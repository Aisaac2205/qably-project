'use client'

import { DashboardPage } from '@/features/dashboard/components/dashboard-page'
import { useTranslation } from '@/lib/i18n'

export default function Page() {
  const { t } = useTranslation()

  return (
    <>
      <h1 className="sr-only">{t('sidebar.dashboard')}</h1>
      <DashboardPage />
    </>
  )
}
