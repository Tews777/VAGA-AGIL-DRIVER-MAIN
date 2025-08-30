# 🚛 Sistema de Gestão de Vagas para Motoristas

## 📋 Sobre o Projeto

Este é um sistema web para gerenciamento de vagas de motoristas desenvolvido em React + TypeScript. O sistema permite o controle de vagas disponíveis, motoristas interessados e acompanhamento em tempo real do status das solicitações.

## 🏗️ Arquitetura do Projeto

```
📁 src/
├── 📁 components/          # Componentes reutilizáveis da interface
├── 📁 pages/              # Páginas principais do sistema  
├── 📁 hooks/              # Hooks customizados para lógica de negócio
├── 📁 utils/              # Funções utilitárias compartilhadas
├── 📁 lib/                # Configurações e bibliotecas
└── 📁 logs/               # Logs de erro do sistema

📁 docs/                   # Documentação completa
📁 public/                 # Arquivos estáticos
📁 supabase/               # Configurações do banco de dados
```

## 🚀 Como Executar o Projeto

### Pré-requisitos
- Node.js 18+ instalado
- NPM ou Bun instalado
- Conta no Supabase (banco de dados)

### 1. Instalação
```bash
# Clone o repositório
git clone [url-do-repositorio]

# Entre na pasta do projeto
cd vaga-agil-driver-main

# Instale as dependências
npm install
```

### 2. Configuração
```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Configure suas variáveis de ambiente no arquivo .env
# Adicione sua URL e chave do Supabase
```

### 3. Executar
```bash
# Modo desenvolvimento
npm run dev

# Construir para produção
npm run build

# Testar build de produção
npm run preview
```

## 📱 Funcionalidades Principais

### 🏢 Painel Administrativo
- Visualização geral de todas as vagas
- Importação de planilhas de motoristas
- Exportação de dados
- Controle de motoristas atrasados

### 🚛 Painel do Motorista  
- Visualização de vagas disponíveis
- Solicitação de interesse em vagas
- Acompanhamento do status da solicitação

### 📊 Painel de Vagas
- Detalhes específicos de cada vaga
- Lista de motoristas interessados
- Aprovação/rejeição de solicitações

## 🔧 Scripts Disponíveis

```bash
npm run dev         # Executa em modo desenvolvimento
npm run build       # Constrói para produção
npm run preview     # Visualiza build de produção
npm run lint        # Verifica qualidade do código
npm run lint:fix    # Corrige automaticamente problemas
npm run type-check  # Verifica tipos TypeScript
npm run clean       # Limpa cache e dependências
```

## 📚 Documentação Adicional

- [Como Funciona o Sistema](./docs/COMO_FUNCIONA.md)
- [Guia de Solução de Problemas](./docs/SOLUCAO_PROBLEMAS.md)
- [Estrutura de Arquivos](./docs/ESTRUTURA_ARQUIVOS.md)
- [Como Contribuir](./docs/COMO_CONTRIBUIR.md)

## 🐛 Relatando Problemas

1. Verifique o arquivo `logs/errors.log` para detalhes do erro
2. Consulte o [Guia de Solução de Problemas](./docs/SOLUCAO_PROBLEMAS.md)
3. Se persistir, abra uma issue com:
   - Descrição do problema
   - Passos para reproduzir
   - Screenshots (se aplicável)
   - Logs de erro

## 📄 Licença

Este projeto é propriedade privada. Todos os direitos reservados.

## 👥 Suporte

Para suporte técnico, consulte a documentação em `/docs/` ou entre em contato com a equipe de desenvolvimento.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/c97dbe12-a241-4ed6-98ac-593879bcf756) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
