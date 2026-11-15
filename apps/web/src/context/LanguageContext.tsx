'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import en from '../locales/en.json';
import ka from '../locales/ka.json';
import hi from '../locales/hi.json';
import { api } from '../lib/api';

export type Language = 'en' | 'ka' | 'hi';

export const allLanguageNames: Record<Language, { label: string; flag: string }> = {
  en: { label: 'English', flag: '🇬🇧' },
  ka: { label: 'ქართული', flag: '🇬🇪' },
  hi: { label: 'हिन्दी', flag: '🇮🇳' },
};

export const DEFAULT_ENABLED_LANGUAGES: Language[] = ['en', 'ka'];

export const languageNames: Partial<Record<Language, { label: string; flag: string }>> = {
  en: allLanguageNames.en,
  ka: allLanguageNames.ka,
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  enabledLanguages: Language[];
  availableLanguages: Partial<Record<Language, { label: string; flag: string }>>;
  t: (path: string, fallback?: string) => string;
}

const translations: Record<Language, any> = { en, ka, hi };

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [enabledLanguages, setEnabledLanguages] = useState<Language[]>(DEFAULT_ENABLED_LANGUAGES);

  const parseEnabledList = (raw?: string | string[] | null): Language[] => {
    if (!raw) return DEFAULT_ENABLED_LANGUAGES;
    const arr = (Array.isArray(raw) ? raw : String(raw).split(','))
      .map((s) => s.trim().toLowerCase() as Language)
      .filter((s): s is Language => s in allLanguageNames);
    if (!arr.includes('en')) arr.unshift('en');
    return Array.from(new Set(arr));
  };

  useEffect(() => {
    const saved = (localStorage.getItem('avora_lang') || localStorage.getItem('nexis_lang')) as Language | null;
    if (saved && DEFAULT_ENABLED_LANGUAGES.includes(saved)) {
      setLanguageState(saved);
    } else if (saved) {
      setLanguageState('en');
      localStorage.setItem('avora_lang', 'en');
    }

    const syncEnabledLanguages = async () => {
      try {
        const res = await api.get('/cms/settings');
        const rawSetting = res.data?.settings?.system_enabled_languages;
        const activeList = parseEnabledList(rawSetting);
        setEnabledLanguages(activeList);

        const currentSaved = (localStorage.getItem('avora_lang') || 'en') as Language;
        if (activeList.includes(currentSaved)) {
          setLanguageState(currentSaved);
        } else {
          setLanguageState('en');
          localStorage.setItem('avora_lang', 'en');
        }
      } catch {
        // Keep default enabled languages ('en', 'ka') if offline
      }
    };

    syncEnabledLanguages();

    const handleCustomUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const activeList = parseEnabledList(detail);
      setEnabledLanguages(activeList);
      setLanguageState((prev) => {
        if (activeList.includes(prev)) return prev;
        localStorage.setItem('avora_lang', 'en');
        return 'en';
      });
    };

    window.addEventListener('avora_languages_updated', handleCustomUpdate);
    return () => window.removeEventListener('avora_languages_updated', handleCustomUpdate);
  }, []);

  const availableLanguages = useMemo(() => {
    const map: Partial<Record<Language, { label: string; flag: string }>> = {};
    for (const code of enabledLanguages) {
      map[code] = allLanguageNames[code];
    }
    return map;
  }, [enabledLanguages]);

  const setLanguage = (lang: Language) => {
    const target = enabledLanguages.includes(lang) ? lang : 'en';
    setLanguageState(target);
    localStorage.setItem('avora_lang', target);
  };

  const t = (path: string, fallback = ''): string => {
    const keys = path.split('.');
    let current: any = translations[language];

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        let fallbackVal: any = translations['en'];
        for (const fbKey of keys) {
          if (fallbackVal && typeof fallbackVal === 'object' && fbKey in fallbackVal) {
            fallbackVal = fallbackVal[fbKey];
          } else {
            return fallback || path;
          }
        }
        return typeof fallbackVal === 'string' ? fallbackVal : fallback || path;
      }
    }

    return typeof current === 'string' ? current : fallback || path;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, enabledLanguages, availableLanguages, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
