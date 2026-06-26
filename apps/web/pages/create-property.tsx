import { useState } from 'react';
import { useRouter } from 'next/router';
import {
  PROPERTY_TYPES,
  formatEnumLabel
} from '@home-bible/shared';
import { PageHeader, Card, Input, Select, Button } from '@home-bible/ui';

export default function CreatePropertyPage() {
  const router = useRouter();

  const [nickname, setNickname] = useState('');
  const [propertyType, setPropertyType] = useState<(typeof PROPERTY_TYPES)[number]>('single_family_home');
  const [error, setError] = useState('');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!nickname.trim()) {
      setError('Property nickname is required.');
      return;
    }

    const property = {
      id: crypto.randomUUID(),
      nickname: nickname.trim(),
      property_type: propertyType,
      created_at: new Date().toISOString()
    };

    window.localStorage.setItem('homeBible.activeProperty', JSON.stringify(property));

    router.push('/add-rooms');
  }

  return (
    <>
      <PageHeader
        title="Create your first property"
        description="Start with a simple home profile. You do not need to add your full address."
      />

        <Card>
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
              <p style={{ color: '#b91c1c', fontWeight: 700, margin: 0 }}>
                {error}
              </p>
            ) : null}

            <div>
              <Button type="submit">Continue</Button>
            </div>
          </form>
        </Card>
      </>
    );
  }
