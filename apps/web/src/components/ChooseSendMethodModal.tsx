'use client';

import React from 'react';
import {
  X,
  Globe,
  Landmark,
  Users,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface ChooseSendMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectInternational: () => void;
  onSelectAvoraUser: () => void;
}

export const ChooseSendMethodModal: React.FC<ChooseSendMethodModalProps> = ({
  isOpen,
  onClose,
  onSelectInternational,
  onSelectAvoraUser,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-t-[32px] sm:rounded-3xl p-6 pb-8 sm:pb-6 space-y-5 text-slate-900 dark:text-white shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 select-none">
        
        {/* Mobile Pull Indicator */}
        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-800 rounded-full mx-auto -mt-2 mb-2 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
            Choose a method
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Promo Graphic Banner matching RedotPay Screenshot */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-slate-50 to-sky-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border border-slate-200/90 dark:border-slate-800/90 relative overflow-hidden flex items-center justify-between shadow-inner">
          <div className="space-y-1 pr-3 z-10 max-w-[65%]">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
              Send to anyone
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
              You can now send USD, EUR to friends and family!
            </p>
          </div>

          {/* 3D Visual Globe Graphic with floating currency emblems */}
          <div className="relative shrink-0 w-24 h-16 flex items-center justify-center">
            {/* Globe Circle Background */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-slate-200 via-sky-100 to-indigo-100 dark:from-slate-800 dark:via-sky-950 dark:to-indigo-900 border border-slate-300 dark:border-slate-700/60 flex items-center justify-center shadow-lg relative">
              <Globe className="w-7 h-7 text-sky-600 dark:text-sky-400/90 animate-pulse" />
              
              {/* Floating USD badge */}
              <div className="absolute -top-1 -left-2 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-900 dark:text-white shadow-md">
                $
              </div>
              
              {/* Floating EUR badge */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-600 dark:bg-blue-900 border border-blue-400 dark:border-blue-600 flex items-center justify-center text-[9px] font-bold text-white shadow-md">
                €
              </div>
            </div>
          </div>
        </div>

        {/* Transfer Options matching RedotPay */}
        <div className="space-y-3">
          
          {/* OPTION 1: International transfer */}
          <button
            onClick={() => {
              onClose();
              onSelectInternational();
            }}
            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-start gap-3.5 text-left group cursor-pointer shadow-sm active:scale-[0.99]"
          >
            <div className="w-11 h-11 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center shrink-0 text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:border-emerald-500/40 transition-colors shadow-xs">
              <Landmark className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                <span>International transfer</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                Send crypto, receive local currency in a bank account or e-wallet
              </p>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white shrink-0 mt-3.5 group-hover:translate-x-0.5 transition-all" />
          </button>

          {/* OPTION 2: Transfer to Avora Bank user */}
          <button
            onClick={() => {
              onClose();
              onSelectAvoraUser();
            }}
            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-start gap-3.5 text-left group cursor-pointer shadow-sm active:scale-[0.99]"
          >
            <div className="w-11 h-11 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center shrink-0 text-slate-700 dark:text-slate-300 group-hover:text-rose-600 dark:group-hover:text-rose-400 group-hover:border-rose-500/40 transition-colors shadow-xs">
              <Users className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors flex items-center gap-2 flex-wrap">
                <span>Transfer to Avora Bank user</span>
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[9px] font-black uppercase tracking-wider">
                  Zero fees
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                Send instantly using Account Number, QR code, or email
              </p>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white shrink-0 mt-3.5 group-hover:translate-x-0.5 transition-all" />
          </button>

        </div>

      </div>
    </div>
  );
};
