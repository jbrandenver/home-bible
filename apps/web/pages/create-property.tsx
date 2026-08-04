import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  PROPERTY_TYPES,
  formatEnumLabel
} from '@home-folder/shared';
import { PageHeader, Card, Input, Select, Button } from '@home-folder/ui';
import { createPropertyForUser } from '../lib/properties';
import { getCurrentUser, getCurrentUserUncached, isSupabaseConfigured } from '../lib/auth';
import { setDemoActiveProperty } from '../lib/demoStorage';

export default function CreatePropertyPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [propertyType, setPropertyType] = useState<(typeof PROPERTY_TYPES)[number]>('single_family_home');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const supabaseReady = isSupabaseConfigured();

  useEffect(() => {
    getCurrentUser().then((user) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!nickname.trim()) {
      setError('Property nickname is required.');
      return;
    }

    setLoading(true);
    setError('');

    if (userId && supabaseReady) {
      try {
        const user = await getCurrentUser();
        if (!user) {
          throw new Error('Your session expired. Please sign in again.');
        }

        const property = await createPropertyForUser(user, {
          nickname: nickname.trim(),
          property_type: propertyType
        });

        // Deliberately NOT written to demo storage: that key is the signed-out
        // browser copy, and putting a real account property in it meant the next
        // person to sign in on this browser inherited a property they do not own.
        router.push('/add-rooms');
        return;
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : 'Failed to save property to your account.'
        );
        setLoading(false);
        return;
      }
    }

    // Reaching here means we believe nobody is signed in. Confirm that against
    // the auth client rather than the 5-second cache before committing the
    // home to browser-local storage: mid sign-out -> sign-in the cached answer
    // can still be the previous `null`, and this branch decides whether the
    // person's home reaches their account at all.
    if (supabaseReady) {
      const confirmed = await getCurrentUserUncached();
      if (confirmed) {
        try {
          await createPropertyForUser(confirmed, {
            nickname: nickname.trim(),
            property_type: propertyType
          });
          router.push('/add-rooms');
          return;
        } catch (submitError) {
          setError(
            submitError instanceof Error
              ? submitError.message
              : 'Failed to save property to your account.'
          );
          setLoading(false);
          return;
        }
      }
    }

    const property = {
      id: crypto.randomUUID(),
      nickname: nickname.trim(),
      property_type: propertyType,
      created_at: new Date().toISOString()
    };

    setDemoActiveProperty(property);

    router.push('/add-rooms');
  }

  return (
    <>
      <PageHeader
        title="Create your first property"
        description="Start with a simple home profile. A full street address is optional."
      />

        <Card>
          {userId ? (
            <p style={{ marginTop: 0, color: 'var(--status-good)' }}>
              Saved to your account.
            </p>
          ) : (
            <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
              Demo data is stored only in this browser.
            </p>
          )}

          {!supabaseReady ? (
            <p style={{ marginTop: 0, color: 'var(--color-clay)', background: 'rgba(227,194,136,0.14)', border: '1px solid var(--color-brass-pale)', borderRadius: 8, padding: 10 }}>
              Account saving is not available in this local build. Demo data stays only in this browser.
            </p>
          ) : null}

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 20 }}>
            <div>
              <label
                htmlFor="nickname"
                style={{
                  display: 'block',
                  fontWeight: 700,
                  marginBottom: 8
                }}
              >
                Property nickname
              </label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="Example: Main Home"
              />
            </div>

            <div>
              <label
                htmlFor="propertyType"
                style={{
                  display: 'block',
                  fontWeight: 700,
                  marginBottom: 8
                }}
              >
                Property type
              </label>
              <Select
                id="propertyType"
                value={propertyType}
                onChange={(event) =>
                  setPropertyType(event.target.value as (typeof PROPERTY_TYPES)[number])
                }
              >
                {PROPERTY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatEnumLabel(type)}
                  </option>
                ))}
              </Select>
            </div>

            {error ? (
              <p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>
                {error}
              </p>
            ) : null}

            <div>
              <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Continue'}</Button>
            </div>
          </form>
        </Card>
      </>
    );
  }
