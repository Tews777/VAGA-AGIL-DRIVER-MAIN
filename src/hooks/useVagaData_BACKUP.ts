// useVagaData.ts - Hook de gerenciamento de vagas
// Versão profissional refatorada com padrões enterprise-grade

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { clearNotificationsForVaga } from "@/utils/notificationSystem";
import { clearAlertsForSlot } from "@/utils/alertManager";

// Interfaces TypeScript
export interface HistoryEntry {
  id: string;
  timestamp: string;
  action: "gaiola_set" | "chamado" | "carregando" | "finalizado" | "reset" | "check_toggle";
  details: {
    gaiola?: string;
    oldStatus?: string;
    newStatus?: string;
    checkStatus?: boolean;
    duration?: number; // em segundos
    user?: string;
  };
  user: string; // vaga ou admin
}

export interface VagaData {
  id: string;
  gaiola: string;
  status: "esperar" | "chamado" | "carregando" | "finalizado";
  check: boolean;
  chamadoEm?: string;
  carregandoEm?: string;
  finalizadoEm?: string;
  tempoTotal?: number; // em segundos
  tempoChamado?: number; // tempo entre chamado e carregando
  tempoCarregamento?: number; // tempo entre carregando e finalizado
  history: HistoryEntry[];
  lastUpdate: string;
  totalGaiolas: number; // contador de gaiolas processadas hoje
}

export interface VagaHookReturn {
  vagasData: Record<string, VagaData>;
  setGaiola: (vagaId: string, gaiola: string, user: string) => Promise<void>;
  chamarGaiola: (vagaId: string, gaiolaId: string) => Promise<void>;
  iniciarCarregamento: (vagaId: string, gaiolaId: string) => Promise<void>;
  finalizarCarregamento: (vagaId: string, user: string) => Promise<void>;
  loadAllVagasData: () => Promise<void>;
  loadVagaData: (vagaId: string) => Promise<void>;
  resetVaga: (vagaId: string, user: string) => Promise<void>;
  toggleCheck: (vagaId: string, user: string) => Promise<void>;
  getTodayData: () => Record<string, any>;
  getDateRangeData: (startDate: string, endDate: string) => Record<string, any>;
  isLoading: boolean;
  error: string | null;
}

// Constantes
const CONSTANTS = {
  CACHE_TTL: 5000, // 5 segundos
  DEBOUNCE_TIME: 300, // 300ms
  MAX_VAGAS: 30,
  STORAGE_PREFIX: 'vaga_',
  STORAGE_SUFFIX: '_data',
  EVENTS: {
    VAGA_UPDATE: 'vaga_data_update',
    DRIVER_STATUS_UPDATE: 'driver_status_update'
  }
} as const;

// Cache global para otimização
const dataCache: Record<string, { data: VagaData, timestamp: number }> = {};

export const useVagaData = (): VagaHookReturn => {
  // Estados principais
  const [vagasData, setVagasData] = useState<Record<string, VagaData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs para cleanup e debounce
  const debouncedSaves = useRef<Record<string, NodeJS.Timeout>>({});
  const eventListenersAttached = useRef(false);

  // Função de debounce otimizada
  const debounce = useCallback((fn: (...args: any[]) => void, delay: number) => {
    let timeoutId: NodeJS.Timeout | null = null;
    return (...args: any[]) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fn(...args);
        timeoutId = null;
      }, delay);
    };
  }, []);

  // Função para gerar IDs únicos
  const generateId = useCallback((): string => {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Função para criar entrada no histórico
  const createHistoryEntry = useCallback((
    action: HistoryEntry["action"],
    details: HistoryEntry["details"],
    user: string
  ): HistoryEntry => {
    return {
      id: generateId(),
      timestamp: new Date().toISOString(),
      action,
      details: { ...details, user },
      user
    };
  }, [generateId]);

  // Função para criar dados vazios da vaga
  const createEmptyVagaData = useCallback((id: string): VagaData => {
    return {
      id,
      gaiola: "",
      status: "esperar",
      check: false,
      history: [],
      lastUpdate: new Date().toISOString(),
      totalGaiolas: 0
    };
  }, []);

  // Função para calcular duração entre timestamps
  const calculateDuration = useCallback((startTime: string, endTime?: string): number => {
    try {
      const start = new Date(startTime).getTime();
      const end = endTime ? new Date(endTime).getTime() : Date.now();
      return Math.floor((end - start) / 1000); // retorna em segundos
    } catch {
      return 0;
    }
  }, []);

  // Função para validar estrutura de dados da vaga
  const validateVagaData = useCallback((data: any): boolean => {
    // Verificação mais relaxada para permitir recuperação de dados parciais
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    // Se não tem ID, rejeitamos
    if (typeof data.id !== 'string') {
      return false;
    }
    
    // O status é crucial, mas permitimos valores ausentes ou inválidos
    if (data.status && !['esperar', 'chamado', 'carregando', 'finalizado'].includes(data.status)) {
      // Se tiver status inválido, rejeitamos
      return false;
    }
    
    // Os demais campos podem ser preenchidos com valores default se ausentes
    return true;
  }, []);

  // Função para salvar dados no localStorage com debounce
  const saveVagaData = useCallback((vagaId: string, data: VagaData) => {
    const cacheKey = `${CONSTANTS.STORAGE_PREFIX}${vagaId}${CONSTANTS.STORAGE_SUFFIX}`;
    
    // Atualizar cache imediatamente
    dataCache[cacheKey] = { data, timestamp: Date.now() };
    
    // Debounce do salvamento no localStorage
    if (debouncedSaves.current[vagaId]) {
      clearTimeout(debouncedSaves.current[vagaId]);
    }
    
    debouncedSaves.current[vagaId] = setTimeout(() => {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
        delete debouncedSaves.current[vagaId];
      } catch (error) {
        console.error(`Erro ao salvar dados da vaga ${vagaId}:`, error);
        setError(`Erro ao salvar dados da vaga ${vagaId}`);
      }
    }, CONSTANTS.DEBOUNCE_TIME);
  }, []);

  // Função para carregar dados de uma vaga específica
  const loadVagaData = useCallback(async (vagaId: string): Promise<void> => {
    try {
      const cacheKey = `${CONSTANTS.STORAGE_PREFIX}${vagaId}${CONSTANTS.STORAGE_SUFFIX}`;
      const now = Date.now();
      
      // Verificar cache primeiro
      if (dataCache[cacheKey] && (now - dataCache[cacheKey].timestamp) < CONSTANTS.CACHE_TTL) {
        setVagasData(prev => ({
          ...prev,
          [vagaId]: dataCache[cacheKey].data
        }));
        return;
      }
      
      // Carregar do localStorage
      const savedData = localStorage.getItem(cacheKey);
      
      // Tentar carregar diretamente da vaga (para vagas virtuais)
      const directVagaKey = `vaga${vagaId.padStart(2, '0')}`;
      const directVagaData = localStorage.getItem(directVagaKey);
      
      // Inicializar com dados vazios
      const emptyData = createEmptyVagaData(vagaId);
      let vagaData = emptyData;
      
      // Priorizar dados diretos de vaga (para vagas virtuais NOSHOW)
      let dataToUse = savedData;
      if (directVagaData) {
        try {
          const directParsed = JSON.parse(directVagaData);
          if (directParsed.gaiola && (directParsed.specialStatus || directParsed.isVirtual)) {
            console.log(`🔍 Vaga virtual detectada em ${directVagaKey}:`, directParsed);
            dataToUse = directVagaData;
          }
        } catch (error) {
          console.error(`Erro ao verificar vaga virtual ${directVagaKey}:`, error);
        }
      }
      
      // Tentar obter dados salvos
      if (dataToUse) {
        try {
          const parsedData = JSON.parse(dataToUse);
          
          // Validar dados básicos
          if (parsedData && typeof parsedData === 'object') {
            // Mesclar dados existentes com dados padrão para garantir campos obrigatórios
            vagaData = {
              ...emptyData,
              id: vagaId,
              gaiola: parsedData.gaiola || "",
              status: ['esperar', 'chamado', 'carregando', 'finalizado'].includes(parsedData.status) 
                ? parsedData.status 
                : "esperar",
              check: typeof parsedData.check === 'boolean' ? parsedData.check : false,
              chamadoEm: parsedData.chamadoEm,
              carregandoEm: parsedData.carregandoEm,
              finalizadoEm: parsedData.finalizadoEm,
              tempoTotal: parsedData.tempoTotal || 0,
              tempoChamado: parsedData.tempoChamado || 0,
              tempoCarregamento: parsedData.tempoCarregamento || 0,
              history: Array.isArray(parsedData.history) ? parsedData.history : [],
              lastUpdate: new Date().toISOString(),
              totalGaiolas: parsedData.totalGaiolas || 0,
              // Preservar campos especiais para vagas virtuais
              ...(parsedData.specialStatus && { specialStatus: parsedData.specialStatus }),
              ...(parsedData.isVirtual && { isVirtual: parsedData.isVirtual }),
              ...(parsedData.motorista && { motorista: parsedData.motorista })
            };
            
            console.log(`✅ Vaga ${vagaId} carregada com sucesso:`, vagaData);
          } else {
            console.warn(`⚠️ Dados da vaga ${vagaId} inválidos, criando novos`);
          }
        } catch (error) {
          console.error(`❌ Erro ao parsear dados da vaga ${vagaId}:`, error);
        }
      } else {
        console.info(`ℹ️ Nenhum dado encontrado para vaga ${vagaId}, criando novo`);
      }
      
      // Atualizar cache e estado
      dataCache[cacheKey] = { data: vagaData, timestamp: now };
      setVagasData(prev => ({
        ...prev,
        [vagaId]: vagaData
      }));
      
      // Salvar dados normalizados
      saveVagaData(vagaId, vagaData);
      
    } catch (error) {
      console.error(`Erro ao carregar vaga ${vagaId}:`, error);
      const emptyData = createEmptyVagaData(vagaId);
      setVagasData(prev => ({
        ...prev,
        [vagaId]: emptyData
      }));
      setError(`Erro ao carregar vaga ${vagaId}`);
    }
  }, [validateVagaData, createEmptyVagaData, saveVagaData]);

  // Função para carregar todos os dados das vagas
  const loadAllVagasData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const promises = Array.from({ length: CONSTANTS.MAX_VAGAS }, (_, i) => 
        loadVagaData((i + 1).toString())
      );
      
      await Promise.allSettled(promises);
      
    } catch (error) {
      console.error("Erro ao carregar dados das vagas:", error);
      setError("Erro ao carregar dados das vagas");
    } finally {
      setIsLoading(false);
    }
  }, [loadVagaData]);

  // Função para atualizar dados da vaga
  const updateVagaData = useCallback(async (
    vagaId: string, 
    updates: Partial<VagaData>, 
    user: string = "system"
  ): Promise<void> => {
    console.log("🔄 [DEBUG] updateVagaData chamado:", { vagaId, updates, user });
    
    try {
      setVagasData(prev => {
        console.log("📊 [DEBUG] Estado anterior das vagas:", prev);
        
        const currentData = prev[vagaId] || createEmptyVagaData(vagaId);
        console.log("📋 [DEBUG] Dados atuais da vaga:", currentData);
        
        const newData: VagaData = { 
          ...currentData, 
          ...updates, 
          lastUpdate: new Date().toISOString() 
        };
        console.log("🆕 [DEBUG] Novos dados da vaga:", newData);
        
        saveVagaData(vagaId, newData);
        console.log("💾 [DEBUG] saveVagaData chamado");
        
        // Disparar evento para sincronização
        window.dispatchEvent(new CustomEvent(CONSTANTS.EVENTS.VAGA_UPDATE, {
          detail: { vagaId, updates, data: newData, user }
        }));
        console.log("📡 [DEBUG] Evento de sincronização disparado");
        
        const newState = {
          ...prev,
          [vagaId]: newData
        };
        console.log("🔄 [DEBUG] Novo estado completo:", newState);
        
        return newState;
      });
      
      console.log("✅ [DEBUG] updateVagaData concluído com sucesso");
      
    } catch (error) {
      console.error(`❌ [DEBUG] Erro ao atualizar vaga ${vagaId}:`, error);
      setError(`Erro ao atualizar vaga ${vagaId}`);
    }
  }, [createEmptyVagaData, saveVagaData]);

  // Função para adicionar entrada no histórico
  const addHistoryEntry = useCallback(async (
    vagaId: string,
    action: HistoryEntry["action"],
    details: HistoryEntry["details"],
    user: string
  ): Promise<void> => {
    const historyEntry = createHistoryEntry(action, details, user);
    
    setVagasData(prev => {
      const currentData = prev[vagaId] || createEmptyVagaData(vagaId);
      const newHistory = [...currentData.history, historyEntry];
      const newData = { 
        ...currentData, 
        history: newHistory,
        lastUpdate: new Date().toISOString()
      };
      
      saveVagaData(vagaId, newData);
      
      return {
        ...prev,
        [vagaId]: newData
      };
    });
  }, [createHistoryEntry, createEmptyVagaData, saveVagaData]);

  // Função para definir gaiola
  const setGaiola = useCallback(async (vagaId: string, gaiola: string, user: string): Promise<void> => {
    const currentData = vagasData[vagaId];
    
    await updateVagaData(vagaId, { 
      gaiola: gaiola.toUpperCase(),
      status: "esperar",
      chamadoEm: undefined,
      carregandoEm: undefined,
      finalizadoEm: undefined,
      tempoTotal: undefined,
      tempoChamado: undefined,
      tempoCarregamento: undefined
    }, user);
    
    await addHistoryEntry(vagaId, "gaiola_set", { 
      gaiola: gaiola.toUpperCase(),
      oldStatus: currentData?.status 
    }, user);
  }, [vagasData, updateVagaData, addHistoryEntry]);

  // Função para chamar gaiola
  const chamarGaiola = useCallback(async (vagaId: string, gaiolaId: string): Promise<void> => {
    console.log("🚀 [DEBUG] Iniciando chamarGaiola:", { vagaId, gaiolaId });
    
    const currentData = vagasData[vagaId];
    console.log("🔍 [DEBUG] Dados atuais da vaga:", currentData);
    
    const user = gaiolaId; // Usar ID da gaiola como usuário para rastreamento
    
    // 🚨 NOVA FUNCIONALIDADE: Limpar TODOS os alertas desta vaga imediatamente
    // Quando uma nova gaiola é chamada, todos os alertas anteriores devem ser removidos
    console.log("🧹 [FEATURE] Limpando todos os alertas da vaga antes de chamar nova gaiola");
    clearAlertsForSlot(vagaId);
    console.log("✅ [FEATURE] Limpeza de alertas iniciada");
    
    const chamadoEm = new Date().toISOString();
    console.log("⏰ [DEBUG] Timestamp chamada:", chamadoEm);
    console.log("⏰ [DEBUG] Timestamp para exibição:", new Date(chamadoEm).toLocaleTimeString('pt-BR'));
    
    const updateData = { 
      status: "chamado" as const,
      gaiola: gaiolaId, // Definir a gaiola que foi chamada
      chamadoEm
    };
    console.log("📝 [DEBUG] Dados para atualização:", updateData);
    
    // CORREÇÃO: Salvar dados diretamente no localStorage para garantir persistência imediata
    // e evitar problemas de sincronização em caso de primeira chamada
    try {
      const cacheKey = `${CONSTANTS.STORAGE_PREFIX}${vagaId}${CONSTANTS.STORAGE_SUFFIX}`;
      const emptyData = createEmptyVagaData(vagaId);
      
      // Combinar dados existentes (ou vazios) com a atualização
      const completeData = {
        ...(currentData || emptyData),
        ...updateData,
        lastUpdate: new Date().toISOString()
      };
      
      // Salvar imediatamente no localStorage
      localStorage.setItem(cacheKey, JSON.stringify(completeData));
      console.log("💾 [DEBUG] Dados salvos diretamente no localStorage:", completeData);
      
      // Salvar no directVagaKey para vagas virtuais
      const directVagaKey = `vaga${vagaId.padStart(2, '0')}`;
      localStorage.setItem(directVagaKey, JSON.stringify({
        ...completeData,
        isVirtual: false  // Marcar como não-virtual para garantir visibilidade
      }));
      console.log("💾 [DEBUG] Dados salvos na chave direta:", directVagaKey);

      // 🕐 SALVAR TIMESTAMP EXATO para garantir precisão na exibição
      localStorage.setItem(`vaga_${vagaId}_chamado_em_exact`, chamadoEm);
      console.log("🕐 [DEBUG] Timestamp exato salvo:", `vaga_${vagaId}_chamado_em_exact`, chamadoEm);
      
      // Atualizar estado local IMEDIATAMENTE
      setVagasData(prev => ({
        ...prev,
        [vagaId]: completeData
      }));
      
      // 🚀 FORÇA ATUALIZAÇÃO: Dispara evento customizado para forçar re-render
      window.dispatchEvent(new CustomEvent('FORCE_VAGA_UPDATE', {
        detail: { vagaId, data: completeData, timestamp: new Date().toISOString() }
      }));
      console.log("🔄 [DEBUG] Estado local atualizado e evento FORCE_VAGA_UPDATE disparado");
    } catch (error) {
      console.error("❌ [DEBUG] Erro ao salvar dados diretos:", error);
    }
    
    // Continuar com o fluxo normal
    await updateVagaData(vagaId, updateData, user);
    console.log("✅ [DEBUG] updateVagaData concluído");
    
    await addHistoryEntry(vagaId, "chamado", { 
      gaiola: gaiolaId,
      oldStatus: currentData ? currentData.status : "esperar",
      newStatus: "chamado"
    }, user);
    console.log("📚 [DEBUG] addHistoryEntry concluído");
    
    // Disparar múltiplos eventos para melhor sincronização
    window.dispatchEvent(new CustomEvent('VAGA_UPDATE', {
      detail: { vagaId, action: 'gaiola_chamada', gaiola: gaiolaId, status: 'chamado' }
    }));
    console.log("📡 [DEBUG] Evento VAGA_UPDATE disparado");
    
    // Evento específico para limpeza de alertas
    window.dispatchEvent(new CustomEvent('ALERTS_CLEARED', {
      detail: { vagaId, gaiola: gaiolaId, timestamp: new Date().toISOString() }
    }));
    
    // Forçar atualização do localStorage para sync entre abas
    localStorage.setItem('last_vaga_update', JSON.stringify({
      vagaId,
      gaiola: gaiolaId,
      timestamp: new Date().toISOString(),
      action: 'chamado'
    }));
  }, [vagasData, updateVagaData, addHistoryEntry]);

  // Função para iniciar carregamento
  const iniciarCarregamento = useCallback(async (vagaId: string, gaiolaId: string): Promise<void> => {
    const currentData = vagasData[vagaId];
    const user = gaiolaId; // Usar ID da gaiola como usuário para rastreamento
    
    // Se a vaga não estiver no status "chamado", chamá-la automaticamente primeiro
    if (currentData?.status !== "chamado") {
      console.log(`Vaga ${vagaId} não está no status 'chamado'. Status atual: ${currentData?.status}. Chamando gaiola primeiro...`);
      await chamarGaiola(vagaId, gaiolaId);
    }
    
    const carregandoEm = new Date().toISOString();
    const tempoChamado = currentData?.chamadoEm ? 
      calculateDuration(currentData.chamadoEm, carregandoEm) : 0;
    
    await updateVagaData(vagaId, { 
      status: "carregando",
      carregandoEm,
      tempoChamado
    }, user);
    
    await addHistoryEntry(vagaId, "carregando", { 
      gaiola: currentData.gaiola,
      oldStatus: currentData.status,
      newStatus: "carregando",
      duration: tempoChamado
    }, user);
  }, [vagasData, updateVagaData, addHistoryEntry, calculateDuration, chamarGaiola]);

  // Função para finalizar carregamento
  const finalizarCarregamento = useCallback(async (vagaId: string, user: string): Promise<void> => {
    const currentData = vagasData[vagaId];
    if (currentData?.status !== "carregando") {
      throw new Error("Gaiola deve estar carregando para finalizar");
    }
    
    const finalizadoEm = new Date().toISOString();
    const tempoCarregamento = currentData.carregandoEm ? 
      calculateDuration(currentData.carregandoEm, finalizadoEm) : 0;
    const tempoTotal = currentData.chamadoEm ? 
      calculateDuration(currentData.chamadoEm, finalizadoEm) : 0;
    
    await updateVagaData(vagaId, { 
      status: "finalizado",
      finalizadoEm,
      tempoCarregamento,
      tempoTotal,
      totalGaiolas: (currentData.totalGaiolas || 0) + 1
    }, user);
    
    await addHistoryEntry(vagaId, "finalizado", { 
      gaiola: currentData.gaiola,
      oldStatus: currentData.status,
      newStatus: "finalizado",
      duration: tempoTotal
    }, user);
  }, [vagasData, updateVagaData, addHistoryEntry, calculateDuration]);

  // Função para resetar vaga
  const resetVaga = useCallback(async (vagaId: string, user: string): Promise<void> => {
    const currentData = vagasData[vagaId];
    
    await updateVagaData(vagaId, { 
      gaiola: "",
      status: "esperar",
      chamadoEm: undefined,
      carregandoEm: undefined,
      finalizadoEm: undefined,
      tempoTotal: undefined,
      tempoChamado: undefined,
      tempoCarregamento: undefined
    }, user);
    
    await addHistoryEntry(vagaId, "reset", { 
      oldStatus: currentData?.status 
    }, user);
  }, [vagasData, updateVagaData, addHistoryEntry]);

  // Função para toggle check
  const toggleCheck = useCallback(async (vagaId: string, user: string): Promise<void> => {
    const currentData = vagasData[vagaId];
    if (!currentData) return;
    
    const newCheckStatus = !currentData.check;
    
    await updateVagaData(vagaId, { check: newCheckStatus }, user);
    
    await addHistoryEntry(vagaId, "check_toggle", { 
      checkStatus: newCheckStatus 
    }, user);
  }, [vagasData, updateVagaData, addHistoryEntry]);

  // Função para obter dados do dia atual
  const getTodayData = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayData: Record<string, any> = {};
    
    Object.values(vagasData).forEach(vaga => {
      const todayHistory = vaga.history.filter(entry => 
        entry.timestamp.startsWith(today)
      );
      
      todayData[vaga.id] = {
        ...vaga,
        todayHistory,
        todayGaiolas: todayHistory.filter(entry => entry.action === "finalizado").length
      };
    });
    
    return todayData;
  }, [vagasData]);

  // Função para obter dados por intervalo de datas
  const getDateRangeData = useCallback((startDate: string, endDate: string) => {
    const rangeData: Record<string, any> = {};
    
    Object.values(vagasData).forEach(vaga => {
      const rangeHistory = vaga.history.filter(entry => {
        const entryDate = entry.timestamp.split('T')[0];
        return entryDate >= startDate && entryDate <= endDate;
      });
      
      rangeData[vaga.id] = {
        ...vaga,
        rangeHistory,
        rangeGaiolas: rangeHistory.filter(entry => entry.action === "finalizado").length
      };
    });
    
    return rangeData;
  }, [vagasData]);

  // Setup de event listeners
  useEffect(() => {
    if (eventListenersAttached.current) return;
    
    const handleVagaDataUpdate = (event: CustomEvent) => {
      const { vagaId, data } = event.detail;
      if (vagaId && data) {
        setVagasData(prev => ({
          ...prev,
          [vagaId]: data
        }));
      }
    };
    
    const handleDriverStatusUpdate = debounce((event: CustomEvent) => {
      const { gaiola, status, vagaId } = event.detail;
      if (gaiola && status && vagaId) {
        loadAllVagasData();
      }
    }, CONSTANTS.DEBOUNCE_TIME);
    
    window.addEventListener(CONSTANTS.EVENTS.VAGA_UPDATE, handleVagaDataUpdate as EventListener);
    window.addEventListener(CONSTANTS.EVENTS.DRIVER_STATUS_UPDATE, handleDriverStatusUpdate as EventListener);
    
    eventListenersAttached.current = true;
    
    return () => {
      window.removeEventListener(CONSTANTS.EVENTS.VAGA_UPDATE, handleVagaDataUpdate as EventListener);
      window.removeEventListener(CONSTANTS.EVENTS.DRIVER_STATUS_UPDATE, handleDriverStatusUpdate as EventListener);
      eventListenersAttached.current = false;
    };
  }, [debounce, loadAllVagasData]);

  // Cleanup de timeouts no unmount
  useEffect(() => {
    return () => {
      Object.values(debouncedSaves.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      debouncedSaves.current = {};
    };
  }, []);

  // Carregamento inicial
  useEffect(() => {
    loadAllVagasData();
  }, [loadAllVagasData]);

  return {
    vagasData,
    setGaiola,
    chamarGaiola,
    iniciarCarregamento,
    finalizarCarregamento,
    loadAllVagasData,
    loadVagaData,
    resetVaga,
    toggleCheck,
    getTodayData,
    getDateRangeData,
    isLoading,
    error
  };
};
