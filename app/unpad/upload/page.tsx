import type { Metadata } from 'next'
import { ArrowLeft, FileText } from 'lucide-react'
import { UnpadShell, WorkspaceButton } from '../UnpadShell'
import { fetchUnpadStartups, requireUnpadOperator } from '../incubator'
import UploadSimulation from './UploadSimulation'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Unpad Deck Upload — RaiseSEA',
  description: 'Super-admin Unpad startup deck upload with real RaiseSEA analysis and progress tracking.',
}

export default async function UnpadUploadPage() {
  await requireUnpadOperator('/unpad/upload')
  const { startups, schemaReady, error } = await fetchUnpadStartups()

  return (
    <UnpadShell
      active="upload"
      eyebrow="Startup intake"
      title="Deck Upload and Progress"
      subtitle="Create an Unpad startup, upload its deck through the real RaiseSEA analysis flow, and track improvement against every later deck version."
      actions={
        <>
          <WorkspaceButton href="/unpad" variant="secondary">
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            Dashboard
          </WorkspaceButton>
          <WorkspaceButton href="/apply">
            <FileText className="w-4 h-4" strokeWidth={1.75} />
            Real analysis
          </WorkspaceButton>
        </>
      }
    >
      <UploadSimulation startups={startups} schemaReady={schemaReady} schemaError={error} />
    </UnpadShell>
  )
}
