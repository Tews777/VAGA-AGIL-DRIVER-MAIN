import { useCallback, useMemo } from 'react';
import { logger } from '@/utils/logger';

// Hook otimizado para localStorage com debouncing e cache
export const useOptimizedStorage = () => {
  // Cache em memória para evitar acessos desnecessários ao localStorage
  const cache = useMemo(() => new Map<string, any>(), []);
  
  const getItem = useCallback(<T>(key: string, defaultValue?: T): T | null => {
    // Verificar cache primeiro
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue || null;
      
      const parsed = JSON.parse(item);
      cache.set(key, parsed); // Cachear o resultado
      return parsed;
    } catch (error) {
      logger.error(`Erro ao ler localStorage key "${key}":`, error);
      return defaultValue || null;
    }
  }, [cache]);

  const setItem = useCallback((key: string, value: any) => {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      cache.set(key, value); // Atualizar cache
    } catch (error) {
      logger.error(`Erro ao salvar localStorage key "${key}":`, error);
    }
  }, [cache]);

  const removeItem = useCallback((key: string) => {
    try {
      localStorage.removeItem(key);
      cache.delete(key); // Remover do cache
    } catch (error) {
      logger.error(`Erro ao remover localStorage key "${key}":`, error);
    }
  }, [cache]);

  const clearCache = useCallback(() => {
    cache.clear();
  }, [cache]);

  return {
    getItem,
    setItem,
    removeItem,
    clearCache
  };
};
