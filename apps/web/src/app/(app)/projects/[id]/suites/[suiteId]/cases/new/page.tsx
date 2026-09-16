'use client'

/**
 * Case creation lives inline on the suite edit page now (list + editor
 * split). This route only exists so old links/bookmarks keep working —
 * it redirects straight there with a new case draft preselected.
 */
import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { suiteEditNewCasePath } from '@/features/projects/lib/routes'

type Params = Promise<{ id: string; suiteId: string }>

export default function NewCasePage({ params }: { params: Params }) {
  const { id, suiteId } = use(params)
  const router = useRouter()

  useEffect(() => {
    router.replace(suiteEditNewCasePath(id, suiteId))
  }, [router, id, suiteId])

  return null
}
