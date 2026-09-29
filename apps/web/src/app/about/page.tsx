'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import {
  Building2,
  ShieldCheck,
  Globe,
  Users,
  CheckCircle2,
} from 'lucide-react';

interface Leader {
  name: string;
  role: string;
  bio: string;
  linkedin?: string;
  showLinkedin?: boolean;
}

export default function AboutPage() {
  const [leadership, setLeadership] = useState<Leader[]>([]);

  useEffect(() => {
    api.get('/cms/sections/ABOUT')
      .then((res) => {
        if (res.data.sections) {
          const leaderSection = res.data.sections.find((s: any) => s.section === 'LEADERSHIP');
          if (leaderSection && leaderSection.metadata) {
            try {
              setLeadership(JSON.parse(leaderSection.metadata));
            } catch (e) {
              // Ignore
            }
          }
        }
      })
      .catch((e) => console.log('About CMS fetch:', e));
  }, []);

  const defaultLeaders: Leader[] = [
    {
      name: 'David Beridze',
      role: 'Managing Partner & Head of Treasury',
      bio: 'Former senior treasury officer at major Georgian financial institutions with 15+ years overseeing foreign exchange and structured liquidity desk operations.',
      linkedin: 'https://linkedin.com',
      showLinkedin: true,
    },
    {
      name: 'Elena Rostova',
      role: 'Chief Compliance & Risk Officer',
      bio: 'International compliance counsel specializing in VASP regulatory frameworks, AML/CFT risk governance, and National Bank of Georgia virtual asset policies.',
      linkedin: 'https://linkedin.com',
      showLinkedin: true,
    },
    {
      name: 'Arjun Mehta',
      role: 'Director of Quantitative Strategies',
      bio: 'Quantitative researcher and former algorithmic trader focusing on crypto-fiat settlement spreads and institutional order routing.',
      linkedin: 'https://linkedin.com',
      showLinkedin: true,
    },
  ];

  const leadersToShow = leadership.length > 0 ? leadership : defaultLeaders;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-20">
      
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold">
          <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Institutional Heritage</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          About Nexis Global
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
          Bridging traditional treasury risk management and digital asset liquidity with immutable double-entry precision and dedicated physical counter services in Tbilisi, Georgia.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Strict Ledger Discipline</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            All customer balances and investment allocations are governed by an append-only double-entry engine. Every penny is accounted for with zero floating-point approximation.
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Globe className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Cross-Border Eurasian Desk</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Operating from Tbilisi, Georgia—one of the world's most progressive virtual asset jurisdictions—we facilitate high-volume liquidity corridors across Europe, Asia, and the Caucasus.
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Physical Counter Settlement</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Unlike anonymous crypto websites, we welcome our clients to our physical counter in Tbilisi for in-person consultations, identity verification, and cash disbursements.
          </p>
        </div>
      </div>

      <div className="space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            Executive Governance
          </h2>
          <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            Leadership & Advisory
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Experienced professionals in treasury operations, banking compliance, and algorithmic trading.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {leadersToShow.map((member, idx) => (
            <div
              key={idx}
              className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white text-xl font-bold">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h4 className="font-bold text-lg text-slate-900 dark:text-white">{member.name}</h4>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{member.role}</p>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {member.bio}
                </p>
              </div>

              {member.showLinkedin && member.linkedin && (
                <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                    </svg>
                    <span>View LinkedIn Profile</span>
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
