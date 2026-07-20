import Link from 'next/link';
import { Card, PageHeader } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';

const EFFECTIVE_DATE = 'July 16, 2026';

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 8 }}>
      <h2 style={{ marginBottom: 8 }}>{heading}</h2>
      <div style={{ color: 'var(--text-primary)', display: 'grid', gap: 10 }}>{children}</div>
    </section>
  );
}

export default function TermsOfServicePage() {
  return (
    <>
      <PageHeader
        eyebrow={`Effective ${EFFECTIVE_DATE}`}
        title="Terms of Service"
        description="These Terms govern your use of Our Home Folder, a product of JBran LLC."
      >
        <ActionLink href="/privacy" variant="secondary">Privacy Policy</ActionLink>
      </PageHeader>

      <div style={{ display: 'grid', gap: 20, maxWidth: 820 }}>
        <Card>
          <p style={{ marginTop: 0 }}>
            Welcome to <strong>Our Home Folder</strong> (the “Service”), operated by{' '}
            <strong>JBran LLC</strong> (“JBran,” “we,” “us,” or “our”) and available at ourhomefolder.com.
            By creating an account or using the Service, you agree to these Terms of Service (the “Terms”).
            If you do not agree, do not use the Service.
          </p>
        </Card>

        <Card>
          <Section heading="1. The Service">
            <p style={{ margin: 0 }}>
              Our Home Folder is a private home-knowledge application that helps homeowners document and
              organize their property — rooms, utilities, appliances, tools, documents, receipts, warranties,
              repairs, maintenance, smart-home devices, and related records — and generate handover and
              emergency reference materials. The Service is a record-keeping and organizational tool.
            </p>
          </Section>

          <Section heading="2. Eligibility & Accounts">
            <p style={{ margin: 0 }}>
              You must be at least 18 years old and able to form a binding contract to use the Service. You are
              responsible for the activity under your account and for keeping your login credentials secure.
              Notify us promptly of any unauthorized use. You may use signed-out “demo mode” without an account;
              demo data is stored only in your browser and is not saved to our systems.
            </p>
          </Section>

          <Section heading="3. Your Content & Data">
            <p style={{ margin: 0 }}>
              You retain all rights to the information, files, and content you add to the Service (“Your Content”).
              You grant JBran a limited, non-exclusive license to host, store, process, and display Your Content
              solely to operate and provide the Service to you and to those you choose to share with. You are
              responsible for the accuracy and legality of Your Content and for having the right to store it.
            </p>
          </Section>

          <Section heading="4. Sensitive Information">
            <p style={{ margin: 0 }}>
              The Service is designed to store <em>references</em> to where sensitive credentials live (for example,
              a password-manager entry name), not the secrets themselves. You agree not to store passwords, Wi-Fi
              passwords, alarm or door codes, PINs, API keys, recovery codes, or similar secrets as plain text in the
              Service. You are solely responsible for any sensitive information you choose to enter.
            </p>
          </Section>

          <Section heading="5. Acceptable Use">
            <p style={{ margin: 0 }}>You agree not to:</p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>use the Service for any unlawful purpose or in violation of any third party’s rights;</li>
              <li>upload malware or attempt to breach, probe, or disrupt the Service or its infrastructure;</li>
              <li>reverse engineer, resell, or misrepresent the Service; or</li>
              <li>store another person’s confidential information without authorization.</li>
            </ul>
          </Section>

          <Section heading="6. Sharing Features">
            <p style={{ margin: 0 }}>
              The Service may let you share property information with others (for example, family, a house sitter,
              a technician, or a buyer). You are responsible for what you choose to share and with whom. Reports and
              exports you generate are your responsibility once shared or downloaded.
            </p>
          </Section>

          <Section heading="7. Third-Party Services">
            <p style={{ margin: 0 }}>
              The Service relies on third-party infrastructure providers (including Supabase for database,
              authentication, and file storage). Your use of the Service is also subject to those providers’ terms.
              We are not responsible for third-party services outside our control.
            </p>
          </Section>

          <Section heading="8. Not Professional or Emergency Advice">
            <p style={{ margin: 0 }}>
              Our Home Folder provides organizational tools and general informational features, including handover
              and emergency reference guidance you create from your own records. It is <strong>not</strong> a
              substitute for professional advice (legal, financial, insurance, electrical, plumbing, structural,
              safety, or otherwise) and is not an emergency service. <strong>In an emergency, call your local
              emergency number.</strong> Always verify safety-critical information (such as shut-off locations)
              independently. You rely on any guidance at your own risk.
            </p>
          </Section>

          <Section heading="9. Disclaimers">
            <p style={{ margin: 0 }}>
              THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
              IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. JBran does
              not warrant that the Service will be uninterrupted, error-free, or that data will never be lost. You
              are responsible for keeping your own backups of important information.
            </p>
          </Section>

          <Section heading="10. Limitation of Liability">
            <p style={{ margin: 0 }}>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, JBRAN LLC AND ITS OWNERS, MEMBERS, AND AFFILIATES WILL NOT BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA,
              PROFITS, OR GOODWILL, ARISING FROM OR RELATED TO YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY
              CLAIM WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US FOR THE SERVICE IN THE 12 MONTHS BEFORE
              THE CLAIM, OR (B) USD $100.
            </p>
          </Section>

          <Section heading="11. Indemnification">
            <p style={{ margin: 0 }}>
              You agree to indemnify and hold harmless JBran LLC from any claims, damages, or expenses arising from
              Your Content, your use of the Service, or your violation of these Terms or applicable law.
            </p>
          </Section>

          <Section heading="12. Termination">
            <p style={{ margin: 0 }}>
              You may stop using the Service and delete your account at any time. We may suspend or terminate access
              if you violate these Terms or to protect the Service. Upon deletion, we will remove Your Content in
              accordance with our Privacy Policy, except where retention is required by law.
            </p>
          </Section>

          <Section heading="13. Changes">
            <p style={{ margin: 0 }}>
              We may update the Service or these Terms. If we make material changes, we will update the “Effective”
              date above and, where appropriate, provide additional notice. Your continued use after changes take
              effect constitutes acceptance.
            </p>
          </Section>

          <Section heading="14. Governing Law">
            <p style={{ margin: 0 }}>
              These Terms are governed by the laws of the State of Colorado, United States of America, without regard
              to its conflict-of-laws rules. Any dispute will be resolved in the state or federal courts located in
              the State of Colorado, and you consent to their jurisdiction.
            </p>
          </Section>

          <Section heading="15. Contact">
            <p style={{ margin: 0 }}>
              JBran LLC — Our Home Folder<br />
              Email: legal@ourhomefolder.com
            </p>
          </Section>
        </Card>

        <Card>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
            See also our <Link href="/privacy" style={{ color: 'var(--color-brass-deep)' }}>Privacy Policy</Link>.
          </p>
        </Card>
      </div>
    </>
  );
}
