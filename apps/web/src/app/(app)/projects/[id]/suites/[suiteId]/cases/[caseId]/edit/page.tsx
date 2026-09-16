'use client'

/**
 * Case editing lives inline on the suite edit page now (list + editor
 * split). This route only exists so old links/bookmarks keep working —
 * it redirects straight there with this case preselected.
 */
import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { suiteEditCasePath } from '@/features/projects/lib/routes'

type Params = Promise<{ id: string; suiteId: string; caseId: string }>

export default function EditCasePage({ params }: { params: Params }) {
  const { id, suiteId, caseId } = use(params)
  const router = useRouter()

  useEffect(() => {
    router.replace(suiteEditCasePath(id, suiteId, caseId))
  }, [router, id, suiteId, caseId])

  return null
}
