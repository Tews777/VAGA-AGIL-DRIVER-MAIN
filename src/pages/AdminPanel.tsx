import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, RefreshCw, Settings, BarChart3, Users, Clock, AlertTriangle, User, Truck, X, Upload, ArrowLeft, FileSpreadsheet, BarChart2, ChevronDown, RotateCcw, Bell, BellRing } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatarTipoVeiculo, getTipoVeiculoClasses } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useVagaData, type VagaData } from "@/hooks/useVagaData";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { useDriverData, type DriverData } from "@/hooks/useDriverData";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { useOptimizedOperation } from "@/hooks/useOptimizedOperation";
import { DataImport } from "@/components/DataImport";
import { logger } from "@/utils/logger";
import VagaCard from "@/components/VagaCard";
import DelayedDriverItem from "@/components/DelayedDriverItem";
import { triggerManualSync } from "@/utils/mockData";
import { ImportPlanilha } from "@/components/ImportPlanilha";
import { DriverPlanilha } from "@/utils/uploadPlanilha";
import { setupNotificationListener, notifyDelayedDriverCalled, notifyDriverWontEnter, notifyDriverDelay } from "@/utils/notificationSystem";

// Constantes para armazenamento
const CONSTANTS = {
  STORAGE_KEYS: {
    DRIVERS_DATA: 'drivers_data',
    DRIVERS_DATA_OBJ: 'drivers_data_obj',
    DRIVERS_PANEL_DATA: 'drivers_panel_data',
    FORCE_UPDATE: '_forceDriverUpdate',
    LAST_UPDATE_CHECK: '_lastDriverUpdateCheck'
  }
};

// Componente para histórico de vagas - Otimizado
const HistoricoVagas = memo(({ vagasData }: { vagasData: Record<string, VagaData> }) => {
  const [expandedVaga, setExpandedVaga] = useState<string | null>(null);

  // Calcular estatísticas para cada vaga - Otimizado com useMemo
  const vagasStats = useMemo(() => {
    return Object.entries(vagasData).map(([vagaId, vaga]) => {
      const gaiolas = vaga.history.filter(h => h.action === 'gaiola_set').length;
      const chamados = vaga.history.filter(h => h.action === 'chamado').length;
      const finalizados = vaga.history.filter(h => h.action === 'finalizado').length;
      
      // Calcular tempos entre chamadas
      const chamadaEvents = vaga.history
        .filter(h => h.action === 'chamado')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      const temposEntreChamadas = [];
      for (let i = 1; i < chamadaEvents.length; i++) {
        const tempoAnterior = new Date(chamadaEvents[i-1].timestamp).getTime();
        const tempoAtual = new Date(chamadaEvents[i].timestamp).getTime();
        const diferenca = (tempoAtual - tempoAnterior) / (1000 * 60); // em minutos
        temposEntreChamadas.push(diferenca);
      }
      
      const tempoMedio = temposEntreChamadas.length > 0 
        ? temposEntreChamadas.reduce((a, b) => a + b, 0) / temposEntreChamadas.length
        : 0;

      return {
        vagaId,
        gaiolas,
        chamados,
        finalizados,
        tempoMedio,
        ultimaAtividade: vaga.history.length > 0 
          ? new Date(vaga.history[vaga.history.length - 1].timestamp)
          : null,
        detalhes: vaga.history
          .filter(h => h.action === 'gaiola_set')
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10) // Últimas 10 gaiolas
      };
    }).sort((a, b) => b.gaiolas - a.gaiolas); // Ordenar por número de gaiolas
  }, [vagasData]);

  const formatTempo = (minutos: number) => {
    if (minutos < 60) return `${Math.round(minutos)}min`;
    const horas = Math.floor(minutos / 60);
    const mins = Math.round(minutos % 60);
    return `${horas}h ${mins}min`;
  };

  // Componente memoizado para estatísticas de vaga
  const VagaStatsCard = memo(({ stats, isExpanded, onToggle }: {
    stats: any;
    isExpanded: boolean;
    onToggle: () => void;
  }) => (
    <Card className="border">
      <CardHeader 
        className="cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg">VAGA {stats.vagaId.padStart(2, '0')}</CardTitle>
            <div className="flex gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Truck className="h-4 w-4" />
                {stats.gaiolas} gaiolas
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatTempo(stats.tempoMedio)} médio
              </span>
              <span className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                {stats.finalizados}/{stats.chamados} finalizados
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats.ultimaAtividade && (
              <span className="text-xs text-gray-500">
                Última: {stats.ultimaAtividade.toLocaleDateString()} {stats.ultimaAtividade.toLocaleTimeString()}
              </span>
            )}
            <ChevronDown 
              className={`h-4 w-4 transition-transform duration-150 ${
                isExpanded ? 'rotate-180' : ''
              }`} 
            />
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Últimas 10 Gaiolas Processadas</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {stats.detalhes.length > 0 ? (
                stats.detalhes.map((detalhe: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        Gaiola {detalhe.details.gaiola || 'N/A'}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {new Date(detalhe.timestamp).toLocaleDateString()} às {' '}
                        {new Date(detalhe.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      #{stats.detalhes.length - index}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-500">
                  Nenhuma gaiola processada ainda
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  ));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Histórico de Vagas</h2>
        <p className="text-gray-600">Estatísticas e histórico detalhado das operações por vaga</p>
      </div>
      
      <div className="space-y-4">
        {vagasStats.map((stats) => (
          <VagaStatsCard
            key={stats.vagaId}
            stats={stats}
            isExpanded={expandedVaga === stats.vagaId}
            onToggle={() => setExpandedVaga(expandedVaga === stats.vagaId ? null : stats.vagaId)}
          />
        ))}
        
        {vagasStats.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="text-center py-8">
              <Truck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Nenhum histórico de vagas disponível</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
});

// Componente Central de Notificações Customizado
const CustomNotificationCenter = memo(({ 
  alerts, 
  isOpen, 
  onClose, 
  onMarkDriverOnWay,
  onRemoveAlert 
}: { 
  alerts: any[], 
  isOpen: boolean, 
  onClose: () => void,
  onMarkDriverOnWay: (vagaId: string) => void,
  onRemoveAlert: (index: number) => void
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Bell className="w-5 h-5 mr-2" />
            Central de Notificações ({alerts.length})
          </DialogTitle>
          <DialogDescription>
            Todas as notificações e alertas do sistema
          </DialogDescription>
        </DialogHeader>
        
        <div className="overflow-y-auto max-h-96">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Nenhuma notificação ativa</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-4 border">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-3">
                      {alert.type === "motorista_atrasou" ? (
                        <User className="h-5 w-5 mt-1 text-amber-600" />
                      ) : alert.type === "analista_chamado" ? (
                        <AlertTriangle className="h-5 w-5 mt-1 text-red-600" />
                      ) : (
                        <Clock className="h-5 w-5 mt-1 text-blue-600" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          Vaga {alert.vagaId}: {alert.message}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : ""}
                        </div>
                        {alert.gaiola && (
                          <Badge variant="outline" className="mt-2">
                            Gaiola {alert.gaiola}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {alert.type === "motorista_atrasou" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onMarkDriverOnWay(alert.vagaId)}
                          className="text-green-600 mobile-button"
                        >
                          Motorista A Caminho
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveAlert(idx)}
                        className="h-8 w-8 p-0 text-gray-400 mobile-button"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

const AdminPanel = () => {
  const navigate = useNavigate();
  const [vagasToShow, setVagasToShow] = useState(17);
  const [refreshKey, setRefreshKey] = useState(0);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [driversOnWay, setDriversOnWay] = useState<Record<string, boolean>>({});
  const [delayRequests, setDelayRequests] = useState<any[]>([]);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  
  // Configurar logout por inatividade após 45 minutos
  useInactivityTimeout(45);
  const { toast } = useToast();
  
  // Hook de operação otimizada para lidar com as notificações
  const { execute: executeDataRefresh } = useOptimizedOperation(async () => {
    await Promise.all([
      loadAllVagasData(),
      loadAlerts()
    ]);
    return true;
  }, 300);

  // Hook para dados das vagas
  const { 
    vagasData, 
    loadAllVagasData, 
    toggleCheck, 
    setGaiola,
    chamarGaiola,
    iniciarCarregamento, 
    finalizarCarregamento,
    resetVaga
  } = useVagaData();
  
  // Hook para sincronização em tempo real com planilha
  const { 
    gaiolasData, 
    isLoading: isSyncing, 
    error: syncError,
    syncWithSheet 
  } = useRealtimeData();
  
  // Hook para dados dos motoristas/gaiolas
  const { 
    driversData, 
    getDriversStats, 
    markDriverDelayed, 
    toggleDriverCheck, 
    setDriverStatus,
    getDriversByStatus,
    getDriverByGaiola,
    syncDriverNames,
    loadAllDriversData
  } = useDriverData();

  // Funções auxiliares - devem estar antes dos hooks que as utilizam
  const loadAlerts = () => {
    const allAlerts: any[] = [];
    Object.keys(vagasData).forEach(vagaId => {
      // 1. Carregar alertas específicos do admin
      const adminAlerts = JSON.parse(localStorage.getItem(`admin_vaga_${vagaId}_alerts`) || '[]');
      adminAlerts.forEach((alert: any) => {
        allAlerts.push({
          ...alert,
          vagaId,
          source: 'admin'
        });
      });
      
      // 2. Carregar alertas das vagas que podem não ter sido sincronizados
      const vagaAlerts = JSON.parse(localStorage.getItem(`vaga_${vagaId}_alerts`) || '[]');
      vagaAlerts.forEach((alert: any) => {
        // Verificar se já existe um alerta similar do admin
        const existsInAdmin = adminAlerts.some((adminAlert: any) => 
          adminAlert.id === `admin_${alert.id}` || 
          (adminAlert.message === alert.message && Math.abs(new Date(adminAlert.timestamp).getTime() - new Date(alert.timestamp).getTime()) < 1000)
        );
        
        if (!existsInAdmin) {
          // Adicionar alerta da vaga com prefixo para identificar
          allAlerts.push({
            ...alert,
            id: `from_vaga_${alert.id}`,
            vagaId,
            source: 'vaga'
          });
        }
      });
    });
    
    // Ordenar por timestamp (mais recente primeiro)
    allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    setAlerts(allAlerts);
  };

  const loadDriversOnWay = () => {
    const driversData = JSON.parse(localStorage.getItem('drivers_on_way') || '{}');
    setDriversOnWay(driversData);
  };

  // Função para carregar solicitações de atraso
  const loadDelayRequests = () => {
    try {
      const requests = JSON.parse(localStorage.getItem('admin_delay_requests') || '[]');
      setDelayRequests(requests);
    } catch (error) {
      console.error('Erro ao carregar solicitações de atraso:', error);
      setDelayRequests([]);
    }
  };

  // Função para responder a uma solicitação de atraso
  const respondToDelayRequest = (requestId: string, response: 'bipar_gaiola' | 'motorista_a_caminho') => {
    logger.log(`Admin: Respondendo solicitação ${requestId} com ${response}`);
    
    try {
      // Encontrar a solicitação
      const requests = JSON.parse(localStorage.getItem('admin_delay_requests') || '[]');
      const requestIndex = requests.findIndex((req: any) => req.id === requestId);
      
      if (requestIndex === -1) {
        console.error(`Admin: Solicitação ${requestId} não encontrada`);
        toast({
          title: "Erro",
          description: "Solicitação não encontrada",
          variant: "destructive"
        });
        return;
      }
      
      const request = requests[requestIndex];
      const timestamp = new Date().toISOString();
      
      console.log(`Admin: Encontrada solicitação:`, request);
      console.log(`Admin: Enviando resposta para vaga ${request.vagaId}`);
      
      // Atualizar a solicitação como respondida
      requests[requestIndex] = {
        ...request,
        status: 'responded',
        response: response,
        responseTimestamp: timestamp
      };
      
      // Salvar solicitações atualizadas
      localStorage.setItem('admin_delay_requests', JSON.stringify(requests));
      
      // Criar evento com dados detalhados
      const eventDetail = {
        requestId: requestId,
        vagaId: request.vagaId,
        gaiola: request.gaiola,
        motorista: request.motorista,
        response: response,
        timestamp: timestamp
      };
      
      console.log(`Admin: Disparando evento 'admin_driver_delay_response' com:`, eventDetail);
      
      // Enviar evento para a vaga específica
      window.dispatchEvent(new CustomEvent('admin_driver_delay_response', {
        detail: eventDetail
      }));
      
      // Confirmar que o evento foi disparado
      console.log(`Admin: Evento disparado com sucesso para vaga ${request.vagaId}`);
      
      // Salvar uma flag adicional para a vaga específica
      localStorage.setItem(`vaga_${request.vagaId}_admin_response`, JSON.stringify({
        response: response,
        timestamp: timestamp,
        gaiola: request.gaiola,
        motorista: request.motorista
      }));
      
      // Feedback visual
      const responseText = response === 'bipar_gaiola' ? 'Bipar Gaiola' : 'Motorista a Caminho';
      toast({
        title: "✅ Resposta Enviada",
        description: `Instrução "${responseText}" enviada para a ${request.vagaNumero}`,
        variant: "default"
      });
      
      // Atualizar o estado local
      loadDelayRequests();
      
    } catch (error) {
      console.error('Erro ao responder solicitação:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar resposta",
        variant: "destructive"
      });
    }
  };

  // Função para sincronizar alertas das vagas para o admin (mantendo-os separados)
  const syncAlertsFromVagasToAdmin = () => {
    logger.log('🔄 Sincronizando alertas das vagas para o AdminPanel...');
    
    Object.keys(vagasData).forEach(vagaId => {
      // Buscar os alertas da vaga
      const vagaAlerts = JSON.parse(localStorage.getItem(`vaga_${vagaId}_alerts`) || '[]');
      
      if (vagaAlerts.length > 0) {
        console.log(`📋 Vaga ${vagaId}: encontrados ${vagaAlerts.length} alertas`);
        
        // Obter alertas atuais do admin para esta vaga
        const adminAlerts = JSON.parse(localStorage.getItem(`admin_vaga_${vagaId}_alerts`) || '[]');
        
        // Para cada alerta na vaga, verificar se já existe no admin
        vagaAlerts.forEach((vagaAlert: any) => {
          // Buscar por ID ou mensagem similar
          const existingAlert = adminAlerts.find((a: any) => 
            a.id === `admin_${vagaAlert.id}` || 
            (a.message === vagaAlert.message && Math.abs(new Date(a.timestamp).getTime() - new Date(vagaAlert.timestamp).getTime()) < 5000)
          );
          
          if (!existingAlert) {
            // Criar cópia do alerta para o admin
            const adminAlert = {
              ...vagaAlert,
              id: `admin_${vagaAlert.id}`,
              source: 'synced_from_vaga'
            };
            
            adminAlerts.push(adminAlert);
            console.log(`➕ Adicionado alerta para vaga ${vagaId}: ${vagaAlert.message}`);
          }
        });
        
        // Salvar os alertas atualizados do admin
        localStorage.setItem(`admin_vaga_${vagaId}_alerts`, JSON.stringify(adminAlerts));
      }
    });
    
    // Atualizar a interface após sincronização
    setTimeout(() => {
      loadAlerts();
    }, 100);
    
    return Promise.resolve();
  };

  const handlePlanoUpload = (drivers: DriverPlanilha[]) => {
    try {
      console.log("Dados recebidos da planilha:", drivers);
      const driversMap: Record<string, DriverData> = {};
      const driversArray: DriverData[] = []; // Array para salvar no formato compatível

      drivers.forEach((driver) => {
        if (!driver.Letra || !driver.Nome) {
          console.log("Pulando linha sem letra ou nome:", driver);
          return; // Pular linhas vazias
        }
        
        const letra = driver.Letra.trim();
        const nome = driver.Nome.trim();
        
        if (!letra || !nome) {
          console.log("Pulando linha só com espaços:", driver);
          return; // Pular linhas só com espaços
        }

        const now = new Date();
        const driverId = `${now.getTime()}-${Math.random().toString(36).substring(2)}`;
        
        // Processamento do tipo de veículo usando a função utilitária
        console.log(`✅ Processando tipo de veículo para ${letra}: "${driver.TipoVeiculo || 'não definido'}"`);
        
        // Usar a função utilitária para garantir consistência na formatação
        const tipoVeiculoProcessado = formatarTipoVeiculo(driver.TipoVeiculo) || undefined;
        
        console.log(`✅ Resultado do processamento: "${tipoVeiculoProcessado || 'INDEFINIDO'}"`);
        
        const driverData: DriverData = {
          id: driverId,
          gaiola: letra,
          motorista: nome,
          status: "esperar_fora_hub",
          driverCheck: false,
          lastUpdate: now.toISOString(),
          tipoVeiculo: tipoVeiculoProcessado
        };
        
        // Log detalhado para debug
        console.log(`🔍 Driver processado - Gaiola: ${letra}`);
        console.log(`🔍 TipoVeiculo original: ${driver.TipoVeiculo || 'não definido'}`);
        console.log(`🔍 tipoVeiculo final: ${driverData.tipoVeiculo || 'não definido'}`);
        console.log(`🔍 Driver da gaiola atual:`, driverData);
        console.log(`🔍 tipoVeiculo da gaiola atual: ${driverData.tipoVeiculo}`);
        console.log(`🔍 Todas as propriedades do driver:`, Object.keys(driverData));
        
        driversMap[driverId] = driverData; // Usar ID como chave, não a letra
        driversArray.push(driverData); // Adicionar ao array para formato compatível
        
        console.log(`Motorista adicionado: ${letra} - ${nome} (ID: ${driverId})`);
      });

      const driverCount = driversArray.length;
      console.log(`Total de motoristas processados: ${driverCount}`);
      
      if (driverCount === 0) {
        toast({
          title: "Aviso",
          description: "Nenhum motorista válido encontrado na planilha.",
          variant: "default"
        });
        return;
      }

      // Backup dos dados anteriores caso seja necessário reverter
      const previousData = localStorage.getItem('drivers_data');
      localStorage.setItem('drivers_data_backup', previousData || '[]');

      // Limpar quaisquer dados existentes de todas as fontes
      localStorage.removeItem('mockDriversData');
      
      // Atualizar com dados da planilha nos DOIS formatos necessários
      localStorage.setItem('drivers_data', JSON.stringify(driversArray)); // Formato array
      localStorage.setItem('drivers_data_obj', JSON.stringify(driversMap)); // Formato objeto
      localStorage.setItem('drivers_panel_data', JSON.stringify(driversArray)); // Compatibilidade
      
      // Forçar uma atualização do storage para garantir que outros componentes detectem a mudança
      localStorage.setItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE, Date.now().toString());
      
      // Atualizar nomes dos motoristas nas gaiolas já chamadas
      syncDriverNames();
      
      // Forçar atualização de dados
      loadAllVagasData();
      
      toast({
        title: "Sucesso!",
        description: `Planilha importada: ${driverCount} motoristas carregados.`,
      });
    } catch (error) {
      console.error("Erro ao processar planilha:", error);
      toast({
        title: "Erro ao importar planilha",
        description: `${error}`,
        variant: "destructive",
      });
    }
  };

  // Função para resetar todo o sistema
  const handleResetSystem = async () => {
    try {
      console.log("🔄 Iniciando reset completo do sistema...");
      
      // 1. Primeiro resetar explicitamente cada vaga usando o método correto
      console.log("🔄 Resetando cada vaga individualmente...");
      const vagasIds = Object.keys(vagasData);
      
      // Usar Promise.all para resetar todas as vagas em paralelo
      await Promise.all(
        vagasIds.map(async (vagaId) => {
          try {
            console.log(`🔄 Resetando vaga ${vagaId}...`);
            await resetVaga(vagaId, `admin_panel_reset_system`);
            console.log(`✅ Vaga ${vagaId} resetada com sucesso!`);
          } catch (e) {
            console.error(`❌ Erro ao resetar vaga ${vagaId}:`, e);
          }
        })
      );
      
      console.log("✅ Todas as vagas foram resetadas!");
      
      // 2. Depois limpar outros dados do localStorage (exceto dados fundamentais do sistema)
      console.log("🔄 Limpando dados temporários...");
      
      // Lista de chaves a preservar (se necessário)
      const keysToPreserve = [];
      
      // Limpar localStorage exceto as chaves a preservar
      Object.keys(localStorage).forEach(key => {
        if (!keysToPreserve.includes(key)) {
          localStorage.removeItem(key);
        }
      });
      
      toast({
        title: "Sistema Resetado!",
        description: "Todas as vagas foram resetadas. A página será recarregada em breve...",
      });
      
      console.log("✅ Reset completo concluído!");
      
      // Forçar refresh da página após um breve delay
      setTimeout(() => {
        window.location.reload();
      }, 1500); // Aumentado para dar tempo de concluir todas as operações
      
    } catch (error) {
      console.error("❌ Erro ao resetar sistema:", error);
      toast({
        title: "Erro ao resetar sistema",
        description: `${error}`,
        variant: "destructive",
      });
    }
  };

  // Função para carregar dados iniciais
  const loadInitialData = () => {
    try {
      Promise.all([
        loadAllVagasData(), 
        loadDriversOnWay(),
        loadAlerts(),
        loadDelayRequests(),
        executeDataRefresh(),
        syncAlertsFromVagasToAdmin() // Sincronizar alertas das vagas para o admin
      ]).catch(err => console.error("Erro ao carregar dados iniciais:", err));
    } catch (error) {
      console.error("Erro ao inicializar dados:", error);
    }
  };

  // Listener para motorista atrasado (quando marcado manualmente ou através de um alerta)
  const handleDriverDelayed = (event: CustomEvent) => {
    if (event.detail) {
      const { vagaId, gaiola, source } = event.detail;
      console.log(`Admin: evento driver_delayed recebido para vaga ${vagaId}, gaiola ${gaiola}, fonte: ${source}`);
      
      // Marcar o motorista como atrasado em todos os casos
      console.log(`Admin: Marcando motorista da gaiola ${gaiola} como atrasado`);
      localStorage.setItem(`vaga_${vagaId}_manually_delayed`, 'true');
      localStorage.removeItem(`vaga_${vagaId}_delayed_responded`);
      
      // Sempre atualizar o status do motorista para atrasado
      markDriverDelayed(gaiola);
      setDriverStatus(gaiola, "atrasado", vagaId);
      
      // Adicionar alerta específico do admin (independente do alerta da vaga)
      const adminAlerts = JSON.parse(localStorage.getItem(`admin_vaga_${vagaId}_alerts`) || '[]');
      const newAlert = {
        id: `admin_${Date.now().toString()}`,
        type: 'motorista_atrasou',
        message: `Motorista da gaiola ${gaiola} está atrasado`,
        timestamp: new Date().toISOString(),
        gaiola
      };
      
      // Verificar se já existe um alerta deste tipo
      const existingAlertIndex = adminAlerts.findIndex((a: any) => a.type === 'motorista_atrasou');
      if (existingAlertIndex >= 0) {
        // Substituir o alerta existente
        adminAlerts[existingAlertIndex] = newAlert;
      } else {
        // Adicionar novo alerta
        adminAlerts.push(newAlert);
      }
      
      localStorage.setItem(`admin_vaga_${vagaId}_alerts`, JSON.stringify(adminAlerts));
      loadAlerts(); // Recarregar alertas na interface
      
      // Forçar atualização da lista de motoristas
      localStorage.setItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE, Date.now().toString());
    }
    
    // Atualizar imediatamente as listas
    loadAllVagasData();
    loadAlerts();
  };
  
  // Listener para atualizações de status de motorista
  const handleDriverStatusUpdate = (event: CustomEvent) => {
    const { gaiola, status } = event.detail;
    console.log(`Evento driver_status_update recebido: Gaiola ${gaiola} -> ${status}`);
    
    // Se o status for atrasado, atualizar imediatamente os dados
    if (status === 'atrasado') {
      // Forçar atualização de motorista como atrasado
      const driver = getDriverByGaiola(gaiola);
      if (driver && driver.status !== 'atrasado') {
        console.log(`Atualizando motorista ${gaiola} para atrasado via evento`);
        markDriverDelayed(gaiola);
      }
      
      // Forçar atualização dos dados
      localStorage.setItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE, Date.now().toString());
      loadAllVagasData();
      loadAlerts();
      setRefreshKey(prev => prev + 1);
    }
  };
  
  // Handler para limpar alertas do admin quando novos eventos forem disparados
  const handleAdminAlertsChanged = (event: CustomEvent) => {
    console.log('AdminPanel: Evento admin_alerts_changed recebido', event.detail);
    
    if (event.detail && event.detail.action === 'cleared') {
      console.log(`AdminPanel: Alertas limpos para vaga ${event.detail.vagaId}`);
    }
    
    // Sempre recarregar alertas quando houver mudanças
    loadAlerts();
  };
    
  // Listener para notificações de atraso
  const handleDriverDelayNotification = (event: CustomEvent) => {
    console.log('Notificação de atraso de motorista recebida');
    
    // Receber os detalhes do evento
    const { vagaId, gaiola, notification, timestamp } = event.detail || {};
    
    // Verificar se os dados são válidos
    if (vagaId && gaiola) {
      // Criar um alerta específico para o admin
      const adminAlerts = JSON.parse(localStorage.getItem(`admin_vaga_${vagaId}_alerts`) || '[]');
      
      // Verificar se já existe um alerta deste tipo
      const existingAlertIndex = adminAlerts.findIndex((a: any) => a.type === 'motorista_atrasou');
      
      // Criar o novo alerta para o admin
      const newAlert = {
        id: `admin_${Date.now().toString()}`,
        type: 'motorista_atrasou',
        message: `Motorista da gaiola ${gaiola} está atrasado`,
        timestamp: timestamp || new Date().toISOString(),
        gaiola
      };
      
      if (existingAlertIndex >= 0) {
        // Substituir o alerta existente
        adminAlerts[existingAlertIndex] = newAlert;
      } else {
        // Adicionar novo alerta
        adminAlerts.push(newAlert);
      }
      
      // Salvar os alertas do admin
      localStorage.setItem(`admin_vaga_${vagaId}_alerts`, JSON.stringify(adminAlerts));
      
      // Também atualizar o status do motorista para "atrasado"
      const driver = getDriverByGaiola(gaiola);
      if (driver) {
        console.log(`Atualizando status do motorista da gaiola ${gaiola} para "atrasado" por notificação`);
        markDriverDelayed(gaiola);
        setDriverStatus(gaiola, "atrasado", vagaId);
      } else {
        console.log(`Motorista da gaiola ${gaiola} não encontrado`);
      }
      
      // Forçar atualização da lista de motoristas
      localStorage.setItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE, Date.now().toString());
    }
    
    // Carregar alertas após modificação
    loadAlerts();
  };

  // Função para lidar com novas solicitações de atraso
  const handleNewDelayRequest = (event: CustomEvent) => {
    console.log('Admin: Nova solicitação de atraso recebida:', event.detail);
    
    // Recarregar solicitações para mostrar a nova
    loadDelayRequests();
    
    // Tocar som de alerta
    try {
      const audio = new Audio('/notification-sound.mp3');
      audio.volume = 1.0;
      audio.play().catch(e => console.log("Erro ao reproduzir som:", e));
    } catch (error) {
      console.log("Som de notificação não disponível");
    }
    
    // Mostrar toast
    toast({
      title: "🚨 Nova Solicitação",
      description: `Solicitação de atraso recebida da ${event.detail.vagaNumero}`,
      variant: "destructive"
    });
  };

  // Handler para eventos de chamada de gaiola vinda do VagaPanel
  const handleVagaUpdate = useCallback((event: CustomEvent) => {
    const { vagaId, gaiola, status } = event.detail;
    
    if (status === 'chamado' && gaiola) {
      console.log(`AdminPanel: Gaiola ${gaiola} foi chamada na vaga ${vagaId}`);
      
      // Adicionar alerta no AdminPanel
      const newAlert = {
        id: Date.now().toString(),
        message: `🎯 Gaiola ${gaiola} foi chamada na Vaga ${vagaId}`,
        type: 'success' as const,
        timestamp: new Date(),
        vagaId: vagaId
      };
      
      // setAdminAlerts(prev => [newAlert, ...prev].slice(0, 50)); // Limitar a 50 alertas
      
      // Recarregar dados para atualizar a interface
      executeDataRefresh();
    }
  }, [executeDataRefresh]);

  // Handler para limpeza de alertas
  const handleAlertsCleared = useCallback((event: CustomEvent) => {
    const { vagaId, gaiola, source } = event.detail;
    console.log(`🧹 [ADMIN] Alertas limpos para vaga ${vagaId}, gaiola ${gaiola}, source: ${source}`);
    
    // LIMPAR ALERTAS ADMIN DA VAGA ESPECÍFICA
    if (vagaId) {
      const adminAlertsKey = `admin_vaga_${vagaId}_alerts`;
      console.log(`🧹 [ADMIN] Limpando alertas admin para vaga ${vagaId}`);
      localStorage.removeItem(adminAlertsKey);
    }
    
    // Recarregar alertas especificamente
    loadAlerts();
    
    // Forçar atualização completa dos dados
    executeDataRefresh();
  }, [executeDataRefresh, loadAlerts]);

  // Efeito para iniciar a captura de notificações, atualizar dados e configurar listeners
  useEffect(() => {
    // Carregar dados iniciais
    loadInitialData();
    
    // Configurar listener para notificações com operação otimizada
    const removeNotificationListener = setupNotificationListener((notification) => {
      // Usar o hook para gerenciar o debounce e evitar múltiplas chamadas
      executeDataRefresh();
    });
    
    // Registrar listeners para eventos de tempo real (compatibilidade)
    window.addEventListener('driver_delayed', handleDriverDelayed as EventListener);
    window.addEventListener('driver_status_update', handleDriverStatusUpdate as EventListener);
    window.addEventListener('driver_delay_notification', handleDriverDelayNotification as EventListener);
    window.addEventListener('admin_alerts_changed', handleAdminAlertsChanged as EventListener);
    window.addEventListener('admin_delay_request_received', handleNewDelayRequest as EventListener);
    window.addEventListener('VAGA_UPDATE', handleVagaUpdate as EventListener);
    window.addEventListener('ALERTS_CLEARED', handleAlertsCleared as EventListener);
    window.addEventListener('SLOT_ALERTS_CLEARED', handleAlertsCleared as EventListener); // 🚨 NOVO: listener de alertas por slot
    window.addEventListener('SLOT_ALERTS_CLEARED', handleAlertsCleared as EventListener); // 🚨 NOVO: escutar limpeza de alertas por slot
    
    // Listener para mudanças no localStorage (sincronização entre abas)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'last_vaga_update' && event.newValue) {
        console.log('AdminPanel: Detectada atualização de vaga em outra aba');
        executeDataRefresh();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Auto-refresh otimizado para a cada 15 segundos para melhor sincronização
    const dataInterval = setInterval(loadInitialData, 15000);
    
    // Verificar vagas com motoristas atrasados
    const checkDelayedDrivers = () => {
      // Iterar sobre todas as vagas e verificar se tem motoristas atrasados
      Object.entries(vagasData).forEach(([vagaId, vaga]) => {
        // Verificar se a vaga tem um motorista atrasado que precisa ser marcado
        if (vaga.status === "chamado" && vaga.gaiola && vaga.chamadoEm) {
          const isDelayedDriver = isDriverDelayed(vaga.chamadoEm, vagaId);
          if (isDelayedDriver) {
            console.log(`Verificação: Motorista com gaiola ${vaga.gaiola} está atrasado na vaga ${vagaId}`);
            
            // Marcar o motorista como atrasado no sistema
            const driver = getDriverByGaiola(vaga.gaiola);
            if (driver && driver.status !== "atrasado") {
              console.log(`Atualizando status do motorista ${vaga.gaiola} para atrasado`);
              
              // Chamar diretamente o hook para garantir atualização
              markDriverDelayed(vaga.gaiola);
              setDriverStatus(vaga.gaiola, "atrasado", vagaId);
              
              // Forçar atualização da lista de motoristas
              localStorage.setItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE, Date.now().toString());
            }
          }
        }
      });
    };
    
    // Verificar motoristas atrasados imediatamente e a cada 45 segundos (otimizado para sincronização)
    checkDelayedDrivers();
    const delayedCheckInterval = setInterval(checkDelayedDrivers, 45000);
    
    return () => {
      clearInterval(dataInterval);
      clearInterval(delayedCheckInterval);
      removeNotificationListener();
      
      // Remover todos os event listeners
      window.removeEventListener('driver_delayed', handleDriverDelayed as EventListener);
      window.removeEventListener('driver_status_update', handleDriverStatusUpdate as EventListener);
      window.removeEventListener('driver_delay_notification', handleDriverDelayNotification as EventListener);
      window.removeEventListener('admin_alerts_changed', handleAdminAlertsChanged as EventListener);
      window.removeEventListener('admin_delay_request_received', handleNewDelayRequest as EventListener);
      window.removeEventListener('VAGA_UPDATE', handleVagaUpdate as EventListener);
      window.removeEventListener('ALERTS_CLEARED', handleAlertsCleared as EventListener);
      window.removeEventListener('SLOT_ALERTS_CLEARED', handleAlertsCleared as EventListener); // 🚨 NOVO: cleanup do listener de alertas por slot
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [navigate, loadAllVagasData, loadAlerts, executeDataRefresh, vagasData, handleVagaUpdate, handleAlertsCleared]);

  const markDriverOnWay = (vagaId: string) => {
    const newDriversOnWay = { ...driversOnWay, [vagaId]: true };
    setDriversOnWay(newDriversOnWay);
    localStorage.setItem('drivers_on_way', JSON.stringify(newDriversOnWay));
    
    // Não remove mais o alerta automaticamente - apenas quando o usuário clicar no X
    // O alerta continuará visível até que o usuário o remova explicitamente
  };

  const removeAlertByIndex = (index: number) => {
    const newAlerts = alerts.filter((_, idx) => idx !== index);
    setAlerts(newAlerts);
  };

  const removeAlert = (vagaId: string, type: string) => {
    // Usar chave específica para alertas do admin
    const vagaAlerts = JSON.parse(localStorage.getItem(`admin_vaga_${vagaId}_alerts`) || '[]');
    const filteredAlerts = vagaAlerts.filter((alert: any) => alert.type !== type);
    localStorage.setItem(`admin_vaga_${vagaId}_alerts`, JSON.stringify(filteredAlerts));
    loadAlerts();
  };

  const handleLogout = () => {
    localStorage.removeItem("userType");
    navigate("/");
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    loadAllVagasData();
    // Forçar sincronização manual com planilha
    syncWithSheet();
  };

  const handleToggleCheck = (vagaId: string) => {
    toggleCheck(vagaId, `admin_panel_toggle`);
  };

  const handleStatusChange = (vagaId: string, newStatus: "carregando" | "finalizado" | "esperar") => {
    if (newStatus === "carregando") {
      iniciarCarregamento(vagaId, `admin_panel_loading`);
    } else if (newStatus === "finalizado") {
      finalizarCarregamento(vagaId, `admin_panel_finish`);
    } else {
      resetVaga(vagaId, `admin_panel_reset`);
    }
  };

  // Marcar gaiola como "atrasada" manualmente
  const handleMarkDelayed = (vagaId: string, gaiola: string) => {
    console.log(`🔴 MARCANDO MOTORISTA COMO ATRASADO - Gaiola: ${gaiola}, Vaga: ${vagaId}`);
    
    // Obter dados do motorista atual
    const driver = getDriverByGaiola(gaiola);
    if (!driver) {
      console.error(`Motorista com gaiola ${gaiola} não encontrado`);
      toast({
        title: "Erro",
        description: `Motorista com gaiola ${gaiola} não encontrado`
      });
      return;
    }
    
    console.log(`Motorista encontrado: ${driver.motorista} (ID: ${driver.id}), Status atual: ${driver.status}`);
    
    // ✅ MANTER COMPORTAMENTO ORIGINAL
    markDriverDelayed(gaiola, vagaId);
    setDriverStatus(gaiola, "atrasado", vagaId);
    
    // Notificar o sistema sobre o atraso (comportamento original)
    notifyDriverDelay(vagaId, gaiola, true);
    
    // Forçar atualização do estado e UI (comportamento original)
    localStorage.setItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE, Date.now().toString());
    setRefreshKey(prev => prev + 1);
    
    // Exibir confirmação
    toast({
      title: "Motorista marcado como atrasado",
      description: `O motorista da gaiola ${gaiola} foi marcado como atrasado`
    });
    
    // Recarregar dados após um curto intervalo para garantir que a mudança seja refletida
    setTimeout(() => {
      loadAllDriversData();
      loadAlerts();
    }, 500);
  };

  // Função para lidar com ações para motoristas atrasados
  const handleDriverDelayAction = (vagaId: string, gaiola: string, willEnter: boolean) => {
    // Não remove mais o alerta automaticamente - será removido apenas quando o usuário clicar no X
    // Os alertas permanecerão visíveis até que o usuário os remova explicitamente
    
    // Marcar que a pergunta sobre motorista atrasado já foi respondida
    localStorage.setItem(`vaga_${vagaId}_delayed_responded`, 'true');
    
    // ✅ Forçar atualização das vagas para refletir mudanças imediatamente (comportamento original)
    setTimeout(() => {
      loadAllVagasData();
    }, 100);
    
    if (willEnter) {
      // Se o motorista vai entrar no hub, notificar o sistema
      console.log(`Admin notificando que motorista da gaiola ${gaiola} foi autorizado a entrar no hub`);
      notifyDelayedDriverCalled(vagaId, gaiola);
      
      // Marcar que o motorista está a caminho do hub
      markDriverOnWay(vagaId);
      
      // Notificar que o motorista atrasado foi chamado para entrar no hub
      notifyDelayedDriverCalled(vagaId, gaiola);
    } else {
      // Se o motorista não vai entrar no hub
      console.log(`Admin notificando que motorista da gaiola ${gaiola} não vai entrar no hub`);
      notifyDriverWontEnter(vagaId, gaiola);
      
      // Opcional: Pode resetar a vaga se o motorista não vier
      // resetVaga(vagaId, `admin_panel_driver_wont_enter`);
    }
  };

  // Função para verificar se uma gaiola está atrasada com base em seu horário de chamada
  const isDriverDelayed = (chamadoEm: string, vagaId: string) => {
    // Verificar se este motorista foi marcado como atrasado manualmente
    if (localStorage.getItem(`vaga_${vagaId}_manually_delayed`) === 'true') {
      console.log(`Gaiola na vaga ${vagaId} foi marcada como atrasada manualmente`);
      
      // Obter a gaiola associada à vaga
      const vaga = vagasData[vagaId];
      if (vaga && vaga.gaiola) {
        // Verificar se o status do motorista já está como atrasado
        const driver = getDriverByGaiola(vaga.gaiola);
        if (driver) {
          console.log(`Motorista encontrado: ${driver.motorista} (${vaga.gaiola}) com status ${driver.status}`);
          
          // Se o motorista não estiver já marcado como atrasado, atualizá-lo
          if (driver.status !== 'atrasado') {
            console.log(`⚠️ Atualizando status do motorista da gaiola ${vaga.gaiola} para "atrasado" (verificação automática)`);
            
            // Usar o método direto para garantir que seja atualizado corretamente
            handleMarkDelayed(vagaId, vaga.gaiola);
          }
        } else {
          console.log(`⚠️ Motorista para gaiola ${vaga.gaiola} não encontrado, não é possível marcar como atrasado`);
        }
      }
      
      return true;
    }
    
    // Se há uma marcação explícita de que o motorista respondeu, não mostrar mais como atrasado
    if (localStorage.getItem(`vaga_${vagaId}_delayed_responded`) === 'true') {
      console.log(`Gaiola na vaga ${vagaId}: resposta já foi dada para o atraso`);
      return false;
    }

    // Caso contrário, fazer a checagem automática baseada no tempo
    const now = new Date().getTime();
    const chamadoTime = new Date(chamadoEm).getTime();
    const diffMinutes = (now - chamadoTime) / (1000 * 60);
    
    // Considerar atrasado se passar de 5 minutos desde a chamada
    const isDelayed = diffMinutes > 5;
    if (isDelayed) {
      console.log(`⚠️ Gaiola na vaga ${vagaId} está atrasada há ${Math.floor(diffMinutes)} minutos`);
      
      // Obter a gaiola associada à vaga
      const vaga = vagasData[vagaId];
      if (vaga && vaga.gaiola) {
        // Atualizar status do motorista para atrasado
        const driver = getDriverByGaiola(vaga.gaiola);
        if (driver) {
          if (driver.status !== 'atrasado') {
            console.log(`⚠️ Atualizando status do motorista da gaiola ${vaga.gaiola} para "atrasado" (atraso automático)`);
            
            // Usar o método direto para garantir que seja atualizado corretamente
            handleMarkDelayed(vagaId, vaga.gaiola);
          }
        } else {
          console.log(`⚠️ Motorista para gaiola ${vaga.gaiola} não encontrado, não é possível marcar como atrasado`);
        }
      }
    }
    
    return isDelayed;
  };

  // Função para resetar status do motorista
  const resetDriver = (gaiola: string) => {
    console.log(`🔄 RESETANDO MOTORISTA - Gaiola: ${gaiola}`);
    
    const driver = getDriverByGaiola(gaiola);
    if (!driver) {
      console.error(`Motorista com gaiola ${gaiola} não encontrado`);
      toast({
        title: "Erro",
        description: `Motorista com gaiola ${gaiola} não encontrado`
      });
      return;
    }

    // Resetar status para esperando fora do hub
    setDriverStatus(gaiola, "esperar_fora_hub");
    
    // Notificar o sistema
    notifyDriverDelay(null, gaiola, false);
    
    // Atualizar UI
    localStorage.setItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE, Date.now().toString());
    setRefreshKey(prev => prev + 1);

    toast({
      title: "Motorista Resetado",
      description: `Motorista da gaiola ${gaiola} resetado com sucesso`
    });
  };

  // Estados para inputs de vaga
  const [vagaInputs, setVagaInputs] = useState<Record<string, string>>({});
  const [editableNames, setEditableNames] = useState<Record<string, string>>({});

  // Função para alterar status do motorista via dropdown
  const handleDriverStatusChange = (gaiola: string, newStatus: string) => {
    console.log(`🔄 ALTERANDO STATUS MOTORISTA - Gaiola: ${gaiola}, Novo Status: ${newStatus}`);
    
    const driver = getDriverByGaiola(gaiola);
    if (!driver) {
      console.error(`Motorista com gaiola ${gaiola} não encontrado`);
      toast({
        title: "Erro",
        description: `Motorista com gaiola ${gaiola} não encontrado`
      });
      return;
    }

    // Tratar status especiais mapeando para os valores válidos
    switch (newStatus) {
      case "NOSHOW":
        // Salvar status especial NOSHOW no localStorage
        localStorage.setItem(`driver_${gaiola}_special_status`, 'noshow');
        console.log(`🚫 NOSHOW marcado para motorista ${gaiola}`);
        
        // Atualizar a vaga se o motorista estiver em alguma
        updateVagaStatusForDriver(gaiola, 'noshow');
        
        // Múltiplas flags para garantir comunicação entre páginas diferentes
        const timestamp = Date.now().toString();
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE, timestamp);
        localStorage.setItem('forceTableUpdate', timestamp);
        localStorage.setItem('_forceDriverUpdate', timestamp);
        localStorage.setItem('noshow_update_trigger', timestamp); // Flag específica para NOSHOW
        
        console.log(`📡 Flags de atualização enviadas para TablePanel: ${timestamp}`);
        setRefreshKey(prev => prev + 1);
        
        // Disparar evento personalizado para comunicação entre páginas
        window.dispatchEvent(new CustomEvent('driverStatusUpdated', {
          detail: { gaiola, status: 'noshow', timestamp }
        }));
        
        // Recarregar dados dos motoristas
        setTimeout(() => {
          loadAllDriversData();
        }, 100);
        
        toast({
          title: "Status Atualizado",
          description: `Motorista da gaiola ${gaiola} marcado como NOSHOW`
        });
        break;
        
      case "REVERTER_NOSHOW":
        console.log(`🔄 Iniciando reversão NOSHOW para gaiola ${gaiola}`);
        
        // Primeiro, salvar o nome editado se houver alteração
        const editedName = editableNames[gaiola];
        if (editedName && editedName.trim() !== "" && editedName.trim() !== driver?.motorista) {
          console.log(`📝 Salvando nome editado: ${editedName.trim()}`);
          updateDriverNameInAllVagas(gaiola, editedName.trim());
        }
        
        // Marcar como reversão de noshow
        localStorage.setItem(`driver_${gaiola}_special_status`, 'reverter_noshow');
        console.log(`🔄 REVERTER_NOSHOW marcado para motorista ${gaiola}`);
        
        // Atualizar a vaga se o motorista estiver em alguma
        updateVagaStatusForDriver(gaiola, 'reverter_noshow');
        
        // Múltiplos mecanismos para garantir atualização em ambos os painéis
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE, Date.now().toString());
        localStorage.setItem('forceTableUpdate', Date.now().toString()); 
        localStorage.setItem('reverter_noshow_update_trigger', Date.now().toString()); // Trigger específico para reversão
        
        // Disparar evento personalizado para comunicação entre componentes
        window.dispatchEvent(new CustomEvent('driverStatusUpdated', { 
          detail: { gaiola, status: 'reverter_noshow' }
        }));
        
        // Recarregar dados com delays para garantir sincronização
        setTimeout(() => {
          loadAllDriversData();
        }, 100);
        
        setTimeout(() => {
          loadAllDriversData();
        }, 300);
        
        // Limpar nome editável do estado local APÓS salvar
        setEditableNames(prev => {
          const newNames = { ...prev };
          delete newNames[gaiola];
          return newNames;
        });
        
        // Recarregar dados após pequeno delay adicional
        setTimeout(() => {
          loadAllDriversData();
        }, 100);
        
        toast({
          title: "Status Atualizado",
          description: `Motorista da gaiola ${gaiola} em reversão de NOSHOW`
        });
        break;
        
      case "CARREGAR":
        // Limpar status especial e marcar como carregando
        localStorage.removeItem(`driver_${gaiola}_special_status`);
        // Limpar status especial da vaga também
        clearVagaSpecialStatusForDriver(gaiola);
        setDriverStatus(gaiola, "chegou");
        toast({
          title: "Status Atualizado", 
          description: `Motorista da gaiola ${gaiola} está carregando`
        });
        break;
        
      case "ATRASOU":
        setDriverStatus(gaiola, "atrasado");
        toast({
          title: "Status Atualizado",
          description: `Motorista da gaiola ${gaiola} marcado como atrasado`
        });
        break;
        
      case "ESPERAR":
        localStorage.removeItem(`driver_${gaiola}_special_status`);
        setDriverStatus(gaiola, "esperar_fora_hub");
        toast({
          title: "Status Atualizado",
          description: `Motorista da gaiola ${gaiola} aguardando fora do hub`
        });
        break;
        
      case "NO_HUB":
        setDriverStatus(gaiola, "entrar_hub");
        toast({
          title: "Status Atualizado",
          description: `Motorista da gaiola ${gaiola} deve entrar no hub`
        });
        break;
        
      default:
        if (["esperar_fora_hub", "entrar_hub", "chegou", "atrasado"].includes(newStatus)) {
          setDriverStatus(gaiola, newStatus as "esperar_fora_hub" | "entrar_hub" | "chegou" | "atrasado");
        } else {
          setDriverStatus(gaiola, "esperar_fora_hub");
        }
        toast({
          title: "Status Atualizado",
          description: `Status do motorista da gaiola ${gaiola} atualizado`
        });
    }
    
    // Atualizar UI
    localStorage.setItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE, Date.now().toString());
    setRefreshKey(prev => prev + 1);
  };

  // Função para chamar motorista com vaga específica
  const handleChamarMotorista = async (gaiola: string, vaga: string) => {
    if (!vaga || vaga.trim() === '') {
      toast({
        title: "Erro",
        description: "Por favor, digite o número da vaga"
      });
      return;
    }

    const driver = getDriverByGaiola(gaiola);
    if (!driver) {
      toast({
        title: "Erro",
        description: `Motorista da gaiola ${gaiola} não encontrado`
      });
      return;
    }

    console.log(`🚛 Chamando motorista ${driver.motorista} (${gaiola}) para vaga ${vaga}`);

    try {
      // 1. Primeiro definir a gaiola na vaga usando o hook useVagaData
      console.log(`🔧 Configurando vaga ${vaga} com gaiola ${gaiola}`);
      await setGaiola(vaga, gaiola, "admin");
      
      // 2. Aguardar um pouco para garantir que foi salvo
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 3. Depois chamar a gaiola para mudar status para "chamado"
      console.log(`📞 Chamando gaiola ${gaiola} na vaga ${vaga}`);
      await chamarGaiola(vaga, gaiola);
      
      // 4. Aguardar um pouco antes de continuar
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`✅ Vaga ${vaga} configurada via useVagaData com gaiola ${gaiola}`);

      // 5. Remover status especial se existir
      localStorage.removeItem(`driver_${gaiola}_special_status`);
      clearVagaSpecialStatusForDriver(gaiola);
      
      // 6. Aguardar um pouco antes de atualizar status do motorista
      setTimeout(() => {
        setDriverStatus(gaiola, "entrar_hub", vaga);
        console.log(`✅ Status do motorista ${gaiola} atualizado para ENTRAR NO HUB`);
      }, 200);
      
      // 7. Limpar o input
      setVagaInputs(prev => ({ ...prev, [gaiola]: '' }));

      toast({
        title: "Motorista Chamado",
        description: `${driver.motorista} (${gaiola}) chamado para vaga ${vaga} - Status: ENTRAR NO HUB`
      });

      // 8. Atualizar UI e recarregar dados
      localStorage.setItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE, Date.now().toString());
      setRefreshKey(prev => prev + 1);
      
      // 9. Forçar recarregamento dos dados das vagas
      await loadAllVagasData();
      console.log(`✅ Dados das vagas recarregados após chamar motorista`);
      
    } catch (error) {
      console.error("Erro ao chamar motorista:", error);
      toast({
        title: "Erro",
        description: "Erro ao chamar motorista. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Função para obter status especial do motorista
  const getDriverSpecialStatus = (gaiola: string) => {
    return localStorage.getItem(`driver_${gaiola}_special_status`);
  };

  // Função para atualizar status da vaga quando motorista muda para status especial
  const updateVagaStatusForDriver = (gaiola: string, specialStatus: string) => {
    // Buscar em todas as vagas se há alguma com esta gaiola
    for (let i = 1; i <= 30; i++) {
      const vagaKey = `vaga${i.toString().padStart(2, '0')}`;
      const vagaDataStr = localStorage.getItem(vagaKey);
      
      if (vagaDataStr) {
        try {
          const vagaData = JSON.parse(vagaDataStr);
          if (vagaData.gaiola === gaiola) {
            // Atualizar a vaga com o status especial preservando outros dados
            const updatedVagaData = {
              ...vagaData,
              specialStatus: specialStatus // Adicionar campo especial
            };
            localStorage.setItem(vagaKey, JSON.stringify(updatedVagaData));
            console.log(`✅ Vaga ${vagaKey} atualizada com status especial: ${specialStatus}`);
            break;
          }
        } catch (error) {
          console.error(`Erro ao processar vaga ${vagaKey}:`, error);
        }
      }
    }
    
    // Se não encontrou nenhuma vaga, criar uma entrada temporária para o motorista aparecer na tabela
    const driversDataStr = localStorage.getItem('drivers_data');
    if (driversDataStr) {
      try {
        const driversData = JSON.parse(driversDataStr);
        const driver = driversData.find((d: any) => d.gaiola === gaiola);
        if (driver) {
          // Criar uma "vaga virtual" para o motorista aparecer na tabela
          const virtualVagaData = {
            gaiola: gaiola,
            motorista: driver.motorista,
            status: "esperar",
            check: false,
            specialStatus: specialStatus,
            isVirtual: true // Flag para identificar que é virtual
          };
          
          // Buscar vaga vazia ou sobrescrever uma vaga alta numerada
          let vagaToUse = null;
          for (let i = 25; i <= 30; i++) { // Começar pelas vagas altas
            const vagaKey = `vaga${i.toString().padStart(2, '0')}`;
            const existingVaga = localStorage.getItem(vagaKey);
            if (!existingVaga) {
              vagaToUse = vagaKey;
              break;
            } else {
              // Verificar se é uma vaga virtual anterior que pode ser sobrescrita
              try {
                const existing = JSON.parse(existingVaga);
                if (existing.isVirtual) {
                  vagaToUse = vagaKey;
                  break;
                }
              } catch (e) {}
            }
          }
          
          // Se não encontrou vaga vazia, usar a vaga 30 mesmo assim
          if (!vagaToUse) {
            vagaToUse = 'vaga30';
          }
          
          localStorage.setItem(vagaToUse, JSON.stringify(virtualVagaData));
          console.log(`✅ Vaga virtual ${vagaToUse} criada para ${gaiola} com status: ${specialStatus}`);
        }
      } catch (error) {
        console.error('Erro ao criar vaga virtual:', error);
      }
    }
  };

  // Função para limpar status especial da vaga
  const clearVagaSpecialStatusForDriver = (gaiola: string) => {
    // Buscar em todas as vagas se há alguma com esta gaiola
    for (let i = 1; i <= 30; i++) {
      const vagaKey = `vaga${i.toString().padStart(2, '0')}`;
      const vagaDataStr = localStorage.getItem(vagaKey);
      
      if (vagaDataStr) {
        try {
          const vagaData = JSON.parse(vagaDataStr);
          if (vagaData.gaiola === gaiola) {
            if (vagaData.specialStatus || vagaData.isVirtual) {
              if (vagaData.isVirtual) {
                // Se é uma vaga virtual, remover completamente
                localStorage.removeItem(vagaKey);
                console.log(`🗑️ Vaga virtual ${vagaKey} removida para ${gaiola}`);
              } else {
                // Se é uma vaga real, apenas remover o status especial
                const { specialStatus, ...updatedVagaData } = vagaData;
                localStorage.setItem(vagaKey, JSON.stringify(updatedVagaData));
                console.log(`✅ Status especial removido da vaga ${vagaKey} para ${gaiola}`);
              }
              break;
            }
          }
        } catch (error) {
          console.error(`Erro ao processar vaga ${vagaKey}:`, error);
        }
      }
    }
  };

  // Função para atualizar nome do motorista em todas as vagas
  const updateDriverNameInAllVagas = (gaiola: string, newName: string) => {
    console.log(`🔄 Atualizando nome do motorista ${gaiola} para: ${newName}`);
    
    // 1. Atualizar drivers_data primeiro
    const driversDataStr = localStorage.getItem('drivers_data');
    if (driversDataStr) {
      try {
        const driversData = JSON.parse(driversDataStr);
        const driverIndex = driversData.findIndex((d: any) => d.gaiola === gaiola);
        if (driverIndex !== -1) {
          driversData[driverIndex].motorista = newName;
          driversData[driverIndex].name = newName; // Para compatibilidade
          localStorage.setItem('drivers_data', JSON.stringify(driversData));
          console.log(`✅ Nome atualizado em drivers_data para gaiola ${gaiola}`);
        }
      } catch (error) {
        console.error("Erro ao atualizar drivers_data:", error);
      }
    }
    
    // 2. Atualizar drivers_data_obj também
    const driversDataObjStr = localStorage.getItem('drivers_data_obj');
    if (driversDataObjStr) {
      try {
        const driversDataObj = JSON.parse(driversDataObjStr);
        if (driversDataObj[gaiola]) {
          driversDataObj[gaiola].motorista = newName;
          driversDataObj[gaiola].name = newName; // Para compatibilidade
          localStorage.setItem('drivers_data_obj', JSON.stringify(driversDataObj));
          console.log(`✅ Nome atualizado em drivers_data_obj para gaiola ${gaiola}`);
        }
      } catch (error) {
        console.error("Erro ao atualizar drivers_data_obj:", error);
      }
    }
    
    // 3. Atualizar todas as vagas que contenham este motorista
    for (let i = 1; i <= 30; i++) {
      const vagaKey = `vaga${i.toString().padStart(2, '0')}`;
      const vagaDataStr = localStorage.getItem(vagaKey);
      
      if (vagaDataStr) {
        try {
          const vagaData = JSON.parse(vagaDataStr);
          if (vagaData.gaiola === gaiola) {
            const updatedVagaData = {
              ...vagaData,
              motorista: newName
            };
            localStorage.setItem(vagaKey, JSON.stringify(updatedVagaData));
            console.log(`✅ Nome atualizado na vaga ${vagaKey} para: ${newName}`);
          }
        } catch (error) {
          console.error(`Erro ao processar vaga ${vagaKey}:`, error);
        }
      }
    }
    
    // 3. Forçar atualização
    localStorage.setItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE, Date.now().toString());
  };

  // Função para obter o nome mais atualizado de um motorista
  const getUpdatedDriverName = (gaiola: string): string => {
    // 1. Primeiro, tentar buscar o nome editado temporariamente
    const editedName = editableNames[gaiola];
    if (editedName && editedName.trim() !== "") {
      return editedName.trim();
    }
    
    // 2. Buscar nos dados de motoristas carregados
    const driver = getDriverByGaiola(gaiola);
    if (driver?.motorista) {
      return driver.motorista;
    }
    
    // 3. Buscar direto no localStorage drivers_data
    try {
      const driversDataStr = localStorage.getItem('drivers_data');
      if (driversDataStr) {
        const driversData = JSON.parse(driversDataStr);
        const foundDriver = driversData.find((d: any) => d.gaiola === gaiola);
        if (foundDriver?.motorista) {
          return foundDriver.motorista;
        }
      }
    } catch (error) {
      console.error("Erro ao buscar nome atualizado:", error);
    }
    
    // 4. Fallback para o driver object se existir
    return driver?.motorista || `Motorista ${gaiola}`;
  };

  // Função para forçar atualização de motoristas atrasados
  const updateDelayedDrivers = () => {
    // Verificar todos os alertas de motoristas atrasados
    const delayedAlerts = alerts.filter(alert => alert.type === 'motorista_atrasou');
    
    if (delayedAlerts.length > 0) {
      console.log(`Encontrados ${delayedAlerts.length} alertas de motoristas atrasados para processar`);
      
      // Para cada alerta de atraso, garantir que o motorista esteja marcado como atrasado
      delayedAlerts.forEach(alert => {
        if (alert.gaiola) {
          const driver = getDriverByGaiola(alert.gaiola);
          if (driver) {
            // Verificar se o motorista já está marcado como atrasado
            if (driver.status !== "atrasado") {
              console.log(`Forçando status de atrasado para motorista ${alert.gaiola}`);
              markDriverDelayed(alert.gaiola);
              setDriverStatus(alert.gaiola, "atrasado", alert.vagaId);
            }
          } else {
            console.log(`Alerta para gaiola ${alert.gaiola} mas motorista não encontrado`);
          }
        }
      });
      
      // Forçar atualização da lista de motoristas
      localStorage.setItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE, Date.now().toString());
    }
  };

  // Calcular estatísticas e drivers de forma otimizada
  const { driverStats, drivers, driversNoshow, driversReverterNoshow, driversEsperandoNormal } = useMemo(() => {
    const stats = getDriversStats();
    const driversResult = getDriversByStatus();
    
    // Garantir que temos o tipo correto (DriversByStatus)
    const driversData = Array.isArray(driversResult) ? {
      esperando: driversResult.filter(d => d.status === "esperar_fora_hub"),
      entrando: driversResult.filter(d => d.status === "entrar_hub"),
      no_hub: driversResult.filter(d => d.status === "chegou"),
      atrasados: driversResult.filter(d => d.status === "atrasado")
    } : driversResult;

    // Separar motoristas por status especial
    const noshow = driversData.esperando.filter(d => {
      const specialStatus = getDriverSpecialStatus(d.gaiola);
      return specialStatus === 'noshow';
    });
    
    const reverterNoshow = driversData.esperando.filter(d => {
      const specialStatus = getDriverSpecialStatus(d.gaiola);
      return specialStatus === 'reverter_noshow';
    });
    
    const esperandoNormal = driversData.esperando.filter(d => {
      const specialStatus = getDriverSpecialStatus(d.gaiola);
      return !specialStatus || specialStatus === 'normal';
    });

    return {
      driverStats: stats,
      drivers: driversData,
      driversNoshow: noshow,
      driversReverterNoshow: reverterNoshow,
      driversEsperandoNormal: esperandoNormal
    };
  }, [getDriversStats, getDriversByStatus, getDriverSpecialStatus, refreshKey]);
  
  console.log(`📊 Motoristas NOSHOW: ${driversNoshow.length}, Reverter: ${driversReverterNoshow.length}, Normal: ${driversEsperandoNormal.length}`);
  
  // Log para depuração de motoristas atrasados
  if (drivers.atrasados && drivers.atrasados.length > 0) {
    console.log(`Temos ${drivers.atrasados.length} motoristas atrasados:`, drivers.atrasados.map(d => `${d.gaiola} - ${d.motorista}`));
  }

  // Chamar função para atualizar motoristas atrasados
  useEffect(() => {
    updateDelayedDrivers();
  }, [alerts, refreshKey]);
  
  // Verificar alertas de analistas
  const hasAnalystAlerts = alerts.some(alert => alert.type === "analista_chamado");

  // Cálculos otimizados das vagas
  const { vagasKeys, vagasCounters, groupedVagas } = useMemo(() => {
    // Não mostrar vagas além do número configurado
    const keys = Object.keys(vagasData).sort((a, b) => Number(a) - Number(b)).slice(0, vagasToShow);
    
    // Contadores de vagas por status
    const counters = {
      ativas: keys.length,
      chamados: Object.values(vagasData).filter(v => v.status === "chamado").length,
      carregando: Object.values(vagasData).filter(v => v.status === "carregando").length,
      finalizado: Object.values(vagasData).filter(v => v.status === "finalizado").length,
      total: Object.values(vagasData).length
    };

    // Agrupar vagas por status para melhor visualização
    const grouped = {
      ativas: keys.filter(vagaId => 
        vagasData[vagaId].status !== "finalizado" && 
        (vagasData[vagaId].gaiola || vagasData[vagaId].status === "esperar")
      ),
      finalizadas: keys.filter(vagaId => vagasData[vagaId].status === "finalizado")
    };

    return { vagasKeys: keys, vagasCounters: counters, groupedVagas: grouped };
  }, [vagasData, vagasToShow]);

  // Verificar status de gaiolas globalmente
  const totalGaiolas = driverStats.total || 0;
  const gaiolasNoHub = 0; // Temporariamente hardcoded
  const gaiolasHoje = 0; // Temporariamente hardcoded

  return (
    <div className="flex flex-col h-screen">
      {/* Header com título e controles */}
      <header className="bg-slate-900 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-amber-400">Painel Administrativo</h1>
            <p className="text-sm text-slate-300">Sistema de Controle de Vagas - 05/08/2025</p>
          </div>
          
          <div className="flex gap-2">
            {/* Botão de notificações */}
            <Button
              variant="ghost"
              size="sm"
              className="relative text-white flex items-center gap-1"
              onClick={() => setIsNotificationCenterOpen(true)}
            >
              {alerts.length > 0 ? (
                <BellRing className="h-5 w-5" />
              ) : (
                <Bell className="h-5 w-5" />
              )}
              {alerts.length > 0 && (
                <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs h-5 w-5 rounded-full p-0 flex items-center justify-center">
                  {alerts.length}
                </Badge>
              )}
            </Button>
            
            {/* Link para painel de motoristas */}
            <Button
              variant="ghost"
              size="sm"
              className="text-white flex items-center gap-1"
              onClick={() => window.open('/drivers', '_blank')}
            >
              <Users className="w-4 h-4" />
              <span>Ver Motoristas</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Dashboard principal */}
      <div className="flex-grow container mx-auto p-4">
        {/* Cards de estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <p className="text-4xl font-bold text-blue-600">{vagasCounters.ativas}</p>
              <p className="text-sm text-gray-600">Vagas Ativas Hoje</p>
            </CardContent>
          </Card>
          
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <p className="text-4xl font-bold text-amber-600">0</p>
              <p className="text-sm text-gray-600">Esperando</p>
            </CardContent>
          </Card>
          
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <p className="text-4xl font-bold text-green-600">{vagasCounters.chamados}</p>
              <p className="text-sm text-gray-600">Chamados</p>
            </CardContent>
          </Card>
          
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <p className="text-4xl font-bold text-purple-600">{vagasCounters.carregando}</p>
              <p className="text-sm text-gray-600">Carregando</p>
            </CardContent>
          </Card>
          
          <Card className="bg-teal-50 border-teal-200">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <p className="text-4xl font-bold text-teal-600">{gaiolasNoHub}</p>
              <p className="text-sm text-gray-600">No Hub</p>
            </CardContent>
          </Card>
          
          <Card className="bg-indigo-50 border-indigo-200">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <p className="text-4xl font-bold text-indigo-600">{gaiolasHoje}</p>
              <p className="text-sm text-gray-600">Gaiolas Hoje</p>
            </CardContent>
          </Card>
        </div>

        {/* Painel principal com tabs */}
        <Card className="">
          <CardHeader className="bg-gray-50">
            <Tabs defaultValue="vagas" className="w-full" onValueChange={(value) => {
              if (value === "drivers") {
                // Forçar carregamento dos dados quando a aba de motoristas for selecionada
                localStorage.setItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE, Date.now().toString());
                // Forçar refresh na UI
                setRefreshKey(prev => prev + 1);
                // Atualizar motoristas atrasados
                updateDelayedDrivers();
              }
            }}>
              <div className="flex justify-between items-center mb-4">
                <TabsList className="bg-slate-200">
                  <TabsTrigger value="vagas" className="data-[state=active]:bg-white">
                    <Truck className="w-4 h-4 mr-2" />
                    Vagas
                  </TabsTrigger>
                  <TabsTrigger value="drivers" className="data-[state=active]:bg-white">
                    <User className="w-4 h-4 mr-2" />
                    Motoristas
                  </TabsTrigger>
                  <TabsTrigger value="requests" className="data-[state=active]:bg-white relative">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Solicitações
                    {delayRequests.filter(req => req.status === 'pending').length > 0 && (
                      <Badge className="ml-1 bg-red-500 text-white text-xs px-1 py-0 h-4 min-w-4">
                        {delayRequests.filter(req => req.status === 'pending').length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="import" className="data-[state=active]:bg-white">
                    <Upload className="w-4 h-4 mr-2" />
                    Importar
                  </TabsTrigger>
                  <TabsTrigger value="historico" className="data-[state=active]:bg-white">
                    <BarChart2 className="w-4 h-4 mr-2" />
                    Histórico
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => navigate(-1)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-8 text-red-600 mobile-button"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </Button>
                </div>
              </div>

              {/* Vagas Tab */}
              <TabsContent value="vagas" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                  {groupedVagas.ativas.map((vagaId, i) => {
                    const vagaData = vagasData[vagaId];
                    if (!vagaData) return null;

                    return (
                      <VagaCard
                        key={vagaId}
                        vaga={vagaData}
                        index={i}
                        onToggleCheck={() => handleToggleCheck(vagaId)}
                        onStatusChange={(newStatus) => handleStatusChange(vagaId, newStatus)}
                        showTimers={true}
                        onDriverDelayAction={handleDriverDelayAction}
                        isDriverDelayed={vagaData.status === "chamado" && vagaData.chamadoEm && 
                          isDriverDelayed(vagaData.chamadoEm, vagaId)}
                        isAnalystCalled={alerts.some(alert => 
                          alert.vagaId === vagaId && alert.type === "analista_chamado"
                        )}
                        vagaAlerts={alerts.filter(alert => alert.vagaId === vagaId)}
                      />
                    );
                  })}
                </div>
              </TabsContent>

              {/* Motoristas Tab */}
              <TabsContent value="drivers" className="mt-0">
                <div className="flex justify-between items-center p-4 bg-gray-50 border-b">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold text-gray-800">Gerenciamento de Motoristas</h2>
                    <div className="flex gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        Hub: {drivers.no_hub ? drivers.no_hub.length : 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                        Atrasados: {drivers.atrasados ? drivers.atrasados.length : 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        NoShow: {driversNoshow.length}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-1 mobile-button"
                      onClick={() => {
                        localStorage.setItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE, Date.now().toString());
                        syncWithSheet();
                        updateDelayedDrivers();
                        toast({
                          title: "Dados atualizados",
                          description: "Lista de motoristas atualizada."
                        });
                        setRefreshKey(prev => prev + 1);
                      }}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Atualizar
                    </Button>
                    
                    <Button 
                      variant="destructive" 
                      size="sm"
                      className="flex items-center gap-1"
                      onClick={() => {
                        const delayedAlerts = alerts.filter(alert => alert.type === 'motorista_atrasou');
                        
                        if (delayedAlerts.length > 0) {
                          delayedAlerts.forEach(alert => {
                            if (alert.gaiola && alert.vagaId) {
                              handleMarkDelayed(alert.vagaId, alert.gaiola);
                            }
                          });
                          
                          toast({
                            title: "Motoristas atualizados",
                            description: `${delayedAlerts.length} motorista(s) marcado(s) como atrasado(s)`
                          });
                        } else {
                          toast({
                            title: "Nenhum alerta encontrado",
                            description: "Não há motoristas para marcar como atrasados"
                          });
                        }
                      }}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Processar Atrasos
                    </Button>
                  </div>
                </div>

                {/* Layout Grid Responsivo - 2 colunas em desktop, 1 em mobile */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Coluna Esquerda - Fluxo Normal */}
                  <div className="space-y-6">
                    
                    {/* Motoristas Esperando */}
                    <Card className="border-l-4 border-l-gray-400">
                      <CardHeader className="pb-3 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center text-gray-800">
                            <User className="w-5 h-5 mr-2" />
                            Motoristas que não chegaram
                          </CardTitle>
                          <Badge variant="secondary" className="bg-gray-100 text-gray-800 px-3 py-1">
                            {driversEsperandoNormal.length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="max-h-[350px] overflow-y-auto">
                        {driversEsperandoNormal.length > 0 ? (
                          <div className="space-y-3">
                            {driversEsperandoNormal.map((driver) => (
                              <div key={driver.id} className="flex items-center justify-between p-3 bg-gray-50 mobile-card rounded-lg border">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 font-bold text-sm">
                                    {driver.gaiola}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{driver.motorista}</p>
                                    <p className="text-xs text-gray-500">Gaiola {driver.gaiola}</p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-white border-gray-200 text-gray-700">
                                    Esperando
                                  </Badge>
                                  <Select 
                                    value=""
                                    onValueChange={(value) => handleDriverStatusChange(driver.gaiola, value)}
                                  >
                                    <SelectTrigger className="w-[110px] h-8 border-gray-300">
                                      <SelectValue placeholder="Ações" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="CARREGAR">🚛 Carregar</SelectItem>
                                      <SelectItem value="ATRASOU">⏰ Atrasou</SelectItem>
                                      <SelectItem value="NO_HUB">🏠 No Hub</SelectItem>
                                      <SelectItem value="NOSHOW">❌ NoShow</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <User className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-500">Nenhum motorista esperando</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Motoristas no Hub */}
                    <Card className="border-l-4 border-l-green-400">
                      <CardHeader className="pb-3 bg-green-50">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center text-green-800">
                            <Truck className="w-5 h-5 mr-2" />
                            No Hub
                          </CardTitle>
                          <Badge variant="secondary" className="bg-green-100 text-green-800 px-3 py-1">
                            {drivers.no_hub ? drivers.no_hub.length : 0}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="max-h-[350px] overflow-y-auto">
                        {drivers.no_hub && drivers.no_hub.length > 0 ? (
                          <div className="space-y-3">
                            {drivers.no_hub.map((driver) => (
                              <div key={driver.id} className="flex items-center justify-between p-3 bg-green-50 mobile-card rounded-lg border border-green-200">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-sm">
                                    {driver.gaiola}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{driver.motorista}</p>
                                    <p className="text-xs text-green-600">Pronto para carregar</p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-green-500 text-white">
                                    CHEGOU
                                  </Badge>
                                  <Select 
                                    value=""
                                    onValueChange={(value) => handleDriverStatusChange(driver.gaiola, value)}
                                  >
                                    <SelectTrigger className="w-[110px] h-8 border-green-300">
                                      <SelectValue placeholder="Ações" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="CARREGAR">🚛 Carregar</SelectItem>
                                      <SelectItem value="ATRASOU">⏰ Atrasou</SelectItem>
                                      <SelectItem value="ESPERAR">⏸️ Esperar</SelectItem>
                                      <SelectItem value="NOSHOW">❌ NoShow</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <Truck className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-500">Nenhum motorista no hub</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Entrando no Hub */}
                    <Card className="border-l-4 border-l-blue-400">
                      <CardHeader className="pb-3 bg-blue-50">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center text-blue-800">
                            <ArrowLeft className="w-5 h-5 mr-2" />
                            Entrando no Hub
                          </CardTitle>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 px-3 py-1">
                            {drivers.entrando ? drivers.entrando.length : 0}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="max-h-[350px] overflow-y-auto">
                        {drivers.entrando && drivers.entrando.length > 0 ? (
                          <div className="space-y-3">
                            {drivers.entrando.map((driver) => (
                              <div key={driver.id} className="flex items-center justify-between p-3 bg-blue-50 mobile-card rounded-lg border border-blue-200">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                                    {driver.gaiola}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{driver.motorista}</p>
                                    <p className="text-xs text-blue-600">A caminho do hub</p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-blue-500 text-white">
                                    ENTRAR NO HUB
                                  </Badge>
                                  <Select 
                                    value=""
                                    onValueChange={(value) => handleDriverStatusChange(driver.gaiola, value)}
                                  >
                                    <SelectTrigger className="w-[110px] h-8 border-blue-300">
                                      <SelectValue placeholder="Ações" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="CARREGAR">🚛 Carregar</SelectItem>
                                      <SelectItem value="ATRASOU">⏰ Atrasou</SelectItem>
                                      <SelectItem value="ESPERAR">⏸️ Esperar</SelectItem>
                                      <SelectItem value="NOSHOW">❌ NoShow</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <ArrowLeft className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-500">Nenhum motorista entrando</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Coluna Direita - Situações Especiais */}
                  <div className="space-y-6">
                    
                    {/* Motoristas Atrasados */}
                    <Card className="border-l-4 border-l-red-400">
                      <CardHeader className="pb-3 bg-red-50">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center text-red-800">
                            <AlertTriangle className="w-5 h-5 mr-2" />
                            Motoristas Atrasados
                          </CardTitle>
                          <Badge variant="destructive" className="bg-red-100 text-red-800 px-3 py-1">
                            {drivers.atrasados ? drivers.atrasados.length : 0}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="max-h-[350px] overflow-y-auto">
                        {drivers.atrasados && drivers.atrasados.length > 0 ? (
                          <div className="space-y-4">
                            {drivers.atrasados.map((driver) => (
                              <div key={driver.id} className="p-4 bg-red-50 mobile-card rounded-lg border border-red-200">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-700 font-bold text-sm">
                                      {driver.gaiola}
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900">{driver.motorista}</p>
                                      <p className="text-xs text-red-600">Motorista atrasado</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <Badge variant="destructive" className="bg-red-500 text-white">
                                      ATRASADO
                                    </Badge>
                                    <Button 
                                      size="sm" 
                                      variant="ghost"
                                      className="h-7 px-2 text-xs mobile-button"
                                      onClick={() => resetDriver(driver.gaiola)}
                                    >
                                      <RotateCcw className="w-3 h-3 mr-1" />
                                      Reset
                                    </Button>
                                  </div>
                                </div>
                                
                                {/* Ação rápida de chamar para vaga */}
                                <div className="flex gap-2">
                                  <Input
                                    type="text"
                                    placeholder="Nº da Vaga"
                                    className="flex-1 h-8 text-sm bg-white border-red-300 focus:border-red-500"
                                    value={vagaInputs[driver.gaiola] || ''}
                                    onChange={(e) => setVagaInputs(prev => ({
                                      ...prev,
                                      [driver.gaiola]: e.target.value
                                    }))}
                                  />
                                  <Button
                                    size="sm"
                                    className="bg-green-600 text-white h-8 px-3 text-xs font-medium mobile-button"
                                    onClick={() => handleChamarMotorista(driver.gaiola, vagaInputs[driver.gaiola] || '')}
                                  >
                                    <Truck className="w-3 h-3 mr-1" />
                                    Chamar
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <AlertTriangle className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-500">Nenhum motorista atrasado</p>
                            
                            {alerts.filter(a => a.type === 'motorista_atrasou').length > 0 && (
                              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-700">
                                  Há alertas de atraso não processados.
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2 border-red-300 text-red-700 mobile-button"
                                  onClick={() => {
                                    const delayedAlerts = alerts.filter(alert => alert.type === 'motorista_atrasou');
                                    delayedAlerts.forEach(alert => {
                                      if (alert.gaiola && alert.vagaId) {
                                        handleMarkDelayed(alert.vagaId, alert.gaiola);
                                      }
                                    });
                                  }}
                                >
                                  Processar Atrasos
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* NOSHOW */}
                    <Card className="border-l-4 border-l-black">
                      <CardHeader className="pb-3 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center text-gray-800">
                            <X className="w-5 h-5 mr-2" />
                            NOSHOW
                          </CardTitle>
                          <Badge variant="destructive" className="bg-black text-white px-3 py-1">
                            {driversNoshow.length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="max-h-[350px] overflow-y-auto">
                        {driversNoshow.length > 0 ? (
                          <div className="space-y-3">
                            {driversNoshow.map((driver) => (
                              <div key={driver.id} className="p-3 bg-gray-50 mobile-card rounded-lg border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 font-bold text-sm">
                                      {driver.gaiola}
                                    </div>
                                    <div className="flex-1">
                                      <Input
                                        type="text"
                                        value={editableNames[driver.gaiola] || driver.motorista}
                                        onChange={(e) => {
                                          setEditableNames(prev => ({
                                            ...prev,
                                            [driver.gaiola]: e.target.value
                                          }));
                                        }}
                                        onBlur={(e) => {
                                          const updatedName = e.target.value;
                                          if (updatedName !== driver.motorista) {
                                            const driversDataStr = localStorage.getItem('drivers_data');
                                            if (driversDataStr) {
                                              try {
                                                const driversData = JSON.parse(driversDataStr);
                                                const driverIndex = driversData.findIndex((d: any) => d.gaiola === driver.gaiola);
                                                if (driverIndex !== -1) {
                                                  driversData[driverIndex].motorista = updatedName;
                                                  localStorage.setItem('drivers_data', JSON.stringify(driversData));
                                                  updateDriverNameInAllVagas(driver.gaiola, updatedName);
                                                  setRefreshKey(prev => prev + 1);
                                                  toast({
                                                    title: "Nome atualizado",
                                                    description: `${driver.gaiola}: ${updatedName}`
                                                  });
                                                }
                                              } catch (error) {
                                                console.error("Erro ao atualizar nome:", error);
                                              }
                                            }
                                          }
                                        }}
                                        className="text-sm bg-white border-gray-300 focus:border-gray-500"
                                        placeholder="Nome do motorista"
                                      />
                                      <p className="text-xs text-gray-600 mt-1">Clique para editar o nome</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 ml-2">
                                    <Badge className="bg-black text-white">
                                      NOSHOW
                                    </Badge>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs border-gray-300 text-gray-700 mobile-button"
                                      onClick={() => handleDriverStatusChange(driver.gaiola, "REVERTER_NOSHOW")}
                                    >
                                      <RefreshCw className="w-3 h-3 mr-1" />
                                      Reverter
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <X className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-500">Nenhum NOSHOW registrado</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Reversão NOSHOW */}
                    <Card className="border-l-4 border-l-blue-400">
                      <CardHeader className="pb-3 bg-blue-50">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center text-blue-800">
                            <RefreshCw className="w-5 h-5 mr-2" />
                            Reversão NOSHOW
                          </CardTitle>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 px-3 py-1">
                            {driversReverterNoshow.length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="max-h-[350px] overflow-y-auto">
                        {driversReverterNoshow.length > 0 ? (
                          <div className="space-y-4">
                            {driversReverterNoshow.map((driver) => (
                              <div key={driver.id} className="p-4 bg-blue-50 mobile-card rounded-lg border border-blue-200">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                                      {driver.gaiola}
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900">{getUpdatedDriverName(driver.gaiola)}</p>
                                      <p className="text-xs text-blue-600">Pronto para chamar novamente</p>
                                    </div>
                                  </div>
                                  
                                  <Badge className="bg-blue-500 text-white">
                                    REVERSÃO NOSHOW
                                  </Badge>
                                </div>
                                
                                {/* Ação rápida de chamar para vaga */}
                                <div className="flex gap-2">
                                  <Input
                                    type="text"
                                    placeholder="Nº da Vaga"
                                    className="flex-1 h-8 text-sm bg-white border-blue-300 focus:border-blue-500"
                                    value={vagaInputs[driver.gaiola] || ''}
                                    onChange={(e) => setVagaInputs(prev => ({
                                      ...prev,
                                      [driver.gaiola]: e.target.value
                                    }))}
                                  />
                                  <Button
                                    size="sm"
                                    className="bg-blue-600 text-white h-8 px-3 text-xs font-medium mobile-button"
                                    onClick={() => handleChamarMotorista(driver.gaiola, vagaInputs[driver.gaiola] || '')}
                                  >
                                    <Truck className="w-3 h-3 mr-1" />
                                    Chamar
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <RefreshCw className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-500">Nenhuma reversão pendente</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* Solicitações de Atraso Tab */}
              <TabsContent value="requests" className="mt-0">
                <div className="p-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
                        Solicitações de Atraso
                        {delayRequests.filter(req => req.status === 'pending').length > 0 && (
                          <Badge className="ml-2 bg-red-500 text-white">
                            {delayRequests.filter(req => req.status === 'pending').length} pendente(s)
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Gerencie solicitações de atraso enviadas pelas vagas
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {delayRequests.length === 0 ? (
                        <div className="text-center py-8">
                          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p>Nenhuma solicitação de atraso no momento</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {delayRequests
                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                            .map((request) => (
                              <div
                                key={request.id}
                                className={`p-4 border rounded-lg ${
                                  request.status === 'pending' 
                                    ? 'border-orange-300 bg-orange-50' 
                                    : 'border-gray-200 bg-gray-50'
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant={request.status === 'pending' ? 'destructive' : 'secondary'}>
                                        {request.status === 'pending' ? '🔥 PENDENTE' : '✅ RESPONDIDO'}
                                      </Badge>
                                      <span className="text-sm text-gray-500">
                                        {new Date(request.timestamp).toLocaleString('pt-BR')}
                                      </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-3">
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Vaga:</label>
                                        <p className="text-sm">{request.vagaNumero}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Gaiola:</label>
                                        <p className="text-sm font-mono">{request.gaiola}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Motorista:</label>
                                        <p className="text-sm">{request.motorista}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-600">Status da Vaga:</label>
                                        <p className="text-sm">{request.statusVaga}</p>
                                      </div>
                                    </div>

                                    {request.status === 'responded' && request.response && (
                                      <div className="mt-2 p-2 bg-green-100 rounded border-l-4 border-green-500">
                                        <p className="text-sm text-green-800">
                                          <strong>Respondido:</strong> {
                                            request.response === 'bipar_gaiola' 
                                              ? '📢 Bipar Gaiola' 
                                              : '🕒 Motorista a Caminho'
                                          }
                                        </p>
                                        <p className="text-xs text-green-600">
                                          {new Date(request.responseTimestamp).toLocaleString('pt-BR')}
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  {request.status === 'pending' && (
                                    <div className="flex gap-2 ml-4">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-blue-600 border-blue-300 mobile-button"
                                        onClick={() => respondToDelayRequest(request.id, 'bipar_gaiola')}
                                      >
                                        📢 Bipar Gaiola
                                      </Button>
                                      <Button
                                        variant="outline" 
                                        size="sm"
                                        className="text-orange-600 border-orange-300 mobile-button"
                                        onClick={() => respondToDelayRequest(request.id, 'motorista_a_caminho')}
                                      >
                                        🕒 Motorista a Caminho
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Importação Tab */}
              <TabsContent value="import" className="mt-0">
                <div className="p-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <FileSpreadsheet className="w-5 h-5 mr-2" />
                        Importar Planilha de Motoristas
                      </CardTitle>
                      <CardDescription>
                        Faça upload da planilha com os dados dos motoristas e gaiolas
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <ImportPlanilha onUpload={handlePlanoUpload} />
                        
                        <div className="flex items-center justify-center pt-4 border-t">
                          <Button 
                            onClick={handleResetSystem}
                            variant="destructive"
                            className="w-full max-w-md"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Resetar Sistema Completo
                          </Button>
                        </div>
                        
                        <div className="text-sm text-muted-foreground text-center">
                          ⚠️ O reset limpa todos os dados e permite recomeçar do zero
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
          
              {/* Histórico de Vagas */}
              <TabsContent value="historico">
                <HistoricoVagas vagasData={vagasData} />
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>
      </div>

      {/* Central de Notificações */}
      <CustomNotificationCenter 
        alerts={alerts}
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        onMarkDriverOnWay={markDriverOnWay}
        onRemoveAlert={removeAlertByIndex}
      />
    </div>
  );
};

export default AdminPanel;
