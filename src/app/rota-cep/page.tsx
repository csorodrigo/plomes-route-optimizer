"use client";

import { useState, useCallback, useEffect } from "react";
import { MapContainer, type MapCustomer } from "@/components/map-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Search, Loader2, MapPin } from "lucide-react";
import { filterCustomersInRadius } from "@/lib/geo";

interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
  city: string;
  state: string;
  cep?: string;
  provider: string;
  success: boolean;
}

export default function RotaCepPage() {
  const [cepInput, setCepInput] = useState("");
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [originAddress, setOriginAddress] = useState<string>("");
  const [distanceFilter, setDistanceFilter] = useState(10); // km
  const [customers, setCustomers] = useState<MapCustomer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<MapCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reverseGeocodingLoading, setReverseGeocodingLoading] = useState(false);

  // Filter customers by distance whenever origin or distance filter changes
  useEffect(() => {
    if (originCoords && customers.length > 0) {
      const filtered = filterCustomersInRadius(
        customers,
        originCoords,
        distanceFilter
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers([]);
    }
  }, [originCoords, customers, distanceFilter]);

  // Handle CEP search
  const handleCepSearch = async () => {
    if (!cepInput.trim()) {
      setError("Por favor, digite um CEP");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Geocode CEP
      const cep = cepInput.replace(/\D/g, "");
      const response = await fetch(`/api/geocoding/cep/${cep}`);

      if (!response.ok) {
        throw new Error("CEP não encontrado");
      }

      const data: GeocodeResult = await response.json();

      if (!data.success) {
        throw new Error("Não foi possível geocodificar o CEP");
      }

      setOriginCoords({ lat: data.lat, lng: data.lng });
      setOriginAddress(data.address);

      // Search customers nearby
      await searchCustomersNearby(data.lat, data.lng);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar CEP");
    } finally {
      setLoading(false);
    }
  };

  // Handle map click - reverse geocoding
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    // Only allow click if no origin is set
    if (originCoords) {
      return;
    }

    setReverseGeocodingLoading(true);
    setError(null);

    try {
      // Reverse geocode coordinates
      const response = await fetch(`/api/geocoding/reverse?lat=${lat}&lng=${lng}`);

      if (!response.ok) {
        throw new Error("Não foi possível obter o endereço");
      }

      const data: GeocodeResult = await response.json();

      if (!data.success) {
        throw new Error("Não foi possível geocodificar as coordenadas");
      }

      setOriginCoords({ lat, lng });
      setOriginAddress(data.address);

      // Update CEP input if available
      if (data.cep) {
        setCepInput(data.cep);
      }

      // Search customers nearby
      await searchCustomersNearby(lat, lng);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar endereço");
    } finally {
      setReverseGeocodingLoading(false);
    }
  }, [originCoords]);

  // Search customers near coordinates
  const searchCustomersNearby = async (lat: number, lng: number) => {
    try {
      // Fetch all customers (in a real app, you'd filter server-side)
      const response = await fetch("/api/dashboard/cliente/cached-search?query=");

      if (!response.ok) {
        throw new Error("Erro ao buscar clientes");
      }

      const data = await response.json();

      // Convert to MapCustomer format
      const customersData: MapCustomer[] = [];

      if (data.customers && Array.isArray(data.customers)) {
        data.customers.forEach((item: any) => {
          if (item.customer && item.customer.latitude && item.customer.longitude) {
            customersData.push({
              id: item.customer.id,
              name: item.customer.name,
              latitude: item.customer.latitude,
              longitude: item.customer.longitude,
              address: item.customer.address,
              city: item.customer.city,
              state: item.customer.state,
              selected: false,
            });
          }
        });
      }

      setCustomers(customersData);
    } catch (err) {
      console.error("Error fetching customers:", err);
      setError("Erro ao buscar clientes próximos");
    }
  };

  // Handle customer toggle
  const handleToggleCustomer = (id: string) => {
    setCustomers(prev =>
      prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c)
    );
  };

  // Handle origin drag
  const handleOriginDrag = async (lat: number, lng: number) => {
    setOriginCoords({ lat, lng });
    await searchCustomersNearby(lat, lng);
  };

  // Clear all
  const handleClear = () => {
    setOriginCoords(null);
    setOriginAddress("");
    setCepInput("");
    setCustomers([]);
    setFilteredCustomers([]);
    setError(null);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <h1 className="text-2xl font-bold">Busca de Clientes por CEP</h1>
        <p className="text-gray-600 text-sm">
          Digite um CEP ou clique no mapa para buscar clientes próximos
        </p>
      </div>

      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Control Panel */}
        <Card className="w-96 flex flex-col">
          <CardHeader>
            <CardTitle>Controles</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-4 overflow-auto">
            {/* CEP Input */}
            <div>
              <label className="text-sm font-medium mb-2 block">CEP de Origem</label>
              <div className="flex gap-2">
                <Input
                  value={cepInput}
                  onChange={(e) => setCepInput(e.target.value)}
                  placeholder="00000-000"
                  onKeyDown={(e) => e.key === "Enter" && handleCepSearch()}
                  disabled={loading || reverseGeocodingLoading}
                />
                <Button
                  onClick={handleCepSearch}
                  disabled={loading || reverseGeocodingLoading}
                  size="icon"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Origin Address */}
            {originAddress && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs font-medium text-blue-900 mb-1">Endereço de Origem</p>
                <p className="text-sm text-blue-700">{originAddress}</p>
              </div>
            )}

            {/* Distance Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Raio de Busca: {distanceFilter} km
              </label>
              <Slider
                value={[distanceFilter]}
                onValueChange={(value) => setDistanceFilter(value[0])}
                min={1}
                max={50}
                step={1}
                disabled={!originCoords}
              />
            </div>

            {/* Statistics */}
            {originCoords && (
              <div className="space-y-2">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 mb-1">Clientes no Raio</p>
                  <p className="text-2xl font-bold text-gray-900">{filteredCustomers.length}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 mb-1">Total de Clientes</p>
                  <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Instructions */}
            {!originCoords && (
              <div className="p-3 bg-amber-50 rounded-lg">
                <p className="text-xs font-medium text-amber-900 mb-1">
                  <MapPin className="inline h-3 w-3 mr-1" />
                  Dica
                </p>
                <p className="text-xs text-amber-700">
                  Clique em qualquer lugar do mapa para definir o ponto de origem e buscar clientes próximos
                </p>
              </div>
            )}

            {reverseGeocodingLoading && (
              <div className="p-3 bg-blue-50 rounded-lg flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <p className="text-sm text-blue-700">Buscando endereço...</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleClear}
                variant="outline"
                className="flex-1"
                disabled={!originCoords}
              >
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="flex-1 flex flex-col">
          <CardContent className="flex-1 p-0">
            <MapContainer
              originCoords={originCoords}
              customers={filteredCustomers}
              distanceFilter={distanceFilter}
              onToggleCustomer={handleToggleCustomer}
              onOriginDrag={handleOriginDrag}
              onMapClick={handleMapClick}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
