# 🗄️ SCRIPT SQL COMPLETO PARA SUPABASE - SISTEMA VAGA ÁGIL DRIVER

-- ==================================================
-- INSTRUÇÕES: COPIE E EXECUTE ESTE SQL NO SUPABASE
-- ==================================================
-- 1. Acesse: https://supabase.com/dashboard/project/wxnhcmepilzkzvitqjot
-- 2. Vá em "SQL Editor" 
-- 3. Copie e cole ESTE SQL COMPLETO
-- 4. Clique em "Run" (Execute)
-- ==================================================

-- TABELA 1: VAGAS (Principal do sistema)
CREATE TABLE IF NOT EXISTS vagas (
  id TEXT PRIMARY KEY,
  status TEXT CHECK (status IN ('esperar', 'chamado', 'carregando', 'finalizado')) DEFAULT 'esperar',
  gaiola TEXT,
  motorista_nome TEXT,
  check_status BOOLEAN DEFAULT false,
  chamado_em TIMESTAMPTZ,
  carregando_em TIMESTAMPTZ,
  finalizado_em TIMESTAMPTZ,
  tempo_total INTEGER DEFAULT 0,
  tempo_chamado INTEGER DEFAULT 0,
  tempo_carregamento INTEGER DEFAULT 0,
  history JSONB DEFAULT '[]'::jsonb,
  last_update TIMESTAMPTZ DEFAULT NOW(),
  total_gaiolas INTEGER DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA 2: USUARIOS (Para login e autenticação)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT,
  nome TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('admin', 'vaga', 'motorista', 'gr')) DEFAULT 'motorista',
  vaga_id TEXT,
  gaiola TEXT,
  ativo BOOLEAN DEFAULT true,
  user_type TEXT, -- Para compatibilidade com Supabase Auth
  vaga_number INTEGER, -- Para compatibilidade com Supabase Auth
  display_name TEXT, -- Para compatibilidade com Supabase Auth
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA 3: LOGS DE OPERAÇÕES (Para auditoria)
CREATE TABLE IF NOT EXISTS vaga_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vaga_id TEXT NOT NULL,
  motorista_gaiola TEXT NOT NULL,
  acao TEXT CHECK (acao IN ('chamado', 'chegada', 'carregando', 'finalizado', 'cancelado')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observacoes TEXT,
  usuario_id UUID REFERENCES usuarios(id),
  dados_anteriores JSONB,
  dados_novos JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA 4: STATUS DOS MOTORISTAS (Em tempo real)
CREATE TABLE IF NOT EXISTS motorista_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gaiola TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  status TEXT CHECK (status IN ('esperar_fora_hub', 'entrar_hub', 'chegou', 'atrasado', 'carregando')) DEFAULT 'esperar_fora_hub',
  vaga_atual TEXT REFERENCES vagas(id),
  ultima_atividade TIMESTAMPTZ DEFAULT NOW(),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA 5: BACKUP DE DADOS (Para segurança)
CREATE TABLE IF NOT EXISTS vaga_backup (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vaga_id TEXT NOT NULL,
  data JSONB NOT NULL,
  backup_type TEXT DEFAULT 'auto',
  usuario_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INSERIR DADOS PADRÃO
-- =============================================

-- Inserir vagas padrão (1-30)
INSERT INTO vagas (id, status) 
SELECT LPAD(generate_series(1, 30)::text, 2, '0'), 'esperar'
ON CONFLICT (id) DO NOTHING;

-- Inserir usuários padrão para LOGIN
INSERT INTO usuarios (email, nome, tipo, vaga_id, user_type, vaga_number, display_name) VALUES
('admin@vagaagil.com', 'Administrador', 'admin', NULL, 'admin', NULL, 'Administrador'),
('vaga01@vagaagil.com', 'Operador Vaga 01', 'vaga', '01', 'vaga', 1, 'Vaga 01'),
('vaga02@vagaagil.com', 'Operador Vaga 02', 'vaga', '02', 'vaga', 2, 'Vaga 02'),
('vaga03@vagaagil.com', 'Operador Vaga 03', 'vaga', '03', 'vaga', 3, 'Vaga 03'),
('vaga04@vagaagil.com', 'Operador Vaga 04', 'vaga', '04', 'vaga', 4, 'Vaga 04'),
('vaga05@vagaagil.com', 'Operador Vaga 05', 'vaga', '05', 'vaga', 5, 'Vaga 05'),
('vaga06@vagaagil.com', 'Operador Vaga 06', 'vaga', '06', 'vaga', 6, 'Vaga 06'),
('vaga07@vagaagil.com', 'Operador Vaga 07', 'vaga', '07', 'vaga', 7, 'Vaga 07'),
('vaga08@vagaagil.com', 'Operador Vaga 08', 'vaga', '08', 'vaga', 8, 'Vaga 08'),
('vaga09@vagaagil.com', 'Operador Vaga 09', 'vaga', '09', 'vaga', 9, 'Vaga 09'),
('vaga10@vagaagil.com', 'Operador Vaga 10', 'vaga', '10', 'vaga', 10, 'Vaga 10'),
('gr@vagaagil.com', 'Gerente de Rota', 'gr', NULL, 'admin', NULL, 'Gerente de Rota')
ON CONFLICT (email) DO NOTHING;

-- =============================================
-- FUNÇÕES E TRIGGERS
-- =============================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
DROP TRIGGER IF EXISTS update_vagas_updated_at ON vagas;
CREATE TRIGGER update_vagas_updated_at BEFORE UPDATE ON vagas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_motorista_status_updated_at ON motorista_status;
CREATE TRIGGER update_motorista_status_updated_at BEFORE UPDATE ON motorista_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para criar logs automaticamente quando vaga muda de status
CREATE OR REPLACE FUNCTION log_vaga_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o status mudou, criar um log
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO vaga_logs (vaga_id, motorista_gaiola, acao, observacoes, dados_anteriores, dados_novos)
        VALUES (
            NEW.id,
            COALESCE(NEW.gaiola, 'N/A'),
            NEW.status,
            CASE 
                WHEN NEW.status = 'chamado' THEN 'Vaga chamada para carregamento'
                WHEN NEW.status = 'carregando' THEN 'Motorista chegou e iniciou carregamento'
                WHEN NEW.status = 'finalizado' THEN 'Carregamento finalizado'
                ELSE 'Status alterado'
            END,
            row_to_json(OLD),
            row_to_json(NEW)
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS vaga_changes_log ON vagas;
CREATE TRIGGER vaga_changes_log 
    AFTER UPDATE ON vagas
    FOR EACH ROW 
    EXECUTE FUNCTION log_vaga_changes();

-- =============================================
-- CONFIGURAR ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS nas tabelas
ALTER TABLE vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaga_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorista_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaga_backup ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (PERMISSIVAS para desenvolvimento)
-- IMPORTANTE: Ajuste estas políticas conforme suas necessidades de segurança

-- Políticas para VAGAS
DROP POLICY IF EXISTS "Allow all access vagas" ON vagas;
CREATE POLICY "Allow all access vagas" ON vagas FOR ALL TO anon USING (true);

DROP POLICY IF EXISTS "Allow all access vagas auth" ON vagas;
CREATE POLICY "Allow all access vagas auth" ON vagas FOR ALL TO authenticated USING (true);

-- Políticas para USUARIOS
DROP POLICY IF EXISTS "Allow all access usuarios" ON usuarios;
CREATE POLICY "Allow all access usuarios" ON usuarios FOR ALL TO anon USING (true);

DROP POLICY IF EXISTS "Allow all access usuarios auth" ON usuarios;
CREATE POLICY "Allow all access usuarios auth" ON usuarios FOR ALL TO authenticated USING (true);

-- Políticas para LOGS
DROP POLICY IF EXISTS "Allow read logs" ON vaga_logs;
CREATE POLICY "Allow read logs" ON vaga_logs FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow insert logs" ON vaga_logs;
CREATE POLICY "Allow insert logs" ON vaga_logs FOR INSERT TO anon WITH CHECK (true);

-- Políticas para MOTORISTA STATUS
DROP POLICY IF EXISTS "Allow all motorista status" ON motorista_status;
CREATE POLICY "Allow all motorista status" ON motorista_status FOR ALL TO anon USING (true);

-- Políticas para BACKUP
DROP POLICY IF EXISTS "Allow all backup" ON vaga_backup;
CREATE POLICY "Allow all backup" ON vaga_backup FOR ALL TO anon USING (true);

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================

-- Índices para VAGAS
CREATE INDEX IF NOT EXISTS idx_vagas_status ON vagas(status);
CREATE INDEX IF NOT EXISTS idx_vagas_gaiola ON vagas(gaiola);
CREATE INDEX IF NOT EXISTS idx_vagas_updated_at ON vagas(updated_at);
CREATE INDEX IF NOT EXISTS idx_vagas_chamado_em ON vagas(chamado_em);

-- Índices para USUARIOS
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo ON usuarios(tipo);
CREATE INDEX IF NOT EXISTS idx_usuarios_vaga_id ON usuarios(vaga_id);

-- Índices para LOGS
CREATE INDEX IF NOT EXISTS idx_vaga_logs_vaga_id ON vaga_logs(vaga_id);
CREATE INDEX IF NOT EXISTS idx_vaga_logs_timestamp ON vaga_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vaga_logs_acao ON vaga_logs(acao);

-- Índices para MOTORISTA STATUS
CREATE INDEX IF NOT EXISTS idx_motorista_status_gaiola ON motorista_status(gaiola);
CREATE INDEX IF NOT EXISTS idx_motorista_status_vaga_atual ON motorista_status(vaga_atual);
CREATE INDEX IF NOT EXISTS idx_motorista_status_updated_at ON motorista_status(updated_at);

-- =============================================
-- CONFIGURAR REAL-TIME
-- =============================================

-- Habilitar real-time para as tabelas principais
ALTER PUBLICATION supabase_realtime ADD TABLE vagas;
ALTER PUBLICATION supabase_realtime ADD TABLE usuarios;
ALTER PUBLICATION supabase_realtime ADD TABLE vaga_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE motorista_status;

-- =============================================
-- VERIFICAÇÃO FINAL
-- =============================================

-- Verificar se as tabelas foram criadas
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('vagas', 'usuarios', 'vaga_logs', 'motorista_status', 'vaga_backup')
ORDER BY tablename;

-- =============================================
-- FIM DO SCRIPT
-- =============================================

-- ✅ PRONTO! 
-- Agora você pode:
-- 1. Fazer login no sistema com:
--    - admin@vagaagil.com (senha: sua escolha)
--    - vaga01@vagaagil.com (senha: sua escolha)
--    - vaga02@vagaagil.com (etc...)
-- 
-- 2. Criar novos usuários diretamente na interface
-- 3. Monitorar logs e atividades
-- 4. Usar real-time updates
