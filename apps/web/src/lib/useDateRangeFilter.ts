import { useState, useMemo } from 'react';

export type DateFilterPreset = 'ALL' | 'TODAY' | '7D' | '30D' | 'MONTH' | '90D' | 'CUSTOM';

export interface UseDateRangeFilterReturn<T> {
  startDate: string;
  endDate: string;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  activePreset: DateFilterPreset;
  setPreset: (preset: DateFilterPreset) => void;
  clearFilter: () => void;
  isFiltered: boolean;
  filteredItems: T[];
  dateRangeText: string;
}

function formatDateToIsoString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Reusable hook to handle From Date - To Date filtering with instant presets across any data array.
 */
export function useDateRangeFilter<T>(
  items: T[],
  getDate: (item: T) => Date | string | number | null | undefined,
  initialPreset: DateFilterPreset = 'ALL'
): UseDateRangeFilterReturn<T> {
  const [startDate, setStartDateState] = useState<string>('');
  const [endDate, setEndDateState] = useState<string>('');
  const [activePreset, setActivePreset] = useState<DateFilterPreset>(initialPreset);

  const setPreset = (preset: DateFilterPreset) => {
    setActivePreset(preset);
    const now = new Date();
    const todayStr = formatDateToIsoString(now);

    if (preset === 'ALL') {
      setStartDateState('');
      setEndDateState('');
    } else if (preset === 'TODAY') {
      setStartDateState(todayStr);
      setEndDateState(todayStr);
    } else if (preset === '7D') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDateState(formatDateToIsoString(past));
      setEndDateState(todayStr);
    } else if (preset === '30D') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDateState(formatDateToIsoString(past));
      setEndDateState(todayStr);
    } else if (preset === 'MONTH') {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDateState(formatDateToIsoString(firstOfMonth));
      setEndDateState(todayStr);
    } else if (preset === '90D') {
      const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      setStartDateState(formatDateToIsoString(past));
      setEndDateState(todayStr);
    }
  };

  const setStartDate = (d: string) => {
    setStartDateState(d);
    setActivePreset('CUSTOM');
  };

  const setEndDate = (d: string) => {
    setEndDateState(d);
    setActivePreset('CUSTOM');
  };

  const clearFilter = () => {
    setStartDateState('');
    setEndDateState('');
    setActivePreset('ALL');
  };

  const isFiltered = Boolean(startDate || endDate);

  const filteredItems = useMemo(() => {
    if (!startDate && !endDate) return items;

    let startMs = -Infinity;
    if (startDate) {
      const [y, m, d] = startDate.split('-').map(Number);
      startMs = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
    }

    let endMs = Infinity;
    if (endDate) {
      const [y, m, d] = endDate.split('-').map(Number);
      endMs = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
    }

    return items.filter((item) => {
      const rawDate = getDate(item);
      if (!rawDate) return false;
      const ts = new Date(rawDate).getTime();
      if (isNaN(ts)) return false;
      return ts >= startMs && ts <= endMs;
    });
  }, [items, getDate, startDate, endDate]);

  const dateRangeText = useMemo(() => {
    if (startDate && endDate) {
      return `${startDate} → ${endDate}`;
    }
    if (startDate) {
      return `From ${startDate}`;
    }
    if (endDate) {
      return `Until ${endDate}`;
    }
    return 'All Recorded Time';
  }, [startDate, endDate]);

  return {
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    activePreset,
    setPreset,
    clearFilter,
    isFiltered,
    filteredItems,
    dateRangeText,
  };
}
