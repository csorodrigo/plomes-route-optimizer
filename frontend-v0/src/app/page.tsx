"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/AuthContext";
import { filterCustomersInRadius } from "@/lib/geo";

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

  // Filter customers within radius
  const filteredCustomers = useMemo(() => {
    if (!originCoords || customers.length === 0) {
      return [];
    }
    return filterCustomersInRadius(customers, originCoords, distanceFilter);
  }, [customers, originCoords, distanceFilter]);

  // Stats calculation
  const stats = {
    totalClients: customers.length,
    clientsInRadius: filteredCustomers.length,
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

      // Distinguish between map click and manual CEP search
      const isMapClick = coords && !originCoords;

      // If coords were provided from map click, use them directly
      if (isMapClick) {
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

      // Load REAL customers from Supabase via API
      console.log('👥 Loading real customers from database...');
      const customersResponse = await fetch('/api/customers');

      if (!customersResponse.ok) {
        throw new Error('Erro ao buscar clientes');
      }

      const customersData = await customersResponse.json();
      console.log('📦 Customers API response:', customersData);

      // Convert to MapCustomer format
      const realCustomers: MapCustomer[] = [];

      if (customersData.success && Array.isArray(customersData.data)) {
        customersData.data.forEach((customer: any) => {
          if (customer.latitude && customer.longitude) {
            realCustomers.push({
              id: customer.id,
              name: customer.name,
              latitude: customer.latitude,
              longitude: customer.longitude,
              address: customer.full_address || customer.address,
              city: customer.city,
              state: customer.state,
              selected: false,
            });
          }
        });
      }

      console.log('✅ Real customers loaded from Supabase:', realCustomers.length);
      setCustomers(realCustomers);
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

    if (!originCoords) {
      alert("Por favor, defina um ponto de origem");
      return;
    }

    setIsOptimizingRoute(true);
    try {
      console.log('🗺️ Calling /api/routes/optimize...');

      // Get selected customers data
      const selectedCustomers = customers.filter((c) => c.selected);

      // Prepare waypoints for API
      const waypoints = selectedCustomers.map((customer) => ({
        lat: customer.latitude!,
        lng: customer.longitude!,
        name: customer.name,
        id: customer.id
      }));

      console.log('📍 Origin:', originCoords);
      console.log('📍 Waypoints:', waypoints);

      // Call optimization API with real route calculation
      const response = await fetch('/api/routes/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: {
            lat: originCoords.lat,
            lng: originCoords.lng,
            cep: origin
          },
          waypoints: waypoints,
          options: {
            useRealRoutes: true, // Force real routes from Google/OpenRoute
            returnToOrigin: true,
            algorithm: 'nearest-neighbor-2opt'
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to optimize route');
      }

      const data = await response.json();
      console.log('✅ Route optimized:', data);

      if (data.success && data.route) {
        // Check if we got real route data or fallback
        if (data.route.realRoute?.fallback) {
          console.warn('⚠️ Using fallback route (straight lines)');
          alert('Aviso: Usando rota simplificada. Serviço de rotas pode estar indisponível.');
        }

        // Extract coordinates from real route or use fallback
        let routeCoordinates: LatLngTuple[];

        if (data.route.realRoute?.decodedPath && Array.isArray(data.route.realRoute.decodedPath)) {
          // Use decoded path from Google Directions or OpenRoute Service (PREFERRED)
          console.log('🛣️ Using decoded path from routing service');
          console.log('📊 Decoded path points:', data.route.realRoute.decodedPath.length);
          routeCoordinates = data.route.realRoute.decodedPath.map(
            (p: { lat: number; lng: number }) => [p.lat, p.lng] as LatLngTuple
          );
        } else if (data.route.realRoute?.coordinates && Array.isArray(data.route.realRoute.coordinates)) {
          // Alternative format: direct coordinate array
          console.log('🛣️ Using direct coordinates array');
          console.log('📊 Coordinate points:', data.route.realRoute.coordinates.length);
          routeCoordinates = data.route.realRoute.coordinates;
        } else {
          // Fallback to optimized waypoint order (straight lines)
          console.log('⚠️ Falling back to waypoint order (straight lines)');
          routeCoordinates = data.route.waypoints.map(
            (wp: { lat: number; lng: number }) => [wp.lat, wp.lng] as LatLngTuple
          );
        }

        console.log('📍 Final route has', routeCoordinates.length, 'points');
        setRoutePolyline(routeCoordinates);

        console.log('📏 Distance:', data.route.totalDistance, 'km');
        console.log('⏱️ Time:', data.route.estimatedTime, 'min');
      } else {
        throw new Error('Invalid response from optimization API');
      }
    } catch (error) {
      console.error("❌ Error optimizing route:", error);
      alert("Erro ao otimizar rota. Por favor, tente novamente.");
    } finally {
      setIsOptimizingRoute(false);
    }
  }, [selectedClients, customers, originCoords, origin]);

  const handleExportRoute = useCallback(async () => {
    if (selectedClients.length === 0) {
      alert("Nenhuma rota para exportar");
      return;
    }

    try {
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF();

      // Configurações
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = margin;

      // Header com logo
      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 0, pageWidth, 35, 'F');

      // Adicionar logo
      try {
        const logoImg = await fetch('/logo.png');
        const logoBlob = await logoImg.blob();
        const logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
        doc.addImage(logoBase64, 'PNG', 10, 5, 25, 25);
      } catch (e) {
        console.warn('Logo não carregado no PDF');
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('ROTA DE ENTREGA', pageWidth / 2, 22, { align: 'center' });

      yPos = 45;
      doc.setTextColor(0, 0, 0);

      // Data e Hora
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const now = new Date();
      doc.text(`Gerado em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`, margin, yPos);
      yPos += 15;

      // Origem
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ORIGEM', margin, yPos);
      yPos += 8;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      if (originAddress) {
        doc.text(`Endereço: ${originAddress}`, margin, yPos);
        yPos += 6;
      }
      if (originCity) {
        doc.text(`Cidade: ${originCity}`, margin, yPos);
        yPos += 6;
      }
      if (originCoords) {
        doc.text(`Coordenadas: ${originCoords.lat.toFixed(6)}, ${originCoords.lng.toFixed(6)}`, margin, yPos);
        yPos += 10;
      }

      // Estatísticas
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ESTATÍSTICAS DA ROTA', margin, yPos);
      yPos += 8;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total de Paradas: ${stats.stops}`, margin, yPos);
      yPos += 6;
      doc.text(`Distância Total: ${stats.routeDistance}`, margin, yPos);
      yPos += 6;
      doc.text(`Tempo Estimado: ${stats.estimatedTime}`, margin, yPos);
      yPos += 10;

      // Lista de Clientes
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('CLIENTES NA ROTA', margin, yPos);
      yPos += 8;

      // Tabela de clientes
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      selectedClients.forEach((client, index) => {
        // Verificar se precisa de nova página
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = margin;
        }

        // Número e nome
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${client.name}`, margin, yPos);
        yPos += 6;

        doc.setFont('helvetica', 'normal');

        // Endereço completo
        if (client.address) {
          const lines = doc.splitTextToSize(`   ${client.address}`, pageWidth - 2 * margin);
          doc.text(lines, margin, yPos);
          yPos += (lines.length * 5);
        }

        // Cidade e Estado
        if (client.city || client.state) {
          const location = [client.city, client.state].filter(Boolean).join(' - ');
          doc.text(`   ${location}`, margin, yPos);
          yPos += 5;
        }

        yPos += 3; // Espaçamento entre clientes
      });

      // Footer em todas as páginas
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Página ${i} de ${totalPages} - Gerado pelo Sistema de Rotas`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      // Download
      const fileName = `rota-${now.toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Por favor, tente novamente.');
    }
  }, [selectedClients, originAddress, originCity, originCoords, stats]);

  const handleClearSelection = useCallback(() => {
    // Reset EVERYTHING
    setOrigin("");
    setOriginCoords(null);
    setOriginAddress(undefined);
    setOriginCity(undefined);
    setCustomers([]);
    setSelectedClients([]);
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
      <header className="bg-white border-b border-slate-200 shadow-sm relative z-50">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="CIA Máquinas"
                  className="h-12 w-auto"
                />
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
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-[9999]">
                  <div className="py-1">
                    <button
                      onClick={() => window.location.href = "/users"}
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
          <div className="col-span-12 lg:col-span-9 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative z-10">
            <MapContainer
              originCoords={originCoords}
              customers={filteredCustomers}
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
