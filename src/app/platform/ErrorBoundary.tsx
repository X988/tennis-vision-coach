import { Component, ReactNode } from 'react';
import { reportError } from './errors';

interface Props {
  /** What to show instead of the broken part; receives a retry callback. */
  fallback: (retry: () => void) => ReactNode;
  children: ReactNode;
  /** Resets the boundary when it changes (e.g. the route). */
  resetKey?: string;
}

interface State {
  failed: boolean;
}

/** Keeps a rendering error in one screen from taking the whole app down. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportError('render', error);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (this.state.failed) return this.props.fallback(() => this.setState({ failed: false }));
    return this.props.children;
  }
}
