"use client"

import type React from "react"

import { useState } from "react"

export interface ClientListItem {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  color: "blue" | "green" | "red";
}

interface ClientListProps {
  clients: ClientListItem[];
  setClients: (clients: ClientListItem[]) => void;
}

export function ClientList({ clients, setClients }: ClientListProps) {
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = "move";
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedItem === null) return;

    const newClients = [...clients];
    const draggedClient = newClients[draggedItem];

    newClients.splice(draggedItem, 1);
    newClients.splice(dropIndex, 0, draggedClient);

    setClients(newClients);
    setDraggedItem(null);
  }

  const removeClient = (id: string) => {
    setClients(clients.filter((client) => client.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          Clientes Selecionados
          <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-blue-600">{clients.length}</span>
          </div>
        </h3>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {clients.map((client, index) => (
          <div
            key={client.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            className={`group bg-white border border-slate-200 rounded-lg p-3 cursor-move hover:shadow-md transition-all duration-200 ${
              draggedItem === index ? "opacity-50 scale-95" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>

                <div
                  className={`w-3 h-3 rounded-full ${
                    client.color === "blue" ? "bg-blue-500" : client.color === "green" ? "bg-green-500" : "bg-red-500"
                  }`}
                ></div>

                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">{index + 1}</span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{client.name}</p>
                <p className="text-xs text-slate-500">
                  {[client.address, client.city, client.state].filter(Boolean).join(" • ") || "Sem endereço"}
                </p>
              </div>

              <button
                onClick={() => removeClient(client.id)}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 bg-red-50 hover:bg-red-100 rounded-md flex items-center justify-center transition-all duration-200"
              >
                <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {clients.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">Nenhum cliente selecionado</p>
          <p className="text-xs text-slate-400 mt-1">Clique no mapa para adicionar clientes à rota</p>
        </div>
      )}
    </div>
  )
}
