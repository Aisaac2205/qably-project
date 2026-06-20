export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  return <div className="p-6">Run {runId}</div>
}
