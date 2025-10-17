"use client"

interface RouteStatsProps {
  stats: {
    totalClients: number
    clientsInRadius: number
    routeDistance: string
    estimatedTime: string
    stops: number
  }
}

export function RouteStats({ stats }: RouteStatsProps) {
  return (
    <div className="space-y-4">
      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-700">{stats.totalClients.toLocaleString()}</div>
            <div className="text-sm text-blue-600 font-medium">Total de Clientes</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-xl border border-emerald-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-700">{stats.clientsInRadius}</div>
            <div className="text-sm text-emerald-600 font-medium">Clientes no Raio</div>
          </div>
        </div>
      </div>

      {/* Route Summary */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"></div>
          Resumo da Rota
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Distância Total:</span>
            <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
              {stats.routeDistance}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Tempo Estimado:</span>
            <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
              {stats.estimatedTime}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Paradas:</span>
            <div className="flex items-center gap-1">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">{stats.stops}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
