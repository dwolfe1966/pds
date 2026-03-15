import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '3rem 2rem',
          maxWidth: '600px',
          margin: '2rem auto',
          textAlign: 'center',
        }}>
          <h1 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#555', marginBottom: '2rem', lineHeight: 1.6 }}>
            An unexpected error occurred. Please try again or return to the dashboard.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre style={{
              textAlign: 'left',
              backgroundColor: '#f5f5f5',
              padding: '1rem',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              overflow: 'auto',
              marginBottom: '2rem',
              color: '#c00',
            }}>
              {this.state.error.toString()}
            </pre>
          )}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#fff',
                color: '#0d5d2f',
                border: '2px solid #0d5d2f',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              Try Again
            </button>
            <button
              onClick={this.handleGoHome}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#0d5d2f',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
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

export default ErrorBoundary;
