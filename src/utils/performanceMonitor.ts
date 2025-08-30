import { logger } from './logger';

// Sistema de monitoramento de performance
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Marcar início de uma operação
  startMeasure(name: string): void {
    this.metrics.set(`${name}_start`, performance.now());
  }

  // Marcar fim de uma operação e calcular duração
  endMeasure(name: string): number {
    const start = this.metrics.get(`${name}_start`);
    if (!start) {
      logger.warn(`Medição "${name}" não foi iniciada`);
      return 0;
    }

    const duration = performance.now() - start;
    this.metrics.delete(`${name}_start`);
    
    // Log apenas em desenvolvimento ou se duração for alta
    if (process.env.NODE_ENV === 'development' || duration > 100) {
      logger.log(`🔍 Performance: ${name} levou ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  // Medir tempo de carregamento de componentes
  measureComponentRender(componentName: string, renderFn: () => void): void {
    this.startMeasure(`component_${componentName}`);
    renderFn();
    this.endMeasure(`component_${componentName}`);
  }

  // Medir operações do localStorage
  measureLocalStorageOperation<T>(operation: string, fn: () => T): T {
    this.startMeasure(`localStorage_${operation}`);
    const result = fn();
    this.endMeasure(`localStorage_${operation}`);
    return result;
  }

  // Obter métricas do navegador
  getNavigationTiming(): void {
    if (typeof window !== 'undefined' && window.performance) {
      const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      logger.log('📊 Navigation Timing:', {
        'DNS Lookup': `${timing.domainLookupEnd - timing.domainLookupStart}ms`,
        'TCP Connection': `${timing.connectEnd - timing.connectStart}ms`,
        'Request/Response': `${timing.responseEnd - timing.requestStart}ms`,
        'DOM Processing': `${timing.domComplete - timing.domContentLoadedEventStart}ms`,
        'Load Complete': `${timing.loadEventEnd - timing.fetchStart}ms`
      });
    }
  }
}

// Hook para usar o monitor de performance
export const usePerformanceMonitor = () => {
  return PerformanceMonitor.getInstance();
};
