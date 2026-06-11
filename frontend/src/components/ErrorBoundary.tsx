import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-lg w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Algo salió mal</h1>
          <p className="text-sm text-gray-500 mb-6">
            Ha ocurrido un error inesperado en la aplicación. Puedes intentar recargar la página o volver al inicio.
          </p>
          {this.state.error && (
            <details className="mb-6 text-left">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Detalles técnicos</summary>
              <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-red-600 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 text-sm"
            >
              <RefreshCw className="h-4 w-4" /> Recargar Página
            </button>
            <button
              onClick={() => { window.location.href = '/dashboard' }}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-xl font-medium hover:bg-gray-50 text-sm text-gray-700"
            >
              <Home className="h-4 w-4" /> Ir al Inicio
            </button>
          </div>
          <p className="text-xs text-gray-300 mt-6">CredCore v1.0</p>
        </div>
      </div>
    )
  }
}
