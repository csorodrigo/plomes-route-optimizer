"use client";

import { useMemo, useEffect, useRef } from "react";
import { MapContainer as LeafletMap, TileLayer, Marker, Polyline, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";

import { isValidBrazilCoordinates, kmToMeters } from "@/lib/geo";

export type LatLngTuple = [number, number];

const fallbackCenter: LatLngTuple = [-3.7327, -38.5267];

const originIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const customerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const selectedIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

export interface MapCustomer {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  state?: string;
  selected?: boolean;
}

interface MapContainerProps {
  originCoords: { lat: number; lng: number } | null;
  customers: MapCustomer[];
  distanceFilter: number;
  onToggleCustomer: (id: string) => void;
  onOriginDrag?: (lat: number, lng: number) => void;
  routePolyline?: LatLngTuple[];
  onMapClick?: (lat: number, lng: number) => void;
}

// Component to handle map click events using direct Leaflet API
// This approach avoids tree-shaking issues with useMapEvents
function MapClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!onClick || !map) {
      console.warn('⚠️ MapClickHandler: missing onClick or map', { onClick: !!onClick, map: !!map });
      return;
    }

    console.log('✅ MapClickHandler: registering click handler');

    const handleClick = (e: L.LeafletMouseEvent) => {
      console.log('🎯 Map clicked!', e.latlng);
      onClick(e.latlng.lat, e.latlng.lng);
    };

    // Add event listener directly to Leaflet map
    map.on('click', handleClick);

    // Cleanup
    return () => {
      console.log('🧹 MapClickHandler: removing click handler');
      map.off('click', handleClick);
    };
  }, [map, onClick]);

  return null;
}

export function MapContainer({
  originCoords,
  customers,
  distanceFilter,
  onToggleCustomer,
  onOriginDrag,
  routePolyline,
  onMapClick,
}: MapContainerProps) {
  const center = useMemo<LatLngTuple>(() => {
    if (originCoords && isValidBrazilCoordinates(originCoords.lat, originCoords.lng)) {
      return [originCoords.lat, originCoords.lng];
    }

    const fallbackCustomer = customers.find(
      (customer) => typeof customer.latitude === "number" && typeof customer.longitude === "number"
    );

    if (
      fallbackCustomer &&
      isValidBrazilCoordinates(fallbackCustomer.latitude, fallbackCustomer.longitude)
    ) {
      return [fallbackCustomer.latitude!, fallbackCustomer.longitude!];
    }

    return fallbackCenter;
  }, [originCoords, customers]);

  return (
    <div className="relative w-full h-full">
      <LeafletMap
        center={center}
        zoom={12}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Always render MapClickHandler - it handles clicks on the map */}
        {onMapClick && <MapClickHandler onClick={onMapClick} />}

        {originCoords && originCoords.lat !== 0 && originCoords.lng !== 0 && (
          <>
            <Marker
              position={[originCoords.lat, originCoords.lng]}
              icon={originIcon}
              draggable={true}
              eventHandlers={{
                dragend: (event) => {
                  const marker = event.target;
                  const position = marker.getLatLng();
                  if (onOriginDrag && isValidBrazilCoordinates(position.lat, position.lng)) {
                    onOriginDrag(position.lat, position.lng);
                  }
                },
              }}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold text-sm text-slate-800">Origem (Arrastável)</p>
                  <p className="text-xs text-slate-600">
                    {originCoords.lat.toFixed(6)}, {originCoords.lng.toFixed(6)}
                  </p>
                  <p className="text-xs text-slate-500 italic">
                    💡 Arraste para reposicionar
                  </p>
                </div>
              </Popup>
            </Marker>
            <Circle
              center={[originCoords.lat, originCoords.lng]}
              pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.08 }}
              radius={kmToMeters(distanceFilter)}
            />
          </>
        )}

        {customers.map((customer) => {
          if (typeof customer.latitude !== "number" || typeof customer.longitude !== "number") {
            return null;
          }

          const icon = customer.selected ? selectedIcon : customerIcon;

          return (
            <Marker
              key={customer.id}
              position={[customer.latitude, customer.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onToggleCustomer(customer.id),
              }}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold text-sm text-slate-800">{customer.name}</p>
                  <p className="text-xs text-slate-600">
                    {[customer.address, customer.city, customer.state].filter(Boolean).join(" • ")}
                  </p>
                  <button
                    className="mt-1 inline-flex rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                    onClick={() => onToggleCustomer(customer.id)}
                  >
                    {customer.selected ? "Remover da rota" : "Adicionar à rota"}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {routePolyline && routePolyline.length > 0 && (
          <Polyline
            positions={routePolyline}
            pathOptions={{ color: "#22c55e", weight: 5, opacity: 0.85 }}
          />
        )}
      </LeafletMap>

      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md rounded-lg shadow-md border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Legenda</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
            <span className="text-slate-600">Clientes</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span className="text-slate-600">Selecionados</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <span className="text-slate-600">Origem</span>
          </div>
        </div>
      </div>
    </div>
  );
}
