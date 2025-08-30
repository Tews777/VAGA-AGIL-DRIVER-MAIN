/**
 * 🚨 Hook para Captura e Registro de Erros
 * 
 * Este hook fornece funcionalidades avançadas para captura,
 * registro e tratamento de erros em componentes React.
 */

import { useCallback, useEffect } from 'react';
import { logger } from '@/utils/sistemaLogs';
import { useToast } from '@/hooks/use-toast';

interface ErrorContext {
  component: string;
  action?: string;
  userId?: string;
  additionalData?: Record<string, any>;
}

interface ErrorInfo {
  componentStack?: string;
  errorBoundary?: string;
  errorBoundaryStack?: string;
}

export const useErrorLogger = (componentName: string) => {
  const { toast } = useToast();
  const isDevelopment = !import.meta.env.PROD;

  /**
   * 🔴 Registra erro crítico
   */
  const logCriticalError = useCallback((
    error: Error,
    context: ErrorContext,
    errorInfo?: ErrorInfo
  ) => {
    const errorData = {
      message: error.message,
      stack: error.stack,
      component: context.component,
      action: context.action,
      userId: context.userId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      additionalData: context.additionalData,
      errorInfo
    };

    // Log no sistema
    logger.error(
      `Erro crítico: ${error.message}`,
      context.component,
      errorData,
      error
    );

    // Em desenvolvimento, também no console
    if (isDevelopment) {
      console.group(`🚨 ERRO CRÍTICO - ${context.component}`);
      console.error('Error:', error);
      console.error('Context:', context);
      console.error('ErrorInfo:', errorInfo);
      console.error('Full Data:', errorData);
      console.groupEnd();
    }

    // Salvar no localStorage para backup
    try {
      const existingErrors = JSON.parse(localStorage.getItem('critical-errors') || '[]');
      existingErrors.push(errorData);
      // Manter apenas os últimos 50 erros
      if (existingErrors.length > 50) {
        existingErrors.splice(0, existingErrors.length - 50);
      }
      localStorage.setItem('critical-errors', JSON.stringify(existingErrors));
    } catch (storageError) {
      console.error('Erro ao salvar no localStorage:', storageError);
    }

    // Mostrar toast com instruções claras
    showUserFriendlyError(error, context);

  }, [componentName, isDevelopment, toast]);

  /**
   * ⚠️ Registra erro não crítico
   */
  const logWarning = useCallback((
    message: string,
    context: Partial<ErrorContext>,
    additionalData?: any
  ) => {
    logger.warn(message, context.component || componentName, {
      action: context.action,
      additionalData,
      timestamp: new Date().toISOString()
    });

    if (isDevelopment) {
      console.warn(`⚠️ [${context.component || componentName}] ${message}`, additionalData);
    }
  }, [componentName, isDevelopment]);

  /**
   * 📊 Registra evento de informação
   */
  const logInfo = useCallback((
    message: string,
    context: Partial<ErrorContext>,
    additionalData?: any
  ) => {
    logger.info(message, context.component || componentName, {
      action: context.action,
      additionalData,
      timestamp: new Date().toISOString()
    });
  }, [componentName]);

  /**
   * 🎯 Wrapper para operações async com tratamento de erro
   */
  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T | null> => {
    try {
      const result = await operation();
      logInfo(`Operação bem-sucedida: ${context.action}`, context);
      return result;
    } catch (error) {
      logCriticalError(error as Error, context);
      return null;
    }
  }, [logCriticalError, logInfo]);

  /**
   * 💬 Mostra erro amigável para o usuário
   */
  const showUserFriendlyError = useCallback((
    error: Error,
    context: ErrorContext
  ) => {
    const errorMessages = {
      // Erros de rede
      'NetworkError': {
        title: '🌐 Erro de Conexão',
        message: 'Problema na conexão com o servidor. Verifique sua internet e tente novamente.',
        actions: ['Verificar conexão', 'Recarregar página']
      },
      'Failed to fetch': {
        title: '📡 Falha na Comunicação',
        message: 'Não foi possível conectar ao servidor. Tente novamente em alguns instantes.',
        actions: ['Aguardar e tentar novamente', 'Verificar status do sistema']
      },
      // Erros de autenticação
      'Unauthorized': {
        title: '🔐 Sessão Expirada',
        message: 'Sua sessão expirou. Faça login novamente para continuar.',
        actions: ['Fazer login novamente']
      },
      // Erros de dados
      'Invalid data': {
        title: '📋 Dados Inválidos',
        message: 'Os dados fornecidos não são válidos. Verifique e tente novamente.',
        actions: ['Verificar dados', 'Consultar documentação']
      },
      // Erro padrão
      'default': {
        title: '⚠️ Erro Inesperado',
        message: 'Ocorreu um erro inesperado. Nossa equipe foi notificada.',
        actions: ['Tentar novamente', 'Consultar logs', 'Contatar suporte']
      }
    };

    const errorKey = Object.keys(errorMessages).find(key => 
      error.message.includes(key)
    ) || 'default';

    const errorConfig = errorMessages[errorKey];

    const actionsList = errorConfig.actions.map((action, index) => `${index + 1}. ${action}`).join('\n');
    
    const description = `${errorConfig.message}\n\n💡 O que você pode fazer:\n${actionsList}\n\nID do Erro: ${Date.now().toString(36)} | Componente: ${context.component}`;

    toast({
      variant: "destructive",
      title: errorConfig.title,
      description,
      duration: 8000, // 8 segundos para dar tempo de ler
    });
  }, [toast]);

  /**
   * 📤 Exporta erros para análise
   */
  const exportErrors = useCallback(() => {
    try {
      const criticalErrors = JSON.parse(localStorage.getItem('critical-errors') || '[]');
      const systemLogs = logger.getLogs();
      
      const exportData = {
        timestamp: new Date().toISOString(),
        criticalErrors,
        systemLogs: systemLogs.filter(log => log.level === 'ERROR'),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error-report-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "📊 Relatório Exportado",
        description: "Relatório de erros baixado com sucesso.",
      });

    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
    }
  }, [toast]);

  /**
   * 🧹 Limpa logs de erro
   */
  const clearErrorLogs = useCallback(() => {
    localStorage.removeItem('critical-errors');
    logger.clearLogs();
    
    toast({
      title: "🧹 Logs Limpos",
      description: "Todos os logs de erro foram removidos.",
    });
  }, [toast]);

  // 🔧 Hook para capturar erros não tratados do componente
  useEffect(() => {
    const handleUnhandledError = (event: ErrorEvent) => {
      logCriticalError(
        new Error(event.message),
        {
          component: componentName,
          action: 'unhandled_error',
          additionalData: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        }
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logCriticalError(
        new Error(`Promise rejeitada: ${event.reason}`),
        {
          component: componentName,
          action: 'unhandled_promise_rejection',
          additionalData: {
            reason: event.reason
          }
        }
      );
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [componentName, logCriticalError]);

  return {
    logCriticalError,
    logWarning,
    logInfo,
    executeWithErrorHandling,
    exportErrors,
    clearErrorLogs,
    showUserFriendlyError
  };
};

export default useErrorLogger;
