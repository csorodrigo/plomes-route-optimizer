'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { PricingHistoryModal } from './pricing-modal';

interface CustomerSale {
  id: number;
  ploomes_deal_id: string;
  customer_id: string;
  deal_stage: string;
  deal_value: string | number;
  status: string;
  products: Array<{
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  created_at: string;
  updated_at: string;
}

interface ProductSummary {
  productId: string;
  productName: string;
  category?: string;
  totalQuantity: number;
  totalRevenue: number;
  salesCount: number;
  lastPrice: number;
  lastSaleDate: string;
}

interface CustomerDetail {
  customer: {
    id: string;
    name: string;
    cnpj: string;
    email?: string;
    phone?: string;
  };
  summary: {
    totalRevenue: number;
    totalSales: number;
    avgDealValue: number;
  };
  sales: CustomerSale[];
  products: ProductSummary[];
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<{
    productId: string;
    productName: string;
  } | null>(null);

  useEffect(() => {
    if (customerId) {
      fetchCustomerDetail();
    }
  }, [customerId]);

  const fetchCustomerDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard/customer-sales?customerId=${customerId}`);

      if (!response.ok) {
        throw new Error('Falha ao carregar detalhes do cliente');
      }

      const result = await response.json();
      setData(result.data || result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleProductClick = (productId: string, productName: string) => {
    setSelectedProduct({ productId, productName });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="h-12 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" onClick={() => router.push('/dashboard/customers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Card className="border-red-500 mt-6">
          <CardContent className="pt-6">
            <p className="text-red-500">Erro: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/customers')}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para Clientes
      </Button>

      {/* Customer Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{data.customer.name}</h1>
        <div className="text-gray-600 space-y-1">
          <p>CNPJ: {data.customer.cnpj}</p>
          {data.customer.email && <p>Email: {data.customer.email}</p>}
          {data.customer.phone && <p>Telefone: {data.customer.phone}</p>}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Receita Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.summary?.totalRevenue || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Total de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary?.totalSales || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Valor Médio por Venda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.summary?.avgDealValue || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Histórico de Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Data</th>
                  <th className="text-left py-3 px-4 font-medium">ID da Venda</th>
                  <th className="text-left py-3 px-4 font-medium">Produtos</th>
                  <th className="text-right py-3 px-4 font-medium">Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {data.sales.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      Nenhuma venda registrada
                    </td>
                  </tr>
                ) : (
                  data.sales
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((sale) => {
                    const productNames = sale.products?.map(p => p.product_name) || [];
                    return (
                      <tr key={sale.ploomes_deal_id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 px-4">{formatDate(sale.created_at)}</td>
                        <td className="py-3 px-4">{sale.ploomes_deal_id}</td>
                        <td className="py-3 px-4">
                          {productNames.length === 0 ? (
                            <span className="text-gray-400">Sem produtos</span>
                          ) : productNames.length <= 2 ? (
                            productNames.join(', ')
                          ) : (
                            <>
                              {productNames.slice(0, 2).join(', ')}
                              <span className="text-gray-500 ml-1">
                                + {productNames.length - 2} mais
                              </span>
                            </>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {formatCurrency(parseFloat(sale.deal_value as string) || 0)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Products Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Produto</th>
                  <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Categoria</th>
                  <th className="text-right py-3 px-4 font-medium">Quantidade Total</th>
                  <th className="text-right py-3 px-4 font-medium hidden lg:table-cell">Receita Total</th>
                  <th className="text-right py-3 px-4 font-medium">Último Preço</th>
                </tr>
              </thead>
              <tbody>
                {data.products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      Nenhum produto encontrado
                    </td>
                  </tr>
                ) : (
                  data.products.map((product) => (
                    <tr
                      key={product.productId}
                      onClick={() => handleProductClick(product.productId, product.productName)}
                      className="border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-medium">{product.productName}</td>
                      <td className="py-3 px-4 hidden md:table-cell text-gray-600">
                        {product.category}
                      </td>
                      <td className="py-3 px-4 text-right">{product.totalQuantity}</td>
                      <td className="py-3 px-4 text-right hidden lg:table-cell">
                        {formatCurrency(product.totalRevenue)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {formatCurrency(product.lastPrice)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pricing History Modal */}
      {selectedProduct && (
        <PricingHistoryModal
          customerId={customerId}
          productId={selectedProduct.productId}
          productName={selectedProduct.productName}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
