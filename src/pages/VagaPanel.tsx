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
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";

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
  
  // Configurar timeout de inatividade
  useInactivityTimeout(CONSTANTS.INACTIVITY_TIMEOUT);
  
  // Hooks de dados
  const { 
    vagasData, 
    loadVagaData, 
    toggleCheck, 
    iniciarCarregamento, 
    finalizarCarregamento,
    resetVaga,
    chamarGaiola
  } = useVagaData();
  
  // Validação crítica - vagaId deve existir
  if (!vagaId) {
    console.error("VagaPanel: vagaId não fornecido");
    navigate("/admin");
    return null;
  }
  
  const { 
    getDriverByGaiola, 
    setDriverStatus,
    getDriversStats,
    driversData,
    markDriverDelayed
  } = useDriverData();
  
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
    
    // Verificar periodicamente se há sinalizações para tocar alerta
    const alertCheckInterval = setInterval(() => {
      const shouldPlayAlert = localStorage.getItem(`vaga_${vagaId}_play_alert_sound`);
      if (shouldPlayAlert === 'true') {
        try {
          // Remover flag para não tocar novamente no próximo ciclo
          localStorage.removeItem(`vaga_${vagaId}_play_alert_sound`);
          
          // Reproduzir som de alerta
          const audio = new Audio('/notification-sound.mp3');
          audio.volume = 1.0; // Volume máximo
          audio.play().catch(e => console.log("Erro ao reproduzir som:", e));
          
          // Reproduzir som novamente após 1 segundo
          setTimeout(() => {
            const audio2 = new Audio('/notification-sound.mp3');
            audio2.volume = 1.0;
            audio2.play().catch(e => console.log("Erro ao reproduzir som:", e));
          }, 1000);
        } catch (error) {
          console.log("Som de notificação não disponível");
        }
      }
    }, 1000); // Verificar a cada 1 segundo
    
    return () => {
      clearInterval(timer);
      clearInterval(alertCheckInterval);
    };
  }, [vagaId]);
  
  // Carregar alertas do localStorage
  const loadAlerts = useCallback(() => {
    try {
      const savedAlerts = localStorage.getItem(`vaga_${vagaId}_alerts`);
      if (savedAlerts) {
        const parsedAlerts: VagaAlert[] = JSON.parse(savedAlerts);
        setAlerts(parsedAlerts.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ));
      }
    } catch (error) {
      console.error("Erro ao carregar alertas:", error);
    }
  }, [vagaId]);

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
    
    // Enviar cópia do alerta diretamente para o Admin
    try {
      const adminKey = `admin_vaga_${vagaId}_alerts`;
      let adminAlerts = [];
      const savedAdminAlerts = localStorage.getItem(adminKey);
      
      if (savedAdminAlerts) {
        try {
          adminAlerts = JSON.parse(savedAdminAlerts);
          if (!Array.isArray(adminAlerts)) adminAlerts = [];
        } catch (e) {
          adminAlerts = [];
        }
      }
      
      // Criar versão do alerta para admin
      const adminAlert = {
        ...newAlert,
        id: `admin_${newAlert.id}`,
        source: 'direct_from_vaga'
      };
      
      // Adicionar ao início da lista
      adminAlerts = [adminAlert, ...adminAlerts];
      
      // Salvar alertas do admin
      localStorage.setItem(adminKey, JSON.stringify(adminAlerts));
      
      // Disparar evento para notificar o admin sobre o novo alerta
      window.dispatchEvent(new CustomEvent('admin_alerts_changed', {
        detail: { vagaId, alertId: adminAlert.id }
      }));
      
      // Forçar sincronização dos alertas
      localStorage.setItem('_forceAlertSync', 'true');
      
      console.log(`Alerta enviado diretamente para o admin: ${message}`);
    } catch (error) {
      console.error("Erro ao enviar alerta para o admin:", error);
    }
    
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

  // Limpar alertas da gaiola anterior quando uma nova gaiola é chamada
  const clearPreviousGaiolaAlerts = useCallback((previousGaiola?: string) => {
    if (!previousGaiola) return;
    
    console.log(`Limpando alertas da gaiola anterior: ${previousGaiola}`);
    
    // Filtrar alertas que mencionam a gaiola anterior
    const filteredAlerts = alerts.filter(alert => {
      const mentionsGaiola = alert.message.toLowerCase().includes(previousGaiola.toLowerCase());
      const isGaiolaRelated = alert.message.includes('gaiola') || 
                             alert.message.includes('motorista') || 
                             alert.message.includes('Analista RESPONDEU') ||
                             alert.message.includes('ADMIN RESPONDEU');
      
      // Remove alertas que mencionam a gaiola anterior OU alertas relacionados a gaiolas em geral
      return !(mentionsGaiola || (isGaiolaRelated && alert.type === 'error') || (isGaiolaRelated && alert.type === 'success'));
    });
    
    if (filteredAlerts.length !== alerts.length) {
      console.log(`Removendo ${alerts.length - filteredAlerts.length} alertas da gaiola ${previousGaiola}`);
      saveAlerts(filteredAlerts);
      
      // Também limpar do localStorage específico da gaiola
      localStorage.removeItem(`vaga_${vagaId}_admin_response`);
      localStorage.removeItem(`vaga_${vagaId}_delay_request`);
    }
  }, [alerts, saveAlerts, vagaId]);
  
  // Carregar dados ao montar componente
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      try {
        await loadVagaData(vagaId!);
        loadAlerts();
      } catch (error) {
        console.error("Erro ao inicializar dados da vaga:", error);
        toast({
          title: "Erro",
          description: "Erro ao carregar dados da vaga",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    // Executar inicialização imediatamente
    initializeData();
    
    // Configurar recarregamento periódico de dados a cada 5 segundos
    const dataRefreshInterval = setInterval(() => {
      console.log(`VagaPanel ${vagaId}: Atualizando dados periodicamente...`);
      loadVagaData(vagaId!).catch(err => {
        console.error("Erro na atualização periódica de dados:", err);
      });
      loadAlerts();
    }, 5000);
    
    // Limpar intervalo quando componente for desmontado
    return () => {
      clearInterval(dataRefreshInterval);
    };
  }, [vagaId, loadVagaData, loadAlerts, toast]);
  
  // Verificar autenticação
  useEffect(() => {
    const loggedVaga = localStorage.getItem("vagaLoggedIn");
    if (!loggedVaga || loggedVaga !== vagaId) {
      navigate("/");
      return;
    }
  }, [vagaId, navigate]);
  
  // Ouvir eventos de confirmação de atraso do Admin
  useEffect(() => {
    // Verificar se há alertas de som pendentes
    const checkForSoundAlerts = () => {
      const soundAlertKey = `vaga_${vagaId}_play_alert_sound`;
      const soundAlert = localStorage.getItem(soundAlertKey);
      
      if (soundAlert && soundAlert.startsWith('true')) {
        console.log(`VagaPanel ${vagaId}: Tocando alerta sonoro`);
        
        try {
          // Reproduzir som de alerta
          const audio = new Audio('/notification-sound.mp3');
          audio.volume = 1.0; // Volume máximo
          audio.play()
            .then(() => {
              // Limpar alerta após tocar
              // Mas mantém o registro por alguns segundos para evitar repetições imediatas
              setTimeout(() => {
                localStorage.removeItem(soundAlertKey);
              }, 3000);
            })
            .catch(e => console.log("Erro ao reproduzir som:", e));
        } catch (error) {
          console.log("Som de notificação não disponível");
        }
      }
    };
    
    // Função para lidar com confirmação de atraso pelo admin
    const handleAdminDelayConfirmation = (event: CustomEvent) => {
      const { vagaId: targetVagaId, gaiola, motorista, timestamp } = event.detail;
      
      // Verificar se esta confirmação é para esta vaga
      if (targetVagaId === vagaId) {
        console.log(`VagaPanel ${vagaId}: Recebido confirmação de atraso do Admin para gaiola ${gaiola} (${new Date(timestamp).toLocaleTimeString()})`);
        
        // Adicionar alerta na vaga
        addAlert(`URGENTE: O Admin confirmou que o motorista ${motorista || gaiola} está ATRASADO! Por favor, bipe a gaiola e deixe-a para outro motorista.`, 'error');
        
        // Reproduzir som de alerta
        try {
          const audio = new Audio('/notification-sound.mp3');
          audio.volume = 1.0; // Volume máximo
          audio.play().catch(e => console.log("Erro ao reproduzir som:", e));
          
          // Reproduzir som novamente após 1 segundo
          setTimeout(() => {
            const audio2 = new Audio('/notification-sound.mp3');
            audio2.volume = 1.0;
            audio2.play().catch(e => console.log("Erro ao reproduzir som:", e));
          }, 1000);
        } catch (error) {
          console.log("Som de notificação não disponível");
        }
        
        // Recarregar dados da vaga para refletir mudanças
        loadVagaData(vagaId);
      }
    };
    
    // Verificar se já existe uma confirmação de atraso para esta vaga
    const checkForExistingConfirmation = () => {
      const confirmationKey = `vaga_${vagaId}_admin_confirmed_delay`;
      const confirmationData = localStorage.getItem(confirmationKey);
      
      if (confirmationData) {
        try {
          const { gaiola, motorista, timestamp } = JSON.parse(confirmationData);
          
          // Verificar se a confirmação é recente (menos de 30 minutos)
          const confirmationTime = new Date(timestamp);
          const now = new Date();
          const timeDiffMinutes = (now.getTime() - confirmationTime.getTime()) / (1000 * 60);
          
          if (timeDiffMinutes < 30) {
            console.log(`VagaPanel ${vagaId}: Encontrada confirmação de atraso de ${timeDiffMinutes.toFixed(1)} minutos atrás`);
            
            addAlert(`URGENTE: O Admin confirmou que o motorista ${motorista || gaiola} está ATRASADO! Por favor, bipe a gaiola e deixe-a para outro motorista.`, 'error');
            
            // Reproduzir som apenas se a confirmação for muito recente (menos de 5 minutos)
            if (timeDiffMinutes < 5) {
              try {
                const audio = new Audio('/notification-sound.mp3');
                audio.volume = 1.0;
                audio.play().catch(e => console.log("Erro ao reproduzir som:", e));
              } catch (error) {
                console.log("Som de notificação não disponível");
              }
            }
          } else {
            // Remover confirmações muito antigas
            localStorage.removeItem(confirmationKey);
          }
        } catch (error) {
          console.error("Erro ao processar confirmação de atraso existente:", error);
        }
      }
    };
    
    // Verificar confirmações existentes ao carregar
    checkForExistingConfirmation();
    checkForSoundAlerts();
    
    // Configurar verificação periódica para alertas sonoros e confirmações
    const alertCheckInterval = setInterval(() => {
      checkForSoundAlerts();
      checkForExistingConfirmation();
    }, 5000);
    
    // Adicionar evento listener
    window.addEventListener('admin_confirmed_delay', handleAdminDelayConfirmation as EventListener);
    
    // Remover evento listener e intervalo ao desmontar
    return () => {
      window.removeEventListener('admin_confirmed_delay', handleAdminDelayConfirmation as EventListener);
      clearInterval(alertCheckInterval);
    };
  }, [vagaId, addAlert, loadVagaData]);

  // Listener para respostas do Admin às solicitações de atraso
  useEffect(() => {
    const handleAdminResponse = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { requestId, vagaId: targetVagaId, gaiola, motorista, response, timestamp } = customEvent.detail;
      
      console.log(`VagaPanel ${vagaId}: Evento recebido:`, { requestId, targetVagaId, gaiola, motorista, response });
      
      // Verificar se a resposta é para esta vaga
      if (targetVagaId === vagaId) {
        console.log(`VagaPanel ${vagaId}: Processando resposta do Admin:`, { response, gaiola, motorista });
        
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
        
        // Reproduzir som de alerta para chamar atenção
        try {
          const audio = new Audio('/notification-sound.mp3');
          audio.volume = 1.0;
          audio.play().catch(e => console.log("Erro ao reproduzir som:", e));
        } catch (error) {
          console.log("Som de notificação não disponível");
        }
        
        if (response === 'bipar_gaiola') {
          // Admin instruiu para bipar a gaiola - MARCAR COMO ATRASADO
          addAlert(`❌ Analista RESPONDEU: Bipar a gaiola ${gaiola} e levar para o layout, chamar o próximo motorista.`, 'error');
          
          toast({
            title: "❌ Analista RESPONDEU - AÇÃO NECESSÁRIA",
            description: `BIPE A GAIOLA ${gaiola} - Levar para layout!`,
            variant: "destructive",
            duration: 10000, // 10 segundos
          });
          
          // MARCAR MOTORISTA COMO ATRASADO - Admin decidiu que precisa bipar
          if (motorista && gaiola) {
            markDriverDelayed(gaiola, vagaId, true); // removeVaga = true
            console.log(`Motorista ${motorista} da gaiola ${gaiola} marcado como ATRASADO após Admin instruir para bipar - VAGA REMOVIDA`);
            
            // Disparar evento para atualizar DriverPanel - marcar como atrasado e remover vaga
            window.dispatchEvent(new CustomEvent('driver_status_updated', { 
              detail: { 
                gaiola: gaiola,
                motorista: motorista,
                status: 'atrasado',
                timestamp: timestamp,
                source: 'admin_bipar_instruction',
                removeFromVaga: true // Flag para remover da vaga no sistema
              }
            }));
          }
          
          // Reproduzir som adicional
          setTimeout(() => {
            try {
              const audio2 = new Audio('/notification-sound.mp3');
              audio2.volume = 1.0;
              audio2.play().catch(e => console.log("Erro ao reproduzir som:", e));
            } catch (error) {
              console.log("Som adicional não disponível");
            }
          }, 1000);
          
        } else if (response === 'motorista_a_caminho') {
          // Admin confirmou que motorista está a caminho - NÃO marcar como atrasado
          addAlert(`✅ Analista RESPONDEU: Motorista da gaiola ${gaiola} está a caminho. Aguarde mais um pouco.`, 'success');
          
          toast({
            title: "✅ Analista RESPONDEU - MOTORISTA A CAMINHO",
            description: `Gaiola ${gaiola} está a caminho`,
            variant: "default",
            duration: 8000, // 8 segundos
          });
          
          // NÃO marcar como atrasado - motorista está apenas demorando mas ainda é válido
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
          console.log(`VagaPanel ${vagaId}: Encontrada resposta do Admin no localStorage:`, responseData);
          
          // Processar a resposta como se fosse um evento
          handleAdminResponse({
            detail: {
              vagaId: vagaId,
              gaiola: responseData.gaiola,
              motorista: responseData.motorista,
              response: responseData.response,
              timestamp: responseData.timestamp
            }
          } as any);
          
          // Remover a resposta após processar
          localStorage.removeItem(`vaga_${vagaId}_admin_response`);
        } catch (error) {
          console.error('Erro ao processar resposta do Admin do localStorage:', error);
        }
      }
    };

    // Verificar respostas pendentes ao montar o componente
    checkForAdminResponse();
    
    // Verificar periodicamente por respostas (fallback)
    const checkInterval = setInterval(checkForAdminResponse, 2000);

    window.addEventListener('admin_driver_delay_response', handleAdminResponse);
    
    return () => {
      window.removeEventListener('admin_driver_delay_response', handleAdminResponse);
      clearInterval(checkInterval);
    };
  }, [vagaId, addAlert, toast, markDriverDelayed]);

  // Obter informações do motorista
  const driverInfo = useMemo(() => {
    if (!vagaData.gaiola) return null;
    return getDriverByGaiola(vagaData.gaiola);
  }, [vagaData.gaiola, getDriverByGaiola]);
  
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
      
      // LIMPAR ALERTAS DA GAIOLA ANTERIOR - Importante para evitar confusão
      if (vagaData?.gaiola && vagaData.gaiola !== gaiolaFormatted) {
        console.log(`Nova gaiola ${gaiolaFormatted} sendo chamada. Limpando alertas da gaiola anterior: ${vagaData.gaiola}`);
        clearPreviousGaiolaAlerts(vagaData.gaiola);
      }
      
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

      // CORREÇÃO: Primeiro chamar explicitamente a gaiola para garantir atualização correta
      await chamarGaiola(vagaId!, gaiolaFormatted);

      // Aguardar um momento para garantir persistência dos dados
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Iniciar carregamento após chamar a gaiola
      await iniciarCarregamento(vagaId!, gaiolaFormatted);
      
      // 3. Atualizar status do motorista
      await setDriverStatus(gaiolaFormatted, "entrar_hub", vagaId!);
      
      // Atualizar status na planilha se função existir
      // if (typeof updateGaiolaStatus === 'function') {
      //   updateGaiolaStatus(gaiolaFormatted, 'chamado', vagaId);
      // }
      
      // Adicionar alerta de sucesso
      addAlert(`Gaiola ${gaiolaFormatted} foi chamada`, 'success');
      
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
  }, [gaiola, vagaId, vagaData, getDriverByGaiola, chamarGaiola, iniciarCarregamento, setDriverStatus, addAlert, toast, clearPreviousGaiolaAlerts]);
  
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
  
  // Marcar motorista como atrasado - ENVIAR SOLICITAÇÃO PARA ADMIN
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
      console.log(`VagaPanel ${vagaId}: Enviando solicitação de atraso para Admin - gaiola ${vagaData.gaiola}`);
      
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
      
      // Configurar localStorage para que o admin toque som de alerta
      localStorage.setItem(`admin_play_alert_sound`, 'true|' + new Date().getTime());
      
      // Reproduzir som de alerta local
      try {
        const audio = new Audio('/notification-sound.mp3');
        audio.volume = 0.8;
        audio.play().catch(e => console.log("Erro ao reproduzir som:", e));
      } catch (error) {
        console.log("Som de notificação não disponível");
      }
      
      toast({
        title: "📢 Solicitação Enviada",
        description: `Solicitação de atraso da gaiola ${vagaData.gaiola} foi enviada ao Admin`,
        variant: "default",
      });
      
      // Garantir que o admin receba o alerta
      for (let i = 1; i <= 2; i++) {
        setTimeout(() => {
          localStorage.setItem(`admin_play_alert_sound`, 'true|' + new Date().getTime());
        }, i * 3000); // 3, 6 segundos depois
      }
      
    } catch (error) {
      console.error("Erro ao enviar solicitação de atraso:", error);
      addAlert("Erro ao enviar solicitação de atraso", 'error');
    }
  }, [vagaData.gaiola, vagaData.status, vagaId, addAlert, toast, getDriverByGaiola]);
  
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

  // Obter tempo desde chamado e memoizar para uso na interface
  const getElapsedTime = useCallback((): string | null => {
    if ((vagaData.status !== "chamado" && vagaData.status !== "carregando") || !vagaData.chamadoEm) return null;
    return calculateElapsedTime(vagaData.chamadoEm);
  }, [vagaData.status, vagaData.chamadoEm, calculateElapsedTime]);
  
  // Memoizar o valor calculado por getElapsedTime para reuso em toda a interface
  const elapsedTime = useMemo(() => getElapsedTime(), [getElapsedTime]);

  // Obter tipo de veículo da gaiola atual - VERSÃO APRIMORADA
  const getCurrentVehicleType = useCallback((): string | null => {
    if (!vagaData.gaiola || !driversData) {
      console.log('🚫 getCurrentVehicleType: Dados ausentes', { gaiola: vagaData.gaiola, hasDriversData: !!driversData });
      return null;
    }
    
    const gaiolaNormalizada = vagaData.gaiola.trim().toUpperCase();
    console.log(`🔎 Buscando tipo de veículo para gaiola normalizada: "${gaiolaNormalizada}"`);
    
    // Primeiro, tenta buscar pelo objeto driversData
    let driverData: DriverData | undefined = undefined;
    
    // Buscar com case-insensitive para maior segurança
    Object.values(driversData).forEach(driver => {
      if (driver.gaiola && driver.gaiola.toUpperCase() === gaiolaNormalizada) {
        driverData = driver;
        console.log(`✅ Driver encontrado para gaiola ${gaiolaNormalizada}:`, driver);
      }
    });
    
    // Se não encontrou no objeto, tentar buscar de todas as fontes possíveis
    if (!driverData) {
      // Tentar buscar diretamente do localStorage
      try {
        const driversArr = JSON.parse(localStorage.getItem('drivers_data') || '[]');
        const foundDriver = driversArr.find((d: any) => d.gaiola && d.gaiola.toUpperCase() === gaiolaNormalizada);
        if (foundDriver) {
          driverData = foundDriver;
          console.log(`✅ Driver encontrado no localStorage para gaiola ${gaiolaNormalizada}:`, foundDriver);
        }
      } catch (e) {
        console.error('Erro ao buscar drivers_data do localStorage:', e);
      }
    }
    
    // Verificar explicitamente o campo tipoVeiculo
    // Use a função utilitária para formatar de maneira consistente
    const tipoVeiculoFound = formatarTipoVeiculo(driverData?.tipoVeiculo);
    
    console.log('🔍 getCurrentVehicleType - resultado:', { 
      gaiola: vagaData.gaiola, 
      gaiolaNormalizada,
      driverFound: !!driverData,
      driverData, 
      tipoVeiculo: tipoVeiculoFound,
      tipoVeiculoType: typeof driverData?.tipoVeiculo
    });
    
    return tipoVeiculoFound;
  }, [vagaData.gaiola, driversData]);

  const currentVehicleType = useMemo(() => getCurrentVehicleType(), [getCurrentVehicleType]);

  // Debug: Vamos ver todos os dados dos motoristas
  useEffect(() => {
    console.log('🔍 TOTAL driversData:', driversData);
    console.log('🔍 Gaiola atual:', vagaData.gaiola);
    if (driversData && vagaData.gaiola) {
      // Buscar motorista pela gaiola
      const driverData = Object.values(driversData).find(driver => driver.gaiola === vagaData.gaiola);
      console.log('🔍 Driver da gaiola atual:', driverData);
      console.log('🔍 tipoVeiculo da gaiola atual:', driverData?.tipoVeiculo);
      console.log('🔍 Todas as propriedades do driver:', Object.keys(driverData || {}));
    }
  }, [driversData, vagaData.gaiola]);

  // Organizar gaiolas por letra - MEMOIZADO
  const gaiolasPorLetra = useMemo(() => {
    const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const organized: Record<string, any[]> = {};
    
    console.log('🔍 driversData para organizar:', driversData);
    
    letras.forEach(letra => {
      organized[letra] = Object.values(driversData || {})
        .filter((g: any) => g?.gaiola?.startsWith(letra))
        .filter((g: any) => !searchTerm || g.gaiola.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a: any, b: any) => {
          const getNumFromGaiola = (gaiola: string) => {
            const match = gaiola.match(/\d+/);
            return match ? parseInt(match[0]) : 0;
          };
          return getNumFromGaiola(a.gaiola) - getNumFromGaiola(b.gaiola);
        });
    });
    
    console.log('📊 Gaiolas organizadas:', organized);
    return organized;
  }, [driversData, searchTerm]);
  
  // Estatísticas dos motoristas - MEMOIZADO
  const driverStats = useMemo(() => {
    const allDrivers = Object.values(driversData || {});
    return {
      total: allDrivers.length,
      chegaram: allDrivers.filter((g: any) => g?.status === 'chegou').length,
      comVaga: allDrivers.filter((g: any) => g?.vaga).length,
      esperandoVaga: allDrivers.filter((g: any) => g?.status === 'chegou' && !g?.vaga).length
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
                {(vagaData.status === "chamado" || vagaData.status === "carregando") && elapsedTime && (
                  <div className="flex flex-col items-center gap-1">
                    <Badge className="bg-amber-500 text-slate-900 px-4 py-2 text-lg font-bold">
                      <Clock className="h-5 w-5 mr-2" />
                      {elapsedTime}
                    </Badge>
                    {/* Sempre mostrar o tipo de veículo (ou "Tipo não informado") */}
                    <Badge className={`px-2 py-1 text-sm ${currentVehicleType ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {currentVehicleType || "Tipo não informado"}
                    </Badge>
                  </div>
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
                    {(vagaData.status === "chamado" || vagaData.status === "carregando") && elapsedTime && (
                      <div className="inline-flex items-center bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-bold mt-2">
                        <Clock className="h-4 w-4 mr-2" />
                        {elapsedTime}
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
                        <div>Chamado às: {new Date(vagaData.chamadoEm).toLocaleTimeString('pt-BR')}</div>
                        {(vagaData.status === "chamado" || vagaData.status === "carregando") && elapsedTime && (
                          <div className="mt-1 font-semibold text-sm text-amber-600">
                            <Clock className="inline-block h-3 w-3 mr-1" />
                            Em espera: {elapsedTime}
                          </div>
                        )}
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
                disabled={isLoading || !vagaData.gaiola || (vagaData.status !== "chamado" && vagaData.status !== "carregando")}
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
                              {/* Sempre mostrar tipo de veículo */}
                              <div className={`text-xs px-1 rounded mt-1 ${
                                getTipoVeiculoClasses(g.tipoVeiculo)
                              }`}>
                                {formatarTipoVeiculo(g.tipoVeiculo) || "Tipo não informado"}
                              </div>
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
