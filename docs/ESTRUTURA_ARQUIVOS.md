# 📁 Estrutura de Arquivos do Projeto

## 🗂️ Organização Principal

```
vaga-agil-driver-main/
├── 📁 docs/                          # 📚 Documentação completa
│   ├── COMO_FUNCIONA.md              # Como o sistema funciona
│   ├── SOLUCAO_PROBLEMAS.md          # Guia de solução de problemas
│   ├── ESTRUTURA_ARQUIVOS.md         # Este arquivo
│   └── COMO_CONTRIBUIR.md            # Guia para contribuidores
│
├── 📁 src/                           # 💻 Código fonte principal
│   ├── 📁 components/                # 🧩 Componentes reutilizáveis
│   ├── 📁 pages/                     # 📱 Páginas principais
│   ├── 📁 hooks/                     # 🎣 Hooks customizados
│   ├── 📁 utils/                     # 🔧 Funções utilitárias
│   └── 📁 lib/                       # 📚 Configurações
│
├── 📁 logs/                          # 📝 Logs do sistema
├── 📁 public/                        # 🌐 Arquivos estáticos
├── 📁 supabase/                      # 🗄️ Configurações do banco
└── 📋 README.md                      # Documentação principal
```

## 📱 Páginas Principais (/src/pages/)

### 🏢 PainelAdmin.tsx
- **Função**: Painel administrativo principal
- **Acesso**: Apenas administradores
- **Recursos**:
  - Visualização geral de vagas
  - Importação de planilhas
  - Exportação de dados
  - Controle de motoristas atrasados
  - Aprovação/rejeição de solicitações

### 🚛 PainelMotorista.tsx
- **Função**: Interface para motoristas
- **Acesso**: Motoristas autenticados
- **Recursos**:
  - Visualização de vagas disponíveis
  - Solicitação de interesse
  - Acompanhamento de status

### 📊 PainelVagas.tsx
- **Função**: Detalhes específicos de vagas
- **Acesso**: Administradores e motoristas
- **Recursos**:
  - Informações detalhadas da vaga
  - Lista de motoristas interessados
  - Histórico de solicitações

### 📋 PainelTabela.tsx
- **Função**: Visualização em tabela
- **Acesso**: Administradores
- **Recursos**:
  - Dados em formato tabular
  - Filtros avançados
  - Exportação de relatórios

### 🔐 Login.tsx
- **Função**: Autenticação de usuários
- **Acesso**: Público
- **Recursos**:
  - Login de motoristas
  - Login de administradores
  - Recuperação de senha

## 🧩 Componentes (/src/components/)

### 📊 Componentes de Dados
- **DataImport.tsx** - Importação de dados
- **ExportData.tsx** - Exportação de dados
- **ImportPlanilha.tsx** - Import específico de planilhas

### 🎯 Componentes de Ação
- **DelayedDriverActions.tsx** - Ações para motoristas atrasados
- **DelayedDriverItem.tsx** - Item individual de motorista atrasado
- **AnalystCalledActions.tsx** - Ações do analista

### 🃏 Componentes de Interface
- **VagaCard.tsx** - Card de vaga individual
- **ui/** - Componentes de interface (shadcn/ui)

## 🎣 Hooks Customizados (/src/hooks/)

### 📊 Hooks de Dados
- **useVagaData.ts** - Gerenciamento de dados de vagas
- **useDriverData.ts** - Gerenciamento de dados de motoristas
- **useRealtimeData.ts** - Sincronização em tempo real

### 🔧 Hooks de Controle
- **useInactivityTimeout.ts** - Controle de inatividade
- **useOptimizedOperation.ts** - Operações otimizadas
- **use-toast.ts** - Sistema de notificações

### 💾 Hooks de Estado
- **StatusStore.ts** - Store de status global
- **use-mobile.tsx** - Detecção de dispositivo móvel

## 🔧 Utilitários (/src/utils/)

### 📁 Arquivo por Função

#### 🗄️ Dados e Processamento
- **dataExport.ts** - Exportação de dados em diversos formatos
- **uploadPlanilha.ts** - Processamento de uploads de planilhas
- **mockData.ts** - Dados de exemplo para desenvolvimento

#### 🔄 Tempo Real e Sincronização
- **supabaseRealtime.ts** - Configuração do Supabase Realtime
- **timeManager.ts** - Gerenciamento de tempo e timezone

#### 🔔 Notificações
- **notificationSystem.ts** - Sistema completo de notificações
- **sistemaLogs.ts** - ⭐ Sistema de logs e depuração

### 🎯 Como Usar Cada Utilitário

#### 📤 dataExport.ts
```typescript
import { exportToExcel, exportToCSV } from '@/utils/dataExport';

// Exportar para Excel
exportToExcel(dados, 'relatorio-vagas.xlsx');

// Exportar para CSV
exportToCSV(dados, 'motoristas.csv');
```

#### 📝 sistemaLogs.ts
```typescript
import { useLogger } from '@/utils/sistemaLogs';

const { logError, logInfo } = useLogger();

// Registrar erro
logError('Falha na conexão', 'PainelAdmin', { tentativa: 3 });

// Registrar informação
logInfo('Usuário logado', 'Login', { userId: '123' });
```

#### 🔔 notificationSystem.ts
```typescript
import { showNotification } from '@/utils/notificationSystem';

// Mostrar notificação
showNotification('success', 'Vaga aprovada com sucesso!');
```

## 📚 Configurações (/src/lib/)

- **utils.ts** - Utilitários gerais (cn, clsx, etc.)

## 🎨 Interface (/src/components/ui/)

Componentes base do shadcn/ui:
- **button.tsx** - Botões
- **card.tsx** - Cards
- **dialog.tsx** - Modais
- **form.tsx** - Formulários
- **input.tsx** - Campos de entrada
- **table.tsx** - Tabelas
- **toast.tsx** - Notificações
- **...** - Outros componentes UI

## 📝 Logs (/logs/)

- **errors.log** - Logs de erro do sistema (gerado automaticamente)
- **access.log** - Logs de acesso (futuro)
- **performance.log** - Logs de performance (futuro)

## 🌐 Públicos (/public/)

- **favicon.ico** - Ícone do site
- **robots.txt** - Configuração para crawlers
- **placeholder.svg** - Imagem placeholder

## 🗄️ Banco de Dados (/supabase/)

- **functions/** - Funções serverless do Supabase

## 📋 Convenções de Nomenclatura

### 📁 Arquivos
- **Páginas**: `Painel*.tsx` (ex: PainelAdmin.tsx)
- **Componentes**: `PascalCase.tsx` (ex: VagaCard.tsx)
- **Hooks**: `use*.ts` (ex: useVagaData.ts)
- **Utilitários**: `camelCase.ts` (ex: sistemaLogs.ts)

### 🏷️ Variáveis
- **Componentes**: `PascalCase`
- **Funções**: `camelCase`
- **Constantes**: `UPPER_SNAKE_CASE`
- **Props**: `camelCase`

### 📂 Pastas
- **kebab-case** para pastas públicas
- **camelCase** para pastas internas

## 🔍 Como Encontrar o que Procura

### 🐛 Erro no Sistema?
1. Verifique `/logs/errors.log`
2. Consulte `/docs/SOLUCAO_PROBLEMAS.md`
3. Use `sistemaLogs.ts` para debug

### 🔧 Modificar Funcionalidade?
1. Identifique a página em `/src/pages/`
2. Encontre o componente em `/src/components/`
3. Verifique hooks relacionados em `/src/hooks/`

### 📊 Trabalhar com Dados?
1. Hooks de dados: `/src/hooks/use*Data.ts`
2. Utilitários: `/src/utils/dataExport.ts`
3. Banco: `/supabase/`

### 🎨 Modificar Interface?
1. Componentes UI: `/src/components/ui/`
2. Componentes específicos: `/src/components/`
3. Estilos: Tailwind classes inline
