import { Check } from '@phosphor-icons/react';
import { getAuthUrl } from '@/lib/auth-config';
import type { PricingTranslations } from '../../i18n/types';
import { PRICING_TIERS } from '../data/tiers';
import { buildTierFeatures } from '../lib/build-tier-features';

interface PricingSectionProps {
  t: PricingTranslations;
}

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
          const features = buildTierFeatures(tier, t);

          return (
            <div
              key={tier.id}
              className="rounded-xl border border-white/[0.08] bg-zinc-950 p-8 flex flex-col justify-between hover:border-white/20 transition-all"
            >
              <div>
                <h3 className="text-lg font-semibold text-white mb-1.5">{copy.name}</h3>
                <p className="text-xs text-zinc-400 mb-6 min-h-8">{copy.description}</p>

                <ul className="space-y-3 border-t border-white/[0.06] pt-6 mb-8 text-xs text-zinc-300">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5">
                      <Check size={14} weight="bold" className="text-zinc-500 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href={authUrl}
                className="block w-full text-center py-2.5 px-4 rounded-lg bg-zinc-900 border border-white/10 text-white hover:bg-zinc-800 text-xs font-medium active:scale-[0.98] transition-all"
              >
                {copy.cta}
              </a>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-zinc-400 font-sans">{t.planUpgradeNote}</p>
    </section>
  );
}
