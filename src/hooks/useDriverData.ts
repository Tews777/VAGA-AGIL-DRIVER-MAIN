// useDriverData.ts - Hook de gerenciamento de motoristas
// Versão profissional refatorada com padrões enterprise-grade

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { statusStore } from "./StatusStore";

// Interfaces TypeScript
export interface DriverData {
  id: string;
  gaiola: string; // A-1, A-2, etc. - expandido para A-Z
  motorista: string;
  status: "esperar_fora_hub" | "entrar_hub" | "chegou" | "atrasado";
  vaga?: string; // 1, 2, 3, etc.
  chegadaEm?: string;
  chamadoEm?: string;
  driverCheck: boolean;
  lastUpdate: string;
  tipoVeiculo?: string; // Novo campo para tipo de veículo
}

export interface DriverStats {
  total: number;
  esperandoFora: number;
  entrando: number;
  chegaram: number;
  atrasados: number;
  comCheck: number;
  comVaga: number;
}

export interface DriversByStatus {
  esperando: DriverData[];
  entrando: DriverData[];
  no_hub: DriverData[];
  atrasados: DriverData[];
}

export interface DriverHookReturn {
  driversData: Record<string, DriverData>;
  loadAllDriversData: () => Promise<void>;
  getDriverByGaiola: (gaiola: string) => DriverData | undefined;
  setDriverStatus: (gaiola: string, status: DriverData["status"], vaga?: string) => Promise<void>;
  toggleDriverCheck: (gaiola: string) => Promise<void>;
  markDriverDelayed: (gaiola: string, vagaId?: string, removeVaga?: boolean) => Promise<void>;
  resetDriver: (gaiola: string) => Promise<void>;
  getDriversByStatus: (status?: DriverData["status"]) => DriversByStatus | DriverData[];
  getDriversStats: () => DriverStats;
  updateDriverData: (driverId: string, updates: Partial<DriverData>) => Promise<void>;
  syncDriverNames: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

// Constantes
const CONSTANTS = {
  STORAGE_KEYS: {
    DRIVERS_DATA: 'drivers_data',
    DRIVERS_DATA_OBJ: 'drivers_data_obj',
    DRIVERS_PANEL_DATA: 'drivers_panel_data',
    FORCE_UPDATE: '_forceDriverUpdate',
    LAST_UPDATE_CHECK: '_lastDriverUpdateCheck'
  },
  UPDATE_INTERVAL: 3000, // 3 segundos
  DEBOUNCE_TIME: 300, // 300ms
  EVENTS: {
    DRIVER_STATUS_UPDATE: 'driver_status_update',
    STORAGE: 'storage',
    DRIVER_DELAYED: 'driver_delayed'
  },
  GAIOLA_PATTERN: /^([A-I])-(\d+)$/
} as const;

export const useDriverData = (): DriverHookReturn => {
  // Estados principais
  const [driversData, setDriversData] = useState<Record<string, DriverData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs para cleanup e controle
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventListenersAttached = useRef(false);

  // Função para gerar ID único
  const generateDriverId = useCallback((): string => {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Função para validar dados de motorista
  const validateDriverData = useCallback((data: any): data is DriverData => {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.id === 'string' &&
      typeof data.gaiola === 'string' &&
      typeof data.motorista === 'string' &&
      ['esperar_fora_hub', 'entrar_hub', 'chegou', 'atrasado'].includes(data.status) &&
      typeof data.driverCheck === 'boolean'
    );
  }, []);

  // Função para normalizar dados de motorista
  const normalizeDriverData = useCallback((data: any): DriverData => {
    // Verificar se tipoVeiculo existe, mesmo que seja undefined
    const hasTypeField = 'tipoVeiculo' in data;
    console.log(`📊 normalizeDriverData - Gaiola: ${data.gaiola}, tipoVeiculo existe: ${hasTypeField}, valor: ${data.tipoVeiculo || 'não definido'}`);
    
    return {
      id: data.id || generateDriverId(),
      gaiola: data.gaiola || "",
      motorista: data.motorista || data.name || "Sem nome",
      status: data.status || "esperar_fora_hub",
      vaga: data.vaga,
      chegadaEm: data.chegadaEm,
      chamadoEm: data.chamadoEm,
      driverCheck: data.driverCheck || (data.status === "chegou"),
      lastUpdate: data.lastUpdate || new Date().toISOString(),
      tipoVeiculo: data.tipoVeiculo // Incluir tipo de veículo sempre
    };
  }, [generateDriverId]);
  
  // Função para garantir que todos os motoristas tenham o campo tipoVeiculo
  const ensureDriverVehicleType = useCallback((drivers: Record<string, DriverData>): Record<string, DriverData> => {
    const updatedDrivers = {...drivers};
    
    // Verificar cada motorista e garantir que tipoVeiculo exista
    Object.keys(updatedDrivers).forEach(key => {
      if (!('tipoVeiculo' in updatedDrivers[key])) {
        console.log(`🚗 Motorista ${key} não tem campo tipoVeiculo, adicionando como undefined`);
        updatedDrivers[key] = {
          ...updatedDrivers[key],
          tipoVeiculo: undefined
        };
      }
    });
    
    return updatedDrivers;
  }, []);

  // Função para carregar dados no formato objeto
  const loadFromObjectFormat = useCallback((): Record<string, DriverData> | null => {
    try {
      const savedData = localStorage.getItem(CONSTANTS.STORAGE_KEYS.DRIVERS_DATA_OBJ);
      if (!savedData) return null;

      const parsed = JSON.parse(savedData);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null;
      }

      const normalizedData: Record<string, DriverData> = {};
      Object.entries(parsed).forEach(([key, value]) => {
        if (validateDriverData(value)) {
          normalizedData[key] = normalizeDriverData(value);
        }
      });

      return Object.keys(normalizedData).length > 0 ? normalizedData : null;
    } catch (error) {
      console.error('Erro ao carregar formato objeto:', error);
      return null;
    }
  }, [validateDriverData, normalizeDriverData]);

  // Função para carregar dados no formato array
  const loadFromArrayFormat = useCallback((): Record<string, DriverData> | null => {
    try {
      const savedData = localStorage.getItem(CONSTANTS.STORAGE_KEYS.DRIVERS_DATA);
      if (!savedData) return null;

      const parsed = JSON.parse(savedData);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return null;
      }

      const normalizedData: Record<string, DriverData> = {};
      parsed.forEach(item => {
        const driver = normalizeDriverData(item);
        normalizedData[driver.id] = driver;
      });

      return normalizedData;
    } catch (error) {
      console.error('Erro ao carregar formato array:', error);
      return null;
    }
  }, [normalizeDriverData]);

  // Função principal para carregar todos os dados
  const loadAllDriversData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Tentar carregar do formato objeto primeiro
      let driversData = loadFromObjectFormat();
      
      // Se não encontrar, tentar formato array
      if (!driversData) {
        driversData = loadFromArrayFormat();
        
        // Se encontrou dados no formato array, salvar também como objeto
        if (driversData) {
          localStorage.setItem(
            CONSTANTS.STORAGE_KEYS.DRIVERS_DATA_OBJ, 
            JSON.stringify(driversData)
          );
        }
      }

      // Se ainda não encontrou dados, inicializar vazio
      if (!driversData) {
        driversData = {};
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.DRIVERS_DATA_OBJ, JSON.stringify({}));
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.DRIVERS_DATA, JSON.stringify([]));
      }

      // Garantir que todos os motoristas tenham o campo tipoVeiculo
      const updatedDriversData = ensureDriverVehicleType(driversData);
      
      setDriversData(updatedDriversData);
      console.log(`Carregados ${Object.keys(updatedDriversData).length} motoristas`);

    } catch (error) {
      console.error('Erro ao carregar dados dos motoristas:', error);
      setError('Erro ao carregar dados dos motoristas');
      setDriversData({});
    } finally {
      setIsLoading(false);
    }
  }, [loadFromObjectFormat, loadFromArrayFormat, ensureDriverVehicleType]);

  // Função para salvar dados em todos os formatos
  const saveDriversData = useCallback((data: Record<string, DriverData>) => {
    try {
      // Salvar formato objeto
      localStorage.setItem(CONSTANTS.STORAGE_KEYS.DRIVERS_DATA_OBJ, JSON.stringify(data));
      
      // Salvar formato array
      const arrayData = Object.values(data).map(driver => ({
        ...driver,
        name: driver.motorista // Para compatibilidade
      }));
      localStorage.setItem(CONSTANTS.STORAGE_KEYS.DRIVERS_DATA, JSON.stringify(arrayData));
      localStorage.setItem(CONSTANTS.STORAGE_KEYS.DRIVERS_PANEL_DATA, JSON.stringify(arrayData));
      
      // 🔄 SINCRONIZAR com useRealtimeData
      syncWithRealtimeData(data);
      
    } catch (error) {
      console.error('Erro ao salvar dados dos motoristas:', error);
      setError('Erro ao salvar dados dos motoristas');
    }
  }, []);

  // 🆕 Função para sincronizar dados com useRealtimeData
  const syncWithRealtimeData = useCallback((data: Record<string, DriverData>) => {
    try {
      const gaiolasDataForRealtimeHook: Record<string, any> = {};
      
      Object.entries(data).forEach(([_, driverData]) => {
        gaiolasDataForRealtimeHook[driverData.gaiola] = {
          gaiola: driverData.gaiola,
          motorista: driverData.motorista,
          status: driverData.status,
          vaga: driverData.vaga || null,
          chegadaEm: driverData.chegadaEm || null,
          chamadoEm: driverData.chamadoEm || null,
          driverCheck: driverData.driverCheck,
          lastUpdate: driverData.lastUpdate,
          synced: true,
          id: driverData.id,
          // Compatibilidade com formato antigo do useRealtimeData
          chegou: driverData.status === "chegou"
        };
      });
      
      // Salvar na chave que o useRealtimeData usa
      localStorage.setItem('realtime_gaiolas_data', JSON.stringify(gaiolasDataForRealtimeHook));
      console.log('🔄 Dados sincronizados com useRealtimeData:', Object.keys(gaiolasDataForRealtimeHook).length, 'gaiolas');
      
    } catch (error) {
      console.error('Erro ao sincronizar com useRealtimeData:', error);
    }
  }, []);

  // Função para atualizar dados de um motorista
  const updateDriverData = useCallback(async (
    driverId: string, 
    updates: Partial<DriverData>
  ): Promise<void> => {
    try {
      setDriversData(prev => {
        const currentData = prev[driverId];
        if (!currentData) {
          console.warn(`Motorista ${driverId} não encontrado`);
          return prev;
        }

        const newData: DriverData = {
          ...currentData,
          ...updates,
          lastUpdate: new Date().toISOString()
        };

        const updatedData = {
          ...prev,
          [driverId]: newData
        };

        // Salvar dados atualizados
        saveDriversData(updatedData);

        return updatedData;
      });

    } catch (error) {
      console.error(`Erro ao atualizar motorista ${driverId}:`, error);
      setError(`Erro ao atualizar motorista ${driverId}`);
    }
  }, [saveDriversData]);

  // Função para buscar motorista por gaiola
  const getDriverByGaiola = useCallback((gaiola: string): DriverData | undefined => {
    const match = gaiola.match(CONSTANTS.GAIOLA_PATTERN);
    if (!match) {
      console.warn(`Formato de gaiola inválido: ${gaiola}`);
      return undefined;
    }

    const [_, letra, numero] = match;
    const gaiolaFormatted = `${letra}-${parseInt(numero)}`;
    
    return Object.values(driversData).find(driver => 
      driver.gaiola === gaiolaFormatted
    );
  }, [driversData]);

  // Função para definir status do motorista
  const setDriverStatus = useCallback(async (
    gaiola: string, 
    status: DriverData["status"], 
    vaga?: string
  ): Promise<void> => {
    try {
      const driver = getDriverByGaiola(gaiola);
      if (!driver) {
        console.warn(`Motorista com gaiola ${gaiola} não encontrado`);
        return;
      }

      console.log(`Atualizando ${driver.motorista} (${gaiola}) para status "${status}"`);
      
      // Preservar explicitamente o tipo de veículo
      const tipoVeiculo = driver.tipoVeiculo;
      console.log(`🚗 Preservando tipo de veículo: "${tipoVeiculo || 'não definido'}"`);

      const updates: Partial<DriverData> = { 
        status,
        tipoVeiculo  // Sempre preservar o tipo de veículo
      };
      const timestamp = new Date().toISOString();
      const oldStatus = driver.status;

      // Configurar updates específicos por status
      switch (status) {
        case "entrar_hub":
          if (vaga) {
            updates.vaga = vaga;
            updates.chamadoEm = timestamp;
            updates.driverCheck = false;
          }
          break;

        case "chegou":
          updates.chegadaEm = timestamp;
          updates.driverCheck = true;
          break;

        case "atrasado":
          updates.vaga = vaga; // Manter referência se fornecida
          updates.driverCheck = false;
          if (!vaga) {
            updates.vaga = undefined;
            updates.chamadoEm = undefined;
          }
          break;

        case "esperar_fora_hub":
          updates.vaga = undefined;
          updates.chamadoEm = undefined;
          updates.chegadaEm = undefined;
          updates.driverCheck = false;
          break;
      }

      await updateDriverData(driver.id, updates);

      // 🔄 Disparar evento tradicional PRIMEIRO (compatibilidade)
      window.dispatchEvent(new CustomEvent(CONSTANTS.EVENTS.DRIVER_STATUS_UPDATE, {
        detail: {
          driverId: driver.id,
          gaiola,
          oldStatus,
          status,
          vagaId: vaga,
          timestamp
        }
      }));

      // Caso específico para motorista atrasado (comportamento original)
      if (status === "atrasado" && vaga) {
        window.dispatchEvent(new CustomEvent(CONSTANTS.EVENTS.DRIVER_DELAYED, {
          detail: { 
            vagaId: vaga,
            gaiola,
            timestamp,
            source: "setDriverStatus"
          }
        }));
      }

      // ✨ StatusStore como complemento (não deve interferir)
      try {
        statusStore.syncDriverStatus(gaiola, status, 'useDriverData.setDriverStatus');
        
        if (status === "atrasado" && vaga) {
          statusStore.markDriverDelayed(vaga, gaiola, true, 'useDriverData.setDriverStatus');
        }
      } catch (error) {
        console.warn('[StatusStore] Erro na sincronização (não crítico):', error);
      }

    } catch (error) {
      console.error(`Erro ao definir status do motorista:`, error);
      setError(`Erro ao definir status do motorista`);
    }
  }, [getDriverByGaiola, updateDriverData]);

  // Função para toggle do check do motorista
  const toggleDriverCheck = useCallback(async (gaiola: string): Promise<void> => {
    const driver = getDriverByGaiola(gaiola);
    if (driver) {
      await updateDriverData(driver.id, {
        driverCheck: !driver.driverCheck
      });
    }
  }, [getDriverByGaiola, updateDriverData]);

  // Função para marcar motorista como atrasado
  const markDriverDelayed = useCallback(async (gaiola: string, vagaId?: string, removeVaga: boolean = false): Promise<void> => {
    const driver = getDriverByGaiola(gaiola);
    if (driver) {
      console.log(`Marcando ${driver.motorista} (${gaiola}) como atrasado${removeVaga ? ' e removendo da vaga' : ''}`);
      
      // Atualizar localmente primeiro (funcionalidade original)
      await updateDriverData(driver.id, {
        status: "atrasado",
        vaga: removeVaga ? undefined : vagaId, // Remove vaga se removeVaga=true, senão mantém
        chamadoEm: undefined,
        driverCheck: false
      });
      
      // Disparar evento tradicional para manter compatibilidade
      window.dispatchEvent(new CustomEvent(CONSTANTS.EVENTS.DRIVER_DELAYED, {
        detail: {
          driverId: driver.id,
          gaiola,
          vagaId: removeVaga ? undefined : vagaId, // Remove vagaId do evento se removeVaga=true
          timestamp: new Date().toISOString(),
          source: 'useDriverData.markDriverDelayed',
          removeVaga: removeVaga
        }
      }));
      
      // ✨ Só sincronizar com StatusStore sem interferir no fluxo principal
      try {
        if (vagaId && !removeVaga) {
          statusStore.markDriverDelayed(vagaId, gaiola, true, 'useDriverData.markDriverDelayed');
        } else {
          statusStore.syncDriverStatus(gaiola, "atrasado", 'useDriverData.markDriverDelayed');
        }
      } catch (error) {
        console.warn('[StatusStore] Erro na sincronização (não crítico):', error);
      }
    } else {
      console.error(`Motorista com gaiola ${gaiola} não encontrado`);
    }
  }, [getDriverByGaiola, updateDriverData]);

  // Função para resetar motorista
  const resetDriver = useCallback(async (gaiola: string): Promise<void> => {
    const driver = getDriverByGaiola(gaiola);
    if (driver) {
      await updateDriverData(driver.id, {
        status: "esperar_fora_hub",
        vaga: undefined,
        chegadaEm: undefined,
        chamadoEm: undefined,
        driverCheck: false
      });
    }
  }, [getDriverByGaiola, updateDriverData]);

  // Função para obter motoristas por status
  const getDriversByStatus = useCallback((status?: DriverData["status"]) => {
    const drivers = Object.values(driversData);
    
    // Log para debug
    console.log(`Total de motoristas: ${drivers.length}`);
    console.log(`Status dos motoristas:`, drivers.map(d => ({ gaiola: d.gaiola, status: d.status })));
    
    if (status) {
      return drivers.filter(driver => driver.status === status);
    }

    // Verificar manualmente motoristas atrasados para debug
    const atrasadosCount = drivers.filter(d => d.status === "atrasado").length;
    console.log(`Total de motoristas atrasados encontrados: ${atrasadosCount}`);
    
    // Verificar localStorage diretamente para comparar
    try {
      const driversArr = JSON.parse(localStorage.getItem('drivers_data') || '[]');
      const atrasadosStorage = driversArr.filter((d: any) => d.status === "atrasado");
      console.log(`Total de motoristas atrasados no localStorage: ${atrasadosStorage.length}`);
      
      if (atrasadosStorage.length > 0) {
        console.log('Motoristas atrasados no localStorage:', atrasadosStorage.map((d: any) => d.gaiola));
      }
    } catch (error) {
      console.error('Erro ao verificar localStorage:', error);
    }
    
    // Retornar agrupado por status
    const result = {
      esperando: drivers.filter(d => d.status === "esperar_fora_hub"),
      entrando: drivers.filter(d => d.status === "entrar_hub"),
      no_hub: drivers.filter(d => d.status === "chegou"),
      atrasados: drivers.filter(d => d.status === "atrasado")
    };
    
    // Log do resultado para verificação
    console.log('Resultado agrupado:', {
      esperando: result.esperando.length,
      entrando: result.entrando.length,
      no_hub: result.no_hub.length,
      atrasados: result.atrasados.length
    });
    
    return result;
  }, [driversData]);

  // Função para obter estatísticas dos motoristas
  const getDriversStats = useCallback((): DriverStats => {
    const drivers = Object.values(driversData);
    
    return {
      total: drivers.length,
      esperandoFora: drivers.filter(d => d.status === "esperar_fora_hub").length,
      entrando: drivers.filter(d => d.status === "entrar_hub").length,
      chegaram: drivers.filter(d => d.status === "chegou").length,
      atrasados: drivers.filter(d => d.status === "atrasado").length,
      comCheck: drivers.filter(d => d.driverCheck).length,
      comVaga: drivers.filter(d => d.vaga).length
    };
  }, [driversData]);

  // Função para sincronizar nomes entre formatos
  const syncDriverNames = useCallback(async (): Promise<void> => {
    console.log("Sincronizando nomes de motoristas entre formatos...");
    
    try {
      // Coletar todos os nomes disponíveis de todas as fontes
      const namesByGaiola: Record<string, string> = {};
      
      // Fontes de dados para verificar
      const sources = [
        CONSTANTS.STORAGE_KEYS.DRIVERS_DATA,
        CONSTANTS.STORAGE_KEYS.DRIVERS_PANEL_DATA,
        CONSTANTS.STORAGE_KEYS.DRIVERS_DATA_OBJ
      ];

      // Coletar nomes de todas as fontes
      for (const sourceKey of sources) {
        try {
          const data = localStorage.getItem(sourceKey);
          if (!data) continue;

          const parsed = JSON.parse(data);
          
          if (Array.isArray(parsed)) {
            parsed.forEach((driver: any) => {
              if (driver.gaiola && (driver.name || driver.motorista)) {
                namesByGaiola[driver.gaiola] = driver.name || driver.motorista;
              }
            });
          } else if (typeof parsed === 'object' && parsed !== null) {
            Object.values(parsed).forEach((driver: any) => {
              if (driver.gaiola && driver.motorista) {
                namesByGaiola[driver.gaiola] = driver.motorista;
              }
            });
          }
        } catch (error) {
          console.warn(`Erro ao processar fonte ${sourceKey}:`, error);
        }
      }

      console.log(`Coletados nomes para ${Object.keys(namesByGaiola).length} gaiolas`);

      // Aplicar nomes sincronizados em todos os formatos
      for (const sourceKey of sources) {
        try {
          const data = localStorage.getItem(sourceKey);
          if (!data) continue;

          const parsed = JSON.parse(data);
          let updated = false;

          if (Array.isArray(parsed)) {
            const updatedArray = parsed.map((driver: any) => {
              if (driver.gaiola && namesByGaiola[driver.gaiola]) {
                updated = true;
                return {
                  ...driver,
                  name: namesByGaiola[driver.gaiola],
                  motorista: namesByGaiola[driver.gaiola]
                };
              }
              return driver;
            });

            if (updated) {
              localStorage.setItem(sourceKey, JSON.stringify(updatedArray));
            }
          } else if (typeof parsed === 'object' && parsed !== null) {
            const updatedObj = { ...parsed };
            
            Object.values(updatedObj).forEach((driver: any) => {
              if (driver.gaiola && namesByGaiola[driver.gaiola]) {
                driver.motorista = namesByGaiola[driver.gaiola];
                updated = true;
              }
            });

            if (updated) {
              localStorage.setItem(sourceKey, JSON.stringify(updatedObj));
            }
          }
        } catch (error) {
          console.warn(`Erro ao atualizar fonte ${sourceKey}:`, error);
        }
      }

      // Recarregar dados atualizados
      await loadAllDriversData();
      
      console.log("Sincronização de nomes concluída com sucesso");

    } catch (error) {
      console.error("Erro ao sincronizar nomes:", error);
      setError("Erro ao sincronizar nomes de motoristas");
    }
  }, [loadAllDriversData]);

  // Função para verificar atualizações forçadas
  const checkForForcedUpdate = useCallback(() => {
    const forceUpdate = localStorage.getItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE);
    if (forceUpdate) {
      const lastCheck = localStorage.getItem(CONSTANTS.STORAGE_KEYS.LAST_UPDATE_CHECK) || '0';
      if (forceUpdate !== lastCheck) {
        console.log("Atualização forçada detectada");
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.LAST_UPDATE_CHECK, forceUpdate);
        loadAllDriversData();
      }
    }
  }, [loadAllDriversData]);

  // Setup de event listeners e auto-update
  useEffect(() => {
    if (eventListenersAttached.current) return;

    const handleDriverUpdate = () => {
      console.log("Evento de atualização de driver detectado");
      loadAllDriversData();
    };

    const handleStorageUpdate = (event: StorageEvent) => {
      const relevantKeys = [
        CONSTANTS.STORAGE_KEYS.DRIVERS_DATA,
        CONSTANTS.STORAGE_KEYS.DRIVERS_DATA_OBJ,
        CONSTANTS.STORAGE_KEYS.FORCE_UPDATE,
        '_status_store_message'
      ];
      
      if (event.key && relevantKeys.includes(event.key as any)) {
        handleDriverUpdate();
      }
    };

    // Configurar listener para o StatusStore
    const unsubscribe = statusStore.subscribe((message) => {
      if (message.type === 'DRIVER_STATUS_CHANGE' || message.type === 'DRIVER_DELAY') {
        console.log(`[useDriverData] StatusStore notificou mudança em motorista:`, message);
        loadAllDriversData();
      }
    });

    // Configurar listeners
    window.addEventListener(CONSTANTS.EVENTS.DRIVER_STATUS_UPDATE, handleDriverUpdate);
    window.addEventListener(CONSTANTS.EVENTS.STORAGE, handleStorageUpdate);

    // Configurar intervalo de verificação
    updateIntervalRef.current = setInterval(checkForForcedUpdate, CONSTANTS.UPDATE_INTERVAL);

    eventListenersAttached.current = true;

    return () => {
      // Cancelar inscrição no StatusStore
      unsubscribe();
      
      window.removeEventListener(CONSTANTS.EVENTS.DRIVER_STATUS_UPDATE, handleDriverUpdate);
      window.removeEventListener(CONSTANTS.EVENTS.STORAGE, handleStorageUpdate);
      
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      
      eventListenersAttached.current = false;
    };
  }, [loadAllDriversData, checkForForcedUpdate]);

  // Carregamento inicial
  useEffect(() => {
    loadAllDriversData();
  }, [loadAllDriversData]);

  return {
    driversData,
    loadAllDriversData,
    getDriverByGaiola,
    setDriverStatus,
    toggleDriverCheck,
    markDriverDelayed,
    resetDriver,
    getDriversByStatus,
    getDriversStats,
    updateDriverData,
    syncDriverNames,
    isLoading,
    error
  };
};
