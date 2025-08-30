# 👥 Como Contribuir com o Projeto

## 🎯 Visão Geral

Este guia ajuda desenvolvedores a contribuir de forma eficiente e organizada para o sistema de gestão de vagas de motoristas.

## 🏗️ Estrutura de Desenvolvimento

### 📁 Organização do Código

```
src/
├── pages/           # 📱 Páginas principais (PainelAdmin, PainelMotorista, etc.)
├── components/      # 🧩 Componentes reutilizáveis
├── hooks/          # 🎣 Lógica de negócio e estado
├── utils/          # 🔧 Funções utilitárias
└── lib/            # 📚 Configurações
```

### 🎯 Convenções de Nomenclatura

#### 📄 Arquivos
- **Páginas**: `Painel*.tsx` (PainelAdmin.tsx, PainelMotorista.tsx)
- **Componentes**: `PascalCase.tsx` (VagaCard.tsx, ImportPlanilha.tsx)
- **Hooks**: `use*.ts` (useVagaData.ts, useDriverData.ts)
- **Utilitários**: `camelCase.ts` (sistemaLogs.ts, dataExport.ts)

#### 🏷️ Variáveis e Funções
```typescript
// ✅ Bom
const vagaData = useVagaData();
const handleDriverUpdate = () => {};
const VAGA_STATUS_CONSTANTS = {};

// ❌ Evitar
const vagadata = useVagaData();
const handledriver_update = () => {};
const vaga_status_constants = {};
```

## 🚀 Configuração do Ambiente

### 1. Pré-requisitos
```bash
# Node.js 18+
node --version

# NPM
npm --version

# Git
git --version
```

### 2. Instalação
```bash
# Clone o repositório
git clone [url-do-repositorio]

# Entre na pasta
cd vaga-agil-driver-main

# Instale dependências
npm install

# Configure ambiente
cp .env.example .env
# Edite .env com suas configurações
```

### 3. Execução
```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Teste de build
npm run preview

# Lint
npm run lint
npm run lint:fix
```

## 🔧 Padrões de Desenvolvimento

### 🎯 Estrutura de Componentes

```typescript
// ✅ Estrutura padrão para componentes
import React, { useState, useEffect } from 'react';
import { useLogger } from '@/utils/sistemaLogs';

interface ComponenteProps {
  // Props com tipos específicos
  vagaId: string;
  onUpdate?: (data: VagaData) => void;
}

export const MeuComponente: React.FC<ComponenteProps> = ({ 
  vagaId, 
  onUpdate 
}) => {
  const { logInfo, logError } = useLogger();
  
  useEffect(() => {
    logInfo('Componente montado', 'MeuComponente', { vagaId });
  }, []);

  return (
    <div className="container">
      {/* JSX aqui */}
    </div>
  );
};

export default MeuComponente;
```

### 🎣 Padrão para Hooks

```typescript
// ✅ Estrutura padrão para hooks customizados
import { useState, useEffect, useCallback } from 'react';
import { useLogger } from '@/utils/sistemaLogs';

export const useMeuHook = (parametro: string) => {
  const { logError, logInfo } = useLogger();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Lógica aqui
      logInfo('Dados carregados', 'useMeuHook');
    } catch (error) {
      logError('Erro ao carregar dados', 'useMeuHook', error);
    } finally {
      setLoading(false);
    }
  }, [parametro]);

  return {
    data,
    loading,
    fetchData,
    // Sempre retornar objeto com funções e estado
  };
};
```

### 🔧 Padrão para Utilitários

```typescript
// ✅ Estrutura padrão para utilitários
import { logger } from '@/utils/sistemaLogs';

/**
 * 📊 Função utilitária para processamento de dados
 * @param dados - Dados a serem processados
 * @param opcoes - Opções de configuração
 * @returns Dados processados
 */
export const processarDados = (dados: any[], opcoes: ProcessOptions) => {
  try {
    // Lógica aqui
    logger.info('Dados processados', 'processarDados', { 
      total: dados.length 
    });
    
    return resultado;
  } catch (error) {
    logger.error('Erro no processamento', 'processarDados', {}, error);
    throw error;
  }
};
```

## 📝 Sistema de Logs

### 🔍 Como Usar Logs

```typescript
import { useLogger } from '@/utils/sistemaLogs';

const { logError, logWarn, logInfo, logDebug } = useLogger();

// 🚨 Erros críticos
logError('Falha na conexão', 'PainelAdmin', { tentativa: 3 }, error);

// ⚠️ Avisos
logWarn('Cache expirado', 'useVagaData', { cacheAge: '5min' });

// ℹ️ Informações
logInfo('Usuário logado', 'Login', { userId: '123' });

// 🔍 Debug (apenas desenvolvimento)
logDebug('Estado atualizado', 'VagaCard', { newState });
```

### 📊 Visualizar Logs

```typescript
// Ver todos os logs
const logs = useLogger().getLogs();

// Exportar logs para arquivo
const logsText = useLogger().exportLogs();

// Estatísticas
const stats = useLogger().getStats();
console.log(`Erros: ${stats.errors}, Avisos: ${stats.warnings}`);
```

## 🐛 Tratamento de Erros

### 🎯 Padrão de Error Handling

```typescript
// ✅ Tratamento completo de erros
const handleVagaUpdate = async (vagaId: string, data: VagaData) => {
  const { logError, logInfo } = useLogger();
  
  try {
    // Validação
    if (!vagaId) {
      throw new Error('ID da vaga é obrigatório');
    }
    
    // Operação
    const result = await updateVaga(vagaId, data);
    
    // Log de sucesso
    logInfo('Vaga atualizada', 'handleVagaUpdate', { vagaId });
    
    return result;
  } catch (error) {
    // Log de erro
    logError('Falha ao atualizar vaga', 'handleVagaUpdate', { vagaId }, error);
    
    // Tratamento específico
    if (error.code === 'NETWORK_ERROR') {
      toast.error('Erro de conexão. Tente novamente.');
    } else {
      toast.error('Erro interno. Verifique os logs.');
    }
    
    // Re-throw para componente pai tratar se necessário
    throw error;
  }
};
```

## 🔄 Workflow de Desenvolvimento

### 1. 🌿 Criar Branch
```bash
# Feature
git checkout -b feature/nova-funcionalidade

# Bug fix
git checkout -b fix/corrigir-bug

# Hotfix
git checkout -b hotfix/correcao-urgente
```

### 2. 💻 Desenvolver
```bash
# Sempre testar durante desenvolvimento
npm run dev

# Verificar código
npm run lint
npm run type-check
```

### 3. ✅ Validar
```bash
# Build de produção
npm run build

# Testar build
npm run preview

# Verificar logs
# Abrir logs/errors.log
```

### 4. 📝 Commit
```bash
# Padrão de commits
git add .
git commit -m "feat: adicionar funcionalidade X"
git commit -m "fix: corrigir bug Y"
git commit -m "docs: atualizar documentação"
```

### 5. 🚀 Deploy
```bash
# Push
git push origin feature/nova-funcionalidade

# Pull Request no GitHub
# Review obrigatório
```

## 🧪 Testes

### 🎯 Como Testar Funcionalidades

1. **Teste Manual**
   - Navegue pela interface
   - Teste cenários edge case
   - Verifique responsividade

2. **Teste de Performance**
   ```bash
   npm run build:analyze
   # Verificar tamanho do bundle
   ```

3. **Teste de Logs**
   - Verificar logs/errors.log
   - Confirmar logs aparecem corretamente

## 📚 Recursos Úteis

### 🔗 Links Importantes
- [Documentação React](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Supabase](https://supabase.com/docs)

### 📋 Checklist Antes do Commit
- [ ] Código compila sem erros
- [ ] Lint passa sem warnings
- [ ] Funcionalidade testada manualmente
- [ ] Logs apropriados adicionados
- [ ] Documentação atualizada se necessário
- [ ] Build de produção funciona

### 🚨 Problemas Comuns

1. **Erro de Import**
   ```typescript
   // ❌ Evitar imports relativos profundos
   import Component from '../../../components/Component';
   
   // ✅ Usar alias
   import Component from '@/components/Component';
   ```

2. **Estado não Sincronizado**
   ```typescript
   // ✅ Usar hooks de sincronização
   const { syncData } = useRealtimeData();
   ```

3. **Performance Issues**
   ```typescript
   // ✅ Usar lazy loading
   const ComponentePesado = lazy(() => import('./ComponentePesado'));
   ```

## 👥 Suporte

- **Dúvidas**: Consulte `/docs/`
- **Bugs**: Verifique `/logs/errors.log`
- **Problemas**: Veja `/docs/SOLUCAO_PROBLEMAS.md`
