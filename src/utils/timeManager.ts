/**
 * TimeManager - Gerenciador centralizado de tempo para o sistema
 * 
 * Este serviço fornece funções para registrar, atualizar e recuperar tempos exatos
 * das operações do sistema, garantindo sincronização e consistência entre componentes.
 */

// Prefixos para as chaves do localStorage
const TIME_PREFIX = 'time_manager';
const CHAMADO_PREFIX = `${TIME_PREFIX}_chamado`;
const CARREGANDO_PREFIX = `${TIME_PREFIX}_carregando`;
const FINALIZADO_PREFIX = `${TIME_PREFIX}_finalizado`;

// Interface para os eventos de tempo
interface TimeEvent {
  vagaId: string;
  gaiola: string;
  timestamp: string;
  type: 'chamado' | 'carregando' | 'finalizado';
  source: string;
}

// Função para obter prefixo baseado no tipo
const getPrefixByType = (type: TimeEvent['type']) => {
  switch (type) {
    case 'chamado': return CHAMADO_PREFIX;
    case 'carregando': return CARREGANDO_PREFIX;
    case 'finalizado': return FINALIZADO_PREFIX;
    default: return CHAMADO_PREFIX;
  }
};

/**
 * Registra um evento de tempo no sistema
 */
export const registerTimeEvent = (
  vagaId: string, 
  gaiola: string, 
  type: TimeEvent['type'], 
  source: string = 'system'
): string => {
  const timestamp = new Date().toISOString();
  const prefix = getPrefixByType(type);
  const key = `${prefix}_${vagaId}`;
  
  // Salvar no localStorage
  const eventData = { vagaId, gaiola, timestamp, type, source };
  localStorage.setItem(key, JSON.stringify(eventData));
  
  // Registrar logs para debug
  console.log(`[TimeManager] Evento registrado: ${type} para vaga ${vagaId} (Gaiola ${gaiola})`, eventData);
  
  // Disparar evento para notificar outros componentes
  window.dispatchEvent(new CustomEvent('time_event_registered', {
    detail: eventData
  }));
  
  return timestamp;
};

/**
 * Recupera o timestamp de um evento de tempo específico
 */
export const getTimeEventTimestamp = (vagaId: string, type: TimeEvent['type']): string | null => {
  const prefix = getPrefixByType(type);
  const key = `${prefix}_${vagaId}`;
  
  const eventData = localStorage.getItem(key);
  if (!eventData) return null;
  
  try {
    const parsed = JSON.parse(eventData);
    return parsed.timestamp;
  } catch (error) {
    console.error(`[TimeManager] Erro ao recuperar timestamp para vaga ${vagaId}:`, error);
    return null;
  }
};

/**
 * Verifica se existe um evento de tempo registrado para a vaga
 */
export const hasTimeEvent = (vagaId: string, type: TimeEvent['type']): boolean => {
  return getTimeEventTimestamp(vagaId, type) !== null;
};

/**
 * Limpa os eventos de tempo para uma vaga específica
 * Se type for null, limpa todos os tipos de eventos
 */
export const clearTimeEvents = (vagaId: string, type: TimeEvent['type'] | null = null): void => {
  if (type) {
    const prefix = getPrefixByType(type);
    const key = `${prefix}_${vagaId}`;
    localStorage.removeItem(key);
    console.log(`[TimeManager] Evento removido: ${type} para vaga ${vagaId}`);
  } else {
    // Limpar todos os tipos
    localStorage.removeItem(`${CHAMADO_PREFIX}_${vagaId}`);
    localStorage.removeItem(`${CARREGANDO_PREFIX}_${vagaId}`);
    localStorage.removeItem(`${FINALIZADO_PREFIX}_${vagaId}`);
    console.log(`[TimeManager] Todos os eventos removidos para vaga ${vagaId}`);
  }
};

/**
 * Calcula o tempo decorrido em formato HH:MM:SS
 */
export const calculateElapsedTime = (startTimestamp: string | null): string => {
  if (!startTimestamp) return "00:00";
  
  try {
    const start = new Date(startTimestamp);
    const now = new Date();
    
    // Verificar se a data é válida
    if (isNaN(start.getTime())) {
      console.error(`[TimeManager] Data inválida: ${startTimestamp}`);
      return "00:00";
    }
    
    // Calcular a diferença em milissegundos
    const diffMs = now.getTime() - start.getTime();
    
    // Se a diferença for negativa ou muito grande, retornar 00:00
    if (diffMs < 0) {
      console.warn(`[TimeManager] Tempo negativo detectado: ${diffMs}ms`);
      return "00:00";
    }
    
    if (diffMs > 24 * 60 * 60 * 1000) { // Mais de 24 horas
      console.warn(`[TimeManager] Tempo muito grande detectado: ${diffMs}ms`);
      return "00:00";
    }
    
    // Converter para segundos e calcular horas, minutos e segundos
    const diffSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;
    
    // Formatar como HH:MM:SS ou MM:SS dependendo se tem horas
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  } catch (error) {
    console.error(`[TimeManager] Erro ao calcular tempo decorrido:`, error);
    return "00:00";
  }
};

/**
 * Hook para usar o TimeManager em componentes React
 */
export const useTimeManager = (vagaId: string) => {
  return {
    registerChamado: (gaiola: string, source: string) => 
      registerTimeEvent(vagaId, gaiola, 'chamado', source),
    
    registerCarregando: (gaiola: string, source: string) => 
      registerTimeEvent(vagaId, gaiola, 'carregando', source),
    
    registerFinalizado: (gaiola: string, source: string) => 
      registerTimeEvent(vagaId, gaiola, 'finalizado', source),
    
    getChamadoTime: () => 
      getTimeEventTimestamp(vagaId, 'chamado'),
    
    getCarregandoTime: () => 
      getTimeEventTimestamp(vagaId, 'carregando'),
    
    getFinalizadoTime: () => 
      getTimeEventTimestamp(vagaId, 'finalizado'),
    
    hasChamadoTime: () => 
      hasTimeEvent(vagaId, 'chamado'),
    
    clearAllTimes: () => 
      clearTimeEvents(vagaId),
    
    getElapsedTime: () => 
      calculateElapsedTime(getTimeEventTimestamp(vagaId, 'chamado'))
  };
};
