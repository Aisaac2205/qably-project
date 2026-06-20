import { RunDetailPageClient } from './client'

type Props = {
  params: Promise<{ id: string; runId: string }>
}

export default async function RunDetailPage({ params }: Props) {
  const { id, runId } = await params
  return <RunDetailPageClient projectId={id} runId={runId} />
}
