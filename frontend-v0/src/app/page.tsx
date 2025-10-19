"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/AuthContext";

// Components
import { ControlPanel } from "@/components/control-panel";
import { RouteStats } from "@/components/route-stats";
import { ClientList, ClientListItem } from "@/components/client-list";

// Dynamic import for MapContainer to avoid SSR issues with Leaflet
const MapContainer = dynamic(
  () => import("@/components/map-container").then((mod) => ({ default: mod.MapContainer })),
  { ssr: false }
);

// Types
import type { MapCustomer, LatLngTuple } from "@/components/map-container";

export default function HomePage() {
  const { user, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // State
  const [origin, setOrigin] = useState("");
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [originAddress, setOriginAddress] = useState<string | undefined>(undefined);
  const [originCity, setOriginCity] = useState<string | undefined>(undefined);
  const [distanceFilter, setDistanceFilter] = useState(10);
  const [customers, setCustomers] = useState<MapCustomer[]>([]);
  const [selectedClients, setSelectedClients] = useState<ClientListItem[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isOptimizingRoute, setIsOptimizingRoute] = useState(false);
  const [routePolyline, setRoutePolyline] = useState<LatLngTuple[] | undefined>(undefined);

  // Stats calculation
  const stats = {
    totalClients: customers.length,
    clientsInRadius: customers.filter((c) => c.selected).length,
    routeDistance: routePolyline ? `${(routePolyline.length * 0.5).toFixed(1)} km` : "0 km",
    estimatedTime: routePolyline ? `${Math.ceil(routePolyline.length * 2)} min` : "0 min",
    stops: selectedClients.length,
  };

  // Handlers
  const handleLoadCustomers = useCallback(async (coords?: { lat: number; lng: number }) => {
    // Use provided coords or current origin
    const coordsToUse = coords || originCoords;

    if (!origin && !coordsToUse) {
      alert("Por favor, insira um CEP de origem");
      return;
    }

    setIsLoadingCustomers(true);
    try {
      let finalCoords = coordsToUse;
      let cityName = originCity;
      let stateName = "";

      // If coords were provided (from map click), use them directly
      if (coords) {
        console.log('🎯 Using provided coords from map click:', coords);
        finalCoords = coords;
        // Extract city/state from existing originCity if available
        if (originCity) {
          const parts = originCity.split(' - ');
          cityName = parts[0];
          stateName = parts[1] || "";
        }
      } else {
        // Manual CEP entry - need to fetch coordinates from ViaCEP
        console.log('📝 Manual CEP entry, fetching from ViaCEP:', origin);
        const cepClean = String(origin).replace(/\D/g, "");

        if (!cepClean) {
          alert("CEP inválido");
          return;
        }

        const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cepClean}/json/`);
        const viaCepData = await viaCepResponse.json();

        if (viaCepData.erro) {
          alert("CEP não encontrado");
          return;
        }

        // Geocode address to get coordinates
        const address = `${viaCepData.logradouro}, ${viaCepData.localidade}, ${viaCepData.uf}`;
        const geocodeResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
        );
        const geocodeData = await geocodeResponse.json();

        if (geocodeData.length === 0) {
          alert("Não foi possível geocodificar o endereço");
          return;
        }

        finalCoords = {
          lat: parseFloat(geocodeData[0].lat),
          lng: parseFloat(geocodeData[0].lon),
        };

        setOriginCoords(finalCoords);
        setOriginAddress(viaCepData.logradouro);
        setOriginCity(`${viaCepData.localidade} - ${viaCepData.uf}`);
        cityName = viaCepData.localidade;
        stateName = viaCepData.uf;
      }

      // Load customers from API (mock for now)
      console.log('👥 Generating mock customers around:', finalCoords);
      const mockCustomers: MapCustomer[] = [
        {
          id: "1",
          name: "Cliente A",
          latitude: finalCoords.lat + 0.01,
          longitude: finalCoords.lng + 0.01,
          address: "Rua A, 123",
          city: cityName || "Cidade",
          state: stateName || "UF",
        },
        {
          id: "2",
          name: "Cliente B",
          latitude: finalCoords.lat - 0.01,
          longitude: finalCoords.lng - 0.01,
          address: "Rua B, 456",
          city: cityName || "Cidade",
          state: stateName || "UF",
        },
        {
          id: "3",
          name: "Cliente C",
          latitude: finalCoords.lat + 0.02,
          longitude: finalCoords.lng - 0.02,
          address: "Rua C, 789",
          city: cityName || "Cidade",
          state: stateName || "UF",
        },
      ];

      console.log('✅ Mock customers generated:', mockCustomers.length);
      setCustomers(mockCustomers);
    } catch (error) {
      console.error("Error loading customers:", error);
      alert("Erro ao carregar clientes");
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [origin, originCoords, originCity]);

  const handleToggleCustomer = useCallback((customerId: string) => {
    setCustomers((prev) =>
      prev.map((customer) =>
        customer.id === customerId ? { ...customer, selected: !customer.selected } : customer
      )
    );

    setSelectedClients((prev) => {
      const customer = customers.find((c) => c.id === customerId);
      if (!customer) return prev;

      const isAlreadySelected = prev.some((c) => c.id === customerId);

      if (isAlreadySelected) {
        return prev.filter((c) => c.id !== customerId);
      } else {
        return [
          ...prev,
          {
            id: customer.id,
            name: customer.name,
            address: customer.address,
            city: customer.city,
            state: customer.state,
            color: "green" as const,
          },
        ];
      }
    });
  }, [customers]);

  const handleOptimizeRoute = useCallback(async () => {
    if (selectedClients.length === 0) {
      alert("Selecione ao menos um cliente para otimizar a rota");
      return;
    }

    setIsOptimizingRoute(true);
    try {
      // Mock route optimization - create polyline between points
      const selectedCustomers = customers.filter((c) => c.selected);
      if (originCoords && selectedCustomers.length > 0) {
        const points: LatLngTuple[] = [
          [originCoords.lat, originCoords.lng],
          ...selectedCustomers.map(
            (c) => [c.latitude!, c.longitude!] as LatLngTuple
          ),
          [originCoords.lat, originCoords.lng],
        ];
        setRoutePolyline(points);
      }
    } catch (error) {
      console.error("Error optimizing route:", error);
      alert("Erro ao otimizar rota");
    } finally {
      setIsOptimizingRoute(false);
    }
  }, [selectedClients, customers, originCoords]);

  const handleExportRoute = useCallback(() => {
    if (selectedClients.length === 0) {
      alert("Nenhuma rota para exportar");
      return;
    }

    // Mock export functionality
    const exportData = {
      origin: { address: originAddress, city: originCity, coords: originCoords },
      clients: selectedClients,
      stats,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rota-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedClients, originAddress, originCity, originCoords, stats]);

  const handleClearSelection = useCallback(() => {
    setSelectedClients([]);
    setCustomers((prev) => prev.map((c) => ({ ...c, selected: false })));
    setRoutePolyline(undefined);
  }, []);

  const handleOriginDrag = useCallback(async (lat: number, lng: number) => {
    setOriginCoords({ lat, lng });

    // Reverse geocode to update address
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();

      if (data.address) {
        setOriginAddress(data.address.road || data.display_name);
        setOriginCity(
          `${data.address.city || data.address.town || data.address.village} - ${
            data.address.state_district || ""
          }`
        );
      }
    } catch (error) {
      console.error("Error reverse geocoding:", error);
    }
  }, []);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    console.log('🗺️ Map clicked!', { lat, lng, hasOrigin: !!originCoords });
    console.log('📍 Starting reverse geocoding...');

    // Reverse geocode clicked location to get CEP
    try {
      const response = await fetch(`/api/geocoding/reverse?lat=${lat}&lng=${lng}`);
      console.log('🌐 API response status:', response.status);

      if (!response.ok) {
        console.error("Error fetching address");
        return;
      }

      const data = await response.json();
      console.log('📦 Reverse geocoding data:', data);

      if (data.success && data.cep) {
        console.log('✅ CEP obtained:', data.cep);
        setOrigin(data.cep);
        setOriginCoords({ lat, lng });
        setOriginAddress(data.address);
        setOriginCity(data.city ? `${data.city} - ${data.state}` : undefined);

        // Load customers after getting CEP (pass coords to avoid state delay)
        console.log('👥 Loading customers...');
        await handleLoadCustomers({ lat, lng });
        console.log('✅ Map click complete!');
      } else {
        console.warn('⚠️ No CEP in response:', data);
      }
    } catch (error) {
      console.error("Error getting CEP from coordinates:", error);
    }
  }, [originCoords, handleLoadCustomers]);

  // Redirect to login if not authenticated
  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">
                    Otimizador de Rotas
                  </h1>
                  <p className="text-sm text-slate-500">CIA Máquinas • Ploome</p>
                </div>
              </div>
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                  {user.email?.charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-medium text-slate-900">
                    Bem-vindo, {user.email?.split("@")[0]}
                  </p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <svg
                  className={`w-4 h-4 text-slate-500 transition-transform ${
                    showUserMenu ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    <button
                      onClick={() => alert("Gerenciar Usuários em desenvolvimento")}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                        />
                      </svg>
                      Gerenciar Usuários
                    </button>
                    <div className="border-t border-slate-200"></div>
                    <button
                      onClick={async () => {
                        setShowUserMenu(false);
                        await signOut();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto p-6">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
          {/* Left Sidebar - Control Panel */}
          <div className="col-span-12 lg:col-span-3 space-y-6 overflow-y-auto">
            {/* Control Panel */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <ControlPanel
                origin={origin}
                setOrigin={setOrigin}
                distanceFilter={distanceFilter}
                setDistanceFilter={setDistanceFilter}
                originAddress={originAddress}
                originCity={originCity}
                onLoadCustomers={handleLoadCustomers}
                onOptimizeRoute={handleOptimizeRoute}
                onExportRoute={handleExportRoute}
                onClearSelection={handleClearSelection}
                isLoadingCustomers={isLoadingCustomers}
                isOptimizingRoute={isOptimizingRoute}
                selectedCount={selectedClients.length}
              />
            </div>

            {/* Route Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <RouteStats stats={stats} />
            </div>

            {/* Client List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <ClientList clients={selectedClients} setClients={setSelectedClients} />
            </div>
          </div>

          {/* Right Side - Map */}
          <div className="col-span-12 lg:col-span-9 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <MapContainer
              originCoords={originCoords}
              customers={customers}
              distanceFilter={distanceFilter}
              onToggleCustomer={handleToggleCustomer}
              onOriginDrag={handleOriginDrag}
              routePolyline={routePolyline}
              onMapClick={handleMapClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
