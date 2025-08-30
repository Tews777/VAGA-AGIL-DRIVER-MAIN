/**
 * 🚨 ALERT MANAGEMENT UTILITY
 * Função utilitária centralizada para gerenciar alertas de vagas
 * 
 * Esta função garante que quando uma nova gaiola é chamada,
 * TODOS os alertas relacionados à vaga sejam removidos de forma consistente
 * em todas as camadas da aplicação (localStorage, notificações, estado global).
 */

import { clearNotificationsForVaga } from '@/utils/notificationSystem';

// Função centralizada para limpar TODOS os alertas de uma vaga específica
export const clearAlertsForSlot = (vagaId: string): void => {
  try {
    console.log(`🧹 [ALERT] Iniciando limpeza completa de alertas para vaga ${vagaId}`);
    
    // 1. Limpar alertas específicos da vaga no localStorage
    const vagaAlertsKey = `vaga_${vagaId}_alerts`;
    const adminAlertsKey = `admin_vaga_${vagaId}_alerts`;
    
    // Remover alertas diretos da vaga
    localStorage.removeItem(vagaAlertsKey);
    console.log(`🗑️ [ALERT] Removido localStorage: ${vagaAlertsKey}`);
    
    // Remover alertas admin da vaga
    localStorage.removeItem(adminAlertsKey);
    console.log(`🗑️ [ALERT] Removido localStorage: ${adminAlertsKey}`);
    
    // 2. Limpar alertas ativos de atraso da vaga
    const delayAlertsKey = `delay_alerts_${vagaId}`;
    localStorage.removeItem(delayAlertsKey);
    console.log(`🗑️ [ALERT] Removido localStorage: ${delayAlertsKey}`);
    
    // 3. Limpar notificações do sistema de notificações
    try {
      clearNotificationsForVaga(vagaId);
      console.log(`🔔 [ALERT] Notificações do sistema limpas para vaga ${vagaId}`);
    } catch (error) {
      console.warn(`⚠️ [ALERT] Erro ao limpar notificações do sistema:`, error);
    }
    
    // 4. Disparar evento global para sincronização de componentes
    window.dispatchEvent(new CustomEvent('SLOT_ALERTS_CLEARED', {
      detail: { 
        vagaId, 
        timestamp: new Date().toISOString(),
        source: 'clearAlertsForSlot'
      }
    }));
    console.log(`📡 [ALERT] Evento SLOT_ALERTS_CLEARED disparado para vaga ${vagaId}`);
    
    // 5. Forçar atualização para sincronização entre abas
    localStorage.setItem('last_alert_clear', JSON.stringify({
      vagaId,
      timestamp: new Date().toISOString(),
      action: 'clear_all_alerts'
    }));
    
    console.log(`✅ [ALERT] Limpeza completa de alertas concluída para vaga ${vagaId}`);
    
  } catch (error) {
    console.error(`❌ [ALERT] Erro ao limpar alertas da vaga ${vagaId}:`, error);
  }
};

/**
 * Função para limpar alertas de múltiplas vagas de uma vez
 * Útil para limpezas em lote no painel admin
 */
export const clearAlertsForMultipleSlots = (vagaIds: string[]): void => {
  console.log(`🧹 [ALERT] Iniciando limpeza em lote para ${vagaIds.length} vagas`);
  
  vagaIds.forEach(vagaId => {
    clearAlertsForSlot(vagaId);
  });
  
  // Disparar evento global para limpeza em lote
  window.dispatchEvent(new CustomEvent('BULK_ALERTS_CLEARED', {
    detail: { 
      vagaIds, 
      timestamp: new Date().toISOString(),
      count: vagaIds.length
    }
  }));
  
  console.log(`✅ [ALERT] Limpeza em lote concluída para ${vagaIds.length} vagas`);
};

/**
 * Função para verificar se uma vaga tem alertas ativos
 * Útil para validações antes de ações
 */
export const hasActiveAlertsForSlot = (vagaId: string): boolean => {
  try {
    const vagaAlerts = localStorage.getItem(`vaga_${vagaId}_alerts`);
    const adminAlerts = localStorage.getItem(`admin_vaga_${vagaId}_alerts`);
    const delayAlerts = localStorage.getItem(`delay_alerts_${vagaId}`);
    
    const hasVagaAlerts = vagaAlerts && JSON.parse(vagaAlerts).length > 0;
    const hasAdminAlerts = adminAlerts && JSON.parse(adminAlerts).length > 0;
    const hasDelayAlerts = delayAlerts && JSON.parse(delayAlerts).length > 0;
    
    return hasVagaAlerts || hasAdminAlerts || hasDelayAlerts;
  } catch (error) {
    console.error(`❌ [ALERT] Erro ao verificar alertas da vaga ${vagaId}:`, error);
    return false;
  }
};

export default {
  clearAlertsForSlot,
  clearAlertsForMultipleSlots,
  hasActiveAlertsForSlot
};
