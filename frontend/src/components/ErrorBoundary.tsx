import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);

    // Auto-reload on chunk loading failures (after an update or rebuild)
    const errorMsg = error?.message?.toLowerCase() || '';
    if (
      errorMsg.includes('failed to fetch dynamically imported module') ||
      errorMsg.includes('loading chunk') ||
      errorMsg.includes('dynamically imported module')
    ) {
      const hasRetried = sessionStorage.getItem('zamzam_chunk_reload_attempted');
      if (!hasRetried) {
        sessionStorage.setItem('zamzam_chunk_reload_attempted', 'true');
        window.location.reload();
      }
    }
  }

  private handleReset = () => {
    sessionStorage.removeItem('zamzam_chunk_reload_attempted');
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            maxWidth: 580,
            margin: '3rem auto',
            padding: '2rem',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1.5px solid #fca5a5',
            boxShadow: '0 10px 25px rgba(220, 38, 38, 0.1)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '14px',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <AlertTriangle size={28} />
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: '0 0 0.5rem 0' }}>
            Something went wrong loading this page
          </h2>

          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary, #64748b)', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected rendering error occurred. Refreshing the application will reload the latest components.'}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={this.handleReset}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.6rem 1.4rem',
                backgroundColor: '#dc2626',
                borderColor: '#dc2626',
                color: '#ffffff',
                fontWeight: 700,
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={16} />
              <span>Reload Page</span>
            </button>
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem('zamzam_chunk_reload_attempted');
                window.location.href = '/owner';
              }}
              className="btn btn-secondary"
              style={{
                padding: '0.6rem 1.2rem',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
