// src/components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
          <div className="max-w-md mx-auto p-6 border border-rose-800 bg-rose-950/40 rounded-2xl">
            <h1 className="text-lg font-semibold mb-2">
              Something went wrong in the dashboard
            </h1>
            <p className="text-sm text-slate-200 mb-3">
              The frontend crashed while rendering. Check the console logs and
              reload the page.
            </p>
            {this.state.message && (
              <pre className="text-[11px] text-rose-200 bg-slate-950/60 p-2 rounded-md overflow-auto">
                {this.state.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
