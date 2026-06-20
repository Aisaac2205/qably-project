import { RunListPageClient } from './client'

type Props = {
  params: Promise<{ id: string }>
}

export default async function RunsListPage({ params }: Props) {
  const { id } = await params
  return <RunListPageClient projectId={id} />
}
