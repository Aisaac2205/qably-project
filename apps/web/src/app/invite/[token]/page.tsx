import { InviteAcceptView } from '@/features/organizations/components/invite-accept-view'

type Params = Promise<{ token: string }>

export default async function InvitePage({ params }: { params: Params }) {
  const { token } = await params

  return <InviteAcceptView token={token} />
}
