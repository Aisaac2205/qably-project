'use client'

import { use } from 'react'
import { redirect } from 'next/navigation'

type Params = Promise<{ id: string }>

export default function SuitesPage({ params }: { params: Params }) {
  const { id } = use(params)
  redirect(`/projects/${id}`)
}
