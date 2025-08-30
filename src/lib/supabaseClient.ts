// supabaseClient.ts - Configuração e inicialização do cliente Supabase
// Versão profissional com tratamento de erros e tipos TypeScript

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Interfaces TypeScript para tipagem
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  options?: {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
      detectSessionInUrl?: boolean;
    };
    realtime?: {
      params?: {
        eventsPerSecond?: number;
      };
    };
  };
}

export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
}

// Configuração das variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validação das variáveis de ambiente
function validateEnvironmentVariables(): void {
  if (!supabaseUrl) {
    throw new Error(
      '🔴 ERRO: VITE_SUPABASE_URL não está definida nas variáveis de ambiente.\n' +
      'Adicione VITE_SUPABASE_URL=your_supabase_url no arquivo .env'
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      '🔴 ERRO: VITE_SUPABASE_ANON_KEY não está definida nas variáveis de ambiente.\n' +
      'Adicione VITE_SUPABASE_ANON_KEY=your_supabase_anon_key no arquivo .env'
    );
  }

  // Validação básica do formato da URL
  try {
    new URL(supabaseUrl);
  } catch {
    throw new Error(
      '🔴 ERRO: VITE_SUPABASE_URL tem formato inválido.\n' +
      'Deve ser uma URL válida como: https://your-project.supabase.co'
    );
  }

  // Log de confirmação (apenas em desenvolvimento)
  if (import.meta.env.DEV) {
    console.log('✅ Supabase: Variáveis de ambiente validadas');
    console.log('📡 Supabase URL:', supabaseUrl);
    console.log('🔑 Anon Key:', `${supabaseAnonKey.substring(0, 20)}...`);
  }
}

// Configuração otimizada do cliente Supabase
const supabaseConfig: SupabaseConfig['options'] = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10 // Limite para evitar spam
    }
  }
};

// Inicialização do cliente
let supabase: SupabaseClient;

try {
  // Validar variáveis antes de criar o cliente
  validateEnvironmentVariables();
  
  // Criar cliente Supabase
  supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseConfig);
  
  if (import.meta.env.DEV) {
    console.log('🚀 Supabase: Cliente inicializado com sucesso');
  }
  
} catch (error) {
  console.error('❌ Erro ao inicializar Supabase:', error);
  
  // Criar cliente mock para evitar crashes
  supabase = {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: null, error: { message: 'Supabase não configurado' } }),
      update: () => Promise.resolve({ data: null, error: { message: 'Supabase não configurado' } }),
      delete: () => Promise.resolve({ data: null, error: { message: 'Supabase não configurado' } })
    }),
    auth: {
      signIn: () => Promise.resolve({ data: null, error: { message: 'Supabase não configurado' } }),
      signOut: () => Promise.resolve({ error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null })
    },
    channel: () => ({
      on: () => ({ subscribe: () => {} }),
      unsubscribe: () => Promise.resolve('ok')
    })
  } as any;
}

// Funções utilitárias para tratamento de erros
export function handleSupabaseError(error: any): SupabaseError {
  return {
    message: error?.message || 'Erro desconhecido no Supabase',
    code: error?.code,
    details: error?.details || error?.hint
  };
}

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

// Log de status na inicialização
if (import.meta.env.DEV) {
  console.log(`🔧 Supabase Status: ${isSupabaseConfigured() ? '✅ Configurado' : '❌ Não configurado'}`);
}

// Exportar cliente e utilitários
export default supabase;
export { supabase };

// Exportar tipos para uso em outros arquivos
export type { SupabaseClient };
