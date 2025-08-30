// SupabaseIntegration.tsx - Componente exemplo para integração com Supabase
// Demonstra como usar o Supabase Client e hooks customizados

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Database, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Plus, 
  Save,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react';

// Hooks customizados
import { useSupabase, useSupabaseTable } from '@/hooks/useSupabase';

// Interfaces para dados de exemplo
interface VagaLog {
  id?: string;
  vaga_id: string;
  motorista_gaiola: string;
  acao: 'chamado' | 'chegada' | 'finalizado';
  timestamp: string;
  observacoes?: string;
  created_at?: string;
}

interface MotoristaStatus {
  id?: string;
  gaiola: string;
  nome: string;
  status: 'esperar_fora_hub' | 'entrar_hub' | 'chegou' | 'atrasado';
  vaga_atual?: string;
  updated_at?: string;
}

const SupabaseIntegration: React.FC = () => {
  // Estados locais
  const [newLog, setNewLog] = useState<Partial<VagaLog>>({
    vaga_id: '',
    motorista_gaiola: '',
    acao: 'chamado',
    observacoes: ''
  });

  // Hooks do Supabase
  const { isConnected, isLoading: connectionLoading, error: connectionError, testConnection } = useSupabase();
  const { 
    data: logs, 
    isLoading: logsLoading, 
    error: logsError, 
    refetch: refetchLogs, 
    insert: insertLog 
  } = useSupabaseTable<VagaLog>('vaga_logs');

  // Função para adicionar novo log
  const handleAddLog = async () => {
    if (!newLog.vaga_id || !newLog.motorista_gaiola) return;

    const success = await insertLog({
      ...newLog,
      timestamp: new Date().toISOString()
    });

    if (success) {
      setNewLog({
        vaga_id: '',
        motorista_gaiola: '',
        acao: 'chamado',
        observacoes: ''
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Integração Supabase
        </h1>
        <p className="text-gray-600">
          Exemplo de integração com banco de dados real-time
        </p>
      </div>

      {/* Status da Conexão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Status da Conexão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <>
                  <Wifi className="h-5 w-5 text-green-600" />
                  <Badge className="bg-green-100 text-green-800">
                    Conectado
                  </Badge>
                </>
              ) : (
                <>
                  <WifiOff className="h-5 w-5 text-red-600" />
                  <Badge className="bg-red-100 text-red-800">
                    Desconectado
                  </Badge>
                </>
              )}
              
              {connectionLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              )}
            </div>

            <Button 
              onClick={testConnection}
              variant="outline"
              disabled={connectionLoading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Testar Conexão
            </Button>
          </div>

          {connectionError && (
            <Alert className="mt-4 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {connectionError.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Configuração */}
      <Card>
        <CardHeader>
          <CardTitle>⚙️ Como Configurar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>1. Configure as variáveis de ambiente:</strong>
              <br />
              Adicione as seguintes variáveis no arquivo <code>.env</code>:
            </AlertDescription>
          </Alert>

          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
            <div>VITE_SUPABASE_URL=https://your-project.supabase.co</div>
            <div>VITE_SUPABASE_ANON_KEY=your_anon_key_here</div>
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>2. Crie as tabelas no Supabase:</strong>
              <br />
              Execute os SQLs abaixo no editor SQL do Supabase:
            </AlertDescription>
          </Alert>

          <div className="bg-gray-900 text-blue-300 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <pre>{`-- Tabela para logs de vagas
CREATE TABLE vaga_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vaga_id TEXT NOT NULL,
  motorista_gaiola TEXT NOT NULL,
  acao TEXT CHECK (acao IN ('chamado', 'chegada', 'finalizado')),
  timestamp TIMESTAMPTZ NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para status dos motoristas
CREATE TABLE motorista_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gaiola TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  status TEXT CHECK (status IN ('esperar_fora_hub', 'entrar_hub', 'chegou', 'atrasado')),
  vaga_atual TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Formulário para Adicionar Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Adicionar Log de Vaga
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Vaga ID</Label>
              <Input
                value={newLog.vaga_id || ''}
                onChange={(e) => setNewLog(prev => ({ ...prev, vaga_id: e.target.value }))}
                placeholder="Ex: 01"
              />
            </div>
            
            <div>
              <Label>Gaiola do Motorista</Label>
              <Input
                value={newLog.motorista_gaiola || ''}
                onChange={(e) => setNewLog(prev => ({ ...prev, motorista_gaiola: e.target.value }))}
                placeholder="Ex: A-1"
              />
            </div>

            <div>
              <Label>Ação</Label>
              <select
                className="w-full p-2 border rounded-md"
                value={newLog.acao || 'chamado'}
                onChange={(e) => setNewLog(prev => ({ ...prev, acao: e.target.value as any }))}
              >
                <option value="chamado">Chamado</option>
                <option value="chegada">Chegada</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Observações (opcional)</Label>
            <Textarea
              value={newLog.observacoes || ''}
              onChange={(e) => setNewLog(prev => ({ ...prev, observacoes: e.target.value }))}
              placeholder="Observações sobre a operação..."
            />
          </div>

          <Button 
            onClick={handleAddLog}
            disabled={!isConnected || !newLog.vaga_id || !newLog.motorista_gaiola}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar Log
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>📋 Logs Recentes</span>
            <Button 
              onClick={refetchLogs}
              variant="outline"
              size="sm"
              disabled={logsLoading}
            >
              <RefreshCw className={`h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsError && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Erro ao carregar logs: {logsError.message}
              </AlertDescription>
            </Alert>
          )}

          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Carregando logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhum log encontrado. Adicione o primeiro!
            </div>
          ) : (
            <div className="space-y-3">
              {logs.slice(0, 10).map((log) => (
                <div key={log.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">
                        Vaga {log.vaga_id} - Gaiola {log.motorista_gaiola}
                      </div>
                      <div className="text-sm text-gray-600">
                        {log.observacoes && `Obs: ${log.observacoes}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        className={
                          log.acao === 'chamado' ? 'bg-blue-100 text-blue-800' :
                          log.acao === 'chegada' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }
                      >
                        {log.acao}
                      </Badge>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SupabaseIntegration;
