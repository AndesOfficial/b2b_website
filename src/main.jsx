import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Application Error Boundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", padding: "20px", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ maxWidth: "550px", width: "100%", background: "#fff", padding: "32px", borderRadius: "16px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)", border: "1px solid #E2E8F0" }}>
            <h2 style={{ margin: "0 0 8px 0", color: "#E11D48", fontSize: "20px", fontWeight: "800" }}>Application Error</h2>
            <p style={{ margin: "0 0 16px 0", color: "#64748B", fontSize: "14px" }}>
              Something caused a rendering failure. Details below:
            </p>
            <pre style={{ background: "#F1F5F9", padding: "14px", borderRadius: "10px", color: "#0F172A", fontSize: "12px", overflowX: "auto", whiteSpace: "pre-wrap" }}>
              {this.state.error?.toString()}
            </pre>
            <button
              onClick={() => {
                sessionStorage.clear();
                window.location.href = "/login";
              }}
              style={{ marginTop: "20px", padding: "10px 20px", background: "#1976D2", color: "#fff", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
            >
              Reset Session & Go to Login
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
