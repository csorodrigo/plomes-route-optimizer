"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Loader2,
  Package,
  TrendingUp,
  Calendar,
  DollarSign,
  Users,
  Award,
  Target,
  BarChart3,
  ShoppingCart,
  X,
  ChevronRight,
  Clock,
  TrendingDown
} from "lucide-react";

interface Product {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  discount?: number;
}

interface Deal {
  deal_id: string;
  title: string;
  deal_value: number;
  created_date: string;
  close_date?: string;
  stage_name: string;
  products: Product[];
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  cnpj?: string;
}

interface PriceHistory {
  product_id: string;
  product_name: string;
  prices: Array<{
    date: string;
    price: number;
    deal_id: string;
    quantity: number;
  }>;
  lastPrice: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
}

interface TopProduct {
  product_name: string;
  total_quantity: number;
  total_value: number;
  deal_count: number;
}

interface MonthlyData {
  month: string;
  count: number;
  value: number;
}

interface CustomerStatistics {
  customer: {
    contactId: number;
    totalDeals: number;
    totalValue: number;
    ranking: number;
    totalCustomers: number;
    percentile: number;
  };
  topCustomers: Array<{
    contactId: number;
    contactName: string;
    dealCount: number;
    totalValue: number;
  }>;
  topProducts: TopProduct[];
  monthlyTrend: MonthlyData[];
  systemTotal: {
    totalDeals: number;
    totalCustomers: number;
    totalValue: number;
  };
}

export default function CustomerDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [statistics, setStatistics] = useState<CustomerStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError("Por favor, digite o nome ou código do cliente");
      return;
    }

    setLoading(true);
    setSearching(true);
    setError(null);
    setShowResults(false);
    setCustomer(null);
    setDeals([]);
    setPriceHistory([]);
    setStatistics(null);

    try {
      const response = await fetch(`/api/dashboard/cliente/cached-search?query=${encodeURIComponent(searchTerm)}`);

      if (!response.ok) {
        throw new Error("Cliente não encontrado");
      }

      const data = await response.json();

      // Check if we got multiple customers (new structure) or single customer (old structure)
      if (data.customers && Array.isArray(data.customers)) {
        // New structure with multiple customers
        setSearchResults(data.customers);
        setShowResults(true);

        if (data.customers.length === 1) {
          // If only one customer found, automatically select it
          handleCustomerSelect(data.customers[0]);
        }
      } else if (data.customer) {
        // Old structure with single customer (fallback)
        const customerData = {
          customer: data.customer,
          deals: data.deals,
          summary: {
            totalDeals: data.deals.length,
            totalValue: data.deals.reduce((sum: number, deal: Deal) => sum + deal.deal_value, 0),
            avgDealValue: data.deals.length > 0 ? data.deals.reduce((sum: number, deal: Deal) => sum + deal.deal_value, 0) / data.deals.length : 0
          }
        };
        setSearchResults([customerData]);
        handleCustomerSelect(customerData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar cliente");
      setSearchResults([]);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  const handleCustomerSelect = async (customerData: any) => {
    try {
      setCustomer(customerData.customer);
      setDeals(customerData.deals);
      setShowResults(false);

      // Processar histórico de preços
      const productPrices = new Map<string, PriceHistory>();

      customerData.deals.forEach((deal: Deal) => {
        deal.products?.forEach((product: Product) => {
          if (!productPrices.has(product.product_id)) {
            productPrices.set(product.product_id, {
              product_id: product.product_id,
              product_name: product.product_name,
              prices: [],
              lastPrice: 0,
              avgPrice: 0,
              minPrice: Infinity,
              maxPrice: 0
            });
          }

          const history = productPrices.get(product.product_id)!;
          history.prices.push({
            date: deal.created_date,
            price: product.unit_price,
            deal_id: deal.deal_id,
            quantity: product.quantity
          });
        });
      });

      // Calcular estatísticas
      const priceHistoryArray = Array.from(productPrices.values()).map(history => {
        // Ordenar por data (mais recente primeiro)
        history.prices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        history.lastPrice = history.prices[0]?.price || 0;
        history.avgPrice = history.prices.reduce((sum, p) => sum + p.price, 0) / history.prices.length;
        history.minPrice = Math.min(...history.prices.map(p => p.price));
        history.maxPrice = Math.max(...history.prices.map(p => p.price));

        return history;
      });

      setPriceHistory(priceHistoryArray);

      // Buscar estatísticas do cliente
      try {
        const statsResponse = await fetch(`/api/dashboard/cliente/statistics?contactId=${customerData.customer.id}`);
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStatistics(statsData);
        }
      } catch (statsErr) {
        console.warn("Erro ao carregar estatísticas:", statsErr);
        // Não exibir erro para o usuário, apenas logs
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar dados do cliente");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(dateString));
  };

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 90) return "bg-green-100 text-green-800";
    if (percentile >= 75) return "bg-blue-100 text-blue-800";
    if (percentile >= 50) return "bg-yellow-100 text-yellow-800";
    if (percentile >= 25) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  const getPercentileText = (percentile: number) => {
    if (percentile >= 90) return "Top 10%";
    if (percentile >= 75) return "Top 25%";
    if (percentile >= 50) return "Top 50%";
    if (percentile >= 25) return "Top 75%";
    return "Bottom 25%";
  };

  const getPriceVariation = (lastPrice: number, avgPrice: number) => {
    const variation = ((lastPrice - avgPrice) / avgPrice) * 100;
    return variation;
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header com Busca */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Dashboard do Cliente</h1>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Input
              placeholder="Digite o nome ou código do cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 pr-10"
              disabled={loading}
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>
          <Button
            onClick={handleSearch}
            disabled={loading}
            className="min-w-[120px]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Buscar
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
            {error}
          </div>
        )}
      </div>

      {/* Search Results - Multiple Customers */}
      {showResults && searchResults.length > 1 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Resultados da Busca</h2>
            <p className="text-gray-600">Encontrados {searchResults.length} clientes para "{searchTerm}"</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((result, index) => (
              <Card
                key={result.customer.id}
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-300"
                onClick={() => handleCustomerSelect(result)}
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-lg">{result.customer.name}</h3>
                      {result.customer.cnpj && (
                        <p className="text-sm text-gray-500">{result.customer.cnpj}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-blue-50 p-2 rounded">
                        <p className="text-xs text-gray-600">Pedidos</p>
                        <p className="font-semibold text-blue-600">{result.summary.totalDeals}</p>
                      </div>
                      <div className="bg-green-50 p-2 rounded">
                        <p className="text-xs text-gray-600">Valor Total</p>
                        <p className="font-semibold text-green-600">{formatCurrency(result.summary.totalValue)}</p>
                      </div>
                    </div>

                    {result.customer.email && (
                      <p className="text-xs text-gray-500 truncate">{result.customer.email}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-gray-500">Clique para ver detalhes</span>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setShowResults(false);
                setSearchTerm("");
              }}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              Nova busca
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {searching && !customer && !showResults && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Procurando cliente...</p>
          </div>
        </div>
      )}

      {/* Informações do Cliente - Clicável */}
      {customer && (
        <Card
          className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-300"
          onClick={() => setShowOrderModal(true)}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                {searchResults.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomer(null);
                      setDeals([]);
                      setPriceHistory([]);
                      setStatistics(null);
                      setShowResults(true);
                    }}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm border border-blue-200 px-3 py-1 rounded"
                  >
                    ← Voltar aos resultados
                  </button>
                )}
                <h2 className="text-xl font-semibold">Informações do Cliente</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Nome</p>
                  <p className="font-semibold">{customer.name}</p>
                </div>
                {customer.email && (
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-semibold">{customer.email}</p>
                  </div>
                )}
                {customer.cnpj && (
                  <div>
                    <p className="text-sm text-gray-500">CNPJ</p>
                    <p className="font-semibold">{customer.cnpj}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-blue-600">
              <span className="text-sm font-medium">Ver histórico de pedidos</span>
              <ChevronRight className="h-5 w-5" />
            </div>
          </div>
        </Card>
      )}

      {/* Modal de Histórico de Pedidos */}
      {showOrderModal && customer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header do Modal */}
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Histórico de Pedidos</h2>
                <p className="text-gray-600">{customer.name}</p>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Resumo Geral */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <Card className="p-4 bg-blue-50">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Total de Pedidos</p>
                      <p className="text-xl font-bold text-blue-600">{deals.length}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 bg-green-50">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">Valor Total</p>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(deals.reduce((sum, deal) => sum + deal.deal_value, 0))}
                      </p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 bg-purple-50">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-600">Produtos Únicos</p>
                      <p className="text-xl font-bold text-purple-600">{priceHistory.length}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 bg-orange-50">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="text-sm text-gray-600">Último Pedido</p>
                      <p className="text-xl font-bold text-orange-600">
                        {deals.length > 0 ? formatDate(deals[0].created_date) : '-'}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Lista de Pedidos com Detalhes */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-3">Pedidos Detalhados</h3>
                {deals.map((deal) => (
                  <Card key={deal.deal_id} className="p-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setSelectedDeal(selectedDeal?.deal_id === deal.deal_id ? null : deal)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-semibold">{deal.title}</p>
                            <p className="text-sm text-gray-500">
                              {formatDate(deal.created_date)} • Deal #{deal.deal_id}
                            </p>
                          </div>
                          <span className={`px-3 py-1 text-xs rounded-full ${
                            deal.stage_name.toLowerCase().includes('ganho') || deal.stage_name.toLowerCase().includes('won')
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {deal.stage_name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Valor Total</p>
                          <p className="text-lg font-bold">{formatCurrency(deal.deal_value)}</p>
                        </div>
                        <ChevronRight
                          className={`h-5 w-5 text-gray-400 transition-transform ${
                            selectedDeal?.deal_id === deal.deal_id ? 'rotate-90' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* Produtos do Pedido - Expandível */}
                    {selectedDeal?.deal_id === deal.deal_id && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-semibold mb-3">Produtos do Pedido</h4>
                        <div className="space-y-2">
                          {deal.products?.map((product, idx) => {
                            const productHistory = priceHistory.find(p => p.product_id === product.product_id);
                            const priceVariation = productHistory ? getPriceVariation(product.unit_price, productHistory.avgPrice) : 0;

                            return (
                              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                  <p className="font-medium">{product.product_name}</p>
                                  <p className="text-sm text-gray-500">
                                    {product.quantity} unidades × {formatCurrency(product.unit_price)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold">{formatCurrency(product.total)}</p>
                                  {productHistory && (
                                    <div className="flex items-center gap-1 text-sm">
                                      {priceVariation > 0 ? (
                                        <>
                                          <TrendingUp className="h-3 w-3 text-red-500" />
                                          <span className="text-red-500">
                                            +{priceVariation.toFixed(1)}% vs média
                                          </span>
                                        </>
                                      ) : priceVariation < 0 ? (
                                        <>
                                          <TrendingDown className="h-3 w-3 text-green-500" />
                                          <span className="text-green-500">
                                            {priceVariation.toFixed(1)}% vs média
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-gray-400">preço médio</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {(!deal.products || deal.products.length === 0) && (
                            <p className="text-sm text-gray-500 italic">Nenhum produto registrado</p>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {/* Análise de Preços por Produto */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Análise de Preços por Produto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {priceHistory.map((product) => (
                    <Card key={product.product_id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-blue-600" />
                          <h4 className="font-semibold">{product.product_name}</h4>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          {product.prices.length} vendas
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-blue-50 p-3 rounded">
                          <p className="text-xs text-gray-600">Último Preço</p>
                          <p className="text-lg font-bold text-blue-600">
                            {formatCurrency(product.lastPrice)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(product.prices[0].date)}
                          </p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-xs text-gray-600">Preço Médio</p>
                          <p className="text-lg font-bold">
                            {formatCurrency(product.avgPrice)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Δ {((product.lastPrice - product.avgPrice) / product.avgPrice * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Mín: {formatCurrency(product.minPrice)}</span>
                          <span className="text-gray-500">Máx: {formatCurrency(product.maxPrice)}</span>
                        </div>
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">Histórico de Preços</p>
                          <div className="flex items-end gap-1 h-12">
                            {product.prices.slice(0, 10).reverse().map((price, idx) => {
                              const height = ((price.price - product.minPrice) / (product.maxPrice - product.minPrice)) * 100;
                              return (
                                <div
                                  key={idx}
                                  className="flex-1 bg-blue-400 rounded-t hover:bg-blue-500 transition-colors"
                                  style={{ height: `${height}%`, minHeight: '4px' }}
                                  title={`${formatCurrency(price.price)} em ${formatDate(price.date)}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estatísticas do Cliente */}
      {statistics && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Estatísticas do Cliente</h2>

          {/* Cards de Estatísticas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total de Deals */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-500">Total de Deals</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {statistics.customer.totalDeals}
                    </p>
                    <p className="text-xs text-gray-500">
                      de {statistics.systemTotal.totalDeals.toLocaleString()} totais
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Valor Total */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-500">Valor Total</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(statistics.customer.totalValue)}
                    </p>
                    <p className="text-xs text-gray-500">
                      de {formatCurrency(statistics.systemTotal.totalValue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ranking */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Award className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-500">Ranking</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {statistics.customer.ranking}º
                    </p>
                    <p className="text-xs text-gray-500">
                      de {statistics.customer.totalCustomers} clientes
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Percentil */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  <div>
                    <p className="text-sm text-gray-500">Posição</p>
                    <span className={`inline-block px-2 py-1 rounded-full text-sm font-semibold ${getPercentileColor(statistics.customer.percentile)}`}>
                      {getPercentileText(statistics.customer.percentile)}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Percentil {statistics.customer.percentile}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Produtos e Tendência Mensal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Produtos */}
            {statistics.topProducts && statistics.topProducts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Top Produtos Comprados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {statistics.topProducts.slice(0, 5).map((product, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{product.product_name}</p>
                          <p className="text-xs text-gray-500">
                            {product.total_quantity} unidades em {product.deal_count} deals
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">
                            {formatCurrency(product.total_value)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tendência Mensal */}
            {statistics.monthlyTrend && statistics.monthlyTrend.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Tendência Mensal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {statistics.monthlyTrend.slice(-6).map((month, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{month.month}</p>
                          <p className="text-xs text-gray-500">{month.count} deals</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">
                            {formatCurrency(month.value)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}