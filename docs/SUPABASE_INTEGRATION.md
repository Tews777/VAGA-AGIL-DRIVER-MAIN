# 🚀 Guia de Integração Supabase

## 📋 Visão Geral

Este projeto agora inclui integração completa com Supabase para persistência de dados em tempo real. O sistema mantém a compatibilidade com localStorage como fallback.

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com:

```bash
# Configurações do Supabase
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Senhas existentes do sistema
VITE_GR_PASSWORD=GR2024
VITE_ADMIN_PASSWORD=vaga
VITE_VAGA_PASSWORD=123
VITE_APP_NAME="Vaga Ágil Driver"
VITE_APP_VERSION="1.0.0"
```

### 2. Configuração do Supabase

1. **Crie um projeto no Supabase**: https://supabase.com
2. **Encontre suas credenciais**: Dashboard → Settings → API
3. **Configure as tabelas** (SQLs abaixo)

#### Tabelas Necessárias

Execute os seguintes SQLs no editor SQL do Supabase:

```sql
-- Tabela para logs de operações de vagas
CREATE TABLE vaga_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vaga_id TEXT NOT NULL,
  motorista_gaiola TEXT NOT NULL,
  acao TEXT CHECK (acao IN ('chamado', 'chegada', 'finalizado')),
  timestamp TIMESTAMPTZ NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para status em tempo real dos motoristas
CREATE TABLE motorista_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gaiola TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  status TEXT CHECK (status IN ('esperar_fora_hub', 'entrar_hub', 'chegou', 'atrasado')),
  vaga_atual TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para backup de dados das vagas
CREATE TABLE vaga_backup (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vaga_id TEXT NOT NULL,
  data JSONB NOT NULL,
  backup_type TEXT DEFAULT 'auto',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_vaga_logs_vaga_id ON vaga_logs(vaga_id);
CREATE INDEX idx_vaga_logs_timestamp ON vaga_logs(timestamp DESC);
CREATE INDEX idx_motorista_status_gaiola ON motorista_status(gaiola);
CREATE INDEX idx_vaga_backup_vaga_id ON vaga_backup(vaga_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE vaga_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorista_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaga_backup ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (permitir tudo para anon por enquanto)
CREATE POLICY "Allow all for anon" ON vaga_logs FOR ALL TO anon USING (true);
CREATE POLICY "Allow all for anon" ON motorista_status FOR ALL TO anon USING (true);
CREATE POLICY "Allow all for anon" ON vaga_backup FOR ALL TO anon USING (true);
```

## 🔧 Como Usar

### 1. Cliente Supabase

```typescript
// Importar o cliente
import { supabase } from '@/lib/supabaseClient';

// Usar diretamente
const { data, error } = await supabase
  .from('vaga_logs')
  .select('*')
  .order('created_at', { ascending: false });
```

### 2. Hook useSupabase

```typescript
import { useSupabase } from '@/hooks/useSupabase';

function MyComponent() {
  const { isConnected, isLoading, error, testConnection } = useSupabase();
  
  return (
    <div>
      {isConnected ? '✅ Conectado' : '❌ Desconectado'}
      <button onClick={testConnection}>Testar</button>
    </div>
  );
}
```

### 3. Hook useSupabaseTable

```typescript
import { useSupabaseTable } from '@/hooks/useSupabase';

function LogsComponent() {
  const { data, isLoading, insert, update, delete: deleteRecord } = 
    useSupabaseTable('vaga_logs');
  
  const addLog = async () => {
    await insert({
      vaga_id: '01',
      motorista_gaiola: 'A-1',
      acao: 'chamado',
      timestamp: new Date().toISOString()
    });
  };
  
  return (
    <div>
      {data.map(log => <div key={log.id}>{log.vaga_id}</div>)}
      <button onClick={addLog}>Adicionar Log</button>
    </div>
  );
}
```

### 4. Real-time Updates

```typescript
import { useSupabaseRealtime } from '@/hooks/useSupabase';

function RealtimeComponent() {
  useSupabaseRealtime('vaga_logs', (payload) => {
    console.log('Mudança em tempo real:', payload);
    // Atualizar estado local
  });
  
  return <div>Dados em tempo real</div>;
}
```

## 🎮 URLs de Teste

### Página de Demonstração
- **URL**: http://localhost:8102/supabase
- **Funcionalidades**:
  - Teste de conexão
  - Formulário para adicionar logs
  - Visualização de dados em tempo real
  - Instruções de configuração

## 📁 Arquivos Criados

```
src/
├── lib/
│   └── supabaseClient.ts      # Cliente Supabase configurado
├── hooks/
│   └── useSupabase.ts         # Hooks customizados
├── components/
│   └── SupabaseIntegration.tsx # Componente de demonstração
└── App.tsx                    # Rota adicionada
```

## 🔄 Migração de localStorage para Supabase

### Estratégia Híbrida

O sistema funcionará em modo híbrido:

1. **Desenvolvimento**: localStorage (como está)
2. **Produção**: Supabase + localStorage como fallback
3. **Migração gradual**: Componente por componente

### Exemplo de Migração

```typescript
// Hook híbrido que usa Supabase se disponível, localStorage como fallback
export function useHybridStorage() {
  const { isConnected } = useSupabase();
  
  const saveData = async (key: string, data: any) => {
    if (isConnected) {
      // Salvar no Supabase
      await supabase.from('vaga_backup').insert({
        vaga_id: key,
        data: data
      });
    }
    
    // Sempre salvar no localStorage como backup
    localStorage.setItem(key, JSON.stringify(data));
  };
  
  return { saveData };
}
```

## 🚨 Troubleshooting

### Erro: "Supabase não configurado"
```bash
# Verifique as variáveis de ambiente
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# Reinicie o servidor de desenvolvimento
npm run dev
```

### Erro: "Table doesn't exist"
```sql
-- Execute os SQLs de criação de tabela novamente
-- Verifique se as tabelas foram criadas no schema 'public'
```

### Erro de CORS
```bash
# Configure as URLs permitidas no Supabase:
# Dashboard → Settings → API → URL Configuration
# Adicione: http://localhost:8102
```

## 🎯 Próximos Passos

1. **Configurar variáveis**: Adicionar credenciais no `.env`
2. **Criar tabelas**: Executar SQLs no Supabase
3. **Testar conexão**: Acessar `/supabase` para verificar
4. **Migrar componentes**: Gradualmente integrar com Supabase
5. **Deploy**: Configurar variáveis de produção

## 🔗 Links Úteis

- **Supabase Dashboard**: https://supabase.com/dashboard
- **Documentação**: https://supabase.com/docs
- **JavaScript Client**: https://supabase.com/docs/reference/javascript
- **SQL Editor**: Dashboard → SQL Editor

---

**🎉 Integração Supabase implementada com sucesso!**

A aplicação agora está pronta para dados persistentes e real-time, mantendo total compatibilidade com o sistema atual.
