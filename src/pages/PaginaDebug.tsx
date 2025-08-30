/**
 * 🐛 Página de Debug e Análise de Erros
 * 
 * Interface administrativa para visualizar, analisar e gerenciar
 * todos os erros registrados no sistema.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, Download, Trash2, RefreshCw, Search, 
  AlertTriangle, Bug, Info, AlertCircle, Filter,
  Calendar, User, Globe, Smartphone, Clock
} from 'lucide-react';
import { logger } from '@/utils/sistemaLogs';
import { useErrorLogger } from '@/hooks/useErrorLogger';

interface ErrorEntry {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  message: string;
  component: string;
  details?: any;
  stack?: string;
  userId?: string;
  errorId?: string;
  url?: string;
  userAgent?: string;
}

export const PaginaDebug: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { exportErrors, clearErrorLogs } = useErrorLogger('PaginaDebug');
  
  const [systemLogs, setSystemLogs] = useState<ErrorEntry[]>([]);
  const [boundaryErrors, setBoundaryErrors] = useState<any[]>([]);
  const [criticalErrors, setCriticalErrors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [componentFilter, setComponentFilter] = useState<string>('all');
  const [selectedError, setSelectedError] = useState<ErrorEntry | null>(null);

  // Carregar dados de erro
  useEffect(() => {
    loadErrorData();
  }, []);

  const loadErrorData = () => {
    try {
      // Logs do sistema
      const logs = logger.getLogs();
      setSystemLogs(logs);

      // Erros de boundary
      const boundary = JSON.parse(localStorage.getItem('boundary-errors') || '[]');
      setBoundaryErrors(boundary);

      // Erros críticos
      const critical = JSON.parse(localStorage.getItem('critical-errors') || '[]');
      setCriticalErrors(critical);

    } catch (error) {
      console.error('Erro ao carregar dados de debug:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os logs de erro."
      });
    }
  };

  // Filtros e busca
  const filteredLogs = useMemo(() => {
    return systemLogs.filter(log => {
      const matchesSearch = searchTerm === '' || 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.component.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
      
      const matchesComponent = componentFilter === 'all' || log.component === componentFilter;
      
      return matchesSearch && matchesLevel && matchesComponent;
    });
  }, [systemLogs, searchTerm, levelFilter, componentFilter]);

  // Componentes únicos para filtro
  const uniqueComponents = useMemo(() => {
    const components = [...new Set(systemLogs.map(log => log.component))];
    return components.sort();
  }, [systemLogs]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = systemLogs.length;
    const errors = systemLogs.filter(log => log.level === 'ERROR').length;
    const warnings = systemLogs.filter(log => log.level === 'WARN').length;
    const lastError = systemLogs
      .filter(log => log.level === 'ERROR')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    return {
      total,
      errors,
      warnings,
      boundaryErrors: boundaryErrors.length,
      criticalErrors: criticalErrors.length,
      lastError: lastError?.timestamp
    };
  }, [systemLogs, boundaryErrors, criticalErrors]);

  const handleClearLogs = () => {
    if (window.confirm('⚠️ Tem certeza que deseja limpar todos os logs? Esta ação não pode ser desfeita.')) {
      clearErrorLogs();
      localStorage.removeItem('boundary-errors');
      localStorage.removeItem('critical-errors');
      loadErrorData();
      
      toast({
        title: "🧹 Logs Limpos",
        description: "Todos os logs de erro foram removidos."
      });
    }
  };

  const handleExportLogs = () => {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        stats,
        systemLogs,
        boundaryErrors,
        criticalErrors,
        environment: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString()
        }
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug-report-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "📊 Relatório Exportado",
        description: "Relatório completo de debug baixado."
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'WARN': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'INFO': return <Info className="w-4 h-4 text-blue-500" />;
      default: return <Bug className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    const variants = {
      'ERROR': 'destructive',
      'WARN': 'secondary',
      'INFO': 'default',
      'DEBUG': 'outline'
    } as const;
    
    return (
      <Badge variant={variants[level as keyof typeof variants] || 'outline'}>
        {level}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🐛 Painel de Debug</h1>
              <p className="text-gray-600">Análise e gerenciamento de erros do sistema</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={loadErrorData}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
            <Button 
              variant="outline" 
              onClick={handleExportLogs}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleClearLogs}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Limpar
            </Button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Bug className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total de Logs</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Erros</p>
                  <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avisos</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.warnings}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Bug className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Boundary Errors</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.boundaryErrors}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Críticos</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.criticalErrors}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros e Busca
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar mensagem ou componente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <select 
                value={levelFilter} 
                onChange={(e) => setLevelFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                <option value="all">Todos os níveis</option>
                <option value="ERROR">Apenas Erros</option>
                <option value="WARN">Apenas Avisos</option>
                <option value="INFO">Apenas Info</option>
                <option value="DEBUG">Apenas Debug</option>
              </select>
              
              <select 
                value={componentFilter} 
                onChange={(e) => setComponentFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                <option value="all">Todos os componentes</option>
                {uniqueComponents.map(component => (
                  <option key={component} value={component}>{component}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs de conteúdo */}
        <Tabs defaultValue="system" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="system">Logs do Sistema</TabsTrigger>
            <TabsTrigger value="boundary">Error Boundaries</TabsTrigger>
            <TabsTrigger value="critical">Erros Críticos</TabsTrigger>
            <TabsTrigger value="analysis">Análise</TabsTrigger>
          </TabsList>

          {/* Logs do Sistema */}
          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>📋 Logs do Sistema ({filteredLogs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredLogs.map((log, index) => (
                    <div 
                      key={index} 
                      className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedError(log)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {getLevelIcon(log.level)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {getLevelBadge(log.level)}
                              <span className="text-sm font-medium">{log.component}</span>
                              <span className="text-xs text-gray-500">
                                {formatTimestamp(log.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{log.message}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {filteredLogs.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      📭 Nenhum log encontrado com os filtros aplicados
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Error Boundaries */}
          <TabsContent value="boundary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>🛡️ Erros de Error Boundary ({boundaryErrors.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {boundaryErrors.length > 0 ? (
                  <div className="space-y-3">
                    {boundaryErrors.map((error, index) => (
                      <div key={index} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-red-800">
                            {error.message || 'Erro não especificado'}
                          </h4>
                          <span className="text-xs text-red-600">
                            {formatTimestamp(error.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-red-700 mb-2">ID: {error.errorId}</p>
                        <p className="text-sm text-red-600">URL: {error.url}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    ✅ Nenhum erro de boundary registrado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Erros Críticos */}
          <TabsContent value="critical" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>🚨 Erros Críticos ({criticalErrors.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {criticalErrors.length > 0 ? (
                  <div className="space-y-3">
                    {criticalErrors.map((error, index) => (
                      <div key={index} className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-orange-800">
                            {error.message || 'Erro crítico'}
                          </h4>
                          <span className="text-xs text-orange-600">
                            {formatTimestamp(error.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-orange-700">Componente: {error.component}</p>
                        <p className="text-sm text-orange-600">Usuário: {error.userId || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    ✅ Nenhum erro crítico registrado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Análise */}
          <TabsContent value="analysis" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>📊 Componentes com Mais Erros</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Implementar análise de componentes */}
                  <div className="text-center py-4 text-gray-500">
                    📈 Análise em desenvolvimento
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>⏰ Erros por Horário</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Implementar análise temporal */}
                  <div className="text-center py-4 text-gray-500">
                    🕒 Análise temporal em desenvolvimento
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal de detalhes do erro */}
        {selectedError && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>🔍 Detalhes do Erro</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedError(null)}
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Nível:</label>
                    <div className="mt-1">{getLevelBadge(selectedError.level)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Componente:</label>
                    <p className="mt-1 text-sm">{selectedError.component}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-600">Timestamp:</label>
                    <p className="mt-1 text-sm">{formatTimestamp(selectedError.timestamp)}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-600">Mensagem:</label>
                    <p className="mt-1 text-sm bg-gray-100 p-2 rounded">{selectedError.message}</p>
                  </div>
                  {selectedError.details && (
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-600">Detalhes:</label>
                      <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                        {JSON.stringify(selectedError.details, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedError.stack && (
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-600">Stack Trace:</label>
                      <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                        {selectedError.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaginaDebug;
