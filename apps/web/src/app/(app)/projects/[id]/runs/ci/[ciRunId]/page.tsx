import { CiRunDetailPageClient } from './client'

type Props = {
  params: Promise<{ id: string; ciRunId: string }>
}

export default async function CiRunDetailPage({ params }: Props) {
  const { id, ciRunId } = await params
  return <CiRunDetailPageClient projectId={id} ciRunId={ciRunId} />
}
