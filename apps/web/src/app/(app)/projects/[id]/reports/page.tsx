import { ReportsPage } from '@/features/reports/components/reports-page'

type PageProps = { params: Promise<{ id: string }> }

export default async function ReportsRoute({ params }: PageProps) {
  const { id } = await params
  return <ReportsPage key={id} />
}
