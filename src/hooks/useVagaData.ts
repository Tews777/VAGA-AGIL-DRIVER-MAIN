// useVagaData_SUPABASE.ts - Hook de gerenciamento de vagas com Supabase + Real-time
// Versão integrada: Mantém toda funcionalidade existente + Supabase como backend

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { clearNotificationsForVaga } from "@/utils/notificationSystem";
import { clearAlertsForSlot } from "@/utils/alertManager";

// Interfaces TypeScript (mantidas identicamente)
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
  updated_at?: string; // timestamp do Supabase
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
  isConnected: boolean; // NOVO: Status de conexão Supabase
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error'; // NOVO: Status de sincronização
}

// Constantes
const CONSTANTS = {
  CACHE_TTL: 5000, // 5 segundos
  DEBOUNCE_TIME: 300, // 300ms
  MAX_VAGAS: 30,
  STORAGE_PREFIX: 'vaga_',
  STORAGE_SUFFIX: '_data',
  SUPABASE_TABLE: 'vagas',
  EVENTS: {
    VAGA_UPDATE: 'vaga_data_update',
    DRIVER_STATUS_UPDATE: 'driver_status_update',
    SUPABASE_SYNC: 'supabase_sync_update'
  }
} as const;

// Cache global para otimização
const dataCache: Record<string, { data: VagaData, timestamp: number }> = {};

export const useVagaData = (): VagaHookReturn => {
  // Estados principais
  const [vagasData, setVagasData] = useState<Record<string, VagaData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(isSupabaseConfigured());
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('offline');
  
  // Refs para cleanup e debounce
  const debouncedSaves = useRef<Record<string, NodeJS.Timeout>>({});
  const eventListenersAttached = useRef(false);
  const realtimeChannels = useRef<any[]>([]);
  const { toast } = useToast();

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

  // ===== NOVAS FUNÇÕES SUPABASE =====

  // Converter dados locais para formato Supabase
  const convertToSupabaseFormat = useCallback((vagaData: VagaData) => {
    return {
      id: vagaData.id,
      gaiola: vagaData.gaiola || null,
      status: vagaData.status,
      check_status: vagaData.check,
      chamado_em: vagaData.chamadoEm || null,
      carregando_em: vagaData.carregandoEm || null,
      finalizado_em: vagaData.finalizadoEm || null,
      tempo_total: vagaData.tempoTotal || 0,
      tempo_chamado: vagaData.tempoChamado || 0,
      tempo_carregamento: vagaData.tempoCarregamento || 0,
      history: JSON.stringify(vagaData.history),
      last_update: vagaData.lastUpdate,
      total_gaiolas: vagaData.totalGaiolas || 0,
      motorista_nome: null // Pode ser expandido futuramente
    };
  }, []);

  // Converter dados Supabase para formato local
  const convertFromSupabaseFormat = useCallback((supabaseData: any): VagaData => {
    let history: HistoryEntry[] = [];
    try {
      history = supabaseData.history ? JSON.parse(supabaseData.history) : [];
    } catch (error) {
      console.error('Erro ao parsear histórico:', error);
      history = [];
    }

    return {
      id: supabaseData.id,
      gaiola: supabaseData.gaiola || "",
      status: supabaseData.status,
      check: supabaseData.check_status || false,
      chamadoEm: supabaseData.chamado_em || undefined,
      carregandoEm: supabaseData.carregando_em || undefined,
      finalizadoEm: supabaseData.finalizado_em || undefined,
      tempoTotal: supabaseData.tempo_total || 0,
      tempoChamado: supabaseData.tempo_chamado || 0,
      tempoCarregamento: supabaseData.tempo_carregamento || 0,
      history,
      lastUpdate: supabaseData.last_update || new Date().toISOString(),
      totalGaiolas: supabaseData.total_gaiolas || 0,
      updated_at: supabaseData.updated_at
    };
  }, []);

  // Função para sincronizar com Supabase
  const syncToSupabase = useCallback(async (vagaData: VagaData): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      console.log('⚠️ Supabase não configurado, salvando apenas localmente');
      return false;
    }

    setSyncStatus('syncing');
    
    try {
      const supabaseData = convertToSupabaseFormat(vagaData);
      
      // Verificar se o registro existe
      const { data: existingData } = await supabase
        .from(CONSTANTS.SUPABASE_TABLE)
        .select('id')
        .eq('id', vagaData.id)
        .single();

      if (existingData) {
        // Atualizar registro existente
        const { error } = await supabase
          .from(CONSTANTS.SUPABASE_TABLE)
          .update(supabaseData)
          .eq('id', vagaData.id);

        if (error) throw error;
        console.log(`✅ Vaga ${vagaData.id} atualizada no Supabase`);
      } else {
        // Inserir novo registro
        const { error } = await supabase
          .from(CONSTANTS.SUPABASE_TABLE)
          .insert([supabaseData]);

        if (error) throw error;
        console.log(`✅ Vaga ${vagaData.id} criada no Supabase`);
      }

      setSyncStatus('synced');
      return true;

    } catch (error: any) {
      console.error(`❌ Erro ao sincronizar vaga ${vagaData.id} com Supabase:`, error);
      setSyncStatus('error');
      setError(`Erro de sincronização: ${error.message}`);
      return false;
    }
  }, [convertToSupabaseFormat]);

  // Função para carregar do Supabase
  const loadFromSupabase = useCallback(async (vagaId: string): Promise<VagaData | null> => {
    if (!isSupabaseConfigured()) return null;

    try {
      const { data, error } = await supabase
        .from(CONSTANTS.SUPABASE_TABLE)
        .select('*')
        .eq('id', vagaId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Registro não encontrado - será criado quando necessário
          return null;
        }
        throw error;
      }

      return convertFromSupabaseFormat(data);

    } catch (error: any) {
      console.error(`❌ Erro ao carregar vaga ${vagaId} do Supabase:`, error);
      return null;
    }
  }, [convertFromSupabaseFormat]);

  // ===== FUNÇÕES HÍBRIDAS (localStorage + Supabase) =====

  // Função para salvar dados (híbrida)
  const saveVagaData = useCallback(async (vagaId: string, data: VagaData) => {
    const cacheKey = `${CONSTANTS.STORAGE_PREFIX}${vagaId}${CONSTANTS.STORAGE_SUFFIX}`;
    
    // 1. Atualizar cache imediatamente
    dataCache[cacheKey] = { data, timestamp: Date.now() };
    
    // 2. Salvar no localStorage (síncrono, sempre funciona)
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
      
      // Salvar também na chave direta para compatibilidade
      const directVagaKey = `vaga${vagaId.padStart(2, '0')}`;
      localStorage.setItem(directVagaKey, JSON.stringify(data));
      
    } catch (error) {
      console.error(`❌ Erro ao salvar no localStorage vaga ${vagaId}:`, error);
    }

    // 3. Debounce do salvamento no Supabase
    if (debouncedSaves.current[vagaId]) {
      clearTimeout(debouncedSaves.current[vagaId]);
    }
    
    debouncedSaves.current[vagaId] = setTimeout(async () => {
      await syncToSupabase(data);
      delete debouncedSaves.current[vagaId];
    }, CONSTANTS.DEBOUNCE_TIME);

  }, [syncToSupabase]);

  // Função para carregar dados (híbrida)
  const loadVagaData = useCallback(async (vagaId: string): Promise<void> => {
    try {
      const cacheKey = `${CONSTANTS.STORAGE_PREFIX}${vagaId}${CONSTANTS.STORAGE_SUFFIX}`;
      const now = Date.now();
      
      // 1. Verificar cache primeiro
      if (dataCache[cacheKey] && (now - dataCache[cacheKey].timestamp) < CONSTANTS.CACHE_TTL) {
        setVagasData(prev => ({
          ...prev,
          [vagaId]: dataCache[cacheKey].data
        }));
        return;
      }
      
      let finalData = createEmptyVagaData(vagaId);
      
      // 2. Tentar carregar do Supabase primeiro (fonte da verdade)
      if (isSupabaseConfigured()) {
        const supabaseData = await loadFromSupabase(vagaId);
        if (supabaseData) {
          finalData = supabaseData;
          console.log(`🌐 Vaga ${vagaId} carregada do Supabase`);
          setIsConnected(true);
        } else {
          console.log(`⚠️ Vaga ${vagaId} não encontrada no Supabase, tentando localStorage`);
          setIsConnected(false);
        }
      }
      
      // 3. Se Supabase falhou ou não tem dados, usar localStorage
      if (finalData.id === vagaId && finalData.gaiola === "" && finalData.status === "esperar") {
        // Tentar localStorage
        const savedData = localStorage.getItem(cacheKey);
        const directVagaKey = `vaga${vagaId.padStart(2, '0')}`;
        const directVagaData = localStorage.getItem(directVagaKey);
        
        let dataToUse = savedData || directVagaData;
        
        if (dataToUse) {
          try {
            const parsedData = JSON.parse(dataToUse);
            if (parsedData && typeof parsedData === 'object') {
              finalData = {
                ...finalData,
                ...parsedData,
                id: vagaId,
                lastUpdate: new Date().toISOString()
              };
              console.log(`💾 Vaga ${vagaId} carregada do localStorage`);
            }
          } catch (error) {
            console.error(`❌ Erro ao parsear localStorage para vaga ${vagaId}:`, error);
          }
        }
      }
      
      // 4. Atualizar cache e estado
      dataCache[cacheKey] = { data: finalData, timestamp: now };
      setVagasData(prev => ({
        ...prev,
        [vagaId]: finalData
      }));
      
      // 5. Se temos dados do localStorage mas não do Supabase, sincronizar
      if (isSupabaseConfigured() && finalData.gaiola && !finalData.updated_at) {
        console.log(`🔄 Sincronizando vaga ${vagaId} localStorage → Supabase`);
        await syncToSupabase(finalData);
      }
      
    } catch (error) {
      console.error(`❌ Erro ao carregar vaga ${vagaId}:`, error);
      const emptyData = createEmptyVagaData(vagaId);
      setVagasData(prev => ({
        ...prev,
        [vagaId]: emptyData
      }));
      setError(`Erro ao carregar vaga ${vagaId}`);
    }
  }, [createEmptyVagaData, loadFromSupabase, syncToSupabase]);

  // ===== FUNÇÃO PRINCIPAL DE ATUALIZAÇÃO =====

  // Função para atualizar dados da vaga (híbrida)
  const updateVagaData = useCallback(async (
    vagaId: string, 
    updates: Partial<VagaData>, 
    user: string = "system"
  ): Promise<void> => {
    console.log("🔄 [SUPABASE] updateVagaData chamado:", { vagaId, updates, user });
    
    try {
      setVagasData(prev => {
        const currentData = prev[vagaId] || createEmptyVagaData(vagaId);
        const newData: VagaData = { 
          ...currentData, 
          ...updates, 
          lastUpdate: new Date().toISOString() 
        };
        
        // Salvar híbrido (localStorage + Supabase)
        saveVagaData(vagaId, newData);
        
        // Disparar evento para sincronização
        window.dispatchEvent(new CustomEvent(CONSTANTS.EVENTS.VAGA_UPDATE, {
          detail: { vagaId, updates, data: newData, user, source: 'supabase' }
        }));
        
        return {
          ...prev,
          [vagaId]: newData
        };
      });
      
      console.log("✅ [SUPABASE] updateVagaData concluído");
      
    } catch (error) {
      console.error(`❌ [SUPABASE] Erro ao atualizar vaga ${vagaId}:`, error);
      setError(`Erro ao atualizar vaga ${vagaId}`);
    }
  }, [createEmptyVagaData, saveVagaData]);

  // ===== FUNÇÕES DE NEGÓCIO (mantidas identicamente) =====

  // Função para carregar todos os dados das vagas
  const loadAllVagasData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Verificar conectividade Supabase
      if (isSupabaseConfigured()) {
        try {
          await supabase.from(CONSTANTS.SUPABASE_TABLE).select('id').limit(1);
          setIsConnected(true);
          setSyncStatus('synced');
        } catch {
          setIsConnected(false);
          setSyncStatus('offline');
        }
      }

      const promises = Array.from({ length: CONSTANTS.MAX_VAGAS }, (_, i) => 
        loadVagaData((i + 1).toString())
      );
      
      await Promise.allSettled(promises);
      
    } catch (error) {
      console.error("❌ Erro ao carregar dados das vagas:", error);
      setError("Erro ao carregar dados das vagas");
      setSyncStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [loadVagaData]);

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

  // Função para chamar gaiola (mantida com todas as funcionalidades)
  const chamarGaiola = useCallback(async (vagaId: string, gaiolaId: string): Promise<void> => {
    console.log("🚀 [SUPABASE] Iniciando chamarGaiola:", { vagaId, gaiolaId });
    
    const currentData = vagasData[vagaId];
    const user = gaiolaId;
    
    // Limpar alertas
    console.log("🧹 [SUPABASE] Limpando alertas da vaga");
    clearAlertsForSlot(vagaId);
    
    const chamadoEm = new Date().toISOString();
    const updateData = { 
      status: "chamado" as const,
      gaiola: gaiolaId,
      chamadoEm
    };
    
    // FORÇA SALVAMENTO IMEDIATO para compatibilidade
    try {
      const cacheKey = `${CONSTANTS.STORAGE_PREFIX}${vagaId}${CONSTANTS.STORAGE_SUFFIX}`;
      const emptyData = createEmptyVagaData(vagaId);
      const completeData = {
        ...(currentData || emptyData),
        ...updateData,
        lastUpdate: new Date().toISOString()
      };
      
      // Salvar localStorage imediatamente
      localStorage.setItem(cacheKey, JSON.stringify(completeData));
      const directVagaKey = `vaga${vagaId.padStart(2, '0')}`;
      localStorage.setItem(directVagaKey, JSON.stringify({
        ...completeData,
        isVirtual: false
      }));
      localStorage.setItem(`vaga_${vagaId}_chamado_em_exact`, chamadoEm);
      
      // Atualizar estado
      setVagasData(prev => ({
        ...prev,
        [vagaId]: completeData
      }));
      
      // Eventos
      window.dispatchEvent(new CustomEvent('FORCE_VAGA_UPDATE', {
        detail: { vagaId, data: completeData, timestamp: new Date().toISOString() }
      }));
      
    } catch (error) {
      console.error("❌ [SUPABASE] Erro ao salvar dados diretos:", error);
    }
    
    await updateVagaData(vagaId, updateData, user);
    await addHistoryEntry(vagaId, "chamado", { 
      gaiola: gaiolaId,
      oldStatus: currentData ? currentData.status : "esperar",
      newStatus: "chamado"
    }, user);
    
    // Eventos adicionais
    window.dispatchEvent(new CustomEvent('VAGA_UPDATE', {
      detail: { vagaId, action: 'gaiola_chamada', gaiola: gaiolaId, status: 'chamado' }
    }));
    
    window.dispatchEvent(new CustomEvent('ALERTS_CLEARED', {
      detail: { vagaId, gaiola: gaiolaId, timestamp: new Date().toISOString() }
    }));
    
    localStorage.setItem('last_vaga_update', JSON.stringify({
      vagaId,
      gaiola: gaiolaId,
      timestamp: new Date().toISOString(),
      action: 'chamado'
    }));
  }, [vagasData, updateVagaData, addHistoryEntry, createEmptyVagaData]);

  // Demais funções mantidas identicamente
  const iniciarCarregamento = useCallback(async (vagaId: string, gaiolaId: string): Promise<void> => {
    const currentData = vagasData[vagaId];
    const user = gaiolaId;
    
    if (currentData?.status !== "chamado") {
      console.log(`Vaga ${vagaId} não está no status 'chamado'. Chamando gaiola primeiro...`);
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
      gaiola: currentData?.gaiola || gaiolaId,
      oldStatus: currentData?.status || "esperar",
      newStatus: "carregando",
      duration: tempoChamado
    }, user);
  }, [vagasData, updateVagaData, addHistoryEntry, calculateDuration, chamarGaiola]);

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

  const toggleCheck = useCallback(async (vagaId: string, user: string): Promise<void> => {
    const currentData = vagasData[vagaId];
    if (!currentData) return;
    
    const newCheckStatus = !currentData.check;
    
    await updateVagaData(vagaId, { check: newCheckStatus }, user);
    
    await addHistoryEntry(vagaId, "check_toggle", { 
      checkStatus: newCheckStatus 
    }, user);
  }, [vagasData, updateVagaData, addHistoryEntry]);

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

  // ===== REAL-TIME SUPABASE =====

  // Setup Real-time channels
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    console.log("🔴 [REAL-TIME] Configurando canais Supabase...");

    // Canal para mudanças na tabela vagas
    const vagasChannel = supabase
      .channel('vagas-realtime')
      .on('postgres_changes', 
        {
          event: '*',
          schema: 'public',
          table: CONSTANTS.SUPABASE_TABLE
        },
        (payload) => {
          console.log('🔄 [REAL-TIME] Update recebido:', payload);
          
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedVaga = convertFromSupabaseFormat(payload.new);
            
            setVagasData(prev => ({
              ...prev,
              [updatedVaga.id]: updatedVaga
            }));

            // Cache update
            const cacheKey = `${CONSTANTS.STORAGE_PREFIX}${updatedVaga.id}${CONSTANTS.STORAGE_SUFFIX}`;
            dataCache[cacheKey] = { data: updatedVaga, timestamp: Date.now() };
            
            // LocalStorage sync
            try {
              localStorage.setItem(cacheKey, JSON.stringify(updatedVaga));
            } catch (error) {
              console.error('Erro ao sincronizar localStorage:', error);
            }

            // Toast notification
            toast({
              title: "🔄 Sincronização",
              description: `Vaga ${updatedVaga.id} atualizada em tempo real`,
              duration: 2000,
            });
          }
          
          if (payload.eventType === 'INSERT' && payload.new) {
            const newVaga = convertFromSupabaseFormat(payload.new);
            setVagasData(prev => ({
              ...prev,
              [newVaga.id]: newVaga
            }));
            
            toast({
              title: "➕ Nova vaga",
              description: `Vaga ${newVaga.id} criada`,
              duration: 2000,
            });
          }
        }
      )
      .subscribe();

    realtimeChannels.current.push(vagasChannel);

    return () => {
      console.log("🔴 [REAL-TIME] Limpando canais...");
      realtimeChannels.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      realtimeChannels.current = [];
    };
  }, [convertFromSupabaseFormat, toast]);

  // Setup de event listeners (mantido)
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
    error,
    isConnected,
    syncStatus
  };
};
