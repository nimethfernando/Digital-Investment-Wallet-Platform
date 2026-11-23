import React, { useState } from 'react';
import {
  Calendar,
  Download,
  FileSpreadsheet,
  FileCode,
  Printer,
  X,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { DateFilterPreset } from '../lib/useDateRangeFilter';

export interface ListingDateFilterAndExportProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (d: string) => void;
  onEndDateChange: (d: string) => void;
  activePreset?: DateFilterPreset;
  onPresetSelect?: (preset: DateFilterPreset) => void;
  onClear: () => void;
  isFiltered?: boolean;
  totalFilteredCount?: number;
  totalOriginalCount?: number;
  onExportCsv?: () => void;
  onExportJson?: () => void;
  onPrintPdf?: () => void;
  exportLoading?: boolean;
  itemLabel?: string;
  className?: string;
}

export const ListingDateFilterAndExport: React.FC<ListingDateFilterAndExportProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  activePreset = 'ALL',
  onPresetSelect,
  onClear,
  isFiltered = false,
  totalFilteredCount,
  totalOriginalCount,
  onExportCsv,
  onExportJson,
  onPrintPdf,
  exportLoading = false,
  itemLabel = 'records',
  className = '',
}) => {
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  const presets: Array<{ id: DateFilterPreset; label: string }> = [
    { id: 'ALL', label: 'All Time' },
    { id: 'TODAY', label: 'Today' },
    { id: '7D', label: 'Last 7D' },
    { id: '30D', label: 'Last 30D' },
    { id: 'MONTH', label: 'This Month' },
  ];

  return (
    <div
      className={`p-3 sm:p-4 rounded-2xl bg-slate-900/80 dark:bg-slate-950/70 border border-slate-800 text-xs space-y-3 ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Date Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-slate-300 font-bold uppercase text-[10px] tracking-wider mr-0.5">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>Date Filter:</span>
          </div>

          {/* Quick Presets */}
          {onPresetSelect && (
            <div className="inline-flex rounded-xl bg-slate-950 dark:bg-slate-900 p-0.5 border border-slate-800 text-[11px]">
              {presets.map((p) => {
                const isSelected = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPresetSelect(p.id)}
                    className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* From Date - To Date Inputs */}
          <div className="flex items-center gap-1.5 bg-slate-950 dark:bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="bg-transparent text-white text-xs font-mono outline-none cursor-pointer"
            />
            <span className="text-slate-600">→</span>
            <span className="text-[10px] font-bold uppercase text-slate-400">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="bg-transparent text-white text-xs font-mono outline-none cursor-pointer"
            />
          </div>

          {/* Clear Button (if active) */}
          {(isFiltered || startDate || endDate) && (
            <button
              type="button"
              onClick={onClear}
              className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Clear date range filter"
            >
              <X className="w-3 h-3" />
              <span>Clear Filter</span>
            </button>
          )}

          {/* Item count status badge */}
          {totalFilteredCount !== undefined && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
              <span>Matching:</span>
              <strong className="text-white font-bold">{totalFilteredCount.toLocaleString()}</strong>
              {totalOriginalCount !== undefined && totalOriginalCount !== totalFilteredCount && (
                <span className="text-slate-500">(of {totalOriginalCount.toLocaleString()})</span>
              )}
              <span>{itemLabel}</span>
            </span>
          )}
        </div>

        {/* Right: Export Actions */}
        <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              disabled={exportLoading}
              className="px-3 py-1.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              title="Export filtered records to Microsoft Excel / CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV (Excel)</span>
            </button>
          )}

          {/* Secondary Export Dropdown (JSON, Print/PDF) */}
          {(onExportJson || onPrintPdf) && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                title="More export options"
              >
                <span>Export As</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {exportDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setExportDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95">
                    {onPrintPdf && (
                      <button
                        type="button"
                        onClick={() => {
                          setExportDropdownOpen(false);
                          onPrintPdf();
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Print / Save as PDF</span>
                      </button>
                    )}
                    {onExportJson && (
                      <button
                        type="button"
                        onClick={() => {
                          setExportDropdownOpen(false);
                          onExportJson();
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <FileCode className="w-3.5 h-3.5 text-amber-400" />
                        <span>Audit JSON Report</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListingDateFilterAndExport;
