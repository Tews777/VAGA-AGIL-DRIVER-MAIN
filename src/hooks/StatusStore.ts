// StatusStore.ts - Sistema centralizado de gerenciamento de estado
// Implementa um padrão de design centralizado para gerenciar o estado da aplicação

// Este arquivo implementa um store centralizado usando o padrão Observer
// para garantir que qualquer mudança de status seja propagada para todos os componentes

import { DriverData } from "./useDriverData";
import { VagaData } from "./useVagaData";

// Tipos para o sistema de mensagens
type StatusChangeMessage = {
  type: 'DRIVER_STATUS_CHANGE';
  payload: {
    driverId: string;
    gaiola: string;
    oldStatus: string;
    newStatus: string;
    timestamp: string;
    source: string;
  };
} | {
  type: 'VAGA_STATUS_CHANGE';
  payload: {
    vagaId: string;
    oldStatus: string;
    newStatus: string;
    gaiola?: string;
    timestamp: string;
    source: string;
  };
} | {
  type: 'DRIVER_DELAY';
  payload: {
    vagaId: string;
    gaiola: string;
    timestamp: string;
    isManual: boolean;
    source: string;
  };
} | {
  type: 'DATA_SYNC';
  payload: {
    source: string;
    timestamp: string;
  };
};

// Tipos para os listeners
type StatusChangeListener = (message: StatusChangeMessage) => void;

// Interface para o StatusStore
interface IStatusStore {
  dispatch(message: StatusChangeMessage): void;
  subscribe(listener: StatusChangeListener): () => void;
  syncDriverStatus(gaiola: string, status: DriverData["status"], source: string): void;
  markDriverDelayed(vagaId: string, gaiola: string, isManual: boolean, source: string): void;
}

// Implementação do StatusStore
class StatusStore implements IStatusStore {
  private static instance: StatusStore;
  private listeners: StatusChangeListener[] = [];
  private isDispatching = false;
  private pendingMessages: StatusChangeMessage[] = [];

  private constructor() {
    console.log('[StatusStore] Inicializado');
    this.setupStorageListener();
  }

  // Implementação do Singleton
  public static getInstance(): StatusStore {
    if (!StatusStore.instance) {
      StatusStore.instance = new StatusStore();
    }
    return StatusStore.instance;
  }

  // Configurar listener para mudanças no localStorage
  private setupStorageListener() {
    window.addEventListener('storage', (event) => {
      if (event.key === '_status_store_message') {
        try {
          const message = JSON.parse(event.newValue || '{}') as StatusChangeMessage;
          this.notifyListeners(message);
        } catch (error) {
          console.error('[StatusStore] Erro ao processar mensagem do localStorage:', error);
        }
      }
    });
  }

  // Dispatch de uma mensagem para todos os listeners
  public dispatch(message: StatusChangeMessage): void {
    console.log(`[StatusStore] Dispatching: ${message.type}`, message.payload);
    
    // Sincronizar com localStorage para comunicação entre abas
    localStorage.setItem('_status_store_message', JSON.stringify({
      ...message,
      meta: {
        timestamp: new Date().toISOString(),
        id: Math.random().toString(36).substring(2)
      }
    }));
    
    // Prevenir chamadas recursivas
    if (this.isDispatching) {
      this.pendingMessages.push(message);
      return;
    }
    
    this.isDispatching = true;
    this.notifyListeners(message);
    this.isDispatching = false;
    
    // Processar mensagens pendentes
    if (this.pendingMessages.length > 0) {
      const pending = [...this.pendingMessages];
      this.pendingMessages = [];
      pending.forEach(msg => this.dispatch(msg));
    }
    
    // Persistir o último status no localStorage
    this.persistStatus(message);
  }

  // Notificar todos os listeners
  private notifyListeners(message: StatusChangeMessage): void {
    this.listeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('[StatusStore] Erro em listener:', error);
      }
    });
  }

  // Registrar um listener
  public subscribe(listener: StatusChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Persistir o status no localStorage
  private persistStatus(message: StatusChangeMessage): void {
    try {
      // Lógica específica para cada tipo de mensagem
      if (message.type === 'DRIVER_STATUS_CHANGE' || message.type === 'DRIVER_DELAY') {
        this.handleDriverStatusChange(message);
      } else if (message.type === 'VAGA_STATUS_CHANGE') {
        this.handleVagaStatusChange(message);
      }
    } catch (error) {
      console.error('[StatusStore] Erro ao persistir status:', error);
    }
  }

  // Tratar mudança de status do motorista
  private handleDriverStatusChange(message: StatusChangeMessage): void {
    if (message.type === 'DRIVER_STATUS_CHANGE') {
      const { gaiola, newStatus } = message.payload;
      
      // Atualizar nos três formatos de armazenamento
      this.updateDriverInStorage('drivers_data_obj', gaiola, newStatus);
      this.updateDriverInArrayStorage('drivers_data', gaiola, newStatus);
      this.updateDriverInArrayStorage('drivers_panel_data', gaiola, newStatus);
      
      // Forçar atualização dos componentes
      localStorage.setItem('_forceDriverUpdate', Date.now().toString());
    } else if (message.type === 'DRIVER_DELAY') {
      const { gaiola, vagaId } = message.payload;
      
      // Marcar motorista como atrasado nos três formatos
      this.updateDriverInStorage('drivers_data_obj', gaiola, 'atrasado');
      this.updateDriverInArrayStorage('drivers_data', gaiola, 'atrasado');
      this.updateDriverInArrayStorage('drivers_panel_data', gaiola, 'atrasado');
      
      // Marcar a vaga como tendo um motorista atrasado
      localStorage.setItem(`vaga_${vagaId}_manually_delayed`, 'true');
      localStorage.removeItem(`vaga_${vagaId}_delayed_responded`);
      
      // Forçar atualização dos componentes
      localStorage.setItem('_forceDriverUpdate', Date.now().toString());
    }
  }

  // Atualizar status do motorista no formato de objeto
  private updateDriverInStorage(storageKey: string, gaiola: string, newStatus: string): void {
    try {
      const driversObj = JSON.parse(localStorage.getItem(storageKey) || '{}');
      
      // Para o formato objeto, precisamos encontrar o ID pelo gaiola
      if (storageKey === 'drivers_data_obj') {
        let found = false;
        Object.keys(driversObj).forEach(driverId => {
          const driver = driversObj[driverId];
          if (driver.gaiola === gaiola) {
            found = true;
            driversObj[driverId] = {
              ...driver,
              status: newStatus,
              lastUpdate: new Date().toISOString()
            };
          }
        });
        
        if (found) {
          localStorage.setItem(storageKey, JSON.stringify(driversObj));
          console.log(`[StatusStore] Motorista ${gaiola} atualizado para ${newStatus} em ${storageKey}`);
        } else {
          console.warn(`[StatusStore] Motorista ${gaiola} não encontrado em ${storageKey}`);
        }
      }
    } catch (error) {
      console.error(`[StatusStore] Erro ao atualizar ${storageKey}:`, error);
    }
  }

  // Atualizar status do motorista no formato de array
  private updateDriverInArrayStorage(storageKey: string, gaiola: string, newStatus: string): void {
    try {
      const driversArr = JSON.parse(localStorage.getItem(storageKey) || '[]');
      let found = false;
      
      const updatedArr = driversArr.map((driver: any) => {
        if (driver.gaiola === gaiola) {
          found = true;
          return {
            ...driver,
            status: newStatus,
            lastUpdate: new Date().toISOString()
          };
        }
        return driver;
      });
      
      if (found) {
        localStorage.setItem(storageKey, JSON.stringify(updatedArr));
        console.log(`[StatusStore] Motorista ${gaiola} atualizado para ${newStatus} em ${storageKey}`);
      } else {
        console.warn(`[StatusStore] Motorista ${gaiola} não encontrado em ${storageKey}`);
      }
    } catch (error) {
      console.error(`[StatusStore] Erro ao atualizar ${storageKey}:`, error);
    }
  }

  // Tratar mudança de status da vaga
  private handleVagaStatusChange(message: StatusChangeMessage): void {
    if (message.type !== 'VAGA_STATUS_CHANGE') return;
    
    const { vagaId, newStatus, gaiola } = message.payload;
    
    try {
      // Atualizar vagas
      const vagasData = JSON.parse(localStorage.getItem('vagas_data') || '{}');
      if (vagasData[vagaId]) {
        vagasData[vagaId] = {
          ...vagasData[vagaId],
          status: newStatus,
          lastUpdate: new Date().toISOString()
        };
        
        // Se houver uma gaiola associada e o status for de atraso, atualizar o motorista também
        if (gaiola && newStatus === 'atrasado') {
          this.dispatch({
            type: 'DRIVER_STATUS_CHANGE',
            payload: {
              driverId: `auto_${vagaId}`,
              gaiola,
              oldStatus: 'unknown',
              newStatus: 'atrasado',
              timestamp: new Date().toISOString(),
              source: 'vaga_status_change'
            }
          });
        }
        
        localStorage.setItem('vagas_data', JSON.stringify(vagasData));
      }
    } catch (error) {
      console.error('[StatusStore] Erro ao atualizar vaga:', error);
    }
  }

  // API pública para sincronizar status do motorista
  public syncDriverStatus(gaiola: string, status: DriverData["status"], source: string): void {
    this.dispatch({
      type: 'DRIVER_STATUS_CHANGE',
      payload: {
        driverId: `auto_${gaiola}`,
        gaiola,
        oldStatus: 'unknown',
        newStatus: status,
        timestamp: new Date().toISOString(),
        source
      }
    });
  }

  // API pública para marcar motorista como atrasado
  public markDriverDelayed(vagaId: string, gaiola: string, isManual: boolean, source: string): void {
    this.dispatch({
      type: 'DRIVER_DELAY',
      payload: {
        vagaId,
        gaiola,
        timestamp: new Date().toISOString(),
        isManual,
        source
      }
    });
  }
}

// Exportar a instância singleton
export const statusStore = StatusStore.getInstance();
