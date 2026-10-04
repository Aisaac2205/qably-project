import { parseRunsTab } from '@/features/runs/lib/runs-tab'
import { RunListPageClient } from './client'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string | string[] }>
}

export default async function RunsListPage({ params, searchParams }: Props) {
  const { id } = await params
  const { tab } = await searchParams
  return <RunListPageClient projectId={id} initialTab={parseRunsTab(tab)} />
}
