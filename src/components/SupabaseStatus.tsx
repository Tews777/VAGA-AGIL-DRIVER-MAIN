// SupabaseStatus.tsx - Componente para exibir status da integração Supabase
// Mostra conectividade, sincronização e estatísticas

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Cloud, CloudOff, Wifi, WifiOff, 
  Database, Zap, RefreshCw, CheckCircle, 
  XCircle, AlertTriangle, Activity,
  Users, FileText, Clock, TrendingUp
} from 'lucide-react';

interface SupabaseStatusProps {
  className?: string;
  showDetails?: boolean;
}

interface ConnectionStats {
  isConnected: boolean;
  responseTime: number;
  lastSync: string;
  totalUsers: number;
  totalVagas: number;
  activeConnections: number;
  realtimeStatus: 'connected' | 'connecting' | 'disconnected';
}

const SupabaseStatus: React.FC<SupabaseStatusProps> = ({ 
  className = "", 
  showDetails = false 
}) => {
  const { toast } = useToast();
  const [stats, setStats] = useState<ConnectionStats>({
    isConnected: false,
    responseTime: 0,
    lastSync: 'Nunca',
    totalUsers: 0,
    totalVagas: 0,
    activeConnections: 0,
    realtimeStatus: 'disconnected'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Testar conectividade
  const testConnection = async () => {
    if (!isSupabaseConfigured()) {
      setStats(prev => ({ 
        ...prev, 
        isConnected: false, 
        realtimeStatus: 'disconnected' 
      }));
      return;
    }

    setIsLoading(true);
    const startTime = Date.now();

    try {
      // Teste de conexão básica
      const { data, error } = await supabase
        .from('vagas')
        .select('id')
        .limit(1);

      const responseTime = Date.now() - startTime;

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Buscar estatísticas
      const [usersResult, vagasResult] = await Promise.allSettled([
        supabase.from('usuarios').select('id', { count: 'exact', head: true }),
        supabase.from('vagas').select('id', { count: 'exact', head: true })
      ]);

      const totalUsers = usersResult.status === 'fulfilled' && usersResult.value.count 
        ? usersResult.value.count : 0;
      const totalVagas = vagasResult.status === 'fulfilled' && vagasResult.value.count 
        ? vagasResult.value.count : 0;

      setStats(prev => ({
        ...prev,
        isConnected: true,
        responseTime,
        lastSync: new Date().toLocaleTimeString('pt-BR'),
        totalUsers,
        totalVagas,
        realtimeStatus: 'connected'
      }));

      setLastUpdate(new Date());

    } catch (error: any) {
      console.error('Erro ao testar conexão:', error);
      setStats(prev => ({
        ...prev,
        isConnected: false,
        responseTime: Date.now() - startTime,
        realtimeStatus: 'disconnected'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Atualização automática
  useEffect(() => {
    testConnection();
    
    const interval = setInterval(() => {
      testConnection();
    }, 30000); // Testar a cada 30 segundos

    return () => clearInterval(interval);
  }, []);

  // Status visual
  const getStatusColor = () => {
    if (!isSupabaseConfigured()) return 'bg-gray-500';
    if (stats.isConnected) return 'bg-green-500';
    if (isLoading) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (!isSupabaseConfigured()) return 'Não Configurado';
    if (isLoading) return 'Testando...';
    if (stats.isConnected) return 'Conectado';
    return 'Desconectado';
  };

  const getStatusIcon = () => {
    if (!isSupabaseConfigured()) return <Database className="h-4 w-4" />;
    if (isLoading) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (stats.isConnected) return <CheckCircle className="h-4 w-4" />;
    return <XCircle className="h-4 w-4" />;
  };

  if (!showDetails) {
    // Versão compacta
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-sm text-slate-600">
          Supabase: {getStatusText()}
        </span>
        {stats.isConnected && stats.responseTime > 0 && (
          <span className="text-xs text-slate-500">
            ({stats.responseTime}ms)
          </span>
        )}
      </div>
    );
  }

  // Versão detalhada
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Database className="h-5 w-5" />
          Status Supabase
          <Badge 
            variant={stats.isConnected ? "default" : "destructive"}
            className="ml-auto"
          >
            {getStatusIcon()}
            {getStatusText()}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Informações de Conexão */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Wifi className="h-4 w-4" />
              <span className="font-medium">Configuração:</span>
            </div>
            <p className="text-sm text-slate-600">
              {isSupabaseConfigured() ? (
                <span className="text-green-600">✅ Configurado</span>
              ) : (
                <span className="text-red-600">❌ Não configurado</span>
              )}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" />
              <span className="font-medium">Tempo de Resposta:</span>
            </div>
            <p className="text-sm text-slate-600">
              {stats.responseTime > 0 ? (
                <span className={stats.responseTime < 1000 ? 'text-green-600' : 'text-yellow-600'}>
                  {stats.responseTime}ms
                </span>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span className="font-medium">Última Sync:</span>
            </div>
            <p className="text-sm text-slate-600">{stats.lastSync}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4" />
              <span className="font-medium">Real-time:</span>
            </div>
            <p className="text-sm">
              {stats.realtimeStatus === 'connected' ? (
                <span className="text-green-600">🔴 Ativo</span>
              ) : stats.realtimeStatus === 'connecting' ? (
                <span className="text-yellow-600">🟡 Conectando</span>
              ) : (
                <span className="text-red-600">⚫ Inativo</span>
              )}
            </p>
          </div>
        </div>

        {/* Estatísticas */}
        {stats.isConnected && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Estatísticas
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Usuários: </span>
                <Badge variant="outline">{stats.totalUsers}</Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-500" />
                <span className="text-sm">Vagas: </span>
                <Badge variant="outline">{stats.totalVagas}</Badge>
              </div>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="border-t pt-4 flex gap-2">
          <Button
            onClick={testConnection}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="flex-1"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Testar Conexão
          </Button>
          
          {isSupabaseConfigured() && (
            <Button
              onClick={() => {
                const url = `https://supabase.com/dashboard/project/${import.meta.env.VITE_SUPABASE_URL?.split('.')[0]?.split('//')[1]}`;
                window.open(url, '_blank');
              }}
              size="sm"
              variant="outline"
            >
              <Database className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          )}
        </div>

        {/* URL e Versão */}
        {isSupabaseConfigured() && (
          <div className="border-t pt-4 text-xs text-slate-500 space-y-1">
            <div>
              <strong>URL:</strong> {import.meta.env.VITE_SUPABASE_URL}
            </div>
            <div>
              <strong>Última atualização:</strong> {lastUpdate.toLocaleString('pt-BR')}
            </div>
          </div>
        )}

        {/* Alertas */}
        {!isSupabaseConfigured() && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Supabase não configurado</p>
                <p>Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY</p>
              </div>
            </div>
          </div>
        )}

        {isSupabaseConfigured() && !stats.isConnected && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-medium">Falha na conexão</p>
                <p>Verifique as credenciais e conectividade de rede</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SupabaseStatus;
