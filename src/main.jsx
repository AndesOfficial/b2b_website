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
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f6f2", padding: "20px", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ maxWidth: "550px", width: "100%", background: "#fff", padding: "32px", borderRadius: "16px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)", border: "1px solid #dfe8e2" }}>
            <h2 style={{ margin: "0 0 8px 0", color: "#E11D48", fontSize: "20px", fontWeight: "800" }}>Application Error</h2>
            <p style={{ margin: "0 0 16px 0", color: "#58706a", fontSize: "14px" }}>
              Something caused a rendering failure. Details below:
            </p>
            <pre style={{ background: "#eef5f0", padding: "14px", borderRadius: "10px", color: "#172c28", fontSize: "12px", overflowX: "auto", whiteSpace: "pre-wrap" }}>
              {this.state.error?.toString()}
            </pre>
            <div style={{ marginTop: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                style={{ padding: "10px 20px", background: "#16654e", color: "#fff", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
              >
                Reload Application
              </button>
              <button
                onClick={() => {
                  sessionStorage.clear();
                  window.location.href = "/login";
                }}
                style={{ padding: "10px 20px", background: "#dfe8e2", color: "#26403a", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
              >
                Reset Session & Go to Login
              </button>
            </div>
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
