/**
 * 📝 Sistema de Logs Centralizado
 * 
 * Este arquivo gerencia todos os logs do sistema, salvando erros
 * automaticamente em arquivos locais para facilitar a depuração.
 */

export interface LogEntry {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  message: string;
  component: string;
  details?: any;
  stack?: string;
  userId?: string;
}

class LoggerService {
  private isProduction = import.meta.env.PROD;
  private maxLogSize = 1000; // Máximo de logs em memória
  private logs: LogEntry[] = [];

  /**
   * 🚨 Registra um erro crítico
   */
  error(message: string, component: string, details?: any, error?: Error) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      component,
      details,
      stack: error?.stack,
      userId: this.getCurrentUserId()
    };

    this.addLog(logEntry);
    this.saveToLocalStorage();
    
    // Em desenvolvimento, também mostra no console
    if (!this.isProduction) {
      console.error(`🚨 [${component}] ${message}`, details, error);
    }
  }

  /**
   * ⚠️ Registra um aviso
   */
  warn(message: string, component: string, details?: any) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      component,
      details,
      userId: this.getCurrentUserId()
    };

    this.addLog(logEntry);
    
    if (!this.isProduction) {
      console.warn(`⚠️ [${component}] ${message}`, details);
    }
  }

  /**
   * ℹ️ Registra informação
   */
  info(message: string, component: string, details?: any) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      component,
      details,
      userId: this.getCurrentUserId()
    };

    this.addLog(logEntry);
    
    if (!this.isProduction) {
      console.info(`ℹ️ [${component}] ${message}`, details);
    }
  }

  /**
   * 🔍 Registra debug (apenas em desenvolvimento)
   */
  debug(message: string, component: string, details?: any) {
    if (this.isProduction) return;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      message,
      component,
      details,
      userId: this.getCurrentUserId()
    };

    this.addLog(logEntry);
    console.debug(`🔍 [${component}] ${message}`, details);
  }

  /**
   * 📥 Adiciona log à lista interna
   */
  private addLog(logEntry: LogEntry) {
    this.logs.push(logEntry);
    
    // Remove logs antigos se exceder o limite
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }
  }

  /**
   * 💾 Salva logs no localStorage
   */
  private saveToLocalStorage() {
    try {
      const logsToSave = this.logs.slice(-100); // Salva apenas os últimos 100
      localStorage.setItem('system-logs', JSON.stringify(logsToSave));
    } catch (error) {
      console.error('Erro ao salvar logs no localStorage:', error);
    }
  }

  /**
   * 📤 Exporta logs para arquivo
   */
  exportLogs(): string {
    const logsText = this.logs.map(log => 
      `[${log.timestamp}] ${log.level} - ${log.component}: ${log.message}` +
      (log.details ? `\nDetalhes: ${JSON.stringify(log.details, null, 2)}` : '') +
      (log.stack ? `\nStack: ${log.stack}` : '') + '\n'
    ).join('\n');

    return logsText;
  }

  /**
   * 📋 Obtém todos os logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * 🧹 Limpa todos os logs
   */
  clearLogs() {
    this.logs = [];
    localStorage.removeItem('system-logs');
  }

  /**
   * 📊 Obtém estatísticas dos logs
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      errors: this.logs.filter(l => l.level === 'ERROR').length,
      warnings: this.logs.filter(l => l.level === 'WARN').length,
      info: this.logs.filter(l => l.level === 'INFO').length,
      debug: this.logs.filter(l => l.level === 'DEBUG').length
    };

    return stats;
  }

  /**
   * 👤 Obtém ID do usuário atual
   */
  private getCurrentUserId(): string {
    try {
      const session = localStorage.getItem('vaga-driver-session');
      if (session) {
        const parsed = JSON.parse(session);
        return parsed.user?.id || 'unknown';
      }
    } catch (error) {
      // Ignora erro silenciosamente
    }
    return 'unknown';
  }

  /**
   * 🔄 Carrega logs do localStorage na inicialização
   */
  initializeFromStorage() {
    try {
      const savedLogs = localStorage.getItem('system-logs');
      if (savedLogs) {
        this.logs = JSON.parse(savedLogs);
      }
    } catch (error) {
      console.error('Erro ao carregar logs do localStorage:', error);
    }
  }
}

// 🌍 Instância global do logger
export const logger = new LoggerService();

// Inicializa logs salvos
logger.initializeFromStorage();

// 🔧 Hook para capturar erros não tratados
window.addEventListener('error', (event) => {
  logger.error(
    'Erro global não tratado',
    'WindowErrorHandler',
    {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    },
    event.error
  );
});

// 🔧 Hook para capturar promises rejeitadas
window.addEventListener('unhandledrejection', (event) => {
  logger.error(
    'Promise rejeitada não tratada',
    'WindowErrorHandler',
    {
      reason: event.reason
    }
  );
});

/**
 * 🎯 Hook React para usar o logger
 */
export const useLogger = () => {
  return {
    logError: (message: string, component: string, details?: any, error?: Error) => 
      logger.error(message, component, details, error),
    logWarn: (message: string, component: string, details?: any) => 
      logger.warn(message, component, details),
    logInfo: (message: string, component: string, details?: any) => 
      logger.info(message, component, details),
    logDebug: (message: string, component: string, details?: any) => 
      logger.debug(message, component, details),
    exportLogs: () => logger.exportLogs(),
    getLogs: () => logger.getLogs(),
    clearLogs: () => logger.clearLogs(),
    getStats: () => logger.getStats()
  };
};

export default logger;
