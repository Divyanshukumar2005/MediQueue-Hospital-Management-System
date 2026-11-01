import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-boundary">
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h2 style={{ margin: '8px 0' }}>Something went wrong</h2>
        <p style={{ marginBottom: 16 }}>{this.state.error.message}</p>
        <button className="btn btn-primary" onClick={() => window.location.assign('/')}>Back to start</button>
      </div>
    );
  }
}
