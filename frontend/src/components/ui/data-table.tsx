'use client';

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react';

export interface Column<T> {
  accessor: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchAccessor?: keyof T; // Propiedad para filtrar la tabla
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchPlaceholder = 'Buscar...',
  searchAccessor,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Manejar el ordenamiento (Sortable)
  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;
    
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filtrar datos según búsqueda
  const filteredData = React.useMemo(() => {
    if (!searchQuery || !searchAccessor) return data;
    
    return data.filter((row) => {
      const val = row[searchAccessor as string];
      if (val === undefined || val === null) return false;
      return String(val).toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [data, searchQuery, searchAccessor]);

  // Ordenar datos
  const sortedData = React.useMemo(() => {
    const sortableItems = [...filteredData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;

        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  // Renderizar indicador de ordenamiento
  const renderSortIndicator = (col: Column<T>) => {
    if (!col.sortable) return null;
    
    if (sortConfig && sortConfig.key === (col.accessor as string)) {
      return sortConfig.direction === 'asc' ? (
        <ChevronUp className="w-3.5 h-3.5 text-[#6B8E4E]" />
      ) : (
        <ChevronDown className="w-3.5 h-3.5 text-[#6B8E4E]" />
      );
    }
    return <ChevronsUpDown className="w-3.5 h-3.5 text-slate-350" />;
  };

  return (
    <div className="space-y-4">
      
      {/* Barra superior con Buscador */}
      {searchAccessor && (
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white text-xs text-[#1C2C35] placeholder-slate-400 focus:outline-none focus:border-[#6B8E4E] focus:shadow-md transition-all"
          />
        </div>
      )}

      {/* Grilla / Contenedor de la Tabla */}
      <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-inner bg-slate-50/20 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider">
              {columns.map((col) => (
                <th
                  key={col.accessor as string}
                  onClick={() => handleSort(col.accessor as string, col.sortable)}
                  className={`py-3.5 px-5 select-none ${
                    col.sortable ? 'cursor-pointer hover:bg-slate-100 hover:text-[#1C2C35] transition-colors' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {renderSortIndicator(col)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-[#1C2C35]/85 bg-white">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-slate-400">
                  No se encontraron registros.
                </td>
              </tr>
            ) : (
              sortedData.map((row, idx) => (
                <tr key={row.id || idx} className="hover:bg-slate-50/45 transition-colors">
                  {columns.map((col) => (
                    <td key={col.accessor as string} className="py-3 px-5 whitespace-nowrap">
                      {col.render 
                        ? col.render(row) 
                        : (row[col.accessor as string] !== undefined && row[col.accessor as string] !== null)
                          ? String(row[col.accessor as string])
                          : '-'
                      }
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
    </div>
  );
}
