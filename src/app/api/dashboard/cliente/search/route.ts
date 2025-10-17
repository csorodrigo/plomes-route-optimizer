import { NextRequest, NextResponse } from "next/server";
import { ploomesClient } from "@/lib/ploomes-client";
import { rateLimiter } from "@/lib/ploomes-rate-limiter";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }

    console.log(`🔍 Searching for customer: ${query}`);

    // Buscar cliente por nome ou código usando rate limiter
    let customers = await ploomesClient.getContacts({
      filter: `Name eq '${query}' or LegalName eq '${query}' or Register eq '${query}' or CNPJ eq '${query}'`,
      top: 10,
      select: ['Id', 'Name', 'LegalName', 'Email', 'Phones', 'Register', 'CNPJ']
    });

    if (customers.length === 0) {
      // Se não encontrar exato, tentar busca parcial
      customers = await ploomesClient.getContacts({
        filter: `contains(Name, '${query}') or contains(LegalName, '${query}') or contains(Register, '${query}')`,
        top: 10,
        select: ['Id', 'Name', 'LegalName', 'Email', 'Phones', 'Register', 'CNPJ']
      });

      if (customers.length === 0) {
        return NextResponse.json(
          { error: "Cliente não encontrado" },
          { status: 404 }
        );
      }
    }

    console.log(`✅ Found ${customers.length} matching customers`);

    // Para cada cliente encontrado, buscar seus deals e produtos
    const customersWithDeals = await Promise.all(customers.map(async (customer) => {
      try {
        console.log(`🔍 Processing customer: ${customer.Name} (ID: ${customer.Id})`);

        // Use the new helper method that handles the 403 ContactId filter issue
        const deals = await ploomesClient.getDealsForContact(customer.Id, 10);
        console.log(`📦 Found ${deals.length} deals for customer ${customer.Name}`);

        // Se não encontrou deals, ainda retornar o cliente com lista vazia
        if (deals.length === 0) {
          console.log(`⚠️  No deals found for customer ${customer.Name} (ID: ${customer.Id})`);
          return {
            customer: {
              id: customer.Id.toString(),
              name: customer.Name || customer.LegalName || 'Sem nome',
              email: customer.Email || null,
              phone: customer.Phones?.[0]?.PhoneNumber || null,
              cnpj: customer.CNPJ || customer.Register || null
            },
            deals: [],
            summary: {
              totalDeals: 0,
              totalValue: 0,
              avgDealValue: 0
            }
          };
        }

        // Para cada deal, buscar produtos através de Quotes
        const dealsWithProducts = await Promise.all(deals.map(async (deal) => {
          try {
            // Primeiro buscar quotes associadas ao deal
            const quotes = await ploomesClient.getQuotes({
              filter: `DealId eq ${deal.Id}`,
              expand: ['QuoteProducts($expand=Product($select=Id,Name,Code))'],
              select: ['Id', 'Number', 'Amount', 'Status']
            });

            console.log(`📋 Deal ${deal.Id}: Found ${quotes?.length || 0} quotes`);

            let products: any[] = [];

            // Extrair produtos de todas as quotes do deal
            if (quotes && quotes.length > 0) {
              quotes.forEach((quote: any) => {
                if (quote.QuoteProducts && quote.QuoteProducts.length > 0) {
                  const quoteProducts = quote.QuoteProducts.map((qp: any) => ({
                    product_id: qp.Product?.Id || qp.ProductId || 'unknown',
                    product_name: qp.Product?.Name || qp.ProductName || 'Produto sem nome',
                    product_code: qp.Product?.Code || qp.ProductCode || '',
                    quantity: qp.Quantity || 0,
                    unit_price: qp.UnitPrice || 0,
                    total: qp.Total || (qp.Quantity * qp.UnitPrice) || 0,
                    discount: qp.Discount || 0,
                    quote_id: quote.Id,
                    quote_number: quote.Number
                  }));
                  products.push(...quoteProducts);
                }
              });
            }

            // Se não encontrar produtos via quotes, tentar método alternativo
            if (products.length === 0) {
              try {
                const dealProductsResponse = await ploomesClient.getDealProducts(deal.Id);
                products = dealProductsResponse.map((product: any) => ({
                  product_id: product.ProductId || product.Product?.Id || 'unknown',
                  product_name: product.Product?.Name || product.ProductName || 'Produto sem nome',
                  product_code: product.Product?.Code || '',
                  quantity: product.Quantity || 0,
                  unit_price: product.UnitPrice || 0,
                  total: product.Total || (product.Quantity * product.UnitPrice) || 0,
                  discount: product.Discount || 0
                }));
              } catch (dealProductError) {
                console.log(`⚠️ No products found for deal ${deal.Id} via fallback method`);
              }
            }

            return {
              deal_id: deal.Id.toString(),
              title: deal.Title || 'Sem título',
              deal_value: deal.Amount || 0,
              created_date: deal.CreatedDate,
              close_date: deal.FinishDate,
              stage_name: 'Em andamento', // TODO: buscar nome real do stage usando StageId
              products: products
            };

          } catch (error) {
            console.error(`❌ Error fetching products for deal ${deal.Id}:`, error);

            // Return deal without products in case of error
            return {
              deal_id: deal.Id.toString(),
              title: deal.Title || 'Sem título',
              deal_value: deal.Amount || 0,
              created_date: deal.CreatedDate,
              close_date: deal.FinishDate,
              stage_name: 'Em andamento',
              products: []
            };
          }
        }));

        // Calculate summary for this customer
        const totalValue = dealsWithProducts.reduce((sum, deal) => sum + deal.deal_value, 0);
        const avgDealValue = dealsWithProducts.length > 0 ? totalValue / dealsWithProducts.length : 0;

        return {
          customer: {
            id: customer.Id.toString(),
            name: customer.Name || customer.LegalName || 'Sem nome',
            email: customer.Email || null,
            phone: customer.Phones?.[0]?.PhoneNumber || null,
            cnpj: customer.CNPJ || customer.Register || null
          },
          deals: dealsWithProducts,
          summary: {
            totalDeals: dealsWithProducts.length,
            totalValue: totalValue,
            avgDealValue: avgDealValue
          }
        };

      } catch (error) {
        console.error(`❌ Error processing customer ${customer.Name}:`, error);

        // Return customer without deals in case of error
        return {
          customer: {
            id: customer.Id.toString(),
            name: customer.Name || customer.LegalName || 'Sem nome',
            email: customer.Email || null,
            phone: customer.Phones?.[0]?.PhoneNumber || null,
            cnpj: customer.CNPJ || customer.Register || null
          },
          deals: [],
          summary: {
            totalDeals: 0,
            totalValue: 0,
            avgDealValue: 0
          }
        };
      }
    }));

    // Formatar resposta final com todos os clientes
    const response = {
      customers: customersWithDeals,
      query: query,
      total: customersWithDeals.length,
      summary: {
        totalCustomers: customersWithDeals.length,
        totalDeals: customersWithDeals.reduce((sum, c) => sum + c.summary.totalDeals, 0),
        totalValue: customersWithDeals.reduce((sum, c) => sum + c.summary.totalValue, 0),
        avgCustomerValue: customersWithDeals.length > 0 ?
          customersWithDeals.reduce((sum, c) => sum + c.summary.totalValue, 0) / customersWithDeals.length : 0
      }
    };

    console.log(`✅ Returning data for ${customersWithDeals.length} customers with ${response.summary.totalDeals} total deals`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error searching customer:', error);

    // Handle specific API errors
    if (error instanceof Error) {
      // Handle 403 Forbidden errors
      if (error.message.includes('403')) {
        return NextResponse.json(
          {
            error: 'Acesso negado à API do Ploomes',
            details: 'Verifique as permissões da API Key ou tente novamente mais tarde'
          },
          { status: 403 }
        );
      }

      // Handle rate limit errors
      if (error.message.includes('429')) {
        return NextResponse.json(
          {
            error: 'Muitas requisições à API do Ploomes',
            details: 'Aguarde um momento e tente novamente'
          },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Erro ao buscar cliente',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}