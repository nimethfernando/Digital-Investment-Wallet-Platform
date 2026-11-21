'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationControlsProps {
  currentPage?: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pagination?: {
    page: number;
    totalItems: number;
    pageSize: number;
    setPage: (page: number) => void;
    setPageSize?: (size: number) => void;
    totalPages?: number;
  };
  pageSizeOptions?: number[];
  itemLabel?: string;
  theme?: 'dark' | 'auto';
  className?: string;
}

/**
 * Reusable client-side pagination state helper that safely clamps the active
 * page whenever filtered item counts shrink or pageSize changes.
 */
export function usePagination<T>(items: T[], defaultPageSize = 50) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize: handlePageSizeChange,
    totalItems,
    totalPages,
    pagedItems,
    pageItems: pagedItems,
  };
}

export default function PaginationControls(props: PaginationControlsProps) {
  const currentPage = props.pagination ? props.pagination.page : (props.currentPage ?? 1);
  const totalItems = props.pagination ? props.pagination.totalItems : (props.totalItems ?? 0);
  const pageSize = props.pagination ? props.pagination.pageSize : (props.pageSize ?? 50);
  const onPageChange = props.pagination ? props.pagination.setPage : (props.onPageChange ?? (() => {}));
  const onPageSizeChange = props.pagination?.setPageSize || props.onPageSizeChange;
  const pageSizeOptions = props.pageSizeOptions || [25, 50, 100];
  const itemLabel = props.itemLabel || 'records';
  const theme = props.theme || 'auto';
  const className = props.className || '';

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  if (totalItems === 0) return null;

  const startIndex = (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, totalItems);

  // Build compact page number list (max ~7 buttons with ellipses)
  const pageNumbers: Array<number | 'ellipsis-start' | 'ellipsis-end'> = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (safePage > 3) pageNumbers.push('ellipsis-start');
    const winStart = Math.max(2, safePage - 1);
    const winEnd = Math.min(totalPages - 1, safePage + 1);
    for (let i = winStart; i <= winEnd; i++) pageNumbers.push(i);
    if (safePage < totalPages - 2) pageNumbers.push('ellipsis-end');
    pageNumbers.push(totalPages);
  }

  const isDark = theme === 'dark';
  const containerText = isDark ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400';
  const borderClass = isDark ? 'border-slate-800' : 'border-slate-200 dark:border-slate-800';
  const btnBase = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800';
  const activeBtn = isDark
    ? 'bg-emerald-600 border-emerald-500 text-white'
    : 'bg-slate-900 dark:bg-emerald-600 border-slate-900 dark:border-emerald-500 text-white';
  const strongText = isDark ? 'text-white' : 'text-slate-900 dark:text-white';
  const selectClass = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-200'
    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200';

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t ${borderClass} text-xs ${containerText} ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing <strong className={`font-mono ${strongText}`}>{startIndex}</strong>–
          <strong className={`font-mono ${strongText}`}>{endIndex}</strong> of{' '}
          <strong className={`font-mono ${strongText}`}>{totalItems.toLocaleString()}</strong> {itemLabel}
        </span>

        {onPageSizeChange && (
          <label className="inline-flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className={`px-2 py-1 rounded-lg border font-mono text-[11px] font-bold outline-none cursor-pointer ${selectClass}`}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            className={`px-2.5 py-1.5 rounded-lg border font-bold inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors ${btnBase}`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          {pageNumbers.map((item) =>
            typeof item === 'number' ? (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={`min-w-[28px] px-2 py-1.5 rounded-lg border font-mono text-[11px] font-bold cursor-pointer transition-colors ${
                  item === safePage ? activeBtn : btnBase
                }`}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="px-1 font-mono text-slate-500">
                …
              </span>
            )
          )}

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            className={`px-2.5 py-1.5 rounded-lg border font-bold inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors ${btnBase}`}
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
