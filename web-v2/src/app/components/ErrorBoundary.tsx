import { Component, type ErrorInfo, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors so the native shell shows recovery UI instead of a blank WebView. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[cafyz] UI error", error, info.componentStack);
  }

  private reload = () => {
    if (Capacitor.isNativePlatform()) {
      window.location.replace("./");
      return;
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center"
        style={{ background: "var(--cafyz-app-bg, #06091a)", color: "var(--cafyz-text, #e8eef8)" }}
      >
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm max-w-sm opacity-80">
          The app hit an unexpected error. Tap below to reload — your data is saved on the server.
        </p>
        <button
          type="button"
          onClick={this.reload}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "var(--cafyz-accent, #1e7fff)", color: "#fff" }}
        >
          Reload Cafyz
        </button>
      </div>
    );
  }
}
