import { redirect } from 'next/navigation'
import { projectRootPath } from '@/features/projects/lib/routes'

type Params = Promise<{ id: string }>

export default async function ProjectDetailPage({ params }: { params: Params }) {
  const { id } = await params

  redirect(projectRootPath(id))
}
