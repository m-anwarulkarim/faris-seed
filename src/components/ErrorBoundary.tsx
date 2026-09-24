import { Component, ReactNode } from "react";
import { logError } from "@/lib/errorLogger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Transparent ErrorBoundary: logs errors silently in the background,
 * but never replaces the page with an error UI. Pages always render.
 *
 * Note: if a render actually throws, React will still unmount the subtree —
 * we re-render children on the next attempt by immediately resetting state.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    // Mark error briefly so componentDidCatch fires; we reset right after.
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    void logError(error, {
      severity: "critical",
      errorType: "react.boundary",
      context: { componentStack: errorInfo?.componentStack?.slice(0, 2000) },
    });
    // Immediately reset so children try to render again on next tick.
    this.setState({ hasError: false });
  }

  render() {
    // Always render children — never show an error screen.
    return this.props.children;
  }
}
