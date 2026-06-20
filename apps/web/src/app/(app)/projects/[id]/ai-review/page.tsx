import { AiReviewPage } from '@/features/ai-review/components/ai-review-page'

type Props = {
  params: Promise<{ id: string }>
}

export default async function AiReviewRoute({ params }: Props) {
  const { id } = await params
  return <AiReviewPage projectId={id} />
}
