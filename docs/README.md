# 🚛 Vaga Ágil Driver - Sistema de Controle de Vagas

## 📋 Visão Geral

Sistema completo para gerenciamento de vagas, motoristas e operações logísticas desenvolvido em React + TypeScript + Vite.

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- Node.js 18+ 
- npm ou yarn

### Instalação
```bash
# 1. Clone o repositório (se aplicável)
git clone [URL_DO_REPOSITORIO]

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações

# 4. Execute o projeto
npm run dev
```

### Comandos Disponíveis
```bash
npm run dev          # Executar em modo desenvolvimento
npm run build        # Build para produção
npm run preview      # Preview do build de produção
npm run lint         # Verificar código com ESLint
```

## 🔧 Configuração

### Variáveis de Ambiente (.env)
```env
VITE_GR_PASSWORD=sua_senha_gr
VITE_ADMIN_PASSWORD=sua_senha_admin  
VITE_VAGA_PASSWORD=sua_senha_vaga
VITE_APP_NAME="Vaga Ágil Driver"
VITE_APP_VERSION="1.0.0"
```

## 🏗️ Estrutura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── ui/             # Componentes de interface base
│   ├── ErrorBoundary.tsx   # Captura de erros
│   ├── VagaCard.tsx        # Card de vaga
│   └── ...
├── hooks/              # Hooks customizados
│   ├── useVagaData.ts      # Dados das vagas
│   ├── useDriverData.ts    # Dados dos motoristas
│   ├── useErrorLogger.ts   # Sistema de erros
│   └── ...
├── pages/              # Páginas do sistema
│   ├── Login.tsx           # Página de login
│   ├── PainelAdmin.tsx     # Painel administrativo
│   ├── PainelVagas.tsx     # Painel individual de vaga
│   ├── PainelMotorista.tsx # Painel de motoristas
│   ├── PaginaDebug.tsx     # Debug de erros
│   └── ...
├── utils/              # Funções utilitárias
│   ├── sistemaLogs.ts      # Sistema de logs
│   ├── notificationSystem.ts # Notificações
│   └── ...
└── lib/                # Configurações e utilitários
    └── utils.ts            # Utilitários gerais
```

## 🎯 Principais Funcionalidades

### 🔐 Sistema de Login
- **Admin**: Acesso completo ao sistema
- **Vaga**: Acesso individual por vaga (01-30)
- **Motoristas**: Painel específico para drivers

### 📊 Painéis Disponíveis

#### Painel Admin (`/admin`)
- Visão geral de todas as vagas
- Controle de motoristas
- Sistema de notificações
- Estatísticas em tempo real
- **Botão Debug**: Acesso ao sistema de erros

#### Painel de Vaga (`/vaga/:id`)
- Controle individual da vaga
- Chamada de gaiolas
- Status de carregamento
- Histórico de operações

#### Painel de Motoristas (`/drivers`)
- Lista de todos os motoristas
- Status em tempo real
- Filtros por hub e status

#### Painel Debug (`/debug`)
- Visualização de erros do sistema
- Exportação de logs
- Estatísticas de erros

## 🚨 Como Corrigir Erros Comuns

### 1. Página não carrega / Erro 404
```bash
# Verifique se o servidor está rodando
npm run dev

# Verifique as rotas em src/App.tsx
# URLs válidas: /, /admin, /vaga/01, /drivers, /debug
```

### 2. Erro de autenticação
```bash
# Verifique as senhas no arquivo .env
# Limpe o localStorage se necessário:
localStorage.clear()
```

### 3. Dados não salvam
```bash
# Verifique se o localStorage está funcionando
# Abra DevTools > Application > Local Storage
# Procure por chaves como: vaga01, drivers_data, etc.
```

### 4. Performance lenta
```bash
# Limpe dados antigos
localStorage.clear()

# Recarregue a página
Ctrl + F5
```

### 5. Erros de TypeScript
```bash
# Execute verificação de tipos
npx tsc --noEmit

# Instale dependências em caso de erro
npm install
```

## 🔍 Debug e Monitoramento

### Sistema de Erros
- **Captura Automática**: Erros JavaScript são capturados automaticamente
- **Error Boundaries**: Protegem a aplicação de crashes
- **Logs Centralizados**: Todos os erros ficam em `/debug`
- **Mensagens Amigáveis**: Usuários recebem instruções claras

### Como Acessar Logs
1. Entre no Painel Admin
2. Clique no botão **Debug** (vermelho) no header
3. Visualize erros, estatísticas e exportações

### Principais Logs
```bash
# No navegador (DevTools > Console)
🚨 ERRO CRÍTICO - [ComponenteName]
⚠️ [ComponenteName] Warning message
📊 [ComponenteName] Info message

# No localStorage
critical-errors: Array de erros críticos
system-logs: Logs gerais do sistema
```

## 📱 Responsividade

O sistema é **mobile-first** e funciona em:
- 📱 **Mobile**: 320px+
- 📟 **Tablet**: 768px+
- 💻 **Desktop**: 1024px+

### Classes CSS Importantes
```css
.mobile-card     # Cards otimizados para toque
.mobile-button   # Botões com tamanho adequado
.hover-optimized # Hover apenas em desktop
```

## 🔒 Segurança

### Boas Práticas Implementadas
- ✅ Senhas em variáveis de ambiente
- ✅ Validação de entrada
- ✅ Escape de dados
- ✅ Autenticação por sessão

### Checklist de Segurança
- [ ] Trocar senhas padrão em produção
- [ ] Configurar HTTPS
- [ ] Backup regular dos dados
- [ ] Monitorar logs de erro

## 🎨 Personalização

### Tema e Cores
Edite `src/index.css` para customizar:
```css
:root {
  --primary: 222.2 47.4% 11.2%;
  --secondary: 210 40% 96.1%;
  /* ... outras variáveis */
}
```

### Adicionar Nova Página
1. Crie o arquivo em `src/pages/MinhaPage.tsx`
2. Adicione a rota em `src/App.tsx`
3. Adicione lazy loading se necessário

## 📦 Build e Deploy

### Build para Produção
```bash
npm run build
```

### Verificar Bundle
```bash
npm run preview
```

### Estrutura do Build
```
dist/
├── assets/        # JS/CSS minificados
├── index.html     # HTML principal
└── ...
```

## 🔧 Manutenção

### Atualizações Regulares
```bash
# Atualizar dependências
npm update

# Verificar vulnerabilidades  
npm audit

# Corrigir vulnerabilidades
npm audit fix
```

### Backup de Dados
Os dados ficam no localStorage. Para backup:
1. Acesse `/debug`
2. Clique em "Exportar Logs"
3. Salve o arquivo JSON gerado

### Monitoramento
- Verifique logs de erro diariamente
- Monitore performance via DevTools
- Acompanhe feedback dos usuários

## 📞 Suporte

### Em caso de problemas:
1. Verifique o console do navegador (F12)
2. Acesse a página `/debug` para ver erros
3. Exporte logs se necessário
4. Documente passos para reproduzir o erro

### Logs Importantes
- **Sistema**: Console do navegador
- **Erros**: Página `/debug`
- **Performance**: DevTools > Performance
- **Rede**: DevTools > Network

---

## 📈 Estatísticas do Projeto

- **Linguagem**: TypeScript 100%
- **Framework**: React 18 + Vite
- **Componentes**: 50+ componentes
- **Hooks**: 15+ hooks customizados
- **Páginas**: 7 páginas principais
- **Performance**: Lazy loading + Code splitting
- **Responsividade**: Mobile-first design

**Sistema 100% funcional e otimizado! ✅**
