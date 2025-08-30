# Guia de Deploy na Vercel - Sistema Vaga Agil Driver

## 📋 Pré-requisitos

✅ **Já configurados no projeto:**
- ✅ Supabase integrado e funcionando
- ✅ Variáveis de ambiente configuradas
- ✅ Build otimizado com Vite
- ✅ vercel.json configurado

## 🚀 Passos para Deploy

### 1. Preparar o Projeto

```bash
# Instalar dependências
npm install

# Testar build local
npm run build

# Verificar se build funciona
npm run preview
```

### 2. Configurar Vercel CLI (Opcional)

```bash
# Instalar Vercel CLI globalmente
npm install -g vercel

# Login na Vercel
vercel login

# Deploy do projeto
vercel
```

### 3. Deploy via GitHub (Recomendado)

1. **Enviar código para GitHub:**
   ```bash
   git add .
   git commit -m "feat: integração Supabase completa"
   git push origin main
   ```

2. **Conectar repositório na Vercel:**
   - Acesse: https://vercel.com/dashboard
   - Clique em "New Project"
   - Importe o repositório GitHub
   - Configure as variáveis de ambiente

### 4. Variáveis de Ambiente na Vercel

Configure estas variáveis no painel da Vercel:

```env
# Supabase (OBRIGATÓRIO)
VITE_SUPABASE_URL=https://wxnhcmepilzkzvitqjot.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui

# Senhas do sistema (OBRIGATÓRIO)
VITE_VAGA_PASSWORD=sua_senha_vaga
VITE_ADMIN_PASSWORD=sua_senha_admin
```

### 5. Configurações da Vercel

**Build Settings:**
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

**Domain Settings:**
- Configure um domínio personalizado se necessário
- Exemplo: `vaga-agil.vercel.app`

## 🔧 Configurações do Supabase para Produção

### 1. URL de Callback (Auth)

Adicione na configuração do Supabase Auth:

```
# URLs permitidas
https://seu-projeto.vercel.app
https://seu-projeto.vercel.app/**
```

### 2. CORS (Cross-Origin)

Configure no Supabase:

```
https://seu-projeto.vercel.app
```

### 3. RLS (Row Level Security)

Execute no SQL Editor do Supabase:

```sql
-- Habilitar RLS nas tabelas
ALTER TABLE vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir leitura para todos" ON vagas FOR SELECT USING (true);
CREATE POLICY "Permitir escrita para usuários autenticados" ON vagas FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem ver próprios dados" ON usuarios FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Usuários podem atualizar próprios dados" ON usuarios FOR UPDATE USING (auth.uid() = id);
```

## 🔍 Verificação Pós-Deploy

### 1. Funcionalidades a Testar

✅ **Login/Autenticação:**
- [ ] Login com Supabase Auth
- [ ] Login modo legado (fallback)
- [ ] Registro de novos usuários
- [ ] Logout

✅ **Gestão de Vagas:**
- [ ] Visualização em tempo real
- [ ] Chamar gaiola
- [ ] Atualizar status
- [ ] Sincronização entre abas

✅ **Performance:**
- [ ] Carregamento inicial < 3s
- [ ] Real-time updates funcionando
- [ ] Cache local funcional

### 2. URLs de Teste

Após deploy, teste estas URLs:

```
https://seu-projeto.vercel.app/           # Login
https://seu-projeto.vercel.app/admin      # Painel Admin
https://seu-projeto.vercel.app/vaga/1     # Vaga específica
https://seu-projeto.vercel.app/drivers    # Status Motoristas
```

## 🐛 Troubleshooting

### Erro: "Module not found"
```bash
# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Erro: Supabase connection
- Verificar variáveis de ambiente na Vercel
- Confirmar URLs de callback no Supabase
- Testar conectividade: Network tab no DevTools

### Erro: Real-time não funciona
- Verificar configuração de WebSocket
- Confirmar permissões RLS no Supabase
- Verificar logs da Vercel

## 📊 Monitoramento

### 1. Logs da Vercel
```bash
# Ver logs em tempo real
vercel logs --follow

# Ver logs de uma função específica
vercel logs --function=api/endpoint
```

### 2. Analytics
- Ativar Vercel Analytics
- Configurar Vercel Speed Insights
- Monitorar Core Web Vitals

## 🔐 Segurança

### 1. Headers de Segurança
✅ Já configurados no `vercel.json`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

### 2. Variáveis Sensíveis
- ✅ Todas as senhas são variáveis de ambiente
- ✅ Supabase keys protegidas
- ✅ Não há dados sensíveis no código

## 🚀 Deploy Automático

### Configuração de CI/CD

O projeto está configurado para deploy automático:

1. **Push para `main`** → Deploy automático
2. **Pull Request** → Preview deploy
3. **Merge** → Deploy para produção

### Comandos Úteis

```bash
# Deploy manual
vercel

# Deploy para produção
vercel --prod

# Ver status do projeto
vercel ls

# Ver domínios
vercel domains ls
```

## 📝 Notas Importantes

⚠️ **Antes do primeiro deploy:**
1. Execute o SQL setup do Supabase
2. Configure todas as variáveis de ambiente
3. Teste localmente com `npm run build && npm run preview`

🎯 **Após deploy bem-sucedido:**
1. Teste todas as funcionalidades
2. Configure monitoramento
3. Documente URL de produção
4. Compartilhe com a equipe

## 🎉 Checklist Final

- [ ] Código enviado para GitHub
- [ ] Projeto configurado na Vercel
- [ ] Variáveis de ambiente definidas
- [ ] Supabase configurado para produção
- [ ] Deploy realizado com sucesso
- [ ] Testes funcionais aprovados
- [ ] Monitoramento ativo
- [ ] Equipe notificada

**🔗 URLs Finais:**
- **Produção:** `https://seu-projeto.vercel.app`
- **Supabase Dashboard:** `https://supabase.com/dashboard/project/wxnhcmepilzkzvitqjot`
- **Vercel Dashboard:** `https://vercel.com/dashboard`
