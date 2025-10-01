"use client"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface ControlPanelProps {
  origin: string;
  setOrigin: (value: string) => void;
  distanceFilter: number;
  setDistanceFilter: (value: number) => void;
  originAddress?: string;
  originCity?: string;
  onLoadCustomers: () => void;
  onOptimizeRoute: () => void;
  onExportRoute: () => void;
  onClearSelection: () => void;
  isLoadingCustomers: boolean;
  isOptimizingRoute: boolean;
  selectedCount: number;
}

export function ControlPanel({
  origin,
  setOrigin,
  distanceFilter,
  setDistanceFilter,
  originAddress,
  originCity,
  onLoadCustomers,
  onOptimizeRoute,
  onExportRoute,
  onClearSelection,
  isLoadingCustomers,
  isOptimizingRoute,
  selectedCount,
}: ControlPanelProps) {
  return (
    <div className="space-y-6">
      {/* Origin Section */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-slate-700">Origem</Label>
        <div className="relative">
          <Input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="Digite o CEP de origem"
            className="pr-10 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <button
            onClick={onLoadCustomers}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Buscar origem"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        </div>

        {(originAddress || originCity) && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                {originAddress ?? "Origem localizada"}
              </p>
              {originCity && <p className="text-xs text-blue-700">{originCity}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Distance Filter */}
      <div className="space-y-4">
        <Label className="text-sm font-semibold text-slate-700">Filtro de Distância</Label>
        <div className="px-2">
          <Slider
            value={[distanceFilter]}
            onValueChange={(value) => setDistanceFilter(value[0])}
            max={50}
            min={1}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>1km</span>
            <span className="font-medium text-slate-700">{distanceFilter}km</span>
            <span>50km</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Ações</h3>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="flex items-center gap-2 h-11 bg-transparent"
            onClick={onLoadCustomers}
            disabled={isLoadingCustomers}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
              />
            </svg>
            <span className="text-sm">{isLoadingCustomers ? "Carregando" : "Carregar"}</span>
          </Button>

          <Button
            className="flex items-center gap-2 h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            onClick={onOptimizeRoute}
            disabled={isOptimizingRoute || selectedCount === 0}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-sm">
              {isOptimizingRoute ? "Otimizando" : "Otimizar"}
            </span>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="flex items-center gap-2 h-11 bg-transparent"
            onClick={onExportRoute}
            disabled={selectedCount === 0}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="text-sm">Exportar</span>
          </Button>

          <Button
            variant="destructive"
            className="flex items-center gap-2 h-11"
            onClick={onClearSelection}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span className="text-sm">Limpar</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
