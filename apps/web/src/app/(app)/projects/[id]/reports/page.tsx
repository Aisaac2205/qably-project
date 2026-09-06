import { redirect } from 'next/navigation'
import { projectQualityPath } from '@/features/projects/lib/routes'

type PageProps = { params: Promise<{ id: string }> }

export default async function ReportsRoute({ params }: PageProps) {
  const { id } = await params

  redirect(projectQualityPath(id))
}
