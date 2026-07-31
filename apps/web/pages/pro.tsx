import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Button, Card, Input, PageHeader, getControlStyle } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { resolveDataContext, type ResolvedDataContext } from '../lib/dataContext';
import {
  PARTNER_KINDS,
  PARTNER_KIND_LABELS,
  getMyPartnerProfile,
  getProBinderCheckoutUrl,
  upsertPartnerProfile,
  validatePartnerInput,
  type PartnerKind,
  type PartnerRow
} from '../lib/partners';

// The professional channel (docs/THREAT_MITIGATION.md, T6 / Phase 5).
//
// The shape is decades old: home inspectors have bought $10-per-report add-ons
// since RecallChek, and free-to-homeowner binders reach buyers through
// thousands of inspectors. Ours differs in one way that matters — what the
// buyer receives is not a PDF but the living record itself.

const subtleText: CSSProperties = { color: 'var(--text-muted)' };

const fieldStyle: CSSProperties = {
  padding: 10,
  borderRadius: 'var(--radius-control)',
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)'
};

const stepNumberStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.66rem',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)'
};

type Draft = {
  business_name: string;
  partner_kind: PartnerKind;
  website: string;
};

const EMPTY_DRAFT: Draft = { business_name: '', partner_kind: 'inspector', website: '' };

export default function ProPage() {
  const [context, setContext] = useState<ResolvedDataContext | null>(null);
  const [profile, setProfile] = useState<PartnerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');

    const nextContext = await resolveDataContext();

    if (nextContext.mode !== 'supabase' || !nextContext.user) {
      setContext(nextContext);
      setProfile(null);
      return;
    }

    const nextProfile = await getMyPartnerProfile();
    setContext(nextContext);
    setProfile(nextProfile);
    if (nextProfile) {
      setDraft({
        business_name: nextProfile.business_name,
        partner_kind: nextProfile.partner_kind,
        website: nextProfile.website ?? ''
      });
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    load()
      .catch((loadError) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load the pro page.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [load]);

  const submitProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!context?.user || saving) {
      return;
    }

    // Validate before the round trip so the message arrives immediately.
    const validation = validatePartnerInput({
      business_name: draft.business_name,
      partner_kind: draft.partner_kind,
      website: draft.website
    });
    if (!validation.ok) {
      setFormError(validation.errors.join(' '));
      return;
    }

    setSaving(true);
    setFormError('');
    setNotice('');

    try {
      const saved = await upsertPartnerProfile({
        business_name: draft.business_name,
        partner_kind: draft.partner_kind,
        website: draft.website
      });
      const isFirstSave = !profile;
      setProfile(saved);
      setDraft({
        business_name: saved.business_name,
        partner_kind: saved.partner_kind,
        website: saved.website ?? ''
      });
      setNotice(
        isFirstSave
          ? `Registered. Handovers you issue will now say "Prepared by ${saved.business_name}".`
          : 'Profile saved.'
      );
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to save the profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="For professionals" description="Hand your clients a living home record." />
        <Card>
          <p style={{ ...subtleText, margin: 0 }}>Loading...</p>
        </Card>
      </>
    );
  }

  // Signed out or demo mode: a partner profile belongs to an account.
  if (!context || context.mode !== 'supabase' || !context.user) {
    return (
      <>
        <PageHeader title="For professionals" description="Hand your clients a living home record." />
        <Card>
          <h2 style={{ marginTop: 0 }}>The pro channel is part of an account</h2>
          <p style={subtleText}>
            Inspectors, agents, and property managers can build a home&apos;s record during their
            work — rooms, systems, appliances — and hand it to the buyer with a transfer code. The
            handover carries your business name. That starts with an account: demo data lives only
            in this browser and cannot be handed to anyone.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <ActionLink href="/sign-up">Create your account</ActionLink>
            <ActionLink href="/sign-in" variant="secondary">
              Sign in
            </ActionLink>
          </div>
        </Card>
      </>
    );
  }

  const checkoutUrl = getProBinderCheckoutUrl(context.user.id);

  const profileForm = (
    <form onSubmit={submitProfile} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 600 }}>Business name</span>
        <Input
          value={draft.business_name}
          onChange={(event) => setDraft((prev) => ({ ...prev, business_name: event.target.value }))}
          placeholder="Hilltop Home Inspections"
          required
          maxLength={200}
          disabled={saving}
          style={fieldStyle}
        />
        <span style={{ ...subtleText, fontSize: '0.85rem' }}>
          Shown to your client on the handover, exactly as written here.
        </span>
      </label>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 600 }}>Kind of work</span>
        <select
          value={draft.partner_kind}
          onChange={(event) => setDraft((prev) => ({ ...prev, partner_kind: event.target.value as PartnerKind }))}
          disabled={saving}
          style={{ ...fieldStyle, font: 'inherit' }}
        >
          {PARTNER_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {PARTNER_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 600 }}>Website (optional)</span>
        <Input
          type="url"
          value={draft.website}
          onChange={(event) => setDraft((prev) => ({ ...prev, website: event.target.value }))}
          placeholder="https://example.com"
          disabled={saving}
          style={fieldStyle}
        />
      </label>
      {formError ? (
        <p style={{ margin: 0, color: 'var(--status-urgent)', fontWeight: 700 }} role="alert">
          {formError}
        </p>
      ) : null}
      {notice ? (
        <p style={{ margin: 0, color: 'var(--status-good)', fontWeight: 700 }} role="status">
          {notice}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : profile ? 'Save the profile' : 'Register'}
        </Button>
      </div>
    </form>
  );

  // No profile yet: explain the channel before asking for anything.
  if (!profile) {
    return (
      <>
        <PageHeader title="For professionals" description="Hand your clients a living home record." />
        <div style={{ display: 'grid', gap: 24 }}>
          {error ? (
            <Card>
              <p style={{ margin: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p>
            </Card>
          ) : null}
          <Card>
            <h2 style={{ marginTop: 0 }}>Give the record, keep the relationship</h2>
            <p style={subtleText}>
              Build a home&apos;s record while you work — rooms, systems, appliances, using the same
              tools as any owner — then hand it to the buyer with a transfer code. Inspectors have
              bought per-report add-ons for decades; this one hands over the record itself.
            </p>
            <p style={subtleText}>
              <strong style={{ color: 'inherit' }}>What the buyer gets:</strong> the full living
              record of their new home, free, forever — not a PDF that goes stale in a drawer.
            </p>
            <p style={subtleText}>
              <strong style={{ color: 'inherit' }}>What you get:</strong> your name on the handover
              — the claim page says &ldquo;Prepared by your business&rdquo; — and a client who keeps
              your contact details inside the record they use all year.
            </p>
          </Card>
          <Card>
            <h2 style={{ marginTop: 0 }}>Register your practice</h2>
            <p style={subtleText}>
              Registration is a label, not a role — it grants no access to anyone&apos;s data. It
              only sets the name your handovers carry.
            </p>
            {profileForm}
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="For professionals" description="Hand your clients a living home record." />
      <div style={{ display: 'grid', gap: 24 }}>
        {error ? (
          <Card>
            <p style={{ margin: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p>
          </Card>
        ) : null}

        <Card>
          <h2 style={{ marginTop: 0 }}>How it works</h2>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 16 }}>
            <li>
              <div style={stepNumberStyle}>Step 1</div>
              <strong>Create the property and document it during your inspection.</strong>
              <p style={{ ...subtleText, margin: '4px 0 0' }}>
                Record the home as a property you own, then add its rooms, systems, and appliances
                the same way any owner would.
              </p>
              <div style={{ marginTop: 8 }}>
                <ActionLink href="/create-property" variant="secondary">
                  Create the property
                </ActionLink>
              </div>
            </li>
            <li>
              <div style={stepNumberStyle}>Step 2</div>
              <strong>Issue a transfer code from the Sharing page.</strong>
              <p style={{ ...subtleText, margin: '4px 0 0' }}>
                The Sharing page works on the active property — switch to the client&apos;s home
                with the property switcher in the header first.
              </p>
              <div style={{ marginTop: 8 }}>
                <ActionLink href="/sharing" variant="secondary">
                  Open Sharing
                </ActionLink>
              </div>
            </li>
            <li>
              <div style={stepNumberStyle}>Step 3</div>
              <strong>Give the code to your client.</strong>
              <p style={{ ...subtleText, margin: '4px 0 0' }}>
                When they claim it, the record becomes theirs — and the claim page shows
                &ldquo;Prepared by {profile.business_name}&rdquo;.
              </p>
            </li>
          </ol>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Per-binder pricing</h2>
          {/*
            Soft gate, deliberately: v1 shows the payment link but does not
            block issuing a transfer without a purchase. Hard enforcement lands
            with real partner volume — the same stance as the portfolio plan's
            decision D-15: never gate users behind a checkout that does not
            exist, and don't build enforcement machinery ahead of the first
            paying partner.
          */}
          {checkoutUrl ? (
            <>
              <p style={subtleText}>
                Each binder you hand to a client is a one-time purchase — one payment per binder,
                nothing recurring, priced the way inspection add-ons have been for decades.
              </p>
              <a href={checkoutUrl} className="action-link" style={getControlStyle({ variant: 'primary' })}>
                Purchase a binder
              </a>
            </>
          ) : (
            <p style={{ ...subtleText, marginBottom: 0 }}>
              Pro billing isn&apos;t switched on yet — during early access, binders are free. When it
              arrives it will be a simple one-time payment per binder, nothing recurring.
            </p>
          )}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Your partner profile</h2>
          <p style={subtleText}>
            Changes apply to handovers you issue from now on. Your profile grants no access to any
            client&apos;s record.
          </p>
          {profileForm}
        </Card>
      </div>
    </>
  );
}
