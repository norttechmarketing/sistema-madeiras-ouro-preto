import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component to catch rendering errors and display a fallback UI.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render(): ReactNode {
    const { hasError, error } = this.state;
    // Cast 'this' to any to bypass TypeScript error where 'props' is not recognized on the component instance
    const { children } = (this as any).props;

    if (hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 text-center">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-red-100">
            <h1 className="text-2xl font-bold text-brand-red mb-4">Ops! Algo deu errado.</h1>
            <p className="text-gray-600 mb-6">
              Ocorreu um erro inesperado na aplicação. Por favor, tente recarregar a página.
            </p>
            <pre className="text-[10px] bg-red-50 p-4 rounded-lg text-red-700 overflow-auto text-left mb-6 max-h-32">
              {error?.toString()}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-brand-red text-white py-3 rounded-xl font-bold hover:bg-red-800 transition-colors"
            >
              Recarregar Sistema
            </button>
          </div>
        </div>
      );
    }

    return children || null;
  }
}
