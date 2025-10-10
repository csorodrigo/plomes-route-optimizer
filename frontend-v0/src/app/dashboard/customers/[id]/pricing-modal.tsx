'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { X, AlertTriangle } from 'lucide-react';

interface PricingHistoryEntry {
  date: string;
  price: number;
  quantity: number;
  total: number;
  deal_id: number;
}

interface PricingStats {
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  currentPrice: number;
}

interface PricingHistoryData {
  history: PricingHistoryEntry[];
  stats: PricingStats;
}

interface PricingHistoryModalProps {
  customerId: string;
  productId: string;
  productName: string;
  onClose: () => void;
}

export function PricingHistoryModal({
  customerId,
  productId,
  productName,
  onClose
}: PricingHistoryModalProps) {
  const [data, setData] = useState<PricingHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPricingHistory();
  }, [customerId, productId]);

  const fetchPricingHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/dashboard/product-pricing-history?customerId=${customerId}&productId=${productId}`
      );

      if (!response.ok) {
        throw new Error('Falha ao carregar histórico de preços');
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

  const checkBelowMinimum = (currentPrice: number, minPrice: number) => {
    return currentPrice < minPrice;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">Histórico de Preços</h2>
            <p className="text-gray-600 mt-1">{productName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-4 w-20" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-6 w-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Skeleton className="h-64 w-full" />
            </div>
          ) : error || !data ? (
            <Card className="border-red-500">
              <CardContent className="pt-6">
                <p className="text-red-500">Erro: {error}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-gray-600">
                      Preço Mínimo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(data.stats.minPrice)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-gray-600">
                      Preço Máximo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-red-600">
                      {formatCurrency(data.stats.maxPrice)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-gray-600">
                      Preço Médio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-blue-600">
                      {formatCurrency(data.stats.avgPrice)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-gray-600">
                      Preço Atual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">
                      {formatCurrency(data.stats.currentPrice)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Warning for below minimum price */}
              {checkBelowMinimum(data.stats.currentPrice, data.stats.minPrice) && (
                <Card className="border-yellow-500 bg-yellow-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-yellow-900">
                          Atenção: Preço Abaixo do Mínimo Histórico
                        </p>
                        <p className="text-sm text-yellow-800 mt-1">
                          O preço atual está abaixo do preço mínimo praticado anteriormente.
                          Recomenda-se revisar a precificação antes de confirmar a venda.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* History Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Histórico Detalhado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">Data</th>
                          <th className="text-right py-3 px-4 font-medium">Preço Unitário</th>
                          <th className="text-right py-3 px-4 font-medium">Quantidade</th>
                          <th className="text-right py-3 px-4 font-medium">Total</th>
                          <th className="text-right py-3 px-4 font-medium">ID Venda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.history.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-gray-500">
                              Nenhum histórico de preços encontrado
                            </td>
                          </tr>
                        ) : (
                          data.history.map((entry, index) => (
                            <tr
                              key={index}
                              className={`border-b last:border-0 ${
                                entry.price === data.stats.minPrice
                                  ? 'bg-green-50'
                                  : entry.price === data.stats.maxPrice
                                  ? 'bg-red-50'
                                  : ''
                              }`}
                            >
                              <td className="py-3 px-4">{formatDate(entry.date)}</td>
                              <td className="py-3 px-4 text-right font-medium">
                                {formatCurrency(entry.price)}
                                {entry.price === data.stats.minPrice && (
                                  <span className="ml-2 text-xs text-green-600">(Mín)</span>
                                )}
                                {entry.price === data.stats.maxPrice && (
                                  <span className="ml-2 text-xs text-red-600">(Máx)</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">{entry.quantity}</td>
                              <td className="py-3 px-4 text-right font-medium">
                                {formatCurrency(entry.total)}
                              </td>
                              <td className="py-3 px-4 text-right text-gray-600">
                                #{entry.deal_id}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
}
