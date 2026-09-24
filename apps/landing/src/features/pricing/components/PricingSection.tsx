import { Check } from '@phosphor-icons/react';
import { getAuthUrl } from '@/lib/auth-config';
import type { PricingTranslations } from '../../i18n/types';
import { PRICING_TIERS } from '../data/tiers';
import { buildTierFeatures } from '../lib/build-tier-features';

interface PricingSectionProps {
  t: PricingTranslations;
}

const FEATURED_TIER_ID = 'equipo';

export function PricingSection({ t }: PricingSectionProps) {
  const authUrl = getAuthUrl();

  return (
    <section id="pricing" className="py-24 px-6 max-w-7xl mx-auto" aria-labelledby="pricing-heading">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <h2 id="pricing-heading" className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4 font-sans">
          {t.title}
        </h2>
        <p className="text-base text-zinc-400 leading-relaxed font-sans">{t.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch font-sans">
        {PRICING_TIERS.map((tier) => {
          const copy = t.tiers[tier.id];
          const isFeatured = tier.id === FEATURED_TIER_ID;
          const features = buildTierFeatures(tier, t);

          return (
            <div
              key={tier.id}
              className={
                isFeatured
                  ? 'rounded-xl border border-white/30 bg-zinc-950 p-8 flex flex-col justify-between relative shadow-2xl ring-1 ring-white/20'
                  : 'rounded-xl border border-white/[0.08] bg-zinc-950 p-8 flex flex-col justify-between hover:border-white/20 transition-all'
              }
            >
              {isFeatured ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-0.5 text-[10px] font-semibold text-black uppercase tracking-wider shadow-sm">
                  {t.mostPopularBadge}
                </div>
              ) : null}

              <div>
                <h3 className="text-lg font-semibold text-white mb-1.5">{copy.name}</h3>
                <p className="text-xs text-zinc-400 mb-6 min-h-[32px]">{copy.description}</p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold tracking-tight text-white tabular-nums">
                    ${tier.monthlyPriceUsd}
                  </span>
                  <span className="text-xs text-zinc-500">{t.perMonth}</span>
                </div>

                <ul
                  className={
                    isFeatured
                      ? 'space-y-3 border-t border-white/10 pt-6 mb-8 text-xs text-zinc-200'
                      : 'space-y-3 border-t border-white/[0.06] pt-6 mb-8 text-xs text-zinc-300'
                  }
                >
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5">
                      <Check
                        size={14}
                        weight="bold"
                        className={isFeatured ? 'text-white shrink-0' : 'text-zinc-500 shrink-0'}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href={authUrl}
                className={
                  isFeatured
                    ? 'block w-full text-center py-2.5 px-4 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 active:scale-[0.98] transition-all shadow-md'
                    : 'block w-full text-center py-2.5 px-4 rounded-lg bg-zinc-900 border border-white/10 text-white hover:bg-zinc-800 text-xs font-medium active:scale-[0.98] transition-all'
                }
              >
                {copy.cta}
              </a>

              {tier.id !== 'gratuito' ? (
                <p className="mt-3 text-center text-[11px] text-zinc-500">{t.planUpgradeNote}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
