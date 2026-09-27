import type { Metadata } from 'next'
import { LegalPageShell, LegalSection } from '@/components/landing/LegalPageShell'

export const metadata: Metadata = {
  title: 'Privacy | RaiseSEA',
  description:
    'How RaiseSEA handles founder information, pitch decks and uploaded documents: what we collect, how it is processed, and how to delete it.',
}

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy at RaiseSEA"
      intro="Founders tell us things that are not public: pitch decks, financials, cap tables, plans. This page explains what RaiseSEA collects, how it is used, and how you stay in control of it."
      updated="September 2026"
    >
      <LegalSection heading="What we collect">
        <p>
          <strong className="font-medium text-text-primary">Account information.</strong> Your email
          address and basic profile details, provided when you sign in with Google.
        </p>
        <p>
          <strong className="font-medium text-text-primary">Documents you upload.</strong> Pitch decks
          and any other material you choose to submit for analysis, together with the analysis produced
          from them.
        </p>
        <p>
          <strong className="font-medium text-text-primary">Your activity.</strong> The investors you
          track, notes you record, meetings you log, and other records you create in the product.
        </p>
      </LegalSection>

      <LegalSection heading="How we use it">
        <p>
          We use your information to provide the product: to generate your deck analysis, produce
          investor matches, run practice sessions, and keep your fundraising pipeline working. We do not
          sell your information, and we do not use it for advertising.
        </p>
      </LegalSection>

      <LegalSection heading="Pitch decks and confidential documents">
        <p>
          Your documents are stored privately in your account so that you can return to your analysis.
          They are not visible to other users, and they are not shared with investors, mentors or
          partners unless you deliberately share them yourself.
        </p>
        <p>
          Documents are transmitted over encrypted connections and stored encrypted. Access to your
          documents is limited to your account and to the systems that generate your analysis.
        </p>
      </LegalSection>

      <LegalSection heading="AI processing">
        <p>
          RaiseSEA uses AI models to produce analysis, matching and practice feedback. Your documents are
          processed in order to generate results for you.
        </p>
        <p>
          <strong className="font-medium text-text-primary">
            Your documents are not used to train public or shared models.
          </strong>{' '}
          They are not contributed to any shared training corpus.
        </p>
      </LegalSection>

      <LegalSection heading="Service providers">
        <p>
          RaiseSEA runs on third-party cloud infrastructure and uses third-party AI providers to perform
          analysis. These providers process data on our behalf, as part of operating the product, and not
          for their own independent purposes.
        </p>
      </LegalSection>

      <LegalSection heading="Retention and deletion">
        <p>
          Your documents and product records are kept for as long as your account is active. You can
          delete your documents at any time, and you can request deletion of your account and its data.
          Once deleted, they are removed from the active product.
        </p>
        <p>
          To request deletion, email{' '}
          <a href="mailto:hello@raisesea.com" className="font-medium text-brand hover:text-brand-hover transition-colors">
            hello@raisesea.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this page">
        <p>
          RaiseSEA is in beta and this document will change as the product and its data processing
          change. Material changes will be reflected here with an updated date.
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
