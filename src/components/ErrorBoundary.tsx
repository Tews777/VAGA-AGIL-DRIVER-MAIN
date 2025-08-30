/**
 * 🛡️ Error Boundary Component
 * 
 * Captura erros de JavaScript em qualquer lugar da árvore de componentes,
 * registra esses erros e exibe uma interface de fallback.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Bug, Home, AlertTriangle } from 'lucide-react';
import { logger } from '@/utils/sistemaLogs';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Atualiza o state para que a próxima renderização mostre a UI de fallback
    return {
      hasError: true,
      error,
      errorId: Date.now().toString(36)
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Registra o erro no sistema de logs
    const componentName = this.props.componentName || 'ErrorBoundary';
    
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      errorId: this.state.errorId
    };

    // Log crítico no sistema
    logger.error(
      `Error Boundary capturou erro em ${componentName}`,
      componentName,
      errorData,
      error
    );

    // Salvar no localStorage para recuperação
    try {
      const existingErrors = JSON.parse(localStorage.getItem('boundary-errors') || '[]');
      existingErrors.push(errorData);
      if (existingErrors.length > 100) {
        existingErrors.splice(0, existingErrors.length - 100);
      }
      localStorage.setItem('boundary-errors', JSON.stringify(existingErrors));
    } catch (storageError) {
      console.error('Erro ao salvar no localStorage:', storageError);
    }

    // Em desenvolvimento, também log no console
    if (!import.meta.env.PROD) {
      console.group('🚨 ERROR BOUNDARY');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Name:', componentName);
      console.groupEnd();
    }

    // Atualiza o state com informações do erro
    this.setState({
      error,
      errorInfo,
      errorId: errorData.errorId
    });

    // Callback customizado se fornecido
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReportError = () => {
    const { error, errorInfo, errorId } = this.state;
    
    if (!error) return;

    const reportData = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    // Copiar para clipboard
    navigator.clipboard.writeText(JSON.stringify(reportData, null, 2)).then(() => {
      alert('🔗 Dados do erro copiados para a área de transferência!\n\nCole essas informações ao reportar o problema.');
    }).catch(() => {
      // Fallback se clipboard não estiver disponível
      console.log('📋 Dados do erro:', reportData);
      alert('📋 Verifique o console do navegador para os dados do erro.');
    });
  };

  render() {
    if (this.state.hasError) {
      // Renderizar fallback customizado se fornecido
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Interface de fallback padrão
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-red-600">
                🚨 Ops! Algo deu errado
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <Alert className="border-orange-200 bg-orange-50">
                <Bug className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Não se preocupe!</strong> Este erro foi automaticamente registrado 
                  e nossa equipe será notificada. Você pode tentar as opções abaixo.
                </AlertDescription>
              </Alert>

              {/* Informações do erro (apenas em desenvolvimento) */}
              {!import.meta.env.PROD && this.state.error && (
                <div className="bg-gray-100 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">🔍 Detalhes do Erro (Dev):</h4>
                  <p className="text-sm text-gray-600 font-mono break-all">
                    {this.state.error.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    ID: {this.state.errorId}
                  </p>
                </div>
              )}

              {/* Ações do usuário */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-800">💡 O que você pode fazer:</h3>
                
                <div className="grid gap-3">
                  <Button 
                    onClick={this.handleRetry}
                    className="w-full"
                    size="lg"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Tentar Novamente
                  </Button>
                  
                  <Button 
                    onClick={this.handleGoHome}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Voltar ao Início
                  </Button>
                  
                  <Button 
                    onClick={this.handleReportError}
                    variant="secondary"
                    className="w-full"
                    size="lg"
                  >
                    <Bug className="w-4 h-4 mr-2" />
                    Reportar Erro
                  </Button>
                </div>
              </div>

              {/* Instruções adicionais */}
              <div className="text-sm text-gray-600 bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">📋 Dicas para resolver:</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Recarregue a página (Ctrl+F5 ou Cmd+R)</li>
                  <li>Verifique sua conexão com a internet</li>
                  <li>Limpe o cache do navegador</li>
                  <li>Tente usar outro navegador</li>
                  <li>Se persistir, contate o suporte técnico</li>
                </ul>
              </div>

              {/* Informações técnicas */}
              <div className="text-xs text-gray-400 text-center border-t pt-4">
                Erro capturado em: {new Date().toLocaleString('pt-BR')}
                {this.state.errorId && (
                  <> | ID: {this.state.errorId}</>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 🎯 HOC para wrappear componentes com Error Boundary
 */
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary componentName={componentName || Component.displayName || Component.name}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${componentName || Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

export default ErrorBoundary;
