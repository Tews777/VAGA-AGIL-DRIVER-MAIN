import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Hook para gerenciar o desempenho de operações que consomem muitos recursos
 * @param callback A função que será executada de forma otimizada
 * @param delay Atraso em ms para o debounce
 * @returns Objeto com funções e estados para gerenciar a operação
 */
export function useOptimizedOperation<T>(callback: () => Promise<T>, delay = 300) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  // Ref para armazenar o último timeout
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref para controlar se uma operação já está em andamento
  const operationInProgressRef = useRef(false);
  
  // Função que executa a operação com debounce
  const executeOperation = useCallback(() => {
    // Limpar o timeout anterior se existir
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Se uma operação já estiver em andamento, agendar para depois
    if (operationInProgressRef.current) {
      timeoutRef.current = setTimeout(() => {
        executeOperation();
      }, delay);
      return;
    }
    
    // Configurar o novo timeout
    timeoutRef.current = setTimeout(async () => {
      try {
        setIsLoading(true);
        operationInProgressRef.current = true;
        setError(null);
        
        const result = await callback();
        setLastResult(result);
        
        return result;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro desconhecido'));
        return null;
      } finally {
        setIsLoading(false);
        operationInProgressRef.current = false;
      }
    }, delay);
  }, [callback, delay]);
  
  // Função para executar imediatamente, sem debounce
  const executeImmediate = useCallback(async () => {
    // Limpar o timeout anterior se existir
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Se uma operação já estiver em andamento, retornar
    if (operationInProgressRef.current) {
      return;
    }
    
    try {
      setIsLoading(true);
      operationInProgressRef.current = true;
      setError(null);
      
      const result = await callback();
      setLastResult(result);
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro desconhecido'));
      return null;
    } finally {
      setIsLoading(false);
      operationInProgressRef.current = false;
    }
  }, [callback]);
  
  // Limpar o timeout quando o componente for desmontado
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return {
    execute: executeOperation,
    executeImmediate,
    isLoading,
    lastResult,
    error,
    reset: () => {
      setLastResult(null);
      setError(null);
    }
  };
}
