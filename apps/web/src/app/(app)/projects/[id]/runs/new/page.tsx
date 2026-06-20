import { NewRunPageClient } from './client'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ suite?: string }>
}

export default async function NewRunPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  return <NewRunPageClient projectId={id} initialSuiteId={sp.suite} />
}
