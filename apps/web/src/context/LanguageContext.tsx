'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import en from '../locales/en.json';
import ka from '../locales/ka.json';
import hi from '../locales/hi.json';

export type Language = 'en' | 'ka' | 'hi';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, fallback?: string) => string;
}

const translations: Record<Language, any> = { en, ka, hi };

export const languageNames: Record<Language, { label: string; flag: string }> = {
  en: { label: 'English', flag: '🇬🇧' },
  ka: { label: 'ქართული', flag: '🇬🇪' },
  hi: { label: 'हिन्दी', flag: '🇮🇳' },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('nexis_lang') as Language | null;
    if (saved && ['en', 'ka', 'hi'].includes(saved)) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('nexis_lang', lang);
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
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
