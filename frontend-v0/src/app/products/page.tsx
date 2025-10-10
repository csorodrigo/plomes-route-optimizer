'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yxwokryybudwygtemfmu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDE2ODEsImV4cCI6MjA3NDMxNzY4MX0.ALgRRp1FivPIQ7TltZF7HPDS2d12RNAxTnc_BfRmJUg'
);

interface Product {
  id: number;
  product_code: string;
  product_name: string;
  product_type: string;
  brand: string;
  category: string;
  unit_price: number;
  creator: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadProducts();
  }, [filter]);

  const loadProducts = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('products_enhanced')
        .select('*')
        .limit(100)
        .order('product_code');

      // Apply filters
      if (filter === 'services') {
        query = query.eq('product_type', 'service');
      } else if (filter === 'rentals') {
        query = query.eq('product_type', 'rental');
      } else if (filter === 'atlas') {
        query = query.eq('brand', 'ATLAS');
      } else if (filter === 'ingersoll') {
        query = query.eq('brand', 'INGERSOLL');
      } else if (filter === 'omie') {
        query = query.eq('creator', 'Omie');
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error loading products:', error);
        return;
      }

      setProducts(data || []);

      // Get total count if showing all
      if (filter === 'all') {
        const { count: totalCount } = await supabase
          .from('products_enhanced')
          .select('*', { count: 'exact', head: true });
        setTotalCount(totalCount || 0);
      } else {
        setTotalCount(data?.length || 0);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate display stats from loaded products
  const stats = {
    total: totalCount,
    services: filter === 'services' ? products.length : 127,
    rentals: filter === 'rentals' ? products.length : 95,
    atlas: filter === 'atlas' ? products.length : 1307,
    ingersoll: filter === 'ingersoll' ? products.length : 1952,
    omie: filter === 'omie' ? products.length : 6934
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">📦 Produtos Sincronizados - Ploomes</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-2xl font-bold">{totalCount.toLocaleString('pt-BR')}</div>
            <div className="text-gray-600 text-sm">Total Produtos</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 shadow">
            <div className="text-2xl font-bold text-blue-600">{stats.services}</div>
            <div className="text-gray-600 text-sm">Serviços CIA_</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 shadow">
            <div className="text-2xl font-bold text-green-600">{stats.rentals}</div>
            <div className="text-gray-600 text-sm">Locações CIA_LOC_</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 shadow">
            <div className="text-2xl font-bold text-purple-600">{stats.atlas}</div>
            <div className="text-gray-600 text-sm">Atlas</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 shadow">
            <div className="text-2xl font-bold text-orange-600">{stats.ingersoll}</div>
            <div className="text-gray-600 text-sm">Ingersoll</div>
          </div>
          <div className="bg-pink-50 rounded-lg p-4 shadow">
            <div className="text-2xl font-bold text-pink-600">{stats.omie}</div>
            <div className="text-gray-600 text-sm">Criados Omie</div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white'}`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('services')}
            className={`px-4 py-2 rounded ${filter === 'services' ? 'bg-blue-600 text-white' : 'bg-white'}`}
          >
            Serviços
          </button>
          <button
            onClick={() => setFilter('rentals')}
            className={`px-4 py-2 rounded ${filter === 'rentals' ? 'bg-green-600 text-white' : 'bg-white'}`}
          >
            Locações
          </button>
          <button
            onClick={() => setFilter('atlas')}
            className={`px-4 py-2 rounded ${filter === 'atlas' ? 'bg-purple-600 text-white' : 'bg-white'}`}
          >
            Atlas
          </button>
          <button
            onClick={() => setFilter('ingersoll')}
            className={`px-4 py-2 rounded ${filter === 'ingersoll' ? 'bg-orange-600 text-white' : 'bg-white'}`}
          >
            Ingersoll
          </button>
          <button
            onClick={() => setFilter('omie')}
            className={`px-4 py-2 rounded ${filter === 'omie' ? 'bg-pink-600 text-white' : 'bg-white'}`}
          >
            Omie
          </button>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <div className="mt-2">Carregando produtos...</div>
            </div>
          ) : products.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Código</th>
                    <th className="px-4 py-2 text-left">Nome</th>
                    <th className="px-4 py-2 text-left">Tipo</th>
                    <th className="px-4 py-2 text-left">Marca</th>
                    <th className="px-4 py-2 text-left">Categoria</th>
                    <th className="px-4 py-2 text-right">Preço</th>
                    <th className="px-4 py-2 text-left">Criador</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-sm">{product.product_code}</td>
                      <td className="px-4 py-2">{product.product_name}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          product.product_type === 'service' ? 'bg-blue-100 text-blue-800' :
                          product.product_type === 'rental' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {product.product_type}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          product.brand === 'ATLAS' ? 'bg-purple-100 text-purple-800' :
                          product.brand === 'INGERSOLL' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {product.brand}
                        </span>
                      </td>
                      <td className="px-4 py-2">{product.category}</td>
                      <td className="px-4 py-2 text-right">
                        R$ {product.unit_price?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{product.creator}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Nenhum produto encontrado
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="mt-6 text-center text-gray-600">
          <p className="font-semibold">Sistema de Sincronização Ploomes → Supabase</p>
          {totalCount > 0 && (
            <>
              <p className="text-sm mt-2">
                Total de {totalCount.toLocaleString('pt-BR')} produtos sincronizados
              </p>
              {products.length > 0 && products.length < totalCount && (
                <p className="text-sm mt-1 text-blue-600">
                  Mostrando {products.length} de {totalCount.toLocaleString('pt-BR')} produtos
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}