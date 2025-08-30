// Sistema de notificações entre painel administrativo e telas de vagas
// Utiliza localStorage para comunicação entre abas/janelas

export interface Notification {
  id: string;
  type: 'analyst_call' | 'driver_delay' | 'delayed_driver_called' | 'driver_wont_enter' | 'driver_enter_confirmation';
  message: string;
  vagaId?: string;
  gaiola?: string;
  timestamp: number;
  read: boolean;
}

// Chave para armazenar notificações no localStorage
const NOTIFICATIONS_KEY = 'vaga_agil_notifications';

// Obtém todas as notificações
export const getNotifications = (): Notification[] => {
  try {
    const storedNotifications = localStorage.getItem(NOTIFICATIONS_KEY);
    if (storedNotifications) {
      return JSON.parse(storedNotifications);
    }
  } catch (error) {
    console.error('Erro ao obter notificações:', error);
  }
  return [];
};

// Adiciona uma nova notificação
export const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Notification => {
  try {
    const notifications = getNotifications();
    
    // Verificar notificações duplicadas recentes (nos últimos 30 segundos)
    const now = Date.now();
    const isDuplicate = notifications.some(n => {
      // Se for o mesmo tipo e mesma vaga/gaiola nos últimos 30 segundos
      return n.type === notification.type && 
             n.vagaId === notification.vagaId && 
             n.gaiola === notification.gaiola &&
             (now - n.timestamp) < 30000; // 30 segundos
    });
    
    // Se for duplicada recente, não adicionar nova notificação
    if (isDuplicate) {
      console.log('Notificação duplicada detectada. Ignorando:', notification);
      
      // Retornar a primeira notificação correspondente em vez de criar uma nova
      const existingNotification = notifications.find(n => 
        n.type === notification.type && 
        n.vagaId === notification.vagaId && 
        n.gaiola === notification.gaiola
      );
      
      if (existingNotification) {
        return existingNotification;
      }
    }
    
    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      read: false
    };
    
    notifications.unshift(newNotification); // Adicionar no início da lista
    
    // Manter apenas as 50 notificações mais recentes
    const updatedNotifications = notifications.slice(0, 50);
    
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updatedNotifications));
    
    // Disparar evento para outras abas/janelas
    window.dispatchEvent(new CustomEvent('vaga_agil_new_notification', { 
      detail: newNotification 
    }));
    
    return newNotification;
  } catch (error) {
    console.error('Erro ao adicionar notificação:', error);
    throw error;
  }
};

// Marcar notificação como lida - agora remove completamente a notificação
export const markNotificationAsRead = (notificationId: string): void => {
  try {
    const notifications = getNotifications();
    // Filtrar a notificação com o ID especificado (removendo-a)
    const updatedNotifications = notifications.filter(notification => 
      notification.id !== notificationId
    );
    
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updatedNotifications));
    
    // Disparar evento de atualização para todas as instâncias/abas
    window.dispatchEvent(new CustomEvent('vaga_agil_notification_updated', {
      detail: { removed: notificationId }
    }));
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
  }
};

// Limpar todas as notificações
export const clearAllNotifications = (): void => {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([]));
    window.dispatchEvent(new CustomEvent('vaga_agil_notification_updated'));
  } catch (error) {
    console.error('Erro ao limpar notificações:', error);
  }
};

// Limpar notificações específicas para uma vaga
export const clearNotificationsForVaga = (vagaId: string, types?: string[]): void => {
  try {
    const notifications = getNotifications();
    
    const updatedNotifications = notifications.filter(notification => {
      // Se não for desta vaga, manter
      if (notification.vagaId !== vagaId) {
        return true;
      }
      
      // Se tipos foram especificados, apenas remover os do tipo especificado
      if (types && types.length > 0) {
        return !types.includes(notification.type);
      }
      
      // Se nenhum tipo foi especificado, remover TODAS as notificações desta vaga
      return false;
    });
    
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updatedNotifications));
    window.dispatchEvent(new CustomEvent('vaga_agil_notification_updated'));
  } catch (error) {
    console.error('Erro ao limpar notificações de vaga:', error);
  }
};

// Notificações específicas

// 1. Analista chamado para uma vaga específica
export const notifyAnalystCalled = (vagaId: string): void => {
  const notification = addNotification({
    type: 'analyst_call',
    message: `Analista chamado para a vaga ${vagaId}`,
    vagaId
  });
  
  // Disparar evento personalizado para o painel da vaga
  // isso permite a atualização em tempo real entre componentes
  window.dispatchEvent(new CustomEvent('analyst_called', {
    detail: { vagaId, notification }
  }));
};

// 2. Motorista atrasado após 5 minutos ou quando marcado manualmente pelo admin
export const notifyDriverDelay = (vagaId: string, gaiola: string, isManual: boolean = false): void => {
  // Se não foi marcado manualmente, verificar se a gaiola foi recentemente chamada
  if (!isManual) {
    // Verificar quando a gaiola foi chamada
    const chamadasKey = `vaga_${vagaId}_chamado_em`;
    const chamadaTime = localStorage.getItem(chamadasKey);
    
    if (chamadaTime) {
      const chamadaDate = new Date(chamadaTime).getTime();
      const now = new Date().getTime();
      const diffMinutes = (now - chamadaDate) / (1000 * 60);
      
      // Se a gaiola foi chamada nos últimos 2 minutos, ignorar o atraso automático
      if (diffMinutes < 2) {
        console.log(`Gaiola ${gaiola} foi chamada há menos de 2 minutos. Ignorando notificação de atraso automático.`);
        return;
      }
    }
  }
  
  // Se for manual, marcar este motorista como atrasado manualmente
  if (isManual) {
    localStorage.setItem(`vaga_${vagaId}_manually_delayed`, 'true');
  }
  
  // Verificar se já existe notificação de atraso recente para este motorista
  const delayKey = `driver_delay_${vagaId}_${gaiola}`;
  const existingDelay = localStorage.getItem(delayKey);
  
  if (existingDelay && !isManual) {
    const lastTime = new Date(existingDelay).getTime();
    const now = new Date().getTime();
    const diffMinutes = (now - lastTime) / (1000 * 60);
    
    // Se faz menos de 1 minuto que notificamos, não notificar novamente
    if (diffMinutes < 1) {
      console.log(`Já notificamos o atraso da gaiola ${gaiola} há menos de 1 minuto. Ignorando.`);
      return;
    }
  }

  // Limpar qualquer resposta anterior sobre este motorista atrasado
  localStorage.removeItem(`vaga_${vagaId}_delayed_responded`);
  
  console.log(`Notificando atraso do motorista da gaiola ${gaiola} para vaga ${vagaId} (${isManual ? 'manual' : 'automático'})`);
  
  const notification = addNotification({
    type: 'driver_delay',
    message: `ATENÇÃO: Motorista da gaiola ${gaiola} está atrasado para a vaga ${vagaId}`,
    vagaId,
    gaiola
  });
  
  // Disparar um único evento para evitar duplicação
  const eventData = {
    detail: { 
      vagaId, 
      gaiola, 
      notification,
      timestamp: new Date().toISOString(),
      source: isManual ? "manual_delay_button" : "auto_delay" // Indicar a fonte do evento
    }
  };
  
  // Disparar eventos para garantir que todos os componentes recebam a notificação
  // 1. Evento principal para o sistema de notificações
  window.dispatchEvent(new CustomEvent('driver_delayed', eventData));
  
  // 2. Evento específico para garantir que o painel admin receba a notificação
  window.dispatchEvent(new CustomEvent('driver_delay_notification', eventData));
  
  // 3. Evento para forçar atualização em todos os componentes
  window.dispatchEvent(new CustomEvent('force_update_notifications', {
    detail: {
      type: 'driver_delay',
      vagaId,
      gaiola,
      timestamp: new Date().toISOString()
    }
  }));
  
  // Adicionar som de alerta
  try {
    const audio = new Audio('/notification-sound.mp3');
    audio.play().catch(e => console.log("Erro ao reproduzir som:", e));
  } catch (error) {
    console.error("Erro ao tocar som de alerta:", error);
  }
  
  // Salvar no localStorage para indicar que esse motorista já foi marcado como atrasado
  localStorage.setItem(delayKey, new Date().toISOString());
};

// 3. Motorista atrasado sendo chamado para entrar no hub
export const notifyDelayedDriverCalled = (vagaId: string, gaiola: string): void => {
  const notification = addNotification({
    type: 'delayed_driver_called',
    message: `Motorista atrasado da gaiola ${gaiola} foi chamado para a vaga ${vagaId}`,
    vagaId,
    gaiola
  });
  
  // Disparar evento para atualizar os componentes em tempo real
  window.dispatchEvent(new CustomEvent('delayed_driver_called', {
    detail: { vagaId, gaiola, notification }
  }));
  
  // Salvar no localStorage para que outras abas/instâncias possam detectar
  const responseKey = `driver_response_${vagaId}_${gaiola}`;
  localStorage.setItem(responseKey, 'will_enter');
};

// 4. Motorista não vai entrar no hub (bipar e deixar na gaiola)
export const notifyDriverWontEnter = (vagaId: string, gaiola: string): void => {
  const notification = addNotification({
    type: 'driver_wont_enter',
    message: `ATENÇÃO: Motorista da gaiola ${gaiola} não entrará no hub. Bipar e deixar na gaiola.`,
    vagaId,
    gaiola
  });
  
  // Disparar evento para o painel específico da vaga
  window.dispatchEvent(new CustomEvent('driver_wont_enter', {
    detail: { vagaId, gaiola, notification }
  }));
  
  // Salvar no localStorage para que outras abas/instâncias possam detectar
  // e evitar mostrar o mesmo prompt várias vezes
  const responseKey = `driver_response_${vagaId}_${gaiola}`;
  localStorage.setItem(responseKey, 'wont_enter');
};

// 5. Confirmação da vaga que o motorista vai entrar
export const notifyDriverEnterConfirmation = (vagaId: string, gaiola: string): void => {
  const notification = addNotification({
    type: 'driver_enter_confirmation',
    message: `Motorista da gaiola ${gaiola} vai entrar na vaga ${vagaId}. Aguarde sua chegada.`,
    vagaId,
    gaiola
  });
  
  // Disparar evento para o painel específico da vaga
  window.dispatchEvent(new CustomEvent('driver_enter_confirmation', {
    detail: { vagaId, gaiola, notification }
  }));
  
  // Salvar no localStorage para indicar que o motorista vai entrar nesta vaga
  const confirmationKey = `driver_entering_vaga_${vagaId}_${gaiola}`;
  localStorage.setItem(confirmationKey, new Date().toISOString());
};

// Hooks para escutar novas notificações em componentes React
export const setupNotificationListener = (callback: (notification: Notification) => void): () => void => {
  const handler = (event: CustomEvent) => {
    callback(event.detail as Notification);
  };
  
  window.addEventListener('vaga_agil_new_notification', handler as EventListener);
  
  // Retornar função para remover o listener quando não for mais necessário
  return () => {
    window.removeEventListener('vaga_agil_new_notification', handler as EventListener);
  };
};
