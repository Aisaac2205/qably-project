import { QualityPage } from '@/features/projects/quality/components/quality-page'

type PageProps = { params: Promise<{ id: string }> }

export default async function QualityRoute({ params }: PageProps) {
  const { id } = await params
  return <QualityPage key={id} projectId={id} />
}
