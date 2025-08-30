// DriverPanel.tsx - Painel de gerenciamento de motoristas
// Versão profissional refatorada com padrões enterprise-grade

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle, XCircle, Search, LogOut, ArrowLeft, 
  Clock, Users, Truck, RefreshCw 
} from "lucide-react";
import { formatarTipoVeiculo, getTipoVeiculoClasses, preservarTipoVeiculo } from "@/lib/utils";

// Interfaces TypeScript
interface Driver {
  id: string;
  name: string;
  shift: string; // PM, SD, AM
  gaiola: string;
  vaga?: string;
  status: "esperar_fora_hub" | "entrar_hub" | "chegou" | "atrasado" | "noshow" | "reverter_noshow";
  hub: string;
  chegadaEm?: string;
  rota?: string;
  tipoVeiculo?: string; // Adicionado campo para tipo de veículo
}

interface DriverPanelProps {}

interface DriverStats {
  total: number;
  esperandoFora: number;
  entrarHub: number;
  atrasados: number;
  chegaram: number;
  noshow: number;
  reverterNoshow: number;
}

// Constantes
const CONSTANTS = {
  GR_PASSWORD: import.meta.env.VITE_GR_PASSWORD || "",
  UPDATE_INTERVAL: 2000, // ms
  HUB_NAME: "HUB - Florianópolis",
  DEFAULT_SHIFT: "PM",
  STATUS_COLORS: {
    esperar_fora_hub: "bg-red-100 text-red-800",
    entrar_hub: "bg-blue-100 text-blue-800", 
    chegou: "bg-green-100 text-green-800",
    atrasado: "bg-red-600 text-white",
    noshow: "bg-black text-white",
    reverter_noshow: "bg-blue-600 text-white"
  },
  STORAGE_KEYS: {
    DRIVERS_DATA: 'drivers_data',
    DRIVERS_DATA_OBJ: 'drivers_data_obj',
    DRIVERS_PANEL_DATA: 'drivers_panel_data',
    FORCE_UPDATE: '_forceDriverUpdate',
    USER_TYPE: 'userType'
  }
} as const;

const DriverPanel: React.FC<DriverPanelProps> = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Estados locais
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [shiftFilter, setShiftFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [isGRLoggedIn, setIsGRLoggedIn] = useState(false);
  const [grPassword, setGrPassword] = useState("");
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [showGRPanel, setShowGRPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Verificar se o usuário está logado como GR
  useEffect(() => {
    const userType = localStorage.getItem(CONSTANTS.STORAGE_KEYS.USER_TYPE);
    if (userType === "gr") {
      setIsGRLoggedIn(true);
    }
  }, []);

  // Função para carregar drivers com detecção automática de NOSHOW
  const loadDriversWithNoshowDetection = useCallback(() => {
    console.log('DriverPanel: Carregando drivers com detecção de NOSHOW...');
    
    try {
      // Carregar dados base
      const driversDataStr = localStorage.getItem('drivers_data');
      if (!driversDataStr) {
        console.log('DriverPanel: Nenhum dado encontrado em drivers_data');
        return [];
      }

      const driversData = JSON.parse(driversDataStr);
      if (!Array.isArray(driversData)) {
        console.log('DriverPanel: drivers_data não é um array válido');
        return [];
      }

      console.log(`DriverPanel: Processando ${driversData.length} drivers do localStorage`);

      // Debug: Listar todas as chaves do localStorage que começam com "driver_"
      const allKeys = Object.keys(localStorage);
      const driverKeys = allKeys.filter(key => key.startsWith('driver_') && key.endsWith('_special_status'));
      console.log('DriverPanel: Chaves especiais encontradas:', driverKeys);
      
      driverKeys.forEach(key => {
        const value = localStorage.getItem(key);
        console.log(`DriverPanel: ${key} = ${value}`);
      });

      // Mapear e aplicar status especiais
      const processedDrivers = driversData.map(driver => {
        const gaiola = driver.gaiola || '';
        let finalStatus = driver.status || 'esperar_fora_hub';

        // Verificar status especial no localStorage
        if (gaiola) {
          const specialStatusKey = `driver_${gaiola}_special_status`;
          const specialStatus = localStorage.getItem(specialStatusKey);
          
          console.log(`DriverPanel: Verificando ${gaiola} -> Chave: ${specialStatusKey} -> Valor: ${specialStatus}`);
          
          if (specialStatus === 'noshow') {
            finalStatus = 'noshow';
            console.log(`DriverPanel: ✅ Driver ${gaiola} (${driver.name || driver.motorista}) marcado como NOSHOW`);
          } else if (specialStatus === 'reverter_noshow') {
            // Quando é reversão, manter o status de reversão visível
            finalStatus = 'reverter_noshow';
            console.log(`DriverPanel: ↩️ Driver ${gaiola} (${driver.name || driver.motorista}) em REVERSÃO NOSHOW`);
          } else if (specialStatus === null || specialStatus === '') {
            // Se não há status especial, manter status original
            finalStatus = driver.status || 'esperar_fora_hub';
          }
        }

        return {
          id: driver.id || `driver_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: driver.name || driver.motorista || 'Sem nome',
          shift: driver.shift || driver.turno || 'PM',
          gaiola: gaiola,
          vaga: driver.vaga || '',
          status: finalStatus,
          hub: driver.hub || 'HUB - Florianópolis',
          chegadaEm: driver.chegadaEm,
          rota: driver.rota
        };
      });

      const noshowCount = processedDrivers.filter(d => d.status === 'noshow').length;
      console.log(`DriverPanel: ✅ Processados ${processedDrivers.length} drivers, ${noshowCount} marcados como NOSHOW`);
      
      return processedDrivers;

    } catch (error) {
      console.error('DriverPanel: Erro ao carregar drivers:', error);
      return [];
    }
  }, []);

  // Função para recarregar dados com status especiais
  const reloadDriversWithSpecialStatus = useCallback(() => {
    console.log('DriverPanel: Recarregando dados com verificação de status especiais...');
    
    const freshDrivers = loadDriversWithNoshowDetection();
    setDrivers(freshDrivers);
    
  }, [loadDriversWithNoshowDetection]);

  // Função para carregar dados dos motoristas - OTIMIZADA
  const loadDriversData = useCallback((): boolean => {
    try {
      setIsLoading(true);
      
      // 1. Tentar carregar de drivers_data (fonte principal)
      const driversDataStr = localStorage.getItem(CONSTANTS.STORAGE_KEYS.DRIVERS_DATA);
      if (driversDataStr) {
        const parsedData = JSON.parse(driversDataStr);
        
        if (Array.isArray(parsedData)) {
          const validDrivers = parsedData.filter(driver => 
            driver && driver.gaiola && (driver.name || driver.motorista)
          );
          
          if (validDrivers.length > 0) {
            const normalizedDrivers = normalizeDriversData(validDrivers);
            setDrivers(normalizedDrivers);
            console.log(`Carregados ${normalizedDrivers.length} motoristas de drivers_data`);
            return true;
          }
        } else if (typeof parsedData === 'object') {
          // Converter objeto para array
          const driversArray = Object.entries(parsedData).map(([key, driver]: [string, any]) => ({
            ...driver,
            id: driver.id || key,
            gaiola: driver.gaiola || key
          }));
          
          if (driversArray.length > 0) {
            const normalizedDrivers = normalizeDriversData(driversArray);
            setDrivers(normalizedDrivers);
            // Salvar no formato array para próximas consultas
            localStorage.setItem(CONSTANTS.STORAGE_KEYS.DRIVERS_DATA, JSON.stringify(normalizedDrivers));
            console.log(`Convertidos ${normalizedDrivers.length} motoristas do formato objeto`);
            return true;
          }
        }
      }
      
      // 2. Tentar carregar de drivers_data_obj
      return loadFromDriversDataObj() || loadFromDriversPanelData();
      
    } catch (error) {
      console.error('Erro ao carregar dados dos motoristas:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Função auxiliar para carregar de drivers_data_obj
  const loadFromDriversDataObj = useCallback((): boolean => {
    try {
      const objDataStr = localStorage.getItem(CONSTANTS.STORAGE_KEYS.DRIVERS_DATA_OBJ);
      if (objDataStr) {
        const parsed = JSON.parse(objDataStr);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          const driversArray = Object.values(parsed);
          const normalizedDrivers = normalizeDriversData(driversArray);
          setDrivers(normalizedDrivers);
          console.log(`Carregados ${normalizedDrivers.length} motoristas de drivers_data_obj`);
          return true;
        }
      }
    } catch (error) {
      console.error('Erro ao carregar de drivers_data_obj:', error);
    }
    return false;
  }, []);

  // Função auxiliar para carregar de drivers_panel_data
  const loadFromDriversPanelData = useCallback((): boolean => {
    try {
      const panelDataStr = localStorage.getItem(CONSTANTS.STORAGE_KEYS.DRIVERS_PANEL_DATA);
      if (panelDataStr) {
        const parsedData = JSON.parse(panelDataStr);
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          const normalizedDrivers = normalizeDriversData(parsedData);
          setDrivers(normalizedDrivers);
          // Sincronizar com drivers_data
          localStorage.setItem(CONSTANTS.STORAGE_KEYS.DRIVERS_DATA, JSON.stringify(normalizedDrivers));
          console.log(`Carregados ${normalizedDrivers.length} motoristas de drivers_panel_data`);
          return true;
        }
      }
    } catch (error) {
      console.error('Erro ao carregar de drivers_panel_data:', error);
    }
    return false;
  }, []);

  // Função para verificar status especial de um driver
  const getDriverSpecialStatus = useCallback((gaiola: string): string | null => {
    if (!gaiola) return null;
    return localStorage.getItem(`driver_${gaiola}_special_status`);
  }, []);

  // Função para aplicar status especiais aos drivers
  const applySpecialStatus = useCallback((driversArray: Driver[]): Driver[] => {
    console.log('DriverPanel: Aplicando status especiais a', driversArray.length, 'drivers');
    
    return driversArray.map(driver => {
      const specialStatus = getDriverSpecialStatus(driver.gaiola);
      
      if (specialStatus === "noshow") {
        console.log(`DriverPanel: Aplicando NOSHOW ao driver ${driver.gaiola} (${driver.name})`);
        return { ...driver, status: "noshow" as Driver['status'] };
      } else if (specialStatus === "reverter_noshow") {
        console.log(`DriverPanel: Aplicando REVERSÃO NOSHOW ao driver ${driver.gaiola} (${driver.name})`);
        
        // Manter o status de reversão visível, NÃO limpar localStorage
        return { ...driver, status: "reverter_noshow" as Driver['status'] };
      }
      
      // Se não há status especial, manter o status original
      return driver;
    });
  }, [getDriverSpecialStatus]);

  // Função para normalizar dados dos motoristas
  const normalizeDriversData = useCallback((driversArray: any[]): Driver[] => {
    const normalized = driversArray.map(driver => {
      // Usar a função utilitária para preservar o tipo de veículo
      const driverWithType = preservarTipoVeiculo(driver);
      
      const result = {
        id: driverWithType.id || `driver_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: driverWithType.name || driverWithType.motorista || "Sem nome",
        shift: driverWithType.shift || driverWithType.turno || CONSTANTS.DEFAULT_SHIFT,
        gaiola: driverWithType.gaiola || "",
        vaga: driverWithType.vaga || "",
        status: driverWithType.status || "esperar_fora_hub",
        hub: driverWithType.hub || CONSTANTS.HUB_NAME,
        chegadaEm: driverWithType.chegadaEm,
        rota: driverWithType.rota,
        tipoVeiculo: driverWithType.tipoVeiculo // Garantir que o tipo de veículo seja preservado
      };
      
      console.log(`🚗 DriverPanel.normalizeDriversData: Normalizando driver ${result.gaiola} com tipo de veículo: "${result.tipoVeiculo || 'não definido'}"`);
      return result;
    });
    
    // Aplicar status especiais (NOSHOW, etc.)
    return applySpecialStatus(normalized);
  }, [applySpecialStatus]);

  // Carregar dados iniciais
  useEffect(() => {
    const loadData = async () => {
      console.log('DriverPanel: Carregamento inicial...');
      reloadDriversWithSpecialStatus();
    };
    
    loadData();
  }, [reloadDriversWithSpecialStatus]);

  // Listener para atualizações automáticas
  useEffect(() => {
    const checkForUpdates = () => {
      const forceUpdate = localStorage.getItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE);
      if (forceUpdate) {
        localStorage.removeItem(CONSTANTS.STORAGE_KEYS.FORCE_UPDATE);
        loadDriversData();
      }
    };
    
    const interval = setInterval(checkForUpdates, CONSTANTS.UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [loadDriversData]);

  // Sincronização para mudanças de status especiais (NOSHOW, etc.)
  useEffect(() => {
    const checkSpecialStatusChanges = () => {
      // Verificar trigger de NOSHOW
      const noshowTrigger = localStorage.getItem('noshow_update_trigger');
      if (noshowTrigger) {
        console.log('DriverPanel: Detectado trigger de NOSHOW, recarregando dados...');
        localStorage.removeItem('noshow_update_trigger');
        
        // Recarregar dados para pegar as mudanças de status
        reloadDriversWithSpecialStatus();
        return; // Sair cedo se encontrou trigger
      }
      
      // Verificar trigger de reversão NOSHOW
      const reverterTrigger = localStorage.getItem('reverter_noshow_update_trigger');
      if (reverterTrigger) {
        console.log('DriverPanel: Detectado trigger de REVERSÃO NOSHOW, recarregando dados...');
        localStorage.removeItem('reverter_noshow_update_trigger');
        
        // Recarregar dados para pegar as mudanças de status
        reloadDriversWithSpecialStatus();
        return; // Sair cedo se encontrou trigger
      }
      
      // Verificar mudanças diretas nos status especiais apenas se temos drivers
      if (drivers.length > 0) {
        let hasChanges = false;
        
        const updatedDrivers = drivers.map(driver => {
          const specialStatus = getDriverSpecialStatus(driver.gaiola);
          let expectedStatus = driver.status;
          
          if (specialStatus === "noshow") {
            expectedStatus = "noshow";
          } else if (specialStatus === "reverter_noshow") {
            expectedStatus = "reverter_noshow";
          } else if (specialStatus === null && (driver.status === "noshow" || driver.status === "reverter_noshow")) {
            // Se não há status especial mas driver ainda está como noshow/reverter, normalizar
            expectedStatus = "esperar_fora_hub";
          }
          
          if (driver.status !== expectedStatus) {
            hasChanges = true;
            return { ...driver, status: expectedStatus as Driver['status'] };
          }
          return driver;
        });
        
        if (hasChanges) {
          console.log('DriverPanel: Detectadas mudanças nos status especiais, atualizando...');
          setDrivers(updatedDrivers);
        }
      }
    };
    
    // Verificar a cada 200ms
    const interval = setInterval(checkSpecialStatusChanges, 200);
    return () => clearInterval(interval);
  }, [drivers, reloadDriversWithSpecialStatus, getDriverSpecialStatus]);

  // Listener para eventos de atualização de status NOSHOW
  useEffect(() => {
    const handleDriverStatusUpdated = () => {
      console.log('DriverPanel: Evento driverStatusUpdated recebido, recarregando...');
      reloadDriversWithSpecialStatus();
    };

    window.addEventListener('driverStatusUpdated', handleDriverStatusUpdated);
    
    return () => {
      window.removeEventListener('driverStatusUpdated', handleDriverStatusUpdated);
    };
  }, [reloadDriversWithSpecialStatus]);

  // Listener para atualizações de status de motorista em tempo real
  useEffect(() => {
    const handleDriverStatusUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { gaiola, motorista, status, timestamp } = customEvent.detail;
      
      console.log('DriverPanel: Recebido evento de atualização de status:', { gaiola, motorista, status, timestamp });
      
      // Recarregar dados para refletir as mudanças
      loadDriversData();
      
      // Feedback visual opcional
      toast({
        title: "Status Atualizado",
        description: `Motorista da gaiola ${gaiola} foi marcado como ${status}`,
        duration: 2000
      });
    };

    window.addEventListener('driver_status_updated', handleDriverStatusUpdate);
    
    return () => {
      window.removeEventListener('driver_status_updated', handleDriverStatusUpdate);
    };
  }, [loadDriversData, toast]);

  // Filtrar motoristas - MEMOIZADO
  useEffect(() => {
    if (!Array.isArray(drivers)) {
      setFilteredDrivers([]);
      return;
    }

    let filtered = [...drivers];

    // Aplicar filtros
    if (searchTerm.trim()) {
      filtered = filtered.filter(driver => 
        driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        driver.gaiola.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (shiftFilter !== "Todos") {
      filtered = filtered.filter(driver => driver.shift === shiftFilter);
    }

    if (statusFilter !== "Todos") {
      filtered = filtered.filter(driver => driver.status === statusFilter);
    }

    // Ordenar por gaiola (A-1, A-2, B-1, B-2, etc)
    filtered.sort((a, b) => {
      const [aLetra, aNumStr] = a.gaiola.split('-');
      const [bLetra, bNumStr] = b.gaiola.split('-');
      
      if (aLetra !== bLetra) return aLetra.localeCompare(bLetra);
      
      const aNum = parseInt(aNumStr) || 0;
      const bNum = parseInt(bNumStr) || 0;
      return aNum - bNum;
    });

    setFilteredDrivers(filtered);
  }, [drivers, searchTerm, shiftFilter, statusFilter]);

  // Função para fazer login do GR
  const handleGRLogin = useCallback(() => {
    if (grPassword === CONSTANTS.GR_PASSWORD) {
      setIsGRLoggedIn(true);
      setShowGRPanel(true);
      setIsLoginOpen(false);
      localStorage.setItem(CONSTANTS.STORAGE_KEYS.USER_TYPE, "gr");
      
      toast({
        title: "Login realizado",
        description: "Bem-vindo GR! Agora você pode marcar chegadas.",
      });
    } else {
      toast({
        title: "Erro no login",
        description: "Senha incorreta.",
        variant: "destructive",
      });
    }
    setGrPassword("");
  }, [grPassword, toast]);

  // Função para fazer logout do GR
  const handleGRLogout = useCallback(() => {
    setIsGRLoggedIn(false);
    setShowGRPanel(false);
    localStorage.removeItem(CONSTANTS.STORAGE_KEYS.USER_TYPE);
    
    toast({
      title: "Logout realizado",
      description: "Você foi deslogado do painel GR.",
    });
  }, [toast]);

  // Função para marcar/desmarcar chegada do motorista
  const handleDriverCheck = useCallback((driverId: string) => {
    const updatedDrivers = drivers.map(driver => {
      if (driver.id === driverId) {
        const newStatus = driver.status === "chegou" ? "esperar_fora_hub" : "chegou";
        
        // Verificar e preservar explicitamente o tipoVeiculo
        const tipoVeiculo = driver.tipoVeiculo;
        console.log(`🚗 Preservando tipo de veículo para ${driver.gaiola}: "${tipoVeiculo || 'não definido'}"`);
        
        return {
          ...driver,
          status: newStatus as Driver['status'],
          vaga: newStatus === "esperar_fora_hub" ? "" : driver.vaga,
          chegadaEm: newStatus === "chegou" ? new Date().toISOString() : undefined,
          tipoVeiculo // Preservar explicitamente o tipo de veículo
        };
      }
      return driver;
    });
    
    setDrivers(updatedDrivers);
    
    // Salvar em todos os formatos para compatibilidade
    saveDriversData(updatedDrivers);
    
    // Feedback para o usuário
    const currentDriver = updatedDrivers.find(d => d.id === driverId);
    if (currentDriver) {
      const isArriving = currentDriver.status === "chegou";
      toast({
        title: isArriving ? "✅ Motorista Chegou" : "❌ Motorista Removido",
        description: isArriving 
          ? `A gaiola ${currentDriver.gaiola} agora está disponível para chamada.`
          : `A gaiola ${currentDriver.gaiola} não está mais disponível para chamada.`,
        variant: isArriving ? "default" : "destructive",
      });
    }
  }, [drivers, toast]);

  // Função para salvar dados dos motoristas
  const saveDriversData = useCallback((updatedDrivers: Driver[]) => {
    try {
      // Garantir que todos os drivers tenham o tipo de veículo preservado
      const driversWithType = updatedDrivers.map(driver => preservarTipoVeiculo(driver));
      
      // Salvar como array
      localStorage.setItem(CONSTANTS.STORAGE_KEYS.DRIVERS_DATA, JSON.stringify(driversWithType));
      
      // Salvar como objeto para compatibilidade
      const driverObj = driversWithType.reduce((acc, driver) => {
        acc[driver.id] = {
          ...driver,
          lastUpdate: new Date().toISOString(),
          driverCheck: driver.status === "chegou",
          motorista: driver.name // Para compatibilidade com useDriverData.ts
        };
        
        // Log para depuração
        console.log(`🚗 saveDriversData: Salvando driver ${driver.gaiola} com tipo de veículo: "${driver.tipoVeiculo || 'não definido'}"`);
        
        return acc;
      }, {} as Record<string, any>);
      
      localStorage.setItem(CONSTANTS.STORAGE_KEYS.DRIVERS_DATA_OBJ, JSON.stringify(driverObj));
      
    } catch (error) {
      console.error('Erro ao salvar dados dos motoristas:', error);
    }
  }, []);

  // Função para atualizar dados manualmente
  const handleRefresh = useCallback(() => {
    loadDriversData();
    toast({
      title: "Dados atualizados",
      description: "Lista de motoristas recarregada com sucesso.",
    });
  }, [loadDriversData, toast]);

  // Calcular estatísticas - MEMOIZADO
  const stats = useMemo((): DriverStats => {
    if (!Array.isArray(drivers)) {
      return {
        total: 0,
        esperandoFora: 0,
        entrarHub: 0,
        atrasados: 0,
        chegaram: 0,
        noshow: 0,
        reverterNoshow: 0
      };
    }
    
    return {
      total: drivers.length,
      esperandoFora: drivers.filter(d => d.status === "esperar_fora_hub").length,
      entrarHub: drivers.filter(d => d.status === "entrar_hub").length,
      atrasados: drivers.filter(d => d.status === "atrasado").length,
      chegaram: drivers.filter(d => d.status === "chegou").length,
      noshow: drivers.filter(d => d.status === "noshow").length,
      reverterNoshow: drivers.filter(d => d.status === "reverter_noshow").length
    };
  }, [drivers]);

  // Função para obter cor do status
  const getStatusColor = useCallback((status: Driver['status']) => {
    return CONSTANTS.STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
  }, []);

  // Função para obter texto do status
  const getStatusText = useCallback((status: Driver['status']) => {
    switch (status) {
      case "esperar_fora_hub": return "NÃO CHEGOU";
      case "entrar_hub": return "ENTRAR NO HUB";
      case "chegou": return "CHEGOU";
      case "atrasado": return "ATRASADO";
      case "noshow": return "NOSHOW";
      case "reverter_noshow": return "REVERSÃO NOSHOW";
      default: return "STATUS DESCONHECIDO";
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border shadow-sm bg-white">
          <CardHeader className="bg-blue-700 text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-3xl font-bold text-white">
                  {isGRLoggedIn && showGRPanel 
                    ? "Painel do GR - Marcar Chegadas" 
                    : "Sistema de Controle de Motoristas"
                  }
                </CardTitle>
                <p className="text-blue-100 mt-1">
                  {CONSTANTS.HUB_NAME}
                </p>
              </div>
              <div className="flex gap-2">
                {isGRLoggedIn && (
                  <Button 
                    onClick={() => setShowGRPanel(!showGRPanel)}
                    className={showGRPanel ? "bg-blue-800 text-white" : "bg-green-600 text-white"}
                  >
                    {showGRPanel ? "Ver Lista de Motoristas" : "Marcar Chegadas"}
                  </Button>
                )}
                <Button 
                  onClick={handleRefresh}
                  variant="outline"
                  className="text-white border-white hover:bg-white hover:text-blue-700"
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                <Button 
                  onClick={() => navigate(-1)} 
                  variant="outline" 
                  className="text-white border-white hover:bg-white hover:text-blue-700"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                
                {!isGRLoggedIn ? (
                  <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-blue-800 hover:bg-blue-900 text-white">
                        Login GR
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Login GR</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="password">Senha</Label>
                          <Input
                            id="password"
                            type="password"
                            value={grPassword}
                            onChange={(e) => setGrPassword(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleGRLogin()}
                            placeholder="Digite a senha do GR"
                          />
                        </div>
                        <Button onClick={handleGRLogin} className="w-full">
                          Entrar
                        </Button>
                        <p className="text-sm text-slate-600 text-center">
                          Senha: {CONSTANTS.GR_PASSWORD}
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-600 text-white">GR Logado</Badge>
                    <Button 
                      onClick={handleGRLogout}
                      variant="outline"
                      size="sm"
                      className="text-white border-white hover:bg-white hover:text-blue-700"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Card className="border shadow-sm bg-white">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-slate-800">{stats.total}</div>
              <div className="text-sm text-slate-600 mt-1">Total</div>
            </CardContent>
          </Card>
          
          <Card className="border shadow-sm bg-red-50">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-red-600">{stats.esperandoFora}</div>
              <div className="text-sm text-slate-600 mt-1">Não Chegou</div>
            </CardContent>
          </Card>
          
          <Card className="border shadow-sm bg-blue-50">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.entrarHub}</div>
              <div className="text-sm text-slate-600 mt-1">Entrar no Hub</div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-red-50">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-red-600">{stats.atrasados}</div>
              <div className="text-sm text-slate-600 mt-1">Atrasados</div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-green-50">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-green-600">{stats.chegaram}</div>
              <div className="text-sm text-slate-600 mt-1">Chegaram</div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-gray-900">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-white">{stats.noshow}</div>
              <div className="text-sm text-gray-300 mt-1">NoShow</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters - somente se não estiver no painel GR */}
        {(!isGRLoggedIn || !showGRPanel) && (
          <Card className="border shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por nome ou gaiola..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={shiftFilter} onValueChange={setShiftFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por turno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos os turnos</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                    <SelectItem value="SD">SD</SelectItem>
                    <SelectItem value="AM">AM</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos os status</SelectItem>
                    <SelectItem value="esperar_fora_hub">Não Chegou</SelectItem>
                    <SelectItem value="entrar_hub">Entrar no Hub</SelectItem>
                    <SelectItem value="chegou">Chegaram</SelectItem>
                    <SelectItem value="atrasado">Atrasados</SelectItem>
                    <SelectItem value="noshow">NoShow</SelectItem>
                    <SelectItem value="reverter_noshow">Reversão NoShow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Motoristas ou Painel GR */}
        {!isGRLoggedIn || !showGRPanel ? (
          <Card className="border shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Lista de Motoristas
                <Badge variant="outline">{filteredDrivers.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Turno</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Gaiola</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Vaga</TableHead>
                      <TableHead>Chegada</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDrivers.map((driver) => (
                      <TableRow key={driver.id}>
                        <TableCell>
                          <Badge variant="outline">{driver.shift}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {driver.name}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-blue-100 text-blue-800">
                            {driver.gaiola}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(driver.status)}>
                            {getStatusText(driver.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {driver.vaga && (
                            <Badge className="bg-purple-100 text-purple-800">
                              Vaga {driver.vaga}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {driver.chegadaEm ? (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(driver.chegadaEm).toLocaleTimeString('pt-BR')}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isGRLoggedIn && (
                            <Button
                              onClick={() => handleDriverCheck(driver.id)}
                              size="sm"
                              variant={driver.status === "chegou" ? "destructive" : "default"}
                            >
                              {driver.status === "chegou" ? (
                                <>
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Remover
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Chegou
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Painel do GR para marcar chegadas */
          <Card className="border shadow-sm bg-white">
            <CardHeader className="bg-green-700">
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <Truck className="h-6 w-6" />
                Marcar Chegada dos Motoristas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {filteredDrivers
                  .filter(driver => driver.status === "esperar_fora_hub")
                  .map((driver) => (
                    <Card key={driver.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Badge className="text-lg font-bold bg-blue-100 text-blue-800">
                            {driver.shift}
                          </Badge>
                          <div className="text-lg font-semibold">
                            {driver.name.toUpperCase()}
                          </div>
                          <Badge className="text-lg font-bold bg-slate-100 text-slate-800">
                            Gaiola {driver.gaiola}
                          </Badge>
                        </div>
                        <Button
                          onClick={() => handleDriverCheck(driver.id)}
                          size="lg"
                          className="bg-green-600 hover:bg-green-700 text-white min-w-[200px]"
                        >
                          <CheckCircle className="h-5 w-5 mr-2" />
                          Marcar Chegada
                        </Button>
                      </div>
                    </Card>
                  ))}
                {filteredDrivers.filter(driver => driver.status === "esperar_fora_hub").length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Todos os motoristas já chegaram ou estão em outras situações</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DriverPanel;
