import { useState, useEffect, memo, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock, TrendingUp, Activity, AlertTriangle, LogIn } from "lucide-react";
import { VagaData } from "@/hooks/useVagaData";
import { DriverData } from "@/hooks/useDriverData";
import { formatDuration } from "@/utils/dataExport";
import { notifyDriverDelay, notifyDriverWontEnter, notifyDriverEnterConfirmation } from "@/utils/notificationSystem";
import DelayedDriverActions from "@/components/DelayedDriverActions";
import AnalystCalledActions from "@/components/AnalystCalledActions";
import { useTimeManager, calculateElapsedTime } from "@/utils/timeManager";
import { statusStore } from "@/hooks/StatusStore";
import { formatarTipoVeiculo, getTipoVeiculoClasses } from "@/lib/utils";

interface VagaCardProps {
  vaga: VagaData;
  index?: number;
  onToggleCheck?: () => void;
  onStatusChange?: (newStatus: "carregando" | "finalizado" | "esperar") => void;
  showTimers?: boolean;
  onDriverDelayAction?: (vagaId: string, gaiola: string, willEnter: boolean) => void;
  isDriverDelayed?: boolean;
  isAnalystCalled?: boolean;
  onAnalystAction?: (vagaId: string, acknowledged: boolean) => void;
  vagaAlerts?: any[]; // Alertas específicos desta vaga
}

const VagaCard = memo(({ 
  vaga, 
  index = 0, 
  onToggleCheck, 
  onStatusChange, 
  showTimers = false,
  onDriverDelayAction,
  isDriverDelayed = false,
  isAnalystCalled = false,
  onAnalystAction,
  vagaAlerts = []
}: VagaCardProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Memoizar valores calculados pesados
  const memoizedKeys = useMemo(() => ({
    delayedResponded: `vaga_${vaga.id}_delayed_responded`,
    analystResponded: `vaga_${vaga.id}_analyst_responded`,
    manuallyDelayed: `vaga_${vaga.id}_manually_delayed`
  }), [vaga.id]);
  
  const hasDelayedResponded = useMemo(() => 
    localStorage.getItem(memoizedKeys.delayedResponded) === 'true', 
    [memoizedKeys.delayedResponded]
  );
  
  const isManuallyDelayed = useMemo(() => 
    localStorage.getItem(memoizedKeys.manuallyDelayed) === 'true', 
    [memoizedKeys.manuallyDelayed]
  );
  
  const [showDelayedActions, setShowDelayedActions] = useState((isDriverDelayed || isManuallyDelayed) && !hasDelayedResponded);
  
  // Verificar se o analista já foi respondido
  const analystRespondedKey = `vaga_${vaga.id}_analyst_responded`;
  const hasAnalystResponded = localStorage.getItem(analystRespondedKey) === 'true';
  const [showAnalystActions, setShowAnalystActions] = useState(isAnalystCalled && !hasAnalystResponded);
  
  // Estado para mostrar mensagem de confirmação de entrada do motorista
  const [showEnterConfirmation, setShowEnterConfirmation] = useState(false);
  const [confirmationGaiola, setConfirmationGaiola] = useState("");

  // Função aprimorada para buscar dados do motorista por gaiola
  const getDriverData = (gaiola: string): DriverData | null => {
    try {
      console.log(`🔎 VagaCard: Buscando dados do motorista para gaiola ${gaiola}`);
      
      // VERIFICAÇÃO ADICIONAL: Garantir que a gaiola seja uma string válida
      if (!gaiola || typeof gaiola !== 'string' || gaiola.trim() === '') {
        console.warn('🚫 VagaCard: Tentativa de buscar motorista com gaiola inválida');
        return null;
      }
      
      const gaiolaNormalizada = gaiola.trim().toUpperCase();
      console.log(`🔎 VagaCard: Gaiola normalizada: "${gaiolaNormalizada}"`);
      
      // Tentar primeiro obter do formato objeto que é mais recente
      const driversDataObj = localStorage.getItem('drivers_data_obj');
      if (driversDataObj) {
        try {
          const driversObj = JSON.parse(driversDataObj);
          
          // Buscar com case-insensitive para evitar problemas de maiúsculo/minúsculo
          const driver = Object.values(driversObj).find((d: any) => {
            return d.gaiola && d.gaiola.toUpperCase() === gaiolaNormalizada;
          });
          
          if (driver) {
            console.log(`� VagaCard: Driver encontrado para gaiola ${gaiola} (formato obj):`, driver);
            console.log(`� VagaCard: tipoVeiculo = "${(driver as DriverData).tipoVeiculo || 'não definido'}"`);
            
            // Forçar que tipoVeiculo seja definido, mesmo que seja undefined
            const driverWithType = driver as DriverData;
            if (typeof driverWithType.tipoVeiculo === 'undefined') {
              driverWithType.tipoVeiculo = undefined;
            }
            
            return driverWithType as DriverData;
          }
        } catch (e) {
          console.error('🔴 VagaCard: Erro ao processar drivers_data_obj:', e);
        }
      }
      
      // Tentar formato array como fallback
      const driversData = localStorage.getItem('drivers_data');
      if (!driversData) {
        console.warn('🔴 VagaCard: Nenhum dado de motoristas encontrado');
        return null;
      }
      
      try {
        const drivers: DriverData[] = JSON.parse(driversData);
        
        // Buscar com case-insensitive
        const driver = drivers.find(d => 
          d.gaiola && d.gaiola.toUpperCase() === gaiolaNormalizada
        );
        
        if (driver) {
          console.log(`� VagaCard: Driver encontrado para gaiola ${gaiola} (formato array):`, driver);
          console.log(`� VagaCard: tipoVeiculo = "${driver.tipoVeiculo || 'não definido'}"`);
          
          // Garantir que tipoVeiculo seja definido
          const driverWithType = driver;
          if (typeof driverWithType.tipoVeiculo === 'undefined') {
            driverWithType.tipoVeiculo = undefined;
          }
          return driverWithType;
        } else {
          console.warn(`🔴 VagaCard: Nenhum driver encontrado para gaiola ${gaiola}`);
        }
      } catch (e) {
        console.error('🔴 VagaCard: Erro ao processar drivers_data:', e);
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao buscar dados do motorista:', error);
      return null;
    }
  };

  // Buscar dados do motorista atual
  const driverData = vaga.gaiola ? getDriverData(vaga.gaiola) : null;
  
  // Log para debug
  useEffect(() => {
    if (driverData) {
      console.log(`🔍 VagaCard: Dados do motorista para vaga ${vaga.id}, gaiola ${vaga.gaiola}:`, driverData);
      console.log(`🔍 VagaCard: tipoVeiculo = ${driverData.tipoVeiculo || 'não definido'}`);
    }
  }, [driverData, vaga.id, vaga.gaiola]);

  // Atualizar o estado de showDelayedActions quando isDriverDelayed ou hasResponded muda
  useEffect(() => {
    // Função para verificar e atualizar o estado das ações de motorista atrasado
    const checkAndUpdateDelayedStatus = () => {
      const delayedResponded = localStorage.getItem(`vaga_${vaga.id}_delayed_responded`) === 'true';
      const manuallyDelayed = localStorage.getItem(`vaga_${vaga.id}_manually_delayed`) === 'true';
      const shouldShowActions = (isDriverDelayed || manuallyDelayed) && vaga.status === "chamado" && !delayedResponded;
      
      console.log(`VagaCard ID ${vaga.id}: Atualizando estado - isDriverDelayed: ${isDriverDelayed}, manuallyDelayed: ${manuallyDelayed}, respondido: ${delayedResponded}, mostrar: ${shouldShowActions}`);
      setShowDelayedActions(shouldShowActions);
    };
    
    // Verificar status inicial
    checkAndUpdateDelayedStatus();
    
    // Verificar status para analista chamado
    const analystResponded = localStorage.getItem(`vaga_${vaga.id}_analyst_responded`) === 'true';
    setShowAnalystActions(isAnalystCalled && !analystResponded);
    
    // Listener unificado para evento de motorista atrasado
    // Agora usamos apenas um evento para evitar duplicações
    const handleDriverDelayed = (event: CustomEvent) => {
      const { vagaId, gaiola } = event.detail;
      if (vagaId === vaga.id) {
        console.log(`VagaCard: evento driver_delayed recebido para vaga ${vagaId} (gaiola ${gaiola})`);
        
        // Limpar qualquer resposta anterior para esta vaga
        localStorage.removeItem(`vaga_${vaga.id}_delayed_responded`);
        
        // Atualizar estado para mostrar os botões
        checkAndUpdateDelayedStatus();
      }
    };
    
    // Listener para evento de analista chamado
    const handleAnalystCalled = (event: CustomEvent) => {
      const { vagaId } = event.detail;
      if (vagaId === vaga.id) {
        console.log(`VagaCard: evento analyst_called recebido para vaga ${vagaId}`);
        // Se o analista foi chamado e ainda não foi respondido, mostrar ações
        const analystResponded = localStorage.getItem(`vaga_${vaga.id}_analyst_responded`) === 'true';
        if (!analystResponded) {
          setShowAnalystActions(true);
        }
      }
    };
    
    // Listener para evento de confirmação de entrada do motorista
    const handleDriverEnterConfirmation = (event: CustomEvent) => {
      const { vagaId, gaiola } = event.detail;
      if (vagaId === vaga.id) {
        console.log(`VagaCard: evento driver_enter_confirmation recebido para vaga ${vagaId} (gaiola ${gaiola})`);
        setConfirmationGaiola(gaiola);
        setShowEnterConfirmation(true);
        
        // Esconder a confirmação após 10 segundos
        setTimeout(() => {
          setShowEnterConfirmation(false);
        }, 10000);
      }
    };

    window.addEventListener('driver_delayed', handleDriverDelayed as EventListener);
    window.addEventListener('analyst_called', handleAnalystCalled as EventListener);
    window.addEventListener('driver_enter_confirmation', handleDriverEnterConfirmation as EventListener);
    
    return () => {
      window.removeEventListener('driver_delayed', handleDriverDelayed as EventListener);
      window.removeEventListener('analyst_called', handleAnalystCalled as EventListener);
      window.removeEventListener('driver_enter_confirmation', handleDriverEnterConfirmation as EventListener);
      window.removeEventListener('analyst_called', handleAnalystCalled as EventListener);
    };
  }, [isDriverDelayed, isAnalystCalled, vaga.status, vaga.id]);

  // Atualizar tempo a cada segundo para mostrar timer em tempo real
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    // Função para obter e validar a hora exata do chamado
    const getExactChamadoTime = () => {
      const exactChamadoTime = localStorage.getItem(`vaga_${vaga.id}_chamado_em_exact`);
      
      // Log para depuração
      if (vaga.status === "chamado") {
        console.log(`VagaCard ${vaga.id}: Estado atual:`, { 
          status: vaga.status,
          exactTime: exactChamadoTime,
          vagaChamadoEm: vaga.chamadoEm
        });
      }
      
      return exactChamadoTime || vaga.chamadoEm;
    };
    
    // Carregar a hora exata do chamado (mais confiável)
    const chamadoTimeToUse = getExactChamadoTime();
    
    // Sempre atualiza o timer quando está no status chamado
    if (vaga.status === "chamado") {
      console.log(`VagaCard ${vaga.id}: Iniciando timer com hora chamada: ${chamadoTimeToUse || 'não definida'}`);
      
      // Atualizar imediatamente
      setCurrentTime(new Date());
      
      // Função para atualizar o tempo
      const updateTimer = () => {
        const now = new Date();
        
        // Se não temos data de chamada, apenas atualizar o tempo atual
        if (!chamadoTimeToUse) {
          setCurrentTime(now);
          return;
        }
        
        const calledTime = new Date(chamadoTimeToUse);
        
        // Validar que a data é válida
        if (isNaN(calledTime.getTime())) {
          console.error(`VagaCard ${vaga.id}: Data inválida: ${chamadoTimeToUse}`);
          setCurrentTime(now);
          return;
        }
        
        setCurrentTime(now);
      };
      
      // Atualizar imediatamente
      updateTimer();
      
      // Depois atualizar a cada segundo
      interval = setInterval(updateTimer, 1000);
    }
    
    // Listeners para vários eventos que devem resetar o timer
    
    // 1. Quando uma gaiola é chamada
    const handleGaiolaChamada = (event: CustomEvent) => {
      const { vagaId } = event.detail;
      if (vagaId === vaga.id) {
        console.log(`VagaCard ${vaga.id}: Evento gaiola chamada recebido, resetando timer`);
        setCurrentTime(new Date());
      }
    };
    
    // 2. Reset explícito do timer da vaga
    const handleResetTimer = (event: CustomEvent) => {
      const { vagaId } = event.detail;
      if (vagaId === vaga.id) {
        console.log(`VagaCard ${vaga.id}: Evento reset_vaga_timer recebido, resetando timer`);
        setCurrentTime(new Date());
      }
    };
    
    // 3. Reset completo do estado da vaga
    const handleVagaStateReset = (event: CustomEvent) => {
      const { vagaId } = event.detail;
      if (vagaId === vaga.id) {
        console.log(`VagaCard ${vaga.id}: Evento vaga_state_reset recebido, resetando timer`);
        setCurrentTime(new Date());
        
        // Se é reset de estado, forçar uma verificação de todos os estados
        setShowDelayedActions(false);
        setShowAnalystActions(false);
      }
    };
    
    // Registrar todos os listeners
    window.addEventListener('vaga_gaiola_chamada', handleGaiolaChamada as EventListener);
    window.addEventListener('reset_vaga_timer', handleResetTimer as EventListener);
    window.addEventListener('vaga_state_reset', handleVagaStateReset as EventListener);
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
      // Remover todos os event listeners
      window.removeEventListener('vaga_gaiola_chamada', handleGaiolaChamada as EventListener);
      window.removeEventListener('reset_vaga_timer', handleResetTimer as EventListener);
      window.removeEventListener('vaga_state_reset', handleVagaStateReset as EventListener);
    };
  }, [vaga.status, vaga.chamadoEm, vaga.id, vaga.gaiola]); // Adicionar vaga.gaiola para garantir atualização

  // 🚀 FORÇA ATUALIZAÇÃO: Escutar eventos de força de atualização para garantir re-render
  useEffect(() => {
    const handleForceUpdate = (event: CustomEvent) => {
      const { vagaId, data, timestamp } = event.detail;
      
      // Se for a vaga atual, forçar atualização do componente
      if (vagaId === vaga.id) {
        console.log(`🔄 [VAGA_CARD] Força atualização recebida para vaga ${vagaId}:`, data);
        
        // Forçar re-render atualizando o estado de tempo
        setCurrentTime(new Date());
        
        // Se houver dados novos com timestamp, atualizar
        if (data && data.chamadoEm) {
          console.log(`⏰ [VAGA_CARD] Novo timestamp para vaga ${vagaId}: ${data.chamadoEm}`);
        }
      }
    };

    // Escutar evento de força de atualização
    window.addEventListener('FORCE_VAGA_UPDATE', handleForceUpdate as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('FORCE_VAGA_UPDATE', handleForceUpdate as EventListener);
    };
  }, [vaga.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "esperar": return "bg-status-waiting text-black";
      case "chamado": return "bg-status-called text-black";
      case "carregando": return "bg-status-loading text-white";
      case "finalizado": return "bg-status-completed text-black";
      default: return "bg-gray-500 text-white";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "esperar": return "ESPERAR";
      case "chamado": return "CHAMADO";
      case "carregando": return "CARREGANDO";
      case "finalizado": return "FINALIZADO";
      default: return status.toUpperCase();
    }
  };

  const getVagaColor = (index: number) => {
    const colors = [
      'bg-slate-100 border border-slate-300', 'bg-gray-100 border border-gray-300', 
      'bg-neutral-100 border border-neutral-300', 'bg-stone-100 border border-stone-300',
      'bg-zinc-100 border border-zinc-300', 'bg-slate-50 border border-slate-400',
      'bg-gray-50 border border-gray-400', 'bg-neutral-50 border border-neutral-400',
      'bg-stone-50 border border-stone-400', 'bg-zinc-50 border border-zinc-400'
    ];
    return colors[index % colors.length];
  };

  const getTodayStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayHistory = vaga.history.filter(entry => 
      entry.timestamp.startsWith(today)
    );
    
    return {
      chamados: todayHistory.filter(entry => entry.action === "chamado").length,
      finalizados: todayHistory.filter(entry => entry.action === "finalizado").length,
      ultimaAtividade: todayHistory.length > 0 ? 
        new Date(todayHistory[todayHistory.length - 1].timestamp).toLocaleTimeString('pt-BR') : "---"
    };
  };

  // Inicializar o timeManager para esta vaga
  const timeManager = useTimeManager(vaga.id);
  
  const getElapsedTime = () => {
    // ⚠️ FIX: SOLUÇÃO DIRETA para garantir exibição correta do timer
    
    // 1. Método mais direto: verificar estado da vaga primeiro
    if (vaga.status === "chamado") {
      // 2. Verificar todas as fontes possíveis de timestamp, em ordem de prioridade
      
      // 2.1 TimeManager - a fonte mais confiável
      if (timeManager.hasChamadoTime()) {
        const elapsedTime = timeManager.getElapsedTime();
        console.log(`VagaCard ${vaga.id}: Timer do TimeManager: ${elapsedTime}`);
        return elapsedTime;
      }
      
      // 2.2 Verificar dados diretos do localStorage
      try {
        const timeManagerData = localStorage.getItem(`time_manager_chamado_${vaga.id}`);
        if (timeManagerData) {
          const data = JSON.parse(timeManagerData);
          if (data && data.timestamp) {
            const elapsed = calculateElapsedTime(data.timestamp);
            console.log(`VagaCard ${vaga.id}: Timer do localStorage direto: ${elapsed}`);
            return elapsed;
          }
        }
      } catch (e) {
        console.error(`VagaCard ${vaga.id}: Erro ao ler time_manager_data:`, e);
      }
      
      // 2.3 Formato exato salvo especificamente para o timer
      const exactChamadoTime = localStorage.getItem(`vaga_${vaga.id}_chamado_em_exact`);
      if (exactChamadoTime) {
        const elapsed = calculateElapsedTime(exactChamadoTime);
        console.log(`VagaCard ${vaga.id}: Timer do chamado_em_exact: ${elapsed}`);
        return elapsed;
      }
      
      // 2.4 Dados da vaga no estado
      if (vaga.chamadoEm) {
        const elapsed = calculateElapsedTime(vaga.chamadoEm);
        console.log(`VagaCard ${vaga.id}: Timer dos dados da vaga: ${elapsed}`);
        return elapsed;
      }
      
      // 2.5 Se estiver no status "chamado" mas não tem timestamp, criar um novo
      console.log(`VagaCard ${vaga.id}: Nenhum timestamp encontrado, mas status é "chamado". Criando novo...`);
      const now = new Date().toISOString();
      
      // Registrar nos três formatos para máxima compatibilidade
      timeManager.registerChamado(vaga.gaiola || "desconhecida", "vaga_card_emergency_fix");
      localStorage.setItem(`vaga_${vaga.id}_chamado_em_exact`, now);
      localStorage.setItem(`time_manager_chamado_${vaga.id}`, JSON.stringify({
        vagaId: vaga.id,
        gaiola: vaga.gaiola || "desconhecida",
        timestamp: now,
        type: 'chamado',
        source: 'vagacard_emergency_fix'
      }));
      
      return "00:00"; // Na próxima atualização terá o valor correto
    }
    
    // Se não estiver em estado "chamado", não mostrar timer
    return "00:00";
  };

  const todayStats = getTodayStats();

  return (
    <Card className="relative mobile-card">
      <CardHeader className="pb-3">
        <div className={`${getVagaColor(index)} px-3 py-2 rounded text-center relative`}>
          <CardTitle className="text-lg font-bold text-slate-700">
            VAGA {vaga.id.padStart(2, '0')}
          </CardTitle>
          {vaga.status === "chamado" && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Informações principais */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-medium text-slate-600">GAIOLA</div>
            <div className="font-mono text-lg font-bold text-slate-800">
              {vaga.gaiola || "---"}
            </div>
            {/* SEMPRE mostrar tipo de veículo, mesmo para gaiolas sem driver */}
            <div className={`text-xs font-medium px-2 py-1 rounded mt-1 ${
              getTipoVeiculoClasses(driverData?.tipoVeiculo)
            }`}>
              {formatarTipoVeiculo(driverData?.tipoVeiculo) || "Tipo não informado"}
            </div>
            {vaga.gaiola && (
              <div className="text-xs text-green-600 font-medium">✓ Chamada</div>
            )}
          </div>
          <div>
            <div className="text-xs font-medium text-slate-600">STATUS</div>
            <Badge className={`text-xs font-bold ${getStatusColor(vaga.status)}`}>
              {getStatusText(vaga.status)}
            </Badge>
          </div>
        </div>

        {/* Tempos */}
        {showTimers && (vaga.chamadoEm || vaga.tempoTotal) && (
          <div className="space-y-2 text-xs bg-slate-50 p-3 rounded-lg">
            {vaga.chamadoEm && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">🕐 Chamado às:</span>
                <span className="font-mono font-medium">
                  {new Date(vaga.chamadoEm).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            )}
            {vaga.status === "chamado" && (
              <div className="flex justify-between items-center">
                <span className="text-blue-600">⏱️ Tempo decorrido:</span>
                <span className="font-mono font-bold text-blue-600 text-lg">
                  {getElapsedTime() || "00:00"}
                </span>
              </div>
            )}
            {vaga.tempoTotal && (
              <div className="flex justify-between items-center">
                <span className="text-green-600">✅ Tempo total:</span>
                <span className="font-mono font-medium text-green-600">
                  {formatDuration(vaga.tempoTotal)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Estatísticas do dia */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-blue-600 font-bold text-lg">{todayStats.chamados}</div>
            <div className="text-slate-600 text-xs">Chamados</div>
          </div>
          <div>
            <div className="text-green-600 font-bold text-lg">{todayStats.finalizados}</div>
            <div className="text-slate-600 text-xs">Finalizados</div>
          </div>
          <div>
            <div className="text-slate-600 font-bold text-lg">{vaga.totalGaiolas || 0}</div>
            <div className="text-slate-600 text-xs">Total</div>
          </div>
        </div>

        {/* Ações para Motorista Atrasado - Mostrar em destaque */}
        {showDelayedActions && onDriverDelayAction && vaga.gaiola && vaga.status === "chamado" && (
          <div className="bg-orange-50 border border-orange-300 rounded-md p-3 my-3">
            <h3 className="text-center font-bold text-amber-800 mb-2">Motorista Atrasou</h3>
            <p className="text-sm text-center mb-2">
              Motorista da gaiola <span className="font-bold">{vaga.gaiola}</span> está atrasado. Ele vai entrar no hub?
            </p>
            <DelayedDriverActions 
              vagaId={vaga.id} 
              gaiola={vaga.gaiola}
              isDelayed={true}
              isAdmin={window.location.pathname.includes('/admin')}
              onDriverAction={(willEnter) => {
                console.log(`VagaCard: Resposta para motorista atrasado: ${willEnter ? 'Sim' : 'Não'}`);
                
                // ✅ MANTER COMPORTAMENTO ORIGINAL PRIMEIRO
                // Passa a ação para o componente pai (AdminPanel) - compatibilidade
                onDriverDelayAction(vaga.id, vaga.gaiola || "", willEnter);
                
                // Esconde as ações após uma escolha
                setShowDelayedActions(false);
              }}
            />
          </div>
        )}
        
        {/* Alerta de confirmação de entrada do motorista */}
        {showEnterConfirmation && (
          <div className="bg-green-50 border border-green-300 rounded-md p-3 my-3">
            <div className="flex items-center justify-center mb-2">
              <LogIn className="text-green-600 mr-2" />
              <h3 className="text-center font-bold text-green-800">Motorista vai Entrar</h3>
            </div>
            <p className="text-sm text-center">
              Motorista da gaiola <span className="font-bold">{confirmationGaiola}</span> vai entrar na vaga <span className="font-bold">{vaga.id}</span>. Aguarde sua chegada.
            </p>
          </div>
        )}
        
        {/* Controles */}
        <div className="space-y-2">
          {/* Ações para Analista Chamado */}
          {showAnalystActions && (
            <div className="bg-blue-50 border border-blue-300 rounded-md p-2 my-2">
              <h3 className="text-center font-bold mb-2 text-blue-800">Analista Chamado</h3>
              <p className="text-sm text-center text-gray-700 mb-2">
                Um analista foi chamado para assistência nesta vaga
              </p>
              <AnalystCalledActions 
                vagaId={vaga.id}
                onAnalystAction={(acknowledged) => {
                  if (onAnalystAction) {
                    onAnalystAction(vaga.id, acknowledged);
                  }
                  // Esconde as ações após uma escolha
                  setShowAnalystActions(false);
                }}
              />
            </div>
          )}
        </div>

        {/* Alertas inline da vaga */}
        {vagaAlerts && vagaAlerts.length > 0 && (
          <div className="space-y-2">
            {vagaAlerts.map((alert, idx) => (
              <div key={idx} className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {alert.type === "motorista_atrasou" ? (
                      <Clock className="h-4 w-4 text-amber-600" />
                    ) : alert.type === "analista_chamado" ? (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    ) : (
                      <LogIn className="h-4 w-4 text-blue-600" />
                    )}
                    <div className="text-xs">
                      <div className="font-medium text-gray-900">{alert.message}</div>
                      {alert.gaiola && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          Gaiola {alert.gaiola}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Última atividade */}
        <div className="text-xs text-slate-500 text-center">
          Última atividade: {todayStats.ultimaAtividade}
        </div>
      </CardContent>
    </Card>
  );
});

export default VagaCard;