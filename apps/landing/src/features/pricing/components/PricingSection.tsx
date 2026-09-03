import React, { useState } from 'react';
import { Check } from '@phosphor-icons/react';
import { getAuthUrl } from '@/lib/auth-config';
import type { PricingTranslations } from '../../i18n/types';

interface PricingSectionProps {
  t: PricingTranslations;
}

export function PricingSection({ t }: PricingSectionProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const isAnnual = billingCycle === 'annual';
  const authUrl = getAuthUrl('/projects');

  return (
    <section id="pricing" className="py-24 px-6 max-w-7xl mx-auto" aria-labelledby="pricing-heading">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <h2 id="pricing-heading" className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4 font-sans">
          {t.title}
        </h2>
        <p className="text-base text-zinc-400 leading-relaxed mb-8 font-sans">
          {t.subtitle}
        </p>

        {/* Monthly / Annual Toggle - Monochromatic */}
        <div className="inline-flex items-center bg-zinc-950 border border-white/10 p-1 rounded-lg font-sans">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              !isAnnual ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t.monthly}
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              isAnnual ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>{t.annual}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] font-semibold text-white">
              {t.save20}
            </span>
          </button>
        </div>
      </div>

      {/* 3 Pricing Cards - Flat, Clean, No pill badge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch font-sans">
        {/* Tier 1: Gratuito / Starter */}
        <div className="rounded-xl border border-white/[0.08] bg-zinc-950 p-8 flex flex-col justify-between hover:border-white/20 transition-all">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1.5">{t.planStarterTitle}</h3>
            <p className="text-xs text-zinc-400 mb-6 min-h-[32px]">{t.planStarterDesc}</p>
            
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold tracking-tight text-white tabular-nums">{t.planStarterPrice}</span>
              <span className="text-xs text-zinc-500">/ mes</span>
            </div>

            <ul className="space-y-3 border-t border-white/[0.06] pt-6 mb-8 text-xs text-zinc-300">
              {t.planStarterFeatures.map((feat) => (
                <li key={feat} className="flex items-center gap-2.5">
                  <Check size={14} weight="bold" className="text-zinc-500 shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <a href={authUrl} className="w-full">
            <button
              type="button"
              className="w-full py-2.5 px-4 rounded-lg bg-zinc-900 border border-white/10 text-white hover:bg-zinc-800 text-xs font-medium active:scale-[0.98] transition-all cursor-pointer"
            >
              {t.planStarterCta}
            </button>
          </a>
        </div>

        {/* Tier 2: Equipo / Pro (Standout in crisp white border) */}
        <div className="rounded-xl border border-white/30 bg-zinc-950 p-8 flex flex-col justify-between relative shadow-2xl ring-1 ring-white/20">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-0.5 text-[10px] font-semibold text-black uppercase tracking-wider shadow-sm">
            {t.planProBadge}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-1.5">{t.planProTitle}</h3>
            <p className="text-xs text-zinc-400 mb-6 min-h-[32px]">{t.planProDesc}</p>
            
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold tracking-tight text-white tabular-nums">
                {isAnnual ? t.planProPriceAnnual : t.planProPriceMonthly}
              </span>
              <span className="text-xs text-zinc-500">/ mes facturado {isAnnual ? 'anual' : 'mensual'}</span>
            </div>

            <ul className="space-y-3 border-t border-white/10 pt-6 mb-8 text-xs text-zinc-200">
              {t.planProFeatures.map((feat) => (
                <li key={feat} className="flex items-center gap-2.5">
                  <Check size={14} weight="bold" className="text-white shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <a href={authUrl} className="w-full">
            <button
              type="button"
              className="w-full py-2.5 px-4 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 active:scale-[0.98] transition-all shadow-md cursor-pointer"
            >
              {t.planProCta}
            </button>
          </a>
        </div>

        {/* Tier 3: Empresa / Enterprise (Price set to Custom) */}
        <div className="rounded-xl border border-white/[0.08] bg-zinc-950 p-8 flex flex-col justify-between hover:border-white/20 transition-all">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1.5">{t.planEnterpriseTitle}</h3>
            <p className="text-xs text-zinc-400 mb-6 min-h-[32px]">{t.planEnterpriseDesc}</p>
            
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold tracking-tight text-white tabular-nums">Custom</span>
            </div>

            <ul className="space-y-3 border-t border-white/[0.06] pt-6 mb-8 text-xs text-zinc-300">
              {t.planEnterpriseFeatures.map((feat) => (
                <li key={feat} className="flex items-center gap-2.5">
                  <Check size={14} weight="bold" className="text-zinc-500 shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <a href="mailto:sales@qably.com" className="w-full">
            <button
              type="button"
              className="w-full py-2.5 px-4 rounded-lg bg-zinc-900 border border-white/10 text-white hover:bg-zinc-800 text-xs font-medium active:scale-[0.98] transition-all cursor-pointer"
            >
              {t.planEnterpriseCta}
            </button>
          </a>
        </div>
      </div>
    </section>
  );
}
