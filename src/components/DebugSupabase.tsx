// DebugSupabase.tsx - Componente temporário para debug
import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DebugSupabase = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    try {
      // Testar conexão básica
      const { data: vagas, error: vagasError } = await supabase
        .from('vagas')
        .select('*')
        .limit(5);

      const { data: usuarios, error: usuariosError } = await supabase
        .from('usuarios')
        .select('*')
        .limit(5);

      setResult({
        vagas: { data: vagas, error: vagasError },
        usuarios: { data: usuarios, error: usuariosError },
        env: {
          url: import.meta.env.VITE_SUPABASE_URL,
          hasKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY
        }
      });
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testAuth = async () => {
    setLoading(true);
    try {
      // Testar criação de conta
      const { data, error } = await supabase.auth.signUp({
        email: 'test@vagaagil.com',
        password: '123456789'
      });

      setResult({ auth: { data, error } });
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>🔍 Debug Supabase</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={testConnection} disabled={loading}>
            Testar Tabelas
          </Button>
          <Button onClick={testAuth} disabled={loading}>
            Testar Auth
          </Button>
        </div>

        {result && (
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
};

export default DebugSupabase;
