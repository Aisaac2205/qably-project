import { ApiKeysPageClient } from './client'

type Props = {
  params: Promise<{ id: string }>
}

export default async function ApiKeysPage({ params }: Props) {
  const { id } = await params
  return <ApiKeysPageClient projectId={id} />
}
