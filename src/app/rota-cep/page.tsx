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

export default function RotaCepPage() {
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

  const fetchWithAuth = (input: RequestInfo | URL, init?: RequestInit) => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("auth_token") : null;
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  // Filter customers within radius
  const filteredCustomers = useMemo(() => {
    if (!originCoords || customers.length === 0) return [];
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

  const handleLoadCustomers = useCallback(async (coords?: { lat: number; lng: number }, isFromMapClick?: boolean) => {
    const coordsToUse = coords || originCoords;

    if (!origin && !coordsToUse) {
      alert("Por favor, insira um CEP de origem");
      return;
    }

    setIsLoadingCustomers(true);
    try {
      let finalCoords = coordsToUse;
      let cityName = originCity;

      const isMapClick = isFromMapClick === true;

      if (!isMapClick) {
        const cepClean = String(origin).replace(/\D/g, "");
        if (!cepClean) { alert("CEP inválido"); return; }

        const geocodeResponse = await fetch(`/api/geocoding/cep/${cepClean}`);
        const geocodeData = await geocodeResponse.json();

        if (!geocodeResponse.ok || !geocodeData.success) { alert("CEP não encontrado"); return; }

        finalCoords = { lat: geocodeData.lat, lng: geocodeData.lng };
        setOriginCoords(finalCoords);
        setOriginAddress(geocodeData.address || '');
        setOriginCity(`${geocodeData.city || ''} - ${geocodeData.state || ''}`);
        cityName = geocodeData.city || '';
      }

      // Load customers via RBAC-aware endpoint (filters by seller if usuario_vendedor)
      const customersResponse = await fetchWithAuth("/api/dashboard/cliente/cached-search?query=");

      if (!customersResponse.ok) {
        const errData = await customersResponse.json().catch(() => ({}));
        const reason = errData?.error || "Erro ao buscar clientes";
        throw new Error(reason);
      }

      const customersData = await customersResponse.json();

      const realCustomers: MapCustomer[] = [];
      if (customersData.customers && Array.isArray(customersData.customers)) {
        customersData.customers.forEach((item: any) => {
          const c = item.customer ?? item;
          if (c && c.latitude && c.longitude) {
            realCustomers.push({
              id: c.id,
              name: c.name,
              latitude: c.latitude,
              longitude: c.longitude,
              address: c.address,
              city: c.city,
              state: c.state,
              selected: false,
            });
          }
        });
      }

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
            razao_social: (customer as any).razao_social,
            cnpj: (customer as any).cnpj,
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
    if (selectedClients.length === 0) { alert("Selecione ao menos um cliente para otimizar a rota"); return; }
    if (!originCoords) { alert("Por favor, defina um ponto de origem"); return; }

    setIsOptimizingRoute(true);
    try {
      const selectedCustomers = customers.filter((c) => c.selected);
      const waypoints = selectedCustomers.map((customer) => ({
        lat: customer.latitude!,
        lng: customer.longitude!,
        name: customer.name,
        id: customer.id,
      }));

      const response = await fetch("/api/routes/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { lat: originCoords.lat, lng: originCoords.lng, cep: origin },
          waypoints,
          options: { useRealRoutes: true, returnToOrigin: true, algorithm: "nearest-neighbor-2opt" },
        }),
      });

      if (!response.ok) throw new Error("Failed to optimize route");

      const data = await response.json();

      if (data.success && data.route) {
        let routeCoordinates: LatLngTuple[];

        if (data.route.realRoute?.decodedPath && Array.isArray(data.route.realRoute.decodedPath)) {
          routeCoordinates = data.route.realRoute.decodedPath.map(
            (p: { lat: number; lng: number }) => [p.lat, p.lng] as LatLngTuple
          );
        } else if (data.route.realRoute?.coordinates && Array.isArray(data.route.realRoute.coordinates)) {
          routeCoordinates = data.route.realRoute.coordinates;
        } else {
          routeCoordinates = data.route.waypoints.map(
            (wp: { lat: number; lng: number }) => [wp.lat, wp.lng] as LatLngTuple
          );
        }

        setRoutePolyline(routeCoordinates);
      } else {
        throw new Error("Invalid response from optimization API");
      }
    } catch (error) {
      console.error("Error optimizing route:", error);
      alert("Erro ao otimizar rota. Por favor, tente novamente.");
    } finally {
      setIsOptimizingRoute(false);
    }
  }, [selectedClients, customers, originCoords, origin]);

  const handleExportRoute = useCallback(async () => {
    if (selectedClients.length === 0) { alert("Nenhuma rota para exportar"); return; }

    try {
      const jsPDF = (await import("jspdf")).default;
      const doc = new jsPDF();

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = margin;

      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageWidth, 35, "F");

      try {
        const logoImg = await fetch("/logo.png");
        const logoBlob = await logoImg.blob();
        const logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
        doc.addImage(logoBase64, "PNG", 10, 5, 25, 25);
      } catch {
        console.warn("Logo não carregado no PDF");
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("ROTA DE ENTREGA", pageWidth / 2, 22, { align: "center" });

      yPos = 45;
      doc.setTextColor(0, 0, 0);

      const now = new Date();
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`, margin, yPos);
      yPos += 15;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("ORIGEM", margin, yPos);
      yPos += 8;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      if (originAddress) { doc.text(`Endereço: ${originAddress}`, margin, yPos); yPos += 6; }
      if (originCity) { doc.text(`Cidade: ${originCity}`, margin, yPos); yPos += 6; }
      if (originCoords) {
        doc.text(`Coordenadas: ${originCoords.lat.toFixed(6)}, ${originCoords.lng.toFixed(6)}`, margin, yPos);
        yPos += 10;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("ESTATÍSTICAS DA ROTA", margin, yPos);
      yPos += 8;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Total de Paradas: ${stats.stops}`, margin, yPos); yPos += 6;
      doc.text(`Distância Total: ${stats.routeDistance}`, margin, yPos); yPos += 6;
      doc.text(`Tempo Estimado: ${stats.estimatedTime}`, margin, yPos); yPos += 10;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("CLIENTES NA ROTA", margin, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      selectedClients.forEach((client, index) => {
        if (yPos > pageHeight - 40) { doc.addPage(); yPos = margin; }

        doc.setFont("helvetica", "bold");
        doc.text(`${index + 1}. ${client.name}`, margin, yPos);
        yPos += 6;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);

        if (client.razao_social) { doc.text(`   Razão Social: ${client.razao_social}`, margin, yPos); yPos += 5; }
        if (client.cnpj) { doc.text(`   CNPJ: ${client.cnpj}`, margin, yPos); yPos += 5; }

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);

        if (client.address) {
          const lines = doc.splitTextToSize(`   ${client.address}`, pageWidth - 2 * margin);
          doc.text(lines, margin, yPos);
          yPos += lines.length * 5;
        }
        if (client.city || client.state) {
          doc.text(`   ${[client.city, client.state].filter(Boolean).join(" - ")}`, margin, yPos);
          yPos += 5;
        }
        yPos += 3;
      });

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Página ${i} de ${totalPages} - Gerado pelo Sistema de Rotas`, pageWidth / 2, pageHeight - 10, { align: "center" });
      }

      doc.save(`rota-${now.toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF. Por favor, tente novamente.");
    }
  }, [selectedClients, originAddress, originCity, originCoords, stats]);

  const handleClearSelection = useCallback(() => {
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
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      if (data.address) {
        setOriginAddress(data.address.road || data.display_name);
        setOriginCity(`${data.address.city || data.address.town || data.address.village} - ${data.address.state_district || ""}`);
      }
    } catch (error) {
      console.error("Error reverse geocoding:", error);
    }
  }, []);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await fetch(`/api/geocoding/reverse?lat=${lat}&lng=${lng}`);
      if (!response.ok) return;

      const data = await response.json();
      if (data.success && data.cep) {
        setOrigin(data.cep);
        setOriginCoords({ lat, lng });
        setOriginAddress(data.address);
        setOriginCity(data.city ? `${data.city} - ${data.state}` : undefined);
        await handleLoadCustomers({ lat, lng }, true);
      }
    } catch (error) {
      console.error("Error getting CEP from coordinates:", error);
    }
  }, [originCoords, handleLoadCustomers]);

  // Redirect to login if not authenticated
  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/login";
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
                <img src="/logo.png" alt="CIA Máquinas" className="h-12 w-auto" />
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Otimizador de Rotas</h1>
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
                  className={`w-4 h-4 text-slate-500 transition-transform ${showUserMenu ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-[9999]">
                  <div className="py-1">
                    {user.role === "admin" && (
                      <>
                        <button
                          onClick={() => (window.location.href = "/users")}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                          Gerenciar Usuários
                        </button>
                        <div className="border-t border-slate-200"></div>
                      </>
                    )}
                    <button
                      onClick={async () => { setShowUserMenu(false); await signOut(); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
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
          {/* Left Sidebar */}
          <div className="col-span-12 lg:col-span-3 space-y-6 overflow-y-auto">
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

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <RouteStats stats={stats} />
            </div>

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
