import { redirect } from 'next/navigation'
import { projectAerisPath } from '@/features/projects/lib/routes'

type Params = Promise<{ id: string }>

export default async function AiReviewRoute({ params }: { params: Params }) {
  const { id } = await params

  redirect(projectAerisPath(id))
}
