import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './use-toast';

// Interfaces TypeScript
export interface GaiolaData {
  gaiola: string;
  chegou: boolean;
  horarioChegada: string | null;
  vaga: string | null;
  motorista: string;
  observacoes: string;
  status: "esperar" | "chamado" | "carregando" | "finalizado" | "atrasado";
  chamadoPor: string | null;
  chamadoEm: string | null;
  lastUpdate: string;
  synced: boolean;
}

// Interfaces
export interface SyncStatus {
  isActive: boolean;
  lastSync: Date | null;
  nextSync: Date | null;
  failedAttempts: number;
  totalSyncs: number;
}

export interface RealtimeHookReturn {
  gaiolasData: Record<string, GaiolaData>;
  isLoading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  syncWithSheet: () => Promise<void>;
  updateGaiolaStatus: (gaiolaId: string, updates: Partial<GaiolaData>) => Promise<void>;
  forceSyncAll: () => Promise<void>;
  clearCache: () => Promise<void>;
  getGaiolaByKey: (key: string) => GaiolaData | undefined;
  getSyncStats: () => SyncStats;
  reloadGaiolasData: () => void;
}

export interface SyncStats {
  totalGaiolas: number;
  syncedGaiolas: number;
  errorGaiolas: number;
  lastSyncDuration: number;
  averageSyncTime: number;
  uptime: number;
}

// Constantes
const CONSTANTS = {
  STORAGE_KEYS: {
    GAIOLAS_DATA: 'realtime_gaiolas_data',
    SYNC_STATUS: 'realtime_sync_status',
    SYNC_STATS: 'realtime_sync_stats'
  },
  SYNC_INTERVAL: 3 * 60 * 1000, // 3 minutos
  RETRY_INTERVAL: 30 * 1000, // 30 segundos para retry
  MAX_RETRY_ATTEMPTS: 3,
  CACHE_VERSION: '2.0',
  EVENTS: {
    MANUAL_SYNC: 'gaiolasManualSync',
    DATA_UPDATE: 'gaiolas_data_update',
    SYNC_STATUS_CHANGE: 'sync_status_change'
  }
} as const;

export const useRealtimeData = (): RealtimeHookReturn => {
  // Estados principais
  const [gaiolasData, setGaiolasData] = useState<Record<string, GaiolaData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isActive: false,
    lastSync: null,
    nextSync: null,
    failedAttempts: 0,
    totalSyncs: 0
  });

  const { toast } = useToast();

  // Função para carregar dados do cache
  const loadFromCache = useCallback((): Record<string, GaiolaData> => {
    try {
      const cached = localStorage.getItem(CONSTANTS.STORAGE_KEYS.GAIOLAS_DATA);
      if (cached) {
        const data = JSON.parse(cached);
        return data || {};
      }
    } catch (error) {
      console.error('Erro ao carregar cache:', error);
    }
    return {};
  }, []);

  // ❌ FUNÇÃO SYNC DESABILITADA - Não gera mais dados mock automáticos
  const syncWithSheet = useCallback(async (): Promise<void> => {
    console.log('⚠️  syncWithSheet() chamada - mas sincronização automática está DESABILITADA');
    console.log('📋 Para adicionar dados de gaiolas, use o sistema de upload manual no painel administrativo');
    console.log('🚫 Mensagens "Dados sincronizados" não aparecerão mais');
    return Promise.resolve();
  }, []);

  // Função para atualizar status de gaiola individual
  const updateGaiolaStatus = useCallback(async (gaiolaId: string, updates: Partial<GaiolaData>): Promise<void> => {
    try {
      setGaiolasData(prev => {
        const updated = {
          ...prev,
          [gaiolaId]: {
            ...prev[gaiolaId],
            ...updates,
            lastUpdate: new Date().toISOString()
          }
        };
        
        // Salvar no cache
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.GAIOLAS_DATA, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error(`Erro ao atualizar gaiola ${gaiolaId}:`, error);
      setError(`Erro ao atualizar gaiola ${gaiolaId}`);
    }
  }, []);

  // Função para forçar sincronização completa - DESABILITADA
  const forceSyncAll = useCallback(async (): Promise<void> => {
    console.log('❌ forceSyncAll() desabilitada - use upload manual de planilhas');
  }, []);

  // Função para forçar recarregamento dos dados
  const reloadGaiolasData = useCallback(() => {
    console.log('🔄 Recarregando dados das gaiolas...');
    const cachedData = loadFromCache();
    setGaiolasData(cachedData);
    console.log(`✅ Recarregados ${Object.keys(cachedData).length} itens`);
  }, [loadFromCache]);

  // Função para limpar cache
  const clearCache = useCallback(async (): Promise<void> => {
    localStorage.removeItem(CONSTANTS.STORAGE_KEYS.GAIOLAS_DATA);
    localStorage.removeItem(CONSTANTS.STORAGE_KEYS.SYNC_STATUS);
    localStorage.removeItem(CONSTANTS.STORAGE_KEYS.SYNC_STATS);
    
    setGaiolasData({});
    setSyncStatus({
      isActive: false,
      lastSync: null,
      nextSync: null,
      failedAttempts: 0,
      totalSyncs: 0
    });
    
    toast({
      title: "Cache limpo",
      description: "Todos os dados em cache foram removidos",
    });
  }, [toast]);

  // Função para buscar gaiola por chave
  const getGaiolaByKey = useCallback((key: string): GaiolaData | undefined => {
    return gaiolasData[key];
  }, [gaiolasData]);

  // Função para obter estatísticas de sincronização
  const getSyncStats = useCallback((): SyncStats => {
    const totalGaiolas = Object.keys(gaiolasData).length;
    const syncedGaiolas = Object.values(gaiolasData).filter((g: any) => g.synced).length;
    const errorGaiolas = totalGaiolas - syncedGaiolas;
    
    try {
      const savedStats = localStorage.getItem(CONSTANTS.STORAGE_KEYS.SYNC_STATS);
      const stats = savedStats ? JSON.parse(savedStats) : {};
      
      return {
        totalGaiolas,
        syncedGaiolas,
        errorGaiolas,
        lastSyncDuration: stats.lastSyncDuration || 0,
        averageSyncTime: stats.lastSyncDuration || 0,
        uptime: syncStatus.totalSyncs * CONSTANTS.SYNC_INTERVAL / 1000
      };
    } catch {
      return {
        totalGaiolas,
        syncedGaiolas,
        errorGaiolas,
        lastSyncDuration: 0,
        averageSyncTime: 0,
        uptime: 0
      };
    }
  }, [gaiolasData, syncStatus.totalSyncs]);

  // ❌ SINCRONIZAÇÃO AUTOMÁTICA DESABILITADA
  useEffect(() => {
    console.log('🚫 Sistema de sincronização automática desabilitado');
    console.log('📋 Use uploads manuais no painel administrativo');
    return () => {
      // Cleanup se necessário
    };
  }, []);

  // ❌ EVENT LISTENERS DESNECESSÁRIOS REMOVIDOS
  useEffect(() => {
    console.log('🚫 Event listeners de sincronização automática desabilitados');
    return () => {
      // Cleanup básico
    };
  }, []);

  // Carregamento inicial - SEM sincronização automática
  useEffect(() => {
    const initializeData = async () => {
      console.log('🔄 Inicializando dados (SEM sincronização automática)...');
      
      // Carregar dados do cache
      const cachedData = loadFromCache();
      if (Object.keys(cachedData).length > 0) {
        setGaiolasData(cachedData);
        console.log(`✅ Carregados ${Object.keys(cachedData).length} itens do cache`);
      } else {
        console.log('📝 Nenhum dado em cache - use upload de planilhas para adicionar dados');
      }

      // Carregar status de sincronização
      try {
        const savedStatus = localStorage.getItem(CONSTANTS.STORAGE_KEYS.SYNC_STATUS);
        if (savedStatus) {
          const status = JSON.parse(savedStatus);
          setSyncStatus(prev => ({
            ...prev,
            ...status,
            isActive: false, // Resetar estado ativo
            lastSync: status.lastSync ? new Date(status.lastSync) : null
          }));
        }
      } catch (error) {
        console.error('Erro ao carregar status de sincronização:', error);
      }

      console.log('✅ Sistema configurado para uploads manuais apenas');
    };

    initializeData();
  }, [loadFromCache]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Cleanup do useRealtimeData');
    };
  }, []);

  return {
    gaiolasData,
    isLoading,
    error,
    syncStatus,
    syncWithSheet,
    updateGaiolaStatus,
    forceSyncAll,
    clearCache,
    getGaiolaByKey,
    getSyncStats,
    reloadGaiolasData
  };
};
