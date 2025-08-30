// useSupabase.ts - Hook customizado para operações com Supabase
// Versão profissional com tratamento de erros e tipos TypeScript

import { useState, useEffect, useCallback } from 'react';
import { supabase, handleSupabaseError, isSupabaseConfigured, type SupabaseError } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

// Interfaces TypeScript
export interface UseSupabaseReturn {
  isConnected: boolean;
  isLoading: boolean;
  error: SupabaseError | null;
  testConnection: () => Promise<boolean>;
  clearError: () => void;
}

export interface SupabaseTableHookReturn<T> {
  data: T[];
  isLoading: boolean;
  error: SupabaseError | null;
  refetch: () => Promise<void>;
  insert: (data: Partial<T>) => Promise<boolean>;
  update: (id: string, data: Partial<T>) => Promise<boolean>;
  delete: (id: string) => Promise<boolean>;
}

// Hook principal para gerenciar conexão com Supabase
export function useSupabase(): UseSupabaseReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<SupabaseError | null>(null);
  const { toast } = useToast();

  // Função para testar conexão
  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      const configError: SupabaseError = {
        message: 'Supabase não está configurado. Verifique as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY'
      };
      setError(configError);
      setIsConnected(false);
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Teste simples de conexão usando uma tabela que sabemos que existe
      const { error: testError } = await supabase.from('vaga_logs').select('*').limit(1);
      
      if (testError && testError.code !== 'PGRST116') { // PGRST116 = table not found (ok para teste)
        throw testError;
      }

      setIsConnected(true);
      
      if (import.meta.env.DEV) {
        console.log('✅ Supabase: Conexão testada com sucesso');
      }
      
      return true;

    } catch (err: any) {
      const supabaseError = handleSupabaseError(err);
      setError(supabaseError);
      setIsConnected(false);
      
      // Não mostrar toast para erros de tabela não encontrada (normal em teste)
      if (err.code !== 'PGRST116') {
        toast({
          title: "Erro de conexão com Supabase",
          description: supabaseError.message,
          variant: "destructive",
        });
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Função para limpar erro
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Testar conexão na inicialização
  useEffect(() => {
    testConnection();
  }, [testConnection]);

  return {
    isConnected,
    isLoading,
    error,
    testConnection,
    clearError
  };
}

// Hook genérico para operações CRUD em tabelas
export function useSupabaseTable<T extends { id?: string }>(tableName: string): SupabaseTableHookReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SupabaseError | null>(null);
  const { toast } = useToast();

  // Buscar dados da tabela
  const refetch = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError({ message: 'Supabase não configurado' });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data: result, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setData(result || []);

    } catch (err: any) {
      const supabaseError = handleSupabaseError(err);
      setError(supabaseError);
      
      toast({
        title: `Erro ao carregar ${tableName}`,
        description: supabaseError.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [tableName, toast]);

  // Inserir novo registro
  const insert = useCallback(async (newData: Partial<T>): Promise<boolean> => {
    if (!isSupabaseConfigured()) return false;

    try {
      setError(null);

      const { error: insertError } = await supabase
        .from(tableName)
        .insert([newData]);

      if (insertError) throw insertError;

      // Recarregar dados
      await refetch();

      toast({
        title: "✅ Registro criado",
        description: `Novo item adicionado à ${tableName}`,
      });

      return true;

    } catch (err: any) {
      const supabaseError = handleSupabaseError(err);
      setError(supabaseError);
      
      toast({
        title: "Erro ao criar registro",
        description: supabaseError.message,
        variant: "destructive",
      });

      return false;
    }
  }, [tableName, refetch, toast]);

  // Atualizar registro
  const update = useCallback(async (id: string, updateData: Partial<T>): Promise<boolean> => {
    if (!isSupabaseConfigured()) return false;

    try {
      setError(null);

      const { error: updateError } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;

      // Recarregar dados
      await refetch();

      toast({
        title: "✅ Registro atualizado",
        description: `Item da ${tableName} foi atualizado`,
      });

      return true;

    } catch (err: any) {
      const supabaseError = handleSupabaseError(err);
      setError(supabaseError);
      
      toast({
        title: "Erro ao atualizar registro",
        description: supabaseError.message,
        variant: "destructive",
      });

      return false;
    }
  }, [tableName, refetch, toast]);

  // Deletar registro
  const deleteRecord = useCallback(async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) return false;

    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Recarregar dados
      await refetch();

      toast({
        title: "✅ Registro deletado",
        description: `Item removido da ${tableName}`,
      });

      return true;

    } catch (err: any) {
      const supabaseError = handleSupabaseError(err);
      setError(supabaseError);
      
      toast({
        title: "Erro ao deletar registro",
        description: supabaseError.message,
        variant: "destructive",
      });

      return false;
    }
  }, [tableName, refetch, toast]);

  // Carregar dados na inicialização
  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data,
    isLoading,
    error,
    refetch,
    insert,
    update,
    delete: deleteRecord
  };
}

// Hook para real-time subscriptions
export function useSupabaseRealtime<T>(
  tableName: string,
  callback: (payload: any) => void
) {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel(`realtime:${tableName}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName
        },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, callback]);
}

// Exportar tipos para uso em outros arquivos
export type { SupabaseError };
