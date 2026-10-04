import { parseSuiteParam } from '@/features/runs/lib/suite-param'
import { NewRunPageClient } from './client'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ suite?: string | string[] }>
}

export default async function NewRunPage({ params, searchParams }: Props) {
  const { id } = await params
  const { suite } = await searchParams
  return <NewRunPageClient projectId={id} initialSuiteId={parseSuiteParam(suite)} />
}
