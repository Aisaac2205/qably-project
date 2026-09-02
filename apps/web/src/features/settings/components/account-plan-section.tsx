'use client'

import Image from 'next/image'
import {
  Buildings,
  Briefcase,
  Users,
  CreditCard,
  Receipt,
  DownloadSimple,
  CheckCircle,
  ArrowUpRight,
} from '@phosphor-icons/react'
import type { Plan } from '@qably/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentOrganization } from '@/features/organizations/hooks/use-current-organization'
import { useTranslation } from '@/lib/i18n'

const planIcons: Record<Plan, typeof Briefcase> = {
  gratuito: Briefcase,
  equipo: Users,
  empresa: Buildings,
}

const mockInvoices = [
  { id: 'INV-2026-003', date: '2026-06-01', amount: '$49.00 USD' },
  { id: 'INV-2026-002', date: '2026-05-01', amount: '$49.00 USD' },
  { id: 'INV-2026-001', date: '2026-04-01', amount: '$49.00 USD' },
]

export function AccountPlanSection() {
  const { organization, isLoading } = useCurrentOrganization()
  const { t } = useTranslation()

  if (isLoading || !organization) {
    return (
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  const PlanIcon = planIcons[organization.plan]

  const features = [
    t('settings.accountPlan.featureParallel'),
    t('settings.accountPlan.featureAi'),
    t('settings.accountPlan.featureTrace'),
    t('settings.accountPlan.featureIntegrations'),
  ]

  return (
    <div className="space-y-5">
      {/* Plan & Subscription Card */}
      <section
        className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-2xs"
        aria-labelledby="account-plan-heading"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2.5">
              <h2 id="account-plan-heading" className="text-base font-semibold tracking-tight text-default">
                {t('settings.accountPlan.title')}
              </h2>
              <Badge variant="default" className="gap-1.5 px-2.5 py-0.5 text-xs font-semibold">
                <PlanIcon size={12} weight="bold" aria-hidden="true" />
                <span>{t(`settings.accountPlan.${organization.plan}`)}</span>
              </Badge>
              <span className="inline-flex items-center gap-1 rounded-md bg-pass-bg px-2 py-0.5 text-[11px] font-semibold text-pass">
                {t('settings.accountPlan.active')}
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              {t('settings.accountPlan.description')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="pr-2 text-left sm:text-right border-r border-border/80 hidden sm:block">
              <p className="text-sm font-semibold tracking-tight text-default">
                {t('settings.accountPlan.price')}
              </p>
              <p className="text-[11px] text-muted">
                {t('settings.accountPlan.renewsOn', { date: '01/07/2026' })}
              </p>
            </div>
            <Button size="sm" className="active:scale-[0.98] transition-transform font-semibold">
              {t('settings.accountPlan.upgrade')}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 active:scale-[0.98] transition-transform">
              <span>{t('settings.accountPlan.manageStripe')}</span>
              <ArrowUpRight size={12} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>

      {/* Payment Method & Features 2-column Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Payment Method */}
        <section
          className="rounded-xl border border-border bg-surface p-5 shadow-2xs flex flex-col justify-between"
          aria-labelledby="payment-method-heading"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard size={16} aria-hidden="true" className="text-muted" />
                <h3 id="payment-method-heading" className="text-sm font-semibold text-default">
                  {t('settings.accountPlan.paymentMethod')}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 opacity-80">
                <Image src="/visa.svg" alt="Visa" width={22} height={14} className="object-contain" />
                <Image src="/ma_symbol.svg" alt="Mastercard" width={22} height={14} className="object-contain" />
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">
              {t('settings.accountPlan.paymentMethodDesc')}
            </p>

            <div className="mt-4 rounded-lg border border-border/70 bg-canvas/30 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Image src="/visa.svg" alt="Visa" width={36} height={24} className="shrink-0 object-contain" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-default">
                    {t('settings.accountPlan.cardDetails')}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {t('settings.accountPlan.cardExpiry')} · {t('settings.accountPlan.billingEmail')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 flex justify-end">
            <Button size="sm" variant="outline" className="text-xs active:scale-[0.98] transition-transform">
              {t('settings.accountPlan.updateCard')}
            </Button>
          </div>
        </section>

        {/* Included Features */}
        <section
          className="rounded-xl border border-border bg-surface p-5 shadow-2xs flex flex-col justify-between"
          aria-labelledby="included-features-heading"
        >
          <div>
            <div className="flex items-center gap-2">
              <Receipt size={16} aria-hidden="true" className="text-muted" />
              <h3 id="included-features-heading" className="text-sm font-semibold text-default">
                {t('settings.accountPlan.includedFeatures')}
              </h3>
            </div>
            <p className="mt-1 text-xs text-muted">
              {t('settings.accountPlan.description')}
            </p>

            <ul className="mt-4 space-y-2.5">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 text-xs text-default">
                  <CheckCircle size={14} weight="fill" className="text-pass shrink-0" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* Invoice History Section */}
      <section
        className="rounded-xl border border-border bg-surface p-5 shadow-2xs"
        aria-labelledby="invoices-heading"
      >
        <div className="space-y-0.5 mb-4">
          <h3 id="invoices-heading" className="text-sm font-semibold text-default">
            {t('settings.accountPlan.invoicesTitle')}
          </h3>
          <p className="text-xs text-muted">
            {t('settings.accountPlan.invoicesDesc')}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[420px]">
            <thead>
              <tr className="border-b border-border/80 text-muted">
                <th className="py-2.5 px-3 font-medium">{t('settings.accountPlan.invoiceNumber')}</th>
                <th className="py-2.5 px-3 font-medium">{t('settings.accountPlan.invoiceDate')}</th>
                <th className="py-2.5 px-3 font-medium">{t('settings.accountPlan.invoiceAmount')}</th>
                <th className="py-2.5 px-3 font-medium">{t('settings.accountPlan.invoiceStatus')}</th>
                <th className="py-2.5 px-3 font-medium text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {mockInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-canvas/30 transition-colors">
                  <td className="py-3 px-3 font-semibold text-default">{inv.id}</td>
                  <td className="py-3 px-3 text-muted">{inv.date}</td>
                  <td className="py-3 px-3 text-default font-medium">{inv.amount}</td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 rounded bg-pass-bg px-2 py-0.5 text-[11px] font-semibold text-pass">
                      <CheckCircle size={12} weight="fill" aria-hidden="true" />
                      <span>{t('settings.accountPlan.invoicePaid')}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover hover:underline transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <DownloadSimple size={13} weight="bold" aria-hidden="true" />
                      <span>{t('settings.accountPlan.download')}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
