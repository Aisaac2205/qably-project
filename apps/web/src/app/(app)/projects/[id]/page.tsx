import { redirect } from 'next/navigation'

type Params = Promise<{ id: string }>

export default async function ProjectDetailPage({ params }: { params: Params }) {
  const { id } = await params

  redirect(`/projects/${id}/repository`)
}
