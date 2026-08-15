import { ProjectRepositoryPage } from '@/features/projects/repository/components/project-repository-page'

export default async function RepositoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <ProjectRepositoryPage projectId={id} />
}
