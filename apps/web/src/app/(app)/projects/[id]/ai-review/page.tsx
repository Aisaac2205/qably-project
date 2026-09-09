import { Suspense } from 'react'
import { AiReviewPage } from '@/features/ai-review/components/ai-review-page'
import { RouteSkeleton } from '@/components/ui/route-skeleton'

type Props = {
  params: Promise<{ id: string }>
}

export default async function AiReviewRoute({ params }: Props) {
  const { id } = await params

  return (
    <Suspense fallback={<RouteSkeleton variant="list" labelKey="aiReview.loading" />}>
      <AiReviewPage projectId={id} />
    </Suspense>
  )
}
