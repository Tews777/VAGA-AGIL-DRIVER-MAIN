// TablePanel.tsx - Sistema de visualização tabular com filtros avançados
// Versão profissional refatorada com padrões enterprise-grade

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useVagaData } from "@/hooks/useVagaData";
import { useDriverData } from "@/hooks/useDriverData";
import { 
  LogOut, RefreshCw, Upload, CheckCircle, XCircle, ArrowLeft, 
  User, Users, Search, Filter, AlertTriangle, Clock, Truck
} from "lucide-react";

// Interfaces TypeScript
interface VagaTableData {
  id: string;
  gaiola: string;
  motorista: string;
  status: "esperar" | "chamado" | "carregando" | "finalizado";
  check: boolean;
  chamadoEm?: string;
  finalizadoEm?: string;
  tempo?: string;
}

interface GaiolaUsage {
  [gaiola: string]: string[];
}

interface TableStats {
  total: number;
  esperando: number;
  chamados: number;
  carregando: number;
  finalizados: number;
  noHub: number;
  duplicadas: number;
}

interface TablePanelProps {}

// Constantes
const CONSTANTS = {
  REFRESH_INTERVAL: 10000, // 10 segundos
  MAX_VAGAS: 30,
  CSV_MIME_TYPES: ".csv,.xlsx,.xls",
  STATUS_COLORS: {
    esperar: "bg-yellow-100 text-yellow-800",
    chamado: "bg-blue-100 text-blue-800", 
    carregando: "bg-orange-100 text-orange-800",
    finalizado: "bg-green-100 text-green-800"
  },
  CHECK_COLORS: {
    checked: "bg-green-600 hover:bg-green-700",
    unchecked: "bg-red-600 hover:bg-red-700"
  }
} as const;

const TablePanel: React.FC<TablePanelProps> = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { vagasData, loadAllVagasData, toggleCheck } = useVagaData();
  const { driversData, loadAllDriversData, syncDriverNames } = useDriverData();
  
  // Estados locais
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [checkFilter, setCheckFilter] = useState("Todos");
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [forceDriversUpdate, setForceDriversUpdate] = useState(0); // Para forçar re-render da lista

  // Verificar autorização de admin
  useEffect(() => {
    const userType = localStorage.getItem("userType");
    if (userType !== "admin") {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem acessar esta página.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }
  }, [navigate, toast]);

  // Função para carregar nomes dos motoristas - OTIMIZADA
  const loadDriverNames = useCallback(async (): Promise<void> => {
    try {
      const driversArrayStr = localStorage.getItem('drivers_data');
      if (!driversArrayStr) {
        console.warn('Nenhum dado de motorista encontrado no localStorage');
        return;
      }

      const driversArray = JSON.parse(driversArrayStr);
      if (!Array.isArray(driversArray)) {
        console.warn('Dados de motoristas não estão no formato de array');
        return;
      }

      const namesMap: Record<string, string> = {};
      driversArray.forEach(driver => {
        if (driver?.gaiola && (driver.name || driver.motorista)) {
          namesMap[driver.gaiola] = driver.name || driver.motorista || "Sem nome";
        }
      });

      setDriverNames(namesMap);
      console.log(`Carregados ${Object.keys(namesMap).length} nomes de motoristas`);
      
    } catch (error) {
      console.error("Erro ao carregar nomes dos motoristas:", error);
      toast({
        title: "Erro ao carregar motoristas",
        description: "Não foi possível carregar os nomes dos motoristas.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Carregar dados iniciais e configurar auto-refresh
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      try {
        // Garantir que usa os dados mais atuais do AdminPanel
        console.log('🔄 Inicializando TablePanel com dados do AdminPanel...');
        
        await Promise.all([
          loadAllVagasData(),
          loadAllDriversData(),
          loadDriverNames()
        ]);
        
        // Sincronizar nomes após carregamento inicial
        await syncDriverNames();
        
        // Verificar se há dados dos motoristas, se não houver, mostrar aviso
        const driversDataStr = localStorage.getItem('drivers_data');
        if (!driversDataStr || JSON.parse(driversDataStr).length === 0) {
          toast({
            title: "Atenção",
            description: "Nenhum dado de motorista encontrado. Importe a planilha no AdminPanel primeiro.",
            variant: "default",
          });
        } else {
          const driversCount = JSON.parse(driversDataStr).length;
          console.log(`✅ ${driversCount} motoristas carregados do AdminPanel`);
        }
        
      } catch (error) {
        console.error("Erro ao inicializar dados:", error);
        toast({
          title: "Erro de inicialização",
          description: "Erro ao carregar dados iniciais.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();

    // Auto-refresh interval
    const intervalId = setInterval(() => {
      loadAllVagasData();
      setRefreshKey(prev => prev + 1);
    }, CONSTANTS.REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [loadAllVagasData, loadAllDriversData, loadDriverNames, syncDriverNames, toast]);

  // Escutar mudanças de status especiais para forçar refresh
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      console.log('🔄 StorageEvent detectado:', e.key, e.newValue);
      if (e.key?.includes('_special_status') || 
          e.key === '_forceDriverUpdate' || 
          e.key === 'forceTableUpdate' ||
          e.key?.includes('driver_') && e.key?.includes('_special_status')) {
        console.log('🔄 Status especial detectado via storage event, atualizando tabela...');
        loadAllVagasData();
        setRefreshKey(prev => prev + 1);
      }
    };

    // Handler para eventos customizados de atualização de status
    const handleDriverStatusUpdate = (e: CustomEvent) => {
      console.log('🔄 Evento customizado detectado, atualizando tabela...', e.detail);
      loadAllVagasData();
      setRefreshKey(prev => prev + 1);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('driverStatusUpdated', handleDriverStatusUpdate as EventListener);
    
    // Polling mais agressivo para detectar mudanças entre páginas
    const pollInterval = setInterval(() => {
      // Verificar múltiplas flags de atualização
      const forceUpdate = localStorage.getItem('_forceDriverUpdate');
      const forceTableUpdate = localStorage.getItem('forceTableUpdate');
      const noshowTrigger = localStorage.getItem('noshow_update_trigger');
      const currentTime = Date.now();
      
      if (forceUpdate) {
        const updateTime = parseInt(forceUpdate);
        if (updateTime > refreshKey && (currentTime - updateTime) < 5000) { // 5 segundos de janela
          console.log('🔄 Force driver update detectado, atualizando tabela...', { updateTime, refreshKey });
          loadAllVagasData();
          setRefreshKey(updateTime);
        }
      }
      
      if (forceTableUpdate) {
        const updateTime = parseInt(forceTableUpdate);
        if (updateTime > refreshKey && (currentTime - updateTime) < 5000) { // 5 segundos de janela
          console.log('🔄 Force table update detectado, atualizando tabela...', { updateTime, refreshKey });
          loadAllVagasData();
          setRefreshKey(updateTime);
        }
      }
      
      // Flag específica para NOSHOW - alta prioridade
      if (noshowTrigger) {
        const updateTime = parseInt(noshowTrigger);
        if (updateTime > refreshKey && (currentTime - updateTime) < 10000) { // 10 segundos de janela para NOSHOW
          console.log('🚫 NOSHOW trigger detectado, atualizando dados...', { updateTime, refreshKey });
          loadAllVagasData();
          loadAllDriversData(); // Recarregar dados dos motoristas
          setRefreshKey(updateTime);
          setForceDriversUpdate(prev => prev + 1); // Forçar re-render da lista
          // Limpar o trigger após uso
          localStorage.removeItem('noshow_update_trigger');
        }
      }
      
      // Detectar mudanças nos dados dos motoristas (drivers_data)
      const driversDataCheck = localStorage.getItem('drivers_data');
      if (driversDataCheck) {
        const lastDriversUpdate = localStorage.getItem('_last_drivers_check');
        const currentDriversHash = btoa(driversDataCheck).slice(0, 20); // Hash simples
        
        if (lastDriversUpdate !== currentDriversHash) {
          console.log('🔄 Mudança nos dados dos motoristas detectada, atualizando...');
          setForceDriversUpdate(prev => prev + 1);
          localStorage.setItem('_last_drivers_check', currentDriversHash);
        }
      }
      
      // Verificar mudanças em status especiais
      const specialStatusKeys = Object.keys(localStorage).filter(key => key.includes('_special_status'));
      if (specialStatusKeys.length > 0) {
        const specialStatusHash = btoa(JSON.stringify(specialStatusKeys.map(k => `${k}:${localStorage.getItem(k)}`).sort())).slice(0, 20);
        const lastSpecialCheck = localStorage.getItem('_last_special_check');
        
        if (lastSpecialCheck !== specialStatusHash) {
          console.log('🔄 Mudança em status especiais detectada, atualizando...');
          setForceDriversUpdate(prev => prev + 1);
          localStorage.setItem('_last_special_check', specialStatusHash);
        }
      }
      
    }, 200); // Polling mais frequente (200ms) para melhor responsividade

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('driverStatusUpdated', handleDriverStatusUpdate as EventListener);
    };

  }, [loadAllVagasData, loadAllDriversData, loadDriverNames, syncDriverNames, toast, refreshKey]);

  const handleLogout = () => {
    localStorage.removeItem("userType");
    navigate("/");
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    loadAllVagasData();
    
    // Sincronizar nomes de motoristas
    syncDriverNames();
    
    // Atualizar mapeamento de nomes
    try {
      const driversArrayStr = localStorage.getItem('drivers_data');
      if (driversArrayStr) {
        const driversArray = JSON.parse(driversArrayStr);
        const namesMap: Record<string, string> = {};
        
        if (Array.isArray(driversArray)) {
          driversArray.forEach(driver => {
            if (driver.gaiola && (driver.name || driver.motorista)) {
              namesMap[driver.gaiola] = driver.name || driver.motorista || "Sem nome";
            }
          });
        }
        
        setDriverNames(namesMap);
        console.log("Nomes de motoristas atualizados:", namesMap);
      }
    } catch (error) {
      console.error("Erro ao atualizar nomes dos motoristas:", error);
    }
  };

  const handleToggleCheck = (vagaId: string) => {
    toggleCheck(vagaId, "admin");
  };

  const getStatusColor = (status: string, gaiola?: string, vagaData?: any) => {
    // Verificar se há status especial na vaga primeiro
    if (vagaData?.specialStatus) {
      if (vagaData.specialStatus === 'noshow') {
        return "bg-black text-white"; // Preto com letra branca
      }
      if (vagaData.specialStatus === 'reverter_noshow') {
        return "bg-blue-500 text-white"; // Azul com letra branca
      }
    }

    // Verificar se há status especial para motorista
    if (gaiola) {
      const specialStatus = localStorage.getItem(`driver_${gaiola}_special_status`);
      if (specialStatus === 'noshow') {
        return "bg-black text-white"; // Preto com letra branca
      }
      if (specialStatus === 'reverter_noshow') {
        return "bg-blue-500 text-white"; // Azul com letra branca
      }
    }

    // Verificar se o status já é especial (para casos diretos)
    if (status === 'noshow') {
      return "bg-black text-white";
    }
    if (status === 'reverter_noshow') {
      return "bg-blue-500 text-white";
    }

    switch (status) {
      case "esperar": return "bg-status-waiting text-black";
      case "chamado": return "bg-status-called text-black";
      case "carregando": return "bg-status-loading text-white";
      case "finalizado": return "bg-status-completed text-black";
      case "esperar_fora_hub": return "bg-yellow-100 text-yellow-800";
      case "entrar_hub": return "bg-blue-100 text-blue-800";
      case "chegou": return "bg-green-100 text-green-800";
      case "atrasado": return "bg-red-100 text-red-800";
      default: return "bg-gray-500 text-white";
    }
  };

  const getStatusText = (status: string, gaiola?: string, vagaData?: any) => {
    // Verificar se há status especial na vaga primeiro
    if (vagaData?.specialStatus) {
      if (vagaData.specialStatus === 'noshow') {
        return "NOSHOW";
      }
      if (vagaData.specialStatus === 'reverter_noshow') {
        return "REVERSÃO NOSHOW";
      }
    }

    // Verificar se há status especial para motorista
    if (gaiola) {
      const specialStatus = localStorage.getItem(`driver_${gaiola}_special_status`);
      if (specialStatus === 'noshow') {
        return "NOSHOW";
      }
      if (specialStatus === 'reverter_noshow') {
        return "REVERSÃO NOSHOW";
      }
    }

    // Verificar se o status já é especial (para casos diretos)
    if (status === 'noshow') {
      return "NOSHOW";
    }
    if (status === 'reverter_noshow') {
      return "REVERSÃO NOSHOW";
    }

    switch (status) {
      case "esperar": return "ESPERAR";
      case "chamado": return "CHAMADO";
      case "carregando": return "CARREGANDO";
      case "finalizado": return "FINALIZADO";
      case "esperar_fora_hub": return "ESPERANDO FORA";
      case "entrar_hub": return "ENTRAR HUB";
      case "chegou": return "CHEGOU";
      case "atrasado": return "ATRASADO";
      default: return status.toUpperCase();
    }
  };

  // Verificar gaiolas duplicadas
  const getGaiolaUsage = () => {
    const gaiolas: Record<string, string[]> = {};
    Object.entries(vagasData).forEach(([vagaId, data]) => {
      if (data.gaiola && data.status !== "finalizado") {
        if (!gaiolas[data.gaiola]) {
          gaiolas[data.gaiola] = [];
        }
        gaiolas[data.gaiola].push(vagaId);
      }
    });
    return gaiolas;
  };

  const gaiolaUsage = getGaiolaUsage();

  const importFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        
        // Aqui você pode implementar a lógica de importação da planilha
        toast({
          title: "Importação simulada",
          description: "Funcionalidade de importação de planilha em desenvolvimento",
        });
      } catch (error) {
        toast({
          title: "Erro na importação",
          description: "Erro ao processar o arquivo",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-3xl font-bold">Painel de Controle - Todas as Vagas</CardTitle>
              <p className="text-muted-foreground">
                Formato planilha - Atualização automática a cada 10s
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={importFromCSV}
                  className="hidden"
                  id="csv-upload"
                />
                <Button 
                  onClick={() => document.getElementById('csv-upload')?.click()}
                  variant="outline" 
                  size="sm"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Planilha
                </Button>
              </div>
              <Button onClick={() => navigate(-1)} variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={handleRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button 
                onClick={() => {
                  syncDriverNames();
                  toast({
                    title: "Nomes sincronizados",
                    description: "Os nomes dos motoristas foram sincronizados em todos os formatos."
                  });
                  setTimeout(handleRefresh, 500);
                }} 
                variant="outline" 
                size="sm"
                className="bg-blue-50"
              >
                <User className="h-4 w-4 mr-2" />
                Sincronizar Nomes
              </Button>
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Alertas de gaiolas duplicadas */}
        {Object.entries(gaiolaUsage).filter(([_, vagas]) => vagas.length > 1).length > 0 && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="text-destructive font-bold mb-2">⚠️ GAIOLAS DUPLICADAS DETECTADAS:</div>
              {Object.entries(gaiolaUsage)
                .filter(([_, vagas]) => vagas.length > 1)
                .map(([gaiola, vagas]) => (
                  <div key={gaiola} className="text-sm">
                    Gaiola <strong>{gaiola}</strong> está sendo usada nas vagas: {vagas.join(", ")}
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        {/* Tabela estilo planilha */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-bold border-r">LETRA</th>
                    <th className="p-3 text-left font-bold border-r">NOME</th>
                    <th className="p-3 text-left font-bold border-r">VAGA</th>
                    <th className="p-3 text-left font-bold border-r">STATUS</th>
                    <th className="p-3 text-left font-bold">CHECK</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 30 }, (_, i) => {
                    const vagaId = (i + 1).toString();
                    const vaga = vagasData[vagaId];
                    const isDuplicated = vaga?.gaiola && gaiolaUsage[vaga.gaiola]?.length > 1;
                    
                    if (!vaga) return null;

                    return (
                      <tr 
                        key={vagaId} 
                        className={`border-b hover:bg-muted/30 ${isDuplicated ? 'bg-destructive/10' : ''}`}
                      >
                        {/* LETRA (Gaiola) */}
                        <td className="p-3 border-r">
                          <div className={`font-mono text-lg font-bold ${isDuplicated ? 'text-destructive' : ''}`}>
                            {vaga.gaiola || "---"}
                          </div>
                          {isDuplicated && (
                            <div className="text-xs text-destructive">DUPLICADA!</div>
                          )}
                        </td>
                        
                        {/* NOME */}
                        <td className="p-3 border-r">
                          <div className="font-semibold">
                            {vaga.gaiola && driverNames[vaga.gaiola] ? driverNames[vaga.gaiola] : "---"}
                          </div>
                        </td>
                        
                        {/* VAGA */}
                        <td className="p-3 border-r">
                          <div className="font-bold">VAGA {vagaId.padStart(2, '0')}</div>
                        </td>
                        
                        {/* STATUS */}
                        <td className="p-3 border-r">
                          <Badge className={`${getStatusColor(vaga.status, vaga.gaiola, vaga)} font-bold`}>
                            {getStatusText(vaga.status, vaga.gaiola, vaga)}
                          </Badge>
                          {vaga.chamadoEm && vaga.status === "chamado" && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(vaga.chamadoEm).toLocaleTimeString('pt-BR')}
                            </div>
                          )}
                        </td>
                        
                        {/* CHECK */}
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => handleToggleCheck(vagaId)}
                              variant="outline"
                              size="sm"
                              className={`p-2 ${vaga.check ? 'bg-check-yes hover:bg-check-yes/80' : 'bg-check-no hover:bg-check-no/80'} text-white border-0`}
                            >
                              {vaga.check ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                            </Button>
                            <span className="text-sm">
                              {vaga.check ? "CHEGOU" : "NÃO CHEGOU"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Motoristas */}
        <Card className="border shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lista de Motoristas
              <Badge variant="outline">{(() => {
                try {
                  const driversArrayStr = localStorage.getItem('drivers_data');
                  return driversArrayStr ? JSON.parse(driversArrayStr).length : 0;
                } catch { return 0; }
              })()}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="p-3 text-left font-semibold">Turno</th>
                    <th className="p-3 text-left font-semibold">Nome</th>
                    <th className="p-3 text-left font-semibold">Gaiola</th>
                    <th className="p-3 text-left font-semibold">Status</th>
                    <th className="p-3 text-left font-semibold">Vaga</th>
                    <th className="p-3 text-left font-semibold">Chegada</th>
                    <th className="p-3 text-left font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Pegar dados diretamente do localStorage como o AdminPanel faz */}
                  {(() => {
                    try {
                      const driversArrayStr = localStorage.getItem('drivers_data');
                      console.log('DEBUG: drivers_data localStorage:', driversArrayStr);
                      
                      if (!driversArrayStr) {
                        console.log('DEBUG: Nenhum dado de motorista encontrado');
                        return <tr><td colSpan={7} className="text-center p-4">Nenhum motorista encontrado</td></tr>;
                      }
                      
                      const driversArray = JSON.parse(driversArrayStr);
                      console.log('DEBUG: driversArray parsed:', driversArray);
                      
                      if (!Array.isArray(driversArray)) {
                        console.log('DEBUG: Dados não são array');
                        return <tr><td colSpan={7} className="text-center p-4">Formato de dados inválido</td></tr>;
                      }
                      
                      return driversArray.map((driver: any) => {
                        // Verificar status especial de forma simples
                        const specialStatus = localStorage.getItem(`driver_${driver.gaiola}_special_status`);
                        
                        // Se há status especial, usar ele; senão usar o status normal
                        const currentStatus = specialStatus || driver.status || 'esperar_fora_hub';
                        
                        return (
                          <tr key={`${driver.id || driver.gaiola}-${forceDriversUpdate}`} className="border-b hover:bg-gray-50">
                            <td className="p-3">
                              <Badge variant="outline">{driver.turno || driver.shift || 'PM'}</Badge>
                            </td>
                            <td className="p-3 font-medium">
                              {driver.motorista || driver.name || 'Sem nome'}
                            </td>
                            <td className="p-3">
                              <Badge className="bg-blue-100 text-blue-800">
                                {driver.gaiola}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Badge className={`${getStatusColor(currentStatus, driver.gaiola)} font-bold`}>
                                {getStatusText(currentStatus, driver.gaiola)}
                              </Badge>
                            </td>
                            <td className="p-3">
                              {driver.vaga && (
                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                  VAGA {driver.vaga.toString().padStart(2, '0')}
                                </Badge>
                              )}
                            </td>
                            <td className="p-3">
                              {driver.chegadaEm && (
                                <div className="text-sm text-muted-foreground">
                                  {new Date(driver.chegadaEm).toLocaleTimeString('pt-BR')}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex gap-2">
                                {specialStatus === 'noshow' && (
                                  <Badge className="bg-red-100 text-red-800 text-xs">NOSHOW</Badge>
                                )}
                                {driver.driverCheck && (
                                  <Badge className="bg-green-100 text-green-800 text-xs">✓ CHEGOU</Badge>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                  });
                } catch (error) {
                  console.error('Erro ao carregar dados dos motoristas:', error);
                  return <tr><td colSpan={7} className="text-center p-4">Erro ao carregar dados</td></tr>;
                }
              })()}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-status-waiting">
                {Object.values(vagasData).filter(v => v.status === "esperar").length}
              </div>
              <div className="text-sm text-muted-foreground">Esperando</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-status-called">
                {Object.values(vagasData).filter(v => v.status === "chamado").length}
              </div>
              <div className="text-sm text-muted-foreground">Chamados</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-status-loading">
                {Object.values(vagasData).filter(v => v.status === "carregando").length}
              </div>
              <div className="text-sm text-muted-foreground">Carregando</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-check-yes">
                {Object.values(vagasData).filter(v => v.check).length}
              </div>
              <div className="text-sm text-muted-foreground">No Hub</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${Object.entries(gaiolaUsage).filter(([_, vagas]) => vagas.length > 1).length > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {Object.entries(gaiolaUsage).filter(([_, vagas]) => vagas.length > 1).length}
              </div>
              <div className="text-sm text-muted-foreground">Duplicadas</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TablePanel;