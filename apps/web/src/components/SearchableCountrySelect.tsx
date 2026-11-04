'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, Globe, X } from 'lucide-react';
import { GMT_GLOBAL_COUNTRIES, GmtCountryItem } from '../lib/gmt-countries';

export interface SearchableCountrySelectProps {
  value?: string;
  onChange: (country: { name: string; code: string; flag: string; currency: string }) => void;
  showAllOption?: boolean;
  allOptionLabel?: string;
  placeholder?: string;
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
}

export const SearchableCountrySelect: React.FC<SearchableCountrySelectProps> = ({
  value = 'ALL',
  onChange,
  showAllOption = false,
  allOptionLabel = 'All Countries',
  placeholder = 'Select Country...',
  size = 'md',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Determine current selected item
  const selectedItem = useMemo(() => {
    if (!value || value === 'ALL') {
      return showAllOption
        ? { name: allOptionLabel, code: 'ALL', flag: '🌍', currency: 'USD' }
        : null;
    }
    const upper = value.toUpperCase();
    return (
      GMT_GLOBAL_COUNTRIES.find(
        (c) => c.code.toUpperCase() === upper || c.name.toUpperCase() === upper
      ) || null
    );
  }, [value, showAllOption, allOptionLabel]);

  // Filter countries by query
  const filteredCountries = useMemo(() => {
    if (!query.trim()) return GMT_GLOBAL_COUNTRIES;
    const q = query.toLowerCase().trim();
    return GMT_GLOBAL_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSelect = (item: { name: string; code: string; flag: string; currency: string }) => {
    onChange(item);
    setIsOpen(false);
    setQuery('');
  };

  const isSmall = size === 'sm';

  return (
    <div ref={containerRef} className={`relative inline-block ${isSmall ? 'w-auto min-w-[150px]' : 'w-full'} ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 text-left rounded-xl border transition-all cursor-pointer ${
          isSmall
            ? 'px-3 py-2 text-xs font-bold'
            : 'px-3.5 py-2.5 text-xs font-semibold'
        } ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-900/80 shadow-sm'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {selectedItem ? (
            <>
              <span className="text-base shrink-0">{selectedItem.flag}</span>
              <span className="truncate">{selectedItem.name}</span>
              {selectedItem.code !== 'ALL' && (
                <span className="text-[10px] font-mono text-slate-400 shrink-0 font-bold">
                  ({selectedItem.code})
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-emerald-500' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 z-[80] w-72 sm:w-80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-2.5 space-y-2 animate-in fade-in zoom-in-95">
          {/* Search Input Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries, codes, currencies..."
              className="w-full pl-8 pr-7 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Quick Header */}
          <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Destination Country</span>
            <span>{filteredCountries.length} available</span>
          </div>

          {/* List of Options */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin">
            {/* "All Countries" Option (if enabled) */}
            {showAllOption && (!query.trim() || 'all countries'.includes(query.toLowerCase())) && (
              <button
                type="button"
                onClick={() =>
                  handleSelect({
                    name: allOptionLabel,
                    code: 'ALL',
                    flag: '🌍',
                    currency: 'USD',
                  })
                }
                className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                  value === 'ALL'
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-300 font-bold border border-emerald-500/30'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🌍</span>
                  <span className="font-semibold">{allOptionLabel}</span>
                </div>
                {value === 'ALL' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
              </button>
            )}

            {filteredCountries.length > 0 ? (
              filteredCountries.map((c) => {
                const isSelected =
                  value?.toUpperCase() === c.code.toUpperCase() ||
                  value?.toUpperCase() === c.name.toUpperCase();
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-300 font-bold border border-emerald-500/30'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <span className="text-base shrink-0">{c.flag}</span>
                      <span className="truncate">{c.name}</span>
                      <span className="text-[10px] font-mono text-slate-400 font-semibold shrink-0">
                        ({c.code})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        {c.currency}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 space-y-1">
                <p>No countries matching "{query}"</p>
                <p className="text-[10px] text-slate-500">Try searching by country name or code</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

