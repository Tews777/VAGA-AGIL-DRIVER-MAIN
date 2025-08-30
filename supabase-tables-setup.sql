# 🗄️ SQL para criar tabela "vagas" no Supabase

Execute este SQL no **SQL Editor** do Supabase:

```sql
-- Tabela principal de vagas
CREATE TABLE vagas (
  id TEXT PRIMARY KEY,
  status TEXT CHECK (status IN ('esperar', 'chamado', 'finalizado')) DEFAULT 'esperar',
  gaiola TEXT,
  motorista_nome TEXT,
  check_status BOOLEAN DEFAULT false,
  chamado_em TIMESTAMPTZ,
  finalizado_em TIMESTAMPTZ,
  tempo_espera INTEGER DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para usuários/motoristas
CREATE TABLE usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT,
  nome TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('admin', 'vaga', 'motorista', 'gr')) DEFAULT 'motorista',
  vaga_id TEXT,
  gaiola TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir vagas padrão (1-30)
INSERT INTO vagas (id, status) 
SELECT LPAD(generate_series(1, 30)::text, 2, '0'), 'esperar';

-- Inserir usuários padrão
INSERT INTO usuarios (email, nome, tipo, vaga_id) VALUES
('admin@vagaagil.com', 'Administrador', 'admin', NULL),
('vaga01@vagaagil.com', 'Operador Vaga 01', 'vaga', '01'),
('vaga02@vagaagil.com', 'Operador Vaga 02', 'vaga', '02'),
('gr@vagaagil.com', 'Gerente de Rota', 'gr', NULL);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at
CREATE TRIGGER update_vagas_updated_at BEFORE UPDATE ON vagas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Configurar Row Level Security
ALTER TABLE vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (desenvolvimento - permitir tudo)
CREATE POLICY "Allow all access vagas" ON vagas FOR ALL TO anon USING (true);
CREATE POLICY "Allow all access usuarios" ON usuarios FOR ALL TO anon USING (true);
CREATE POLICY "Allow all access vagas auth" ON vagas FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all access usuarios auth" ON usuarios FOR ALL TO authenticated USING (true);

-- Índices para performance
CREATE INDEX idx_vagas_status ON vagas(status);
CREATE INDEX idx_vagas_gaiola ON vagas(gaiola);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_tipo ON usuarios(tipo);
```
