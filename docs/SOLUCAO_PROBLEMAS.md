# 🚨 Guia de Solução de Problemas

## 🔍 Problemas Comuns e Soluções

### 1. 🚫 Erro "Não foi possível conectar ao banco de dados"

**Sintomas:**
- Tela branca ou mensagem de erro de conexão
- Dados não carregam

**Soluções:**
1. **Verifique o arquivo .env**
   ```bash
   # Certifique-se que estas variáveis estão definidas:
   VITE_SUPABASE_URL=sua_url_aqui
   VITE_SUPABASE_ANON_KEY=sua_chave_aqui
   ```

2. **Teste a conexão**
   ```bash
   # Abra o console do navegador (F12)
   # Procure por erros de rede ou CORS
   ```

3. **Reinicie o servidor**
   ```bash
   npm run dev
   ```

### 2. 📊 Dados não atualizam em tempo real

**Sintomas:**
- Mudanças não aparecem automaticamente
- Precisa recarregar a página

**Soluções:**
1. **Verifique a conexão WebSocket**
   - Console do navegador → aba Network → filtro WS
   - Deve mostrar conexão ativa com Supabase

2. **Limpe o cache**
   ```bash
   npm run clean
   npm install
   npm run dev
   ```

### 3. 📁 Erro ao importar planilha

**Sintomas:**
- "Erro ao processar arquivo"
- Upload não funciona

**Soluções:**
1. **Verifique o formato do arquivo**
   - Use apenas .xlsx ou .csv
   - Mantenha as colunas obrigatórias:
     - nome, telefone, placa

2. **Arquivo de exemplo**
   ```csv
   nome,telefone,placa
   João Silva,11999999999,ABC-1234
   Maria Santos,11888888888,XYZ-5678
   ```

3. **Verifique o tamanho**
   - Máximo 5MB por arquivo
   - Máximo 1000 linhas

### 4. 🔒 Erro de autenticação

**Sintomas:**
- "Usuário não autorizado"
- Redirecionamento para login

**Soluções:**
1. **Limpe os dados do navegador**
   ```bash
   # No navegador: F12 → Application → Storage → Clear All
   ```

2. **Verifique as credenciais**
   - Use credenciais válidas
   - Verifique se o usuário existe no sistema

### 5. 🐌 Sistema lento

**Sintomas:**
- Carregamento demorado
- Interface travando

**Soluções:**
1. **Verifique a rede**
   - Teste velocidade da internet
   - Verifique latência com o Supabase

2. **Otimize dados**
   ```bash
   # Limpe dados antigos se necessário
   # Reduza o número de vagas exibidas
   ```

3. **Monitore performance**
   ```bash
   # Console → Performance tab
   # Identifique gargalos
   ```

## 📝 Como Interpretar Logs de Erro

### Localização dos Logs
```bash
# Logs do sistema
logs/errors.log

# Logs do navegador
F12 → Console
```

### Tipos de Erro Comuns

#### 🔴 Network Error
```json
{
  "timestamp": "2025-01-13T10:30:00Z",
  "level": "ERROR",
  "message": "Failed to fetch",
  "component": "useRealtimeData",
  "details": "Network request failed"
}
```
**Solução**: Verificar conexão de internet e status do Supabase

#### 🟡 Validation Error
```json
{
  "timestamp": "2025-01-13T10:30:00Z",
  "level": "WARN",
  "message": "Invalid data format",
  "component": "ImportPlanilha",
  "details": "Missing required field: telefone"
}
```
**Solução**: Corrigir formato dos dados de entrada

#### 🔵 Permission Error
```json
{
  "timestamp": "2025-01-13T10:30:00Z",
  "level": "ERROR",
  "message": "Insufficient permissions",
  "component": "AdminPanel",
  "details": "User role: driver, required: admin"
}
```
**Solução**: Verificar permissões do usuário

## 🛠️ Ferramentas de Debug

### 1. Console do Navegador
```javascript
// Verificar estado do React
window.React = require('react');

// Debug de hooks
console.log('VagaData:', useVagaData());

// Verificar local storage
console.log(localStorage.getItem('vaga-driver-session'));
```

### 2. React Developer Tools
- Instale a extensão React DevTools
- Inspecione componentes e estado
- Monitore re-renders

### 3. Network Tab
- Monitore requisições HTTP
- Verifique status codes
- Analise tempo de resposta

## 📞 Quando Pedir Ajuda

### Antes de pedir ajuda, tenha em mãos:

1. **Informações do erro**
   - Mensagem exata do erro
   - Logs do sistema (logs/errors.log)
   - Screenshots da tela

2. **Informações do ambiente**
   - Navegador e versão
   - Sistema operacional
   - Versão do Node.js

3. **Passos para reproduzir**
   - O que você estava fazendo
   - Sequência exata de ações
   - Resultado esperado vs. atual

### Template para reportar erro:

```markdown
## 🐛 Descrição do Erro
[Descreva o que aconteceu]

## 🔄 Passos para Reproduzir
1. 
2. 
3. 

## 💾 Logs de Erro
```
[Cole aqui o conteúdo de logs/errors.log]
```

## 🖥️ Ambiente
- Navegador: 
- SO: 
- Versão Node: 

## 📸 Screenshots
[Anexe screenshots se necessário]
```

## 🚀 Dicas de Performance

1. **Monitore o bundle size**
   ```bash
   npm run build:analyze
   ```

2. **Use lazy loading**
   - Componentes grandes devem ser lazy
   - Verifique LazyComponents.tsx

3. **Otimize re-renders**
   - Use React.memo quando necessário
   - Evite objetos inline em props

4. **Cache inteligente**
   - Use SWR ou React Query
   - Implemente cache local quando possível
