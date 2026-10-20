import React, { Component } from 'react';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

/**
 * SectionErrorBoundary — isolates errors within specific views or tabs so that
 * an uncaught error in one table, chart, or order row does not bring down
 * the entire portal.
 */
export default class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[SectionErrorBoundary] Error in section "${this.props.section || 'view'}":`, error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-6 my-4 shadow-sm text-center">
          <div className="inline-flex p-3 rounded-full bg-red-100 text-red-600 mb-3">
            <FiAlertTriangle size={24} />
          </div>
          <h3 className="text-base font-extrabold text-red-900 mb-1">
            {this.props.title || 'This section could not be displayed'}
          </h3>
          <p className="text-xs text-red-700 max-w-md mx-auto mb-4 font-medium">
            {this.state.error?.message || 'An unexpected rendering error occurred. Your other sections and data are unaffected.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
            >
              <FiRefreshCw size={12} />
              Try Again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl shadow-sm transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
