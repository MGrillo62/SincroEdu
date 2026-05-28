'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SelectSearchProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function SelectSearch({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar opción...',
  disabled = false,
}: SelectSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Encontrar la etiqueta seleccionada actualmente
  const selectedOption = options.find((opt) => opt.value === value);

  // Escuchar clics fuera para cerrar la lista
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sincronizar campo de búsqueda cuando cambia el valor
  useEffect(() => {
    if (selectedOption) {
      setSearchTerm(selectedOption.label);
    } else {
      setSearchTerm('');
    }
  }, [value, selectedOption]);

  // Filtrar opciones
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (val: string, label: string) => {
    onChange(val);
    setSearchTerm(label);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div className="relative w-full ref-container" ref={containerRef}>
      
      {/* Caja de Input Autocomplete */}
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between pl-3.5 pr-2.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 outline-none transition-all cursor-pointer ${
          isOpen ? 'border-[#6B8E4E] bg-white ring-2 ring-[#6B8E4E]/10 shadow-md' : 'hover:border-slate-350'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (e.target.value === '') {
              onChange('');
            }
          }}
          onClick={(e) => e.stopPropagation()} // Evitar toggles
          className="w-full bg-transparent outline-none text-xs text-[#1C2C35] placeholder-slate-400"
        />

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {value && (
            <button 
              type="button" 
              onClick={handleClear}
              className="p-0.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-[#1C2C35] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Lista Desplegable con Overlay absoluto */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 mt-1.5 max-h-60 bg-white border border-slate-100 rounded-2xl shadow-[0_10px_35px_rgba(28,44,53,0.08)] overflow-y-auto p-1.5 space-y-0.5 z-[100] animate-fade-in">
          
          {/* Indicador de filtro activo */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase border-b border-slate-50 mb-1">
            <Search className="w-3.5 h-3.5" />
            Coincidencias Encontradas
          </div>

          {filteredOptions.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400">
              No se encontraron coincidencias
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value, opt.label)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                    isSelected 
                      ? 'bg-[#6B8E4E] text-white' 
                      : 'hover:bg-slate-50 text-[#1C2C35]/80 hover:text-[#1C2C35]'
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <span className="text-[9px] uppercase font-bold bg-white/20 px-1.5 py-0.5 rounded">Seleccionado</span>}
                </button>
              );
            })
          )}
        </div>
      )}

    </div>
  );
}
