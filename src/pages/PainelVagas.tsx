// VagaPanel.tsx - Painel individual de gerenciamento de vaga
// Versão profissional refatorada com padrões enterprise-grade

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Card, CardContent, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Phone, Users, AlertTriangle, ArrowLeft, LogOut, 
  Clock, X, Truck, Search 
} from "lucide-react";
import { formatarTipoVeiculo, getTipoVeiculoClasses, preservarTipoVeiculo } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Hooks customizados
import { useVagaData, type VagaData } from "@/hooks/useVagaData";
import { useDriverData, type DriverData } from "@/hooks/useDriverData";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { useErrorLogger } from "@/hooks/useErrorLogger";

// Componentes auxiliares (importações condicionais)
// import { NotificationCenter } from "@/components/NotificationCenter";
// import InlineNotifications from "@/components/InlineNotifications";

// Utilitários (importações condicionais para evitar erros)
// import { 
//   notifyAnalystCalled, 
//   notifyDriverDelay,
//   clearNotificationsForVaga,
//   updateGaiolaStatus
// } from "@/utils/notification";

// Interfaces TypeScript
interface VagaAlert {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
  vagaId: string;
}

interface VagaPanelProps {
  vagaId?: string;
}

// Constantes
const CONSTANTS = {
  INACTIVITY_TIMEOUT: 60, // minutos
  TIMER_UPDATE_INTERVAL: 1000, // milliseconds
  GAIOLA_PATTERN: /^[A-I]-?\d{0,2}$/,
  STATUS_COLORS: {
    esperar: "bg-status-waiting text-black",
    chamado: "bg-status-called text-black", 
    carregando: "bg-status-loading text-white",
    finalizado: "bg-status-completed text-black",
    default: "bg-gray-500 text-white"
  },
  ALERT_TYPES: {
    success: { color: "border-green-500 bg-green-50", icon: "✅" },
    warning: { color: "border-yellow-500 bg-yellow-50", icon: "⚠️" },
    error: { color: "border-red-500 bg-red-50", icon: "❌" },
    info: { color: "border-blue-500 bg-blue-50", icon: "ℹ️" }
  }
} as const;

const VagaPanel: React.FC = () => {
  const { vagaId } = useParams<{ vagaId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Estados locais
  const [gaiola, setGaiola] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [alerts, setAlerts] = useState<VagaAlert[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  
  // Validação crítica - vagaId deve existir
  if (!vagaId) {
    console.error("VagaPanel: vagaId não fornecido");
    navigate("/admin");
    return null;
  }
  
  // Configurar timeout de inatividade
  useInactivityTimeout(CONSTANTS.INACTIVITY_TIMEOUT);
  
  // Hooks de dados
  const { 
    vagasData, 
    loadVagaData, 
    toggleCheck, 
    iniciarCarregamento, 
    finalizarCarregamento,
    resetVaga
  } = useVagaData();
  
  const { 
    gaiolasData, 
    isLoading: isSyncing, 
    error: syncError 
  } = useRealtimeData();
  
  const { 
    getDriverByGaiola, 
    setDriverStatus,
    markDriverDelayed,
    getDriversStats,
    driversData
  } = useDriverData();
  
  // Hook para registro de erros
  const { logCriticalError, executeWithErrorHandling } = useErrorLogger('PainelVagas');
  
  // Obter dados da vaga atual
  const vagaData = useMemo(() => 
    vagasData[vagaId] || {
      id: vagaId,
      gaiola: "",
      status: "esperar" as const,
      check: false,
      history: [],
      lastUpdate: new Date().toISOString(),
      totalGaiolas: 0
    }, 
    [vagasData, vagaId]
  );
  
  // Timer para atualizar o tempo atual
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, CONSTANTS.TIMER_UPDATE_INTERVAL);
    
    return () => clearInterval(timer);
  }, []);
  
  // Carregar dados ao montar componente
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      await executeWithErrorHandling(async () => {
        await loadVagaData(vagaId!);
        loadAlerts();
      }, {
        component: 'PainelVagas',
        action: 'inicializar_dados'
      });
      setIsLoading(false);
    };
    
    initializeData();
  }, [vagaId, loadVagaData, executeWithErrorHandling]);
  
  // Verificar autenticação
  useEffect(() => {
    const loggedVaga = localStorage.getItem("vagaLoggedIn");
    if (!loggedVaga || loggedVaga !== vagaId) {
      navigate("/");
      return;
    }
  }, [vagaId, navigate]);

  // 🚨 NOVA FUNCIONALIDADE: Escutar evento de limpeza de alertas
  // ===== DEFINIÇÕES DAS FUNÇÕES =====
  
  // Carregar alertas do localStorage
  const loadAlerts = useCallback(() => {
    executeWithErrorHandling(async () => {
      const savedAlerts = localStorage.getItem(`vaga_${vagaId}_alerts`);
      if (savedAlerts) {
        const parsedAlerts: VagaAlert[] = JSON.parse(savedAlerts);
        setAlerts(parsedAlerts.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ));
      }
    }, {
      component: 'PainelVagas',
      action: 'carregar_alertas'
    });
  }, [vagaId, executeWithErrorHandling]);
  
  // Salvar alertas no localStorage
  const saveAlerts = useCallback((newAlerts: VagaAlert[]) => {
    try {
      localStorage.setItem(`vaga_${vagaId}_alerts`, JSON.stringify(newAlerts));
      setAlerts(newAlerts);
    } catch (error) {
      console.error("Erro ao salvar alertas:", error);
    }
  }, [vagaId]);
  
  // Adicionar novo alerta
  const addAlert = useCallback((message: string, type: VagaAlert['type'] = 'info') => {
    const newAlert: VagaAlert = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: new Date().toISOString(),
      vagaId: vagaId!
    };
    
    const newAlerts = [newAlert, ...alerts];
    saveAlerts(newAlerts);
    
    toast({
      title: type === 'error' ? 'Erro' : type === 'warning' ? 'Aviso' : 'Informação',
      description: message,
      variant: type === 'error' ? 'destructive' : 'default'
    });
  }, [alerts, saveAlerts, vagaId, toast]);
  
  // Remover alerta
  const removeAlert = useCallback((alertId: string) => {
    const newAlerts = alerts.filter(alert => alert.id !== alertId);
    saveAlerts(newAlerts);
  }, [alerts, saveAlerts]);

  // ===== USE EFFECTS =====

  // Quando uma nova gaiola é chamada, limpar alertas automaticamente
  useEffect(() => {
    const handleAlertsClear = (event: CustomEvent) => {
      const { vagaId: clearedVagaId } = event.detail;
      
      // Se for a vaga atual, limpar os alertas do estado local
      if (clearedVagaId === vagaId) {
        console.log(`🧹 [PAINEL] Alertas limpos automaticamente para vaga ${vagaId}`);
        setAlerts([]);
      }
    };

    // Escutar eventos de limpeza de alertas
    window.addEventListener('SLOT_ALERTS_CLEARED', handleAlertsClear as EventListener);
    window.addEventListener('ALERTS_CLEARED', handleAlertsClear as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('SLOT_ALERTS_CLEARED', handleAlertsClear as EventListener);
      window.removeEventListener('ALERTS_CLEARED', handleAlertsClear as EventListener);
    };
  }, [vagaId]);

  // Listener para respostas do Admin às solicitações de atraso
  useEffect(() => {
    const handleAdminResponse = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { requestId, vagaId: targetVagaId, gaiola, motorista, response, timestamp } = customEvent.detail;
      
      console.log(`PainelVagas ${vagaId}: Evento recebido:`, { requestId, targetVagaId, gaiola, motorista, response });
      
      // Verificar se a resposta é para esta vaga
      if (targetVagaId === vagaId) {
        console.log(`PainelVagas ${vagaId}: Processando resposta do Admin:`, { response, gaiola, motorista });
        
        // Atualizar status da solicitação local
        const requestData = localStorage.getItem(`vaga_${vagaId}_delay_request`);
        if (requestData) {
          const updatedRequest = {
            ...JSON.parse(requestData),
            status: 'responded',
            response: response,
            responseTimestamp: timestamp
          };
          localStorage.setItem(`vaga_${vagaId}_delay_request`, JSON.stringify(updatedRequest));
        }
        
        if (response === 'bipar_gaiola') {
          // Admin instruiu para bipar a gaiola
          addAlert(`❌ Analista RESPONDEU: Bipar a gaiola ${gaiola} e levar para o layout, chamar o próximo motorista.`, 'error');
          
          toast({
            title: "❌ Analista RESPONDEU - AÇÃO NECESSÁRIA",
            description: `BIPE A GAIOLA ${gaiola} - Levar para layout!`,
            variant: "destructive",
            duration: 10000, // 10 segundos
          });
          
          // Marcar motorista como atrasado E REMOVER A VAGA
          if (motorista && gaiola) {
            markDriverDelayed(gaiola, vagaId!, true); // removeVaga = true
            console.log(`Motorista ${motorista} da gaiola ${gaiola} marcado como ATRASADO e VAGA REMOVIDA após Admin instruir para bipar`);
          }
          
        } else if (response === 'motorista_a_caminho') {
          // Admin confirmou que motorista está a caminho
          addAlert(`✅ Analista RESPONDEU: Motorista da gaiola ${gaiola} está a caminho. Aguarde mais um pouco.`, 'success');
          
          toast({
            title: "✅ Analista RESPONDEU - MOTORISTA A CAMINHO",
            description: `Gaiola ${gaiola} está a caminho`,
            variant: "default",
            duration: 8000, // 8 segundos
          });
          
          console.log(`Admin confirmou que motorista ${motorista} da gaiola ${gaiola} está a caminho - mantendo status atual`);
        }
      }
    };

    // Função para verificar respostas do Admin no localStorage (fallback)
    const checkForAdminResponse = () => {
      const adminResponse = localStorage.getItem(`vaga_${vagaId}_admin_response`);
      if (adminResponse) {
        try {
          const responseData = JSON.parse(adminResponse);
          console.log(`PainelVagas ${vagaId}: Encontrada resposta do Admin no localStorage:`, responseData);
          
          // Processar a resposta como se fosse um evento
          handleAdminResponse({
            detail: {
              vagaId: vagaId,
              gaiola: responseData.gaiola,
              motorista: responseData.motorista,
              response: responseData.response,
              timestamp: responseData.timestamp
            }
          } as CustomEvent);
          
          // Remover a resposta processada
          localStorage.removeItem(`vaga_${vagaId}_admin_response`);
        } catch (error) {
          console.error(`Erro ao processar resposta do Admin para vaga ${vagaId}:`, error);
        }
      }
    };

    // Escutar evento de resposta do admin
    window.addEventListener('admin_driver_delay_response', handleAdminResponse);
    
    // Verificar respostas pendentes no localStorage quando o componente montar
    checkForAdminResponse();
    
    // Verificar periodicamente por respostas (fallback)
    const checkInterval = setInterval(checkForAdminResponse, 3000);

    // Cleanup
    return () => {
      window.removeEventListener('admin_driver_delay_response', handleAdminResponse);
      clearInterval(checkInterval);
    };
  }, [vagaId, addAlert, toast, markDriverDelayed]);

  // Recarregar dados quando houver mudanças
  useEffect(() => {
    const interval = setInterval(() => {
      if (vagaId) {
        loadVagaData(vagaId);
      }
    }, 2000); // Recarregar a cada 2 segundos

    return () => clearInterval(interval);
  }, [vagaId, loadVagaData]);
  
  // Obter informações do motorista
  const driverInfo = useMemo(() => {
    if (!vagaData.gaiola) return null;
    return getDriverByGaiola(vagaData.gaiola);
  }, [vagaData.gaiola, getDriverByGaiola]);
  
  // Obter tipo de veículo atual
  const getCurrentVehicleType = useCallback(() => {
    if (!vagaData.gaiola) return "";
    
    const gaiolaNormalizada = vagaData.gaiola.toUpperCase();
    let driverData = null;
    
    console.log('🚗 getCurrentVehicleType: Buscando tipo para gaiola:', gaiolaNormalizada);
    
    // Tentar buscar do driverInfo atual
    if (driverInfo) {
      driverData = driverInfo;
      console.log('🚗 getCurrentVehicleType: Encontrado em driverInfo:', {
        gaiola: driverData.gaiola,
        tipoVeiculo: driverData.tipoVeiculo,
        tipoVeiculoType: typeof driverData.tipoVeiculo
      });
    }
    
    // Se não encontrou, tentar buscar diretamente do localStorage
    if (!driverData) {
      try {
        const driversArr = JSON.parse(localStorage.getItem('drivers_data') || '[]');
        const foundDriver = driversArr.find((d: any) => d.gaiola && d.gaiola.toUpperCase() === gaiolaNormalizada);
        if (foundDriver) {
          driverData = foundDriver;
          console.log('🚗 getCurrentVehicleType: Encontrado em localStorage:', {
            gaiola: driverData.gaiola,
            tipoVeiculo: driverData.tipoVeiculo,
            tipoVeiculoType: typeof driverData.tipoVeiculo
          });
        }
      } catch (e) {
        console.error('Erro ao buscar drivers_data do localStorage:', e);
      }
    }
    
    // Use a função utilitária para formatar de maneira consistente
    const resultado = formatarTipoVeiculo(driverData?.tipoVeiculo);
    console.log('🚗 getCurrentVehicleType: Resultado final:', resultado);
    return resultado;
  }, [vagaData.gaiola, driverInfo]);
  
  const currentVehicleType = useMemo(() => getCurrentVehicleType(), [getCurrentVehicleType]);
  
  // Função para processar entrada da gaiola
  const handleGaiolaInput = useCallback((value: string) => {
    // Se estiver apagando, permitir
    if (value.length < gaiola.length) {
      setGaiola(value.toUpperCase());
      return;
    }

    // Converter para maiúsculo
    const upperValue = value.toUpperCase();
    
    // Se tiver apenas uma letra, adicionar o hífen
    if (upperValue.length === 1 && upperValue.match(/[A-I]/)) {
      setGaiola(upperValue + "-");
    } 
    // Se começar com letra e hífen, permitir números
    else if (upperValue.match(/^[A-I]-\d{0,2}$/)) {
      setGaiola(upperValue);
    }
    // Se for apenas uma letra válida, permitir
    else if (upperValue.match(/^[A-I]$/)) {
      setGaiola(upperValue);
    }
  }, [gaiola]);
  
  // Função para chamar motorista - VERSÃO PROFISSIONAL
  const handleChamar = useCallback(async () => {
    if (!gaiola.trim()) {
      addAlert("Digite o código da gaiola antes de chamar", 'error');
      return;
    }

    const gaiolaFormatted = gaiola.toUpperCase();
    
    try {
      setIsLoading(true);
      
      // Verificar se gaiola existe
      const driverData = getDriverByGaiola(gaiolaFormatted);
      if (!driverData) {
        addAlert(`Gaiola ${gaiolaFormatted} não está cadastrada no sistema`, 'error');
        return;
      }

      // Verificar se a gaiola chegou
      if (driverData.status !== "chegou") {
        addAlert(`A chegada da gaiola ${gaiolaFormatted} ainda não foi registrada pelo GR`, 'error');
        return;
      }

      // Verificar se gaiola já tem vaga atribuída
      if (driverData.vaga && driverData.vaga !== vagaId) {
        addAlert(`Gaiola ${gaiolaFormatted} já está atribuída à Vaga ${driverData.vaga}`, 'error');
        return;
      }

      // LIMPAR TODOS OS ALERTAS ANTERIORES DA VAGA PRIMEIRO
      // Limpar alertas da vaga
      localStorage.removeItem(`vaga_${vagaId}_alerts`);
      // Limpar alertas do admin para essa vaga também
      localStorage.removeItem(`admin_vaga_${vagaId}_alerts`);
      setAlerts([]);
      
      // DISPARAR EVENTO PARA AVISAR O PAINEL ADMIN
      window.dispatchEvent(new CustomEvent('SLOT_ALERTS_CLEARED', {
        detail: {
          vagaId: vagaId,
          gaiola: gaiolaFormatted,
          source: 'handleChamar'
        }
      }));
      
      // Chamar motorista usando o hook
      await iniciarCarregamento(vagaId!, gaiolaFormatted);
      
      // GARANTIR que a vaga seja atribuída ao motorista
      // Atualizar status do motorista E atribuir vaga explicitamente
      setDriverStatus(gaiolaFormatted, "entrar_hub", vagaId!);
      
      // ✅ CORREÇÃO ADICIONAL: Forçar atualização direta dos dados do motorista
      // para garantir que a vaga seja atribuída mesmo se houver falha na sincronização
      try {
        const driversDataStr = localStorage.getItem('drivers_data');
        if (driversDataStr) {
          const driversArray = JSON.parse(driversDataStr);
          const updatedDrivers = driversArray.map((driver: any) => {
            if (driver.gaiola === gaiolaFormatted) {
              return {
                ...driver,
                status: "entrar_hub",
                vaga: vagaId,
                chamadoEm: new Date().toISOString()
              };
            }
            return driver;
          });
          localStorage.setItem('drivers_data', JSON.stringify(updatedDrivers));
          console.log(`✅ CORREÇÃO: Vaga ${vagaId} atribuída diretamente ao motorista ${gaiolaFormatted}`);
        }
      } catch (error) {
        console.error("Erro na atribuição direta da vaga:", error);
      }
      
      // Criar apenas o novo alerta
      const newAlert: VagaAlert = {
        id: Date.now().toString(),
        message: `Gaiola ${gaiolaFormatted} foi chamada`,
        type: 'success',
        timestamp: new Date().toISOString(),
        vagaId: vagaId!
      };
      
      // Salvar apenas este alerta
      const onlyNewAlert = [newAlert];
      localStorage.setItem(`vaga_${vagaId}_alerts`, JSON.stringify(onlyNewAlert));
      setAlerts(onlyNewAlert);
      
      // Limpar campo de entrada
      setGaiola("");
      
      toast({
        title: "✅ Chamado realizado",
        description: `Gaiola ${gaiolaFormatted} foi chamada para a Vaga ${vagaId}`,
      });
      
    } catch (error) {
      console.error("Erro ao chamar motorista:", error);
      addAlert("Erro ao chamar motorista", 'error');
    } finally {
      setIsLoading(false);
    }
  }, [gaiola, vagaId, getDriverByGaiola, iniciarCarregamento, setDriverStatus, addAlert, toast]);
  
  // Chamar analistas
  const handleChamarAnalistas = useCallback(() => {
    addAlert("Analistas foram chamados para assistência", 'info');
    
    // Notificar sistema global se função existir
    // if (typeof notifyAnalystCalled === 'function') {
    //   notifyAnalystCalled(vagaId!);
    // }
    
    toast({
      title: "Analistas chamados",
      description: "Solicitação enviada para os analistas",
    });
  }, [vagaId, addAlert, toast]);
  
  // Marcar motorista como atrasado
  const handleMotoristaAtrasou = useCallback(() => {
    if (!vagaData.gaiola) {
      addAlert("Não há gaiola associada a esta vaga para marcar como atrasada", 'error');
      return;
    }
    
    if (vagaData.status !== "chamado" && vagaData.status !== "carregando") {
      addAlert(`A gaiola ${vagaData.gaiola} precisa estar com status "chamado" ou "carregando" para ser marcada como atrasada`, 'warning');
      return;
    }
    
    try {
      console.log(`PainelVagas ${vagaId}: Enviando solicitação de atraso para Admin - gaiola ${vagaData.gaiola}`);
      
      // Adicionar alerta local
      addAlert(`📢 Solicitação de atraso enviada para o Admin. Aguardando resposta para a gaiola ${vagaData.gaiola}`, 'warning');
      
      const timestampAtual = new Date().toISOString();
      const requestId = `delay_request_${vagaId}_${Date.now()}`;
      
      // Buscar dados do motorista pela gaiola
      const driverData = getDriverByGaiola(vagaData.gaiola);
      
      // Criar solicitação de atraso para o Admin
      const solicitacaoAtraso = {
        id: requestId,
        vagaId: vagaId,
        vagaNumero: `Vaga ${vagaId}`,
        gaiola: vagaData.gaiola,
        motorista: driverData?.motorista || "Desconhecido",
        statusVaga: vagaData.status,
        timestamp: timestampAtual,
        status: 'pending', // pending, responded
        response: null // será preenchido quando admin responder
      };
      
      // Salvar solicitação no localStorage para o Admin
      const existingRequests = JSON.parse(localStorage.getItem('admin_delay_requests') || '[]');
      const updatedRequests = [solicitacaoAtraso, ...existingRequests];
      localStorage.setItem('admin_delay_requests', JSON.stringify(updatedRequests));
      
      // Salvar referência local da solicitação
      localStorage.setItem(`vaga_${vagaId}_delay_request`, JSON.stringify({
        requestId,
        timestamp: timestampAtual,
        status: 'pending'
      }));
      
      // Disparar evento para notificar o admin em tempo real
      window.dispatchEvent(new CustomEvent('admin_delay_request_received', { 
        detail: solicitacaoAtraso 
      }));
      
      // Atualizar status do motorista
      setDriverStatus(vagaData.gaiola, "atrasado", vagaId!);

      toast({
        title: "Solicitação enviada",
        description: `Solicitação de atraso da gaiola ${vagaData.gaiola} foi enviada para o Admin`,
        variant: "default",
      });

    } catch (error) {
      console.error("Erro ao marcar motorista como atrasado:", error);
      addAlert("Erro ao marcar motorista como atrasado", 'error');
    }
  }, [vagaData.gaiola, vagaData.status, vagaId, addAlert, setDriverStatus, getDriverByGaiola, toast]);
  
  // Funções auxiliares memoizadas
  const getStatusColor = useCallback((status: string) => {
    return CONSTANTS.STATUS_COLORS[status as keyof typeof CONSTANTS.STATUS_COLORS] || 
           CONSTANTS.STATUS_COLORS.default;
  }, []);

  const getStatusText = useCallback((status: string) => {
    switch (status) {
      case "esperar": return "ESPERAR";
      case "chamado": return "CHAMADO";
      case "carregando": return "CARREGANDO";
      case "finalizado": return "FINALIZADO";
      default: return status.toUpperCase();
    }
  }, []);

  // Calcular tempo decorrido
  const calculateElapsedTime = useCallback((timestamp: string): string => {
    try {
      const startTime = new Date(timestamp);
      if (isNaN(startTime.getTime())) {
        return "00:00";
      }
      
      const diffMs = currentTime.getTime() - startTime.getTime();
      if (diffMs < 0) return "00:00";
      
      const diffSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(diffSeconds / 60);
      const seconds = diffSeconds % 60;
      
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } catch (error) {
      console.error("Erro ao calcular tempo decorrido:", error);
      return "00:00";
    }
  }, [currentTime]);

  // Obter tempo desde chamado
  const getElapsedTime = useCallback((): string | null => {
    if (vagaData.status !== "chamado" || !vagaData.chamadoEm) return null;
    return calculateElapsedTime(vagaData.chamadoEm);
  }, [vagaData.status, vagaData.chamadoEm, calculateElapsedTime]);

  // Organizar gaiolas por letra - MEMOIZADO
  const gaiolasPorLetra = useMemo(() => {
    const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const organized: Record<string, any[]> = {};
    
    // ✅ DEBUG: Verificar dados dos motoristas
    console.log("🔍 DEBUG PainelVagas: driversData =", driversData);
    console.log("🔍 DEBUG PainelVagas: Total motoristas =", Object.keys(driversData || {}).length);
    
    letras.forEach(letra => {
      // ✅ CORREÇÃO: Usar driversData ao invés de gaiolasData
      const motoristas = Object.values(driversData || {})
        .filter((driver: any) => driver?.gaiola?.startsWith(letra))
        .filter((driver: any) => !searchTerm || driver.gaiola.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a: any, b: any) => {
          const getNumFromGaiola = (gaiola: string) => {
            const match = gaiola.match(/\d+/);
            return match ? parseInt(match[0]) : 0;
          };
          return getNumFromGaiola(a.gaiola) - getNumFromGaiola(b.gaiola);
        })
        .map((driver: any) => ({
          gaiola: driver.gaiola,
          status: driver.status,
          vaga: driver.vaga,
          name: driver.motorista || driver.name,
          chegou: driver.status === "chegou",
          tipoVeiculo: driver.tipoVeiculo
        }));
      
      organized[letra] = motoristas;
      if (motoristas.length > 0) {
        console.log(`🔍 DEBUG: Letra ${letra} tem ${motoristas.length} motoristas`);
      }
    });
    
    return organized;
  }, [driversData, searchTerm]);
  
  // Estatísticas dos motoristas - MEMOIZADO
  const driverStats = useMemo(() => {
    // ✅ CORREÇÃO: Usar driversData ao invés de gaiolasData
    const allDrivers = Object.values(driversData || {});
    return {
      total: allDrivers.length,
      chegaram: allDrivers.filter((d: any) => d?.status === "chegou").length,
      comVaga: allDrivers.filter((d: any) => d?.vaga).length,
      esperandoVaga: allDrivers.filter((d: any) => d?.status === "chegou" && !d?.vaga).length
    };
  }, [driversData]);

  // Função para logout
  const handleLogout = useCallback(() => {
    localStorage.removeItem("vagaLoggedIn");
    navigate("/");
  }, [navigate]);

  // Função para finalizar carregamento
  const handleFinalizarCarregamento = useCallback(async () => {
    if (!vagaData.gaiola) {
      addAlert("Nenhum motorista foi chamado para esta vaga", 'error');
      return;
    }
    
    try {
      setIsLoading(true);
      
      await finalizarCarregamento(vagaId!, `vaga_${vagaId}`);
      setDriverStatus(vagaData.gaiola, "esperar_fora_hub");
      addAlert(`Carregamento finalizado para a gaiola ${vagaData.gaiola}`, 'success');
      
      toast({
        title: "Sucesso",
        description: "Carregamento finalizado com sucesso",
      });
      
    } catch (error) {
      console.error("Erro ao finalizar carregamento:", error);
      addAlert("Erro ao finalizar carregamento", 'error');
    } finally {
      setIsLoading(false);
    }
  }, [vagaData.gaiola, vagaId, finalizarCarregamento, setDriverStatus, addAlert, toast]);

  // Função para resetar vaga
  const handleResetVaga = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (vagaData.gaiola) {
        setDriverStatus(vagaData.gaiola, "esperar_fora_hub");
      }
      
      await resetVaga(vagaId!, `vaga_${vagaId}`);
      addAlert("Vaga resetada com sucesso", 'info');
      
      toast({
        title: "Sucesso",
        description: "Vaga resetada com sucesso",
      });
      
    } catch (error) {
      console.error("Erro ao resetar vaga:", error);
      addAlert("Erro ao resetar vaga", 'error');
    } finally {
      setIsLoading(false);
    }
  }, [vagaData.gaiola, vagaId, resetVaga, setDriverStatus, addAlert, toast]);

  // Funções auxiliares para alertas
  const getAlertColor = useCallback((type: string) => {
    return CONSTANTS.ALERT_TYPES[type as keyof typeof CONSTANTS.ALERT_TYPES]?.color || 
           CONSTANTS.ALERT_TYPES.info.color;
  }, []);

  const getAlertIcon = useCallback((type: string) => {
    return CONSTANTS.ALERT_TYPES[type as keyof typeof CONSTANTS.ALERT_TYPES]?.icon || 
           CONSTANTS.ALERT_TYPES.info.icon;
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <Card className="border shadow-sm bg-white">
          <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <CardTitle className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">
                  VAGA {vagaId?.padStart(2, '0')}
                </CardTitle>
                {vagaData.status === "chamado" && getElapsedTime() && (
                  <Badge className="bg-amber-500 text-slate-900 px-4 py-2 text-lg font-bold">
                    <Clock className="h-5 w-5 mr-2" />
                    {getElapsedTime()}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2 items-center">
                {/* <NotificationCenter context="vaga" vagaId={vagaId} /> */}
                <Button onClick={() => navigate(-1)} variant="ghost" className="text-white hover:bg-white/10 border border-white/20">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button onClick={handleLogout} variant="ghost" className="text-white hover:bg-white/10 border border-white/20">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Painel de Controle da Vaga */}
          <div className="space-y-8">
            {/* Status atual */}
            <Card className="border shadow-sm bg-white">
              <CardContent className="p-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="text-center space-y-4">
                    <div className="text-sm font-medium text-slate-600 uppercase tracking-wider">Gaiola Atual</div>
                    <div className="text-5xl font-bold text-slate-800 tracking-tight">
                      {vagaData.gaiola || "---"}
                    </div>
                    {currentVehicleType && (
                      <div className={`inline-flex items-center mt-2 ${getTipoVeiculoClasses(currentVehicleType)}`}>
                        <Truck className="h-4 w-4 mr-1" />
                        {currentVehicleType}
                      </div>
                    )}
                    {vagaData.status === "chamado" && getElapsedTime() && (
                      <div className="inline-flex items-center bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-bold mt-2">
                        <Clock className="h-4 w-4 mr-2" />
                        {getElapsedTime()}
                      </div>
                    )}
                  </div>
                  <div className="text-center space-y-4">
                    <div className="text-sm font-medium text-slate-600 uppercase tracking-wider">Status</div>
                    <Badge className={`text-xl font-bold px-6 py-3 rounded-lg ${getStatusColor(vagaData.status)}`}>
                      {getStatusText(vagaData.status)}
                    </Badge>
                    {vagaData.chamadoEm && (
                      <div className="text-xs text-slate-500">
                        Chamado às: {new Date(vagaData.chamadoEm).toLocaleTimeString('pt-BR')}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Formulário de gaiola */}
            <Card className="border shadow-sm bg-white">
              <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white">
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Phone className="h-5 w-5" />
                  </div>
                  Chamar Gaiola
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 bg-white">
                {/* Alertas na área da gaiola */}
                {alerts.length > 0 && (
                  <div className="mb-6 space-y-3">
                    {alerts.map((alert) => (
                      <div key={alert.id} className={`${getAlertColor(alert.type)} border-l-4 p-4 rounded-r-lg shadow-sm`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{getAlertIcon(alert.type)}</span>
                            <div>
                              <div className="font-semibold text-slate-800">{alert.message}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                {new Date(alert.timestamp).toLocaleTimeString('pt-BR')}
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={() => removeAlert(alert.id)}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-slate-200/50"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="space-y-6">
                  <div className="text-lg font-semibold text-slate-800 mb-6">
                    Digite o código da gaiola
                  </div>
                  <Input
                    id="gaiola"
                    type="text"
                    placeholder="Ex: A-5, B-12, C-3"
                    value={gaiola}
                    onChange={(e) => handleGaiolaInput(e.target.value)}
                    className="text-2xl font-mono uppercase h-16 text-center border-2 border-slate-200 focus:border-slate-800 bg-slate-50 font-bold rounded-lg shadow-inner"
                    maxLength={4}
                    disabled={isLoading}
                  />
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      </div>
                      <p className="text-sm text-amber-800 font-medium">
                        Só é possível chamar gaiolas que já tiveram sua chegada registrada pelo GR
                      </p>
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={handleChamar} 
                  className="w-full bg-slate-800 text-white text-xl py-6 font-bold shadow-sm rounded-lg mt-6 mobile-button"
                  disabled={isLoading}
                >
                  <Phone className="h-6 w-6 mr-3" />
                  {isLoading ? "CHAMANDO..." : "CHAMAR GAIOLA"}
                </Button>
                
                {/* Notificações inline sobre motorista */}
                <div className="mt-4">
                  {/* <InlineNotifications vagaId={vagaId} /> */}
                </div>
              </CardContent>
            </Card>

            {/* Botões auxiliares */}
            <div className="grid grid-cols-2 gap-6">
              <Button
                onClick={handleChamarAnalistas}
                variant="outline"
                className="py-6 text-base font-semibold border-2 border-blue-200 text-blue-700 bg-white shadow-sm rounded-lg mobile-button"
                disabled={isLoading}
              >
                <Users className="h-5 w-5 mr-2" />
                Chamar Analistas
              </Button>
              <Button
                onClick={handleMotoristaAtrasou}
                variant="outline"
                className="py-6 text-base font-semibold border-2 border-red-200 text-red-700 bg-white shadow-sm rounded-lg mobile-button"
                disabled={isLoading || !vagaData.gaiola}
              >
                <AlertTriangle className="h-5 w-5 mr-2" />
                Motorista Atrasou
              </Button>
            </div>

            {/* Botões de ação da vaga */}
            {vagaData.status === "carregando" && (
              <div className="grid grid-cols-2 gap-6">
                <Button
                  onClick={handleFinalizarCarregamento}
                  className="py-6 text-base font-semibold bg-green-600 hover:bg-green-700 text-white"
                  disabled={isLoading}
                >
                  <Truck className="h-5 w-5 mr-2" />
                  Finalizar Carregamento
                </Button>
                <Button
                  onClick={handleResetVaga}
                  variant="outline"
                  className="py-6 text-base font-semibold border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                  disabled={isLoading}
                >
                  Resetar Vaga
                </Button>
              </div>
            )}
          </div>

          {/* Painel de Controle de Motoristas */}
          <div className="space-y-6">
            <Card className="border shadow-sm bg-white">
              <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-lg">
                <CardTitle className="text-xl flex items-center justify-between">
                  <span className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      🚚
                    </div>
                    Todos os Motoristas
                  </span>
                  <Badge variant="outline" className="text-white border-white/30 bg-white/10">
                    Total: {driverStats.total}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-white/80 mt-1">
                  Lista de todos os motoristas. Clique em uma gaiola com status <strong>"CHEGOU"</strong> para selecioná-la automaticamente.
                </p>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex mb-4 gap-3 justify-center">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium">CHEGOU</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                    <span className="text-sm font-medium">FORA DO HUB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                    <span className="text-sm font-medium">ENTRAR NO HUB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500"></div>
                    <span className="text-sm font-medium">ATRASADO</span>
                  </div>
                </div>
                
                {/* Campo de busca */}
                <div className="mb-4 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar gaiola..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Lista de gaiolas organizadas por letra */}
                <Tabs defaultValue="A" className="w-full">
                  <TabsList className="grid w-full grid-cols-9">
                    {Object.keys(gaiolasPorLetra).map(letra => (
                      <TabsTrigger key={letra} value={letra} className="text-xs">
                        {letra}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {Object.entries(gaiolasPorLetra).map(([letra, gaiolas]) => (
                    <TabsContent key={letra} value={letra} className="mt-4">
                      <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto">
                        {gaiolas.map((g: any) => (
                          <Button
                            key={g.gaiola}
                            variant={g.gaiola === vagaData.gaiola ? "default" : "outline"}
                            size="sm"
                            className={`
                              text-xs font-mono h-12 
                              ${g.status === "chegou" ? "border-green-500 bg-green-50 hover:bg-green-100 cursor-pointer" : ""}
                              ${g.status === "esperar_fora_hub" ? "border-yellow-500 bg-yellow-50" : ""}
                              ${g.status === "entrar_hub" ? "border-blue-500 bg-blue-50" : ""}
                              ${g.status === "atrasado" ? "border-red-500 bg-red-50" : ""}
                              ${g.vaga ? "ring-2 ring-purple-300" : ""}
                            `}
                            onClick={() => g.status === "chegou" && setGaiola(g.gaiola)}
                            disabled={g.status !== "chegou" || isLoading}
                          >
                            <div className="text-center">
                              <div className="font-bold">{g.gaiola}</div>
                              {g.vaga && (
                                <div className="text-xs text-purple-600">V{g.vaga}</div>
                              )}
                            </div>
                          </Button>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VagaPanel;
