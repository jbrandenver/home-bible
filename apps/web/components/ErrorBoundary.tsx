import React from 'react';
import { operatorLog } from '../lib/errors';

const SUPPORT_MAILTO =
  'mailto:support@ourhomefolder.com?subject=Our%20Home%20Folder%20problem%20report';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

// Catches uncaught render errors so customers see a calm recovery screen instead
// of a blank/broken page. The technical detail is logged for the operator (and
// is picked up automatically if an error tracker is added later).
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    operatorLog('Unhandled UI error', { message: error.message, stack: error.stack, componentStack: info.componentStack });
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  handleHome = () => {
    if (typeof window !== 'undefined') {
      window.location.assign('/dashboard');
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <section
        role="alert"
        style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-card)',
          background: 'var(--surface-card)',
          padding: 24,
          maxWidth: 640,
          margin: '2rem auto'
        }}
      >
        <h1 style={{ marginTop: 0 }}>Something went wrong</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Sorry — this screen ran into a problem. Your saved information is safe. You can try again, or
          head back to the dashboard.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button
            type="button"
            onClick={this.handleReset}
            className="hb-control"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 'var(--radius-control)',
              padding: '11px 16px',
              minHeight: 44,
              background: 'var(--color-brass)',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-brass)',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={this.handleHome}
            className="hb-control"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 'var(--radius-control)',
              padding: '11px 16px',
              minHeight: 44,
              background: 'transparent',
              color: 'var(--color-espresso)',
              border: '1px solid var(--border-subtle)',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Go to dashboard
          </button>
          <a href={SUPPORT_MAILTO} style={{ alignSelf: 'center', color: 'var(--color-brass-deep)', fontWeight: 600 }}>
            Report a problem
          </a>
        </div>
      </section>
    );
  }
}
