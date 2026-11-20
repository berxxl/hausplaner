import { Component, type ReactNode } from "react";

/** Fängt Renderfehler einer Ansicht ab (z. B. kein WebGL) und zeigt eine Meldung statt nichts. */
export class ErrorBoundary extends Component<
  { title: string; children: ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="placeholder" data-testid="view-error">
        <p>{this.props.title}</p>
        <p>{error.message}</p>
      </div>
    );
  }
}
