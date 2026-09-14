import { Suspense } from 'react'
import { ProjectChatPanel } from '@/features/ai-review/components/project-chat-panel'
import { RouteSkeleton } from '@/components/ui/route-skeleton'

type Props = {
  params: Promise<{ id: string }>
}

export default async function AerisRoute({ params }: Props) {
  const { id } = await params

  return (
    <Suspense fallback={<RouteSkeleton variant="list" labelKey="aiReview.loading" />}>
      <div className="flex h-full min-h-0 flex-1 flex-col bg-surface">
        <ProjectChatPanel projectId={id} />
      </div>
    </Suspense>
  )
}
