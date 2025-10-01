"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import polyline from "polyline";

import dynamic from "next/dynamic";

import { ControlPanel } from "@/components/control-panel";
import { ClientList, ClientListItem } from "@/components/client-list";
import { RouteStats } from "@/components/route-stats";
import type { LatLngTuple } from "@/components/map-container";
import { apiService, Customer, RouteOptimizationResponse } from "@/lib/api";
import { filterCustomersInRadius } from "@/lib/geo";
import { useRequireAuth } from "@/hooks/useAuth";
import pdfExportService from "@/lib/pdf-export-service";

interface OriginDetails {
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  state?: string;
}

const formatMinutes = (minutes?: number): string => {
  if (!minutes || minutes <= 0) return "--";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hrs}h ${mins > 0 ? `${mins}min` : ""}`.trim();
};

const DynamicMap = dynamic(
  () => import("@/components/map-container").then((mod) => mod.MapContainer),
  { ssr: false }
);

export default function RouteOptimizerPage() {
  const auth = useRequireAuth();
  const [origin, setOrigin] = useState<string>("");
  const [distanceFilter, setDistanceFilter] = useState<number>(25);
  const [originDetails, setOriginDetails] = useState<OriginDetails | null>(null);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [customersInRadius, setCustomersInRadius] = useState<Customer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([]);
  const [wasExplicitlyCleared, setWasExplicitlyCleared] = useState<boolean>(false); // Track if user cleared selection
  const [routeResult, setRouteResult] = useState<RouteOptimizationResponse | null>(null);
  const [routePolyline, setRoutePolyline] = useState<LatLngTuple[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState<boolean>(false);
  const [optimizingRoute, setOptimizingRoute] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: "error" | "info"; message: string } | null>(null);

  // Auto-hide notifications after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const decodeRoutePolyline = useCallback((route: RouteOptimizationResponse) => {
    // Priority 1: Real route decoded path (from Google/OpenRoute APIs)
    if (route.realRoute?.decodedPath?.length) {
      console.log(`🗺️ Using real route with ${route.realRoute.decodedPath.length} path points`);
      return route.realRoute.decodedPath.map(point => [point.lat, point.lng] as LatLngTuple);
    }

    // Priority 2: Real route coordinates (alternative format)
    if (route.realRoute?.coordinates?.length) {
      console.log(`🗺️ Using real route coordinates with ${route.realRoute.coordinates.length} points`);
      return route.realRoute.coordinates as LatLngTuple[];
    }

    // Priority 3: Encoded polyline (needs decoding)
    if (route.polyline) {
      try {
        console.log(`🔍 Decoding polyline string (${route.polyline.length} chars)`);
        const decoded = polyline.decode(route.polyline) as LatLngTuple[];
        console.log(`✅ Decoded polyline to ${decoded.length} points`);
        return decoded;
      } catch (error) {
        console.warn("⚠️ Failed to decode polyline:", error);
      }
    }

    // Priority 4: Root-level polyline
    if (route.realRoute?.polyline) {
      try {
        console.log(`🔍 Decoding realRoute polyline string (${route.realRoute.polyline.length} chars)`);
        const decoded = polyline.decode(route.realRoute.polyline) as LatLngTuple[];
        console.log(`✅ Decoded realRoute polyline to ${decoded.length} points`);
        return decoded;
      } catch (error) {
        console.warn("⚠️ Failed to decode realRoute polyline:", error);
      }
    }

    // Fallback: Straight lines between waypoints
    console.warn(`⚠️ Falling back to straight lines between ${route.waypoints.length} waypoints`);
    return route.waypoints.map(({ lat, lng }) => [lat, lng] as LatLngTuple);
  }, []);

  const loadCustomers = useCallback(async () => {
    if (!origin || origin.trim().length < 8) {
      setNotification({
        type: "error",
        message: "Informe um CEP válido de 8 dígitos para carregar os clientes.",
      });
      return;
    }

    setLoadingCustomers(true);
    setNotification(null);
    // Removed auto-reset of clear flag to prevent auto-selection

    try {
      const geocode = await apiService.geocodeAddress(origin);

      const originData: OriginDetails = {
        lat: geocode.lat,
        lng: geocode.lng,
        address: geocode.address,
        city: geocode.city,
        state: geocode.state,
      };

      setOriginDetails(originData);

      const customerResponse = await apiService.getCustomers();
      const fetchedCustomers = customerResponse.customers ?? [];
      setAllCustomers(fetchedCustomers);

      const filtered = filterCustomersInRadius(fetchedCustomers, originData, distanceFilter);
      setCustomersInRadius(filtered);

      // Preserve already selected customers that are still inside the radius
      setSelectedCustomers((prev) => {
        const prevIds = new Set(prev.map((customer) => customer.id));
        const preserved = filtered.filter((customer) => prevIds.has(customer.id));
        if (preserved.length > 0) {
          return preserved;
        }
        // Don't auto-select any customers - let user choose manually
        return [];
      });

      setRouteResult(null);
      setRoutePolyline([]);

      // Only show notification if customers were found
      if (filtered.length > 0) {
        setNotification({
          type: "info",
          message: `Dados carregados: ${filtered.length} clientes dentro do raio de ${distanceFilter}km.`,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
      setNotification({
        type: "error",
        message: error instanceof Error ? error.message : "Falha ao carregar dados.",
      });
    } finally {
      setLoadingCustomers(false);
    }
  }, [origin, distanceFilter]);

  // Removed automatic initial load since origin starts empty

  useEffect(() => {
    if (!originDetails) return;

    const filtered = filterCustomersInRadius(allCustomers, originDetails, distanceFilter);
    setCustomersInRadius(filtered);

    setSelectedCustomers((prev) => {
      const filteredIds = new Set(filtered.map((customer) => customer.id));
      const preserved = prev.filter((customer) => filteredIds.has(customer.id));
      if (preserved.length === prev.length) {
        return prev;
      }
      if (preserved.length > 0) {
        return preserved;
      }
      return []; // Never auto-select customers
    });
  }, [distanceFilter, originDetails, allCustomers, wasExplicitlyCleared]);

  const handleToggleCustomer = useCallback(
    (customerId: string) => {
      const availableCustomer = customersInRadius.find((customer) => customer.id === customerId);
      if (!availableCustomer) return;

      // Reset the clear flag since user is manually interacting with selections
      setWasExplicitlyCleared(false);

      setSelectedCustomers((prev) => {
        const exists = prev.some((customer) => customer.id === customerId);
        if (exists) {
          return prev.filter((customer) => customer.id !== customerId);
        }
        return [...prev, availableCustomer];
      });
    },
    [customersInRadius]
  );

  const handleOptimizeRoute = useCallback(async () => {
    if (!originDetails) {
      setNotification({ type: "error", message: "Defina uma origem válida antes de otimizar a rota." });
      return;
    }

    if (selectedCustomers.length === 0) {
      setNotification({ type: "error", message: "Selecione ao menos um cliente para otimizar a rota." });
      return;
    }

    setOptimizingRoute(true);
    setNotification(null);

    try {
      const waypoints = selectedCustomers
        .map((customer) => {
          const lat =
            typeof customer.latitude === "number"
              ? customer.latitude
              : typeof customer.lat === "number"
                ? customer.lat
                : undefined;
          const lng =
            typeof customer.longitude === "number"
              ? customer.longitude
              : typeof customer.lng === "number"
                ? customer.lng
                : undefined;

          if (typeof lat !== "number" || typeof lng !== "number") {
            return null;
          }

          return {
            lat,
            lng,
            name: customer.name,
            id: customer.id,
          };
        })
        .filter(Boolean) as Array<{ lat: number; lng: number; name?: string; id?: string }>;

      if (waypoints.length === 0) {
        setNotification({
          type: "error",
          message: "Os clientes selecionados não possuem coordenadas válidas.",
        });
        return;
      }

      const response = await apiService.optimizeRoute(
        { lat: originDetails.lat, lng: originDetails.lng, cep: origin },
        waypoints,
        {
          save: true,
          useRealRoutes: true,
          returnToOrigin: true,
        }
      );

      if (response.success) {
        const route = response.route;
        setRouteResult(route);
        setRoutePolyline(decodeRoutePolyline(route));
        setNotification({
          type: "info",
          message: `Rota otimizada com ${selectedCustomers.length} paradas. Distância estimada ${route.totalDistance.toFixed(
            1
          )}km.`,
        });
      } else {
        setNotification({ type: "error", message: "Não foi possível otimizar a rota no momento." });
      }
    } catch (error) {
      console.error("Erro ao otimizar rota:", error);
      setNotification({
        type: "error",
        message: error instanceof Error ? error.message : "Falha ao otimizar a rota.",
      });
    } finally {
      setOptimizingRoute(false);
    }
  }, [decodeRoutePolyline, origin, originDetails, selectedCustomers]);

  const handleExportRoute = useCallback(async () => {
    if (!routeResult || selectedCustomers.length === 0) {
      setNotification({ type: "error", message: "Gere uma rota antes de exportar." });
      return;
    }

    if (!originDetails) {
      setNotification({ type: "error", message: "Dados da origem não encontrados." });
      return;
    }

    try {
      setNotification({ type: "info", message: "Gerando PDF..." });

      const result = await pdfExportService.generateRouteReport(
        routeResult,
        selectedCustomers,
        originDetails
      );

      if (result.success) {
        setNotification({
          type: "info",
          message: `PDF exportado com sucesso: ${result.filename}`
        });
      } else {
        setNotification({
          type: "error",
          message: result.message || "Falha ao gerar PDF"
        });
      }
    } catch (error) {
      console.error("Error exporting PDF:", error);
      setNotification({
        type: "error",
        message: "Erro ao gerar PDF. Tente novamente."
      });
    }
  }, [routeResult, selectedCustomers, originDetails]);

  const handleClearSelection = useCallback(() => {
    // Clear everything - CEP, distance filter to default, and all selections
    setOrigin("");
    setDistanceFilter(25); // Reset to default 25km
    setOriginDetails(null);
    setAllCustomers([]); // Clear all customers data
    setSelectedCustomers([]); // Clear selected customers (set to ZERO)
    setCustomersInRadius([]); // Clear customers in radius
    setRouteResult(null);
    setRoutePolyline([]);
    setWasExplicitlyCleared(true); // Mark as explicitly cleared by user
    setNotification({ type: "info", message: "Dados limpos. CEP removido, filtro resetado para 25km e clientes zerados." });
  }, []);

  const clientListItems: ClientListItem[] = useMemo(
    () =>
      selectedCustomers.map((customer) => ({
        id: customer.id,
        name: customer.name ?? "Cliente",
        address: customer.address,
        city: customer.city,
        state: customer.state,
        color: "green",
      })),
    [selectedCustomers]
  );

  const mapCustomers = useMemo(
    () =>
      customersInRadius.map((customer) => ({
        id: customer.id,
        name: customer.name ?? "Cliente",
        latitude: customer.latitude ?? customer.lat,
        longitude: customer.longitude ?? customer.lng,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        selected: selectedCustomers.some((selected) => selected.id === customer.id),
      })),
    [customersInRadius, selectedCustomers]
  );

  const stats = useMemo(
    () => ({
      totalClients: allCustomers.length,
      clientsInRadius: customersInRadius.length,
      routeDistance: routeResult?.totalDistance
        ? `${routeResult.totalDistance.toFixed(1)} km`
        : "0 km",
      estimatedTime: formatMinutes(routeResult?.estimatedTime),
      stops: selectedCustomers.length,
    }),
    [allCustomers.length, customersInRadius.length, routeResult, selectedCustomers.length]
  );

  const handleReorderSelected = useCallback(
    (items: ClientListItem[]) => {
      setSelectedCustomers((prev) => {
        const lookup = new Map(prev.map((customer) => [customer.id, customer]));
        const reordered: Customer[] = [];
        items.forEach((item) => {
          const match = lookup.get(item.id);
          if (match) {
            reordered.push(match);
          }
        });
        return reordered;
      });
    },
    []
  );

  const handleOriginDrag = useCallback(async (lat: number, lng: number) => {
    try {
      // Update origin details with new coordinates
      const newOriginDetails: OriginDetails = {
        lat,
        lng,
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        city: "Nova localização",
        state: "",
      };

      setOriginDetails(newOriginDetails);

      // Update CEP field to show coordinates instead
      setOrigin(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);

      // Clear existing route if any
      setRouteResult(null);
      setRoutePolyline([]);

      // Re-filter customers based on new origin
      const filtered = filterCustomersInRadius(allCustomers, newOriginDetails, distanceFilter);
      setCustomersInRadius(filtered);

      // Preserve selected customers that are still in range
      setSelectedCustomers((prev) => {
        const filteredIds = new Set(filtered.map((customer) => customer.id));
        return prev.filter((customer) => filteredIds.has(customer.id));
      });

      setNotification({
        type: "info",
        message: `Origem reposicionada para ${lat.toFixed(4)}, ${lng.toFixed(4)}`
      });

    } catch (error) {
      console.error("Erro ao reposicionar origem:", error);
      setNotification({
        type: "error",
        message: "Erro ao reposicionar origem"
      });
    }
  }, [allCustomers, distanceFilter]);

  // Show loading spinner while authenticating
  if (auth.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Image src="/logo.png" alt="CIA Máquinas" fill sizes="40px" priority className="object-contain p-1.5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Otimizador de Rotas</h1>
              <p className="text-sm text-slate-600">CIA Máquinas • Ploome</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-slate-600">Bem-vindo de volta</p>
              <p className="font-semibold text-slate-900">
                {auth.user?.name || "Dashboard Logístico"}
              </p>
            </div>
            <div className="relative group">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white cursor-pointer">
                <span className="text-sm font-semibold">
                  {auth.user?.name?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div className="absolute right-0 top-12 bg-white shadow-lg rounded-lg border border-slate-200 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-[9999] min-w-48">
                <div className="px-4 py-2 border-b border-slate-200">
                  <p className="font-medium text-slate-900">{auth.user?.name}</p>
                  <p className="text-sm text-slate-500">{auth.user?.email}</p>
                </div>
                <Link
                  href="/users"
                  className="w-full block px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Gerenciar Usuários
                </Link>
                <button
                  onClick={auth.logout}
                  className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>
        {notification && (
          <div
            className={`px-6 py-2 text-sm ${
              notification.type === "error"
                ? "border-t border-red-200 bg-red-50 text-red-600"
                : "border-t border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {notification.message}
          </div>
        )}
      </header>

      <div className="flex h-[calc(100vh-88px)]">
        <div className="flex w-96 flex-col border-r border-slate-200 bg-white">
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            <ControlPanel
              origin={origin}
              setOrigin={setOrigin}
              distanceFilter={distanceFilter}
              setDistanceFilter={setDistanceFilter}
              originAddress={originDetails?.address}
              originCity={
                originDetails?.city
                  ? `${originDetails.city ?? ""}${originDetails?.state ? ` - ${originDetails.state}` : ""}`
                  : undefined
              }
              onLoadCustomers={loadCustomers}
              onOptimizeRoute={handleOptimizeRoute}
              onExportRoute={handleExportRoute}
              onClearSelection={handleClearSelection}
              isLoadingCustomers={loadingCustomers}
              isOptimizingRoute={optimizingRoute}
              selectedCount={selectedCustomers.length}
            />

            <RouteStats stats={stats} />

            <ClientList clients={clientListItems} setClients={handleReorderSelected} />
          </div>
        </div>

        <div className="relative flex-1">
          <DynamicMap
            originCoords={originDetails}
            customers={mapCustomers}
            distanceFilter={distanceFilter}
            onToggleCustomer={handleToggleCustomer}
            onOriginDrag={handleOriginDrag}
            routePolyline={routePolyline}
          />
        </div>
      </div>
    </div>
  );
}
