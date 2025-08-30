import { useCallback, useRef } from 'react';

// Cache em memória para evitar múltiplas leituras do localStorage
const storageCache = new Map<string, any>();
const cacheTimestamps = new Map<string, number>();

// Tempo de vida do cache (5 minutos)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Hook otimizado para localStorage com cache em memória
 */
export const useOptimizedStorage = () => {
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const getItem = useCallback((key: string, defaultValue?: any) => {
    const now = Date.now();
    const cachedTimestamp = cacheTimestamps.get(key);
    
    // Verificar se o cache ainda é válido
    if (cachedTimestamp && (now - cachedTimestamp) < CACHE_TTL && storageCache.has(key)) {
      return storageCache.get(key);
    }

    try {
      const item = localStorage.getItem(key);
      const value = item ? JSON.parse(item) : defaultValue;
      
      // Atualizar cache
      storageCache.set(key, value);
      cacheTimestamps.set(key, now);
      
      return value;
    } catch (error) {
      console.warn(`Erro ao ler localStorage para chave ${key}:`, error);
      return defaultValue;
    }
  }, []);

  const setItem = useCallback((key: string, value: any, debounceMs = 100) => {
    // Atualizar cache imediatamente
    storageCache.set(key, value);
    cacheTimestamps.set(key, Date.now());

    // Debounce para escrita no localStorage
    const existingTimer = debounceTimers.current.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        debounceTimers.current.delete(key);
      } catch (error) {
        console.warn(`Erro ao escrever localStorage para chave ${key}:`, error);
      }
    }, debounceMs);

    debounceTimers.current.set(key, timer);
  }, []);

  const removeItem = useCallback((key: string) => {
    storageCache.delete(key);
    cacheTimestamps.delete(key);
    
    const existingTimer = debounceTimers.current.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      debounceTimers.current.delete(key);
    }

    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Erro ao remover localStorage para chave ${key}:`, error);
    }
  }, []);

  const clearCache = useCallback(() => {
    storageCache.clear();
    cacheTimestamps.clear();
  }, []);

  return {
    getItem,
    setItem,
    removeItem,
    clearCache
  };
};

/**
 * Versão simplificada para uso direto
 */
export const optimizedStorage = {
  getItem: (key: string, defaultValue?: any) => {
    const now = Date.now();
    const cachedTimestamp = cacheTimestamps.get(key);
    
    if (cachedTimestamp && (now - cachedTimestamp) < CACHE_TTL && storageCache.has(key)) {
      return storageCache.get(key);
    }

    try {
      const item = localStorage.getItem(key);
      const value = item ? JSON.parse(item) : defaultValue;
      
      storageCache.set(key, value);
      cacheTimestamps.set(key, now);
      
      return value;
    } catch (error) {
      console.warn(`Erro ao ler localStorage para chave ${key}:`, error);
      return defaultValue;
    }
  },

  setItem: (key: string, value: any) => {
    storageCache.set(key, value);
    cacheTimestamps.set(key, Date.now());

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Erro ao escrever localStorage para chave ${key}:`, error);
    }
  },

  removeItem: (key: string) => {
    storageCache.delete(key);
    cacheTimestamps.delete(key);
    
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Erro ao remover localStorage para chave ${key}:`, error);
    }
  }
};
