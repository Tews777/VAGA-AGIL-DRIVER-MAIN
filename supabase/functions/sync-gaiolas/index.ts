import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // URL da planilha convertida para CSV
    const SHEETS_URL = "https://docs.google.com/spreadsheets/d/1_LYotqK9qGL0TyTGnEzGs-ntH2fmRHV-7CLFNtKVREw/export?format=csv";
    
    console.log('Buscando dados da planilha:', SHEETS_URL);
    
    // Buscar dados da planilha
    const response = await fetch(SHEETS_URL);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar planilha: ${response.status}`);
    }
    
    const csvText = await response.text();
    console.log('CSV recebido:', csvText.substring(0, 200));
    
    // Processar CSV
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('Planilha vazia ou sem dados');
    }
    
    // Assumindo que a primeira linha são os headers: gaiola, chegou, motorista, observacoes
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('Headers encontrados:', headers);
    
    const gaiolas: Record<string, any> = {};
    
    // Processar cada linha de dados
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length >= 2 && values[0]) {
        const gaiolaId = values[0];
        const chegou = values[1]?.toLowerCase() === 'true' || 
                      values[1]?.toLowerCase() === 'sim' ||
                      values[1] === '1';
        
        gaiolas[gaiolaId] = {
          gaiola: gaiolaId,
          chegou,
          horarioChegada: chegou ? new Date().toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : null,
          vaga: null,
          motorista: values[2] || `Motorista ${gaiolaId}`,
          observacoes: values[3] || '',
          status: 'esperando',
          chamadoPor: null,
          chamadoEm: null
        };
      }
    }

    console.log('Gaiolas processadas:', Object.keys(gaiolas).length);

    // Armazenar dados no Supabase (opcional) ou retornar para o frontend
    const result = {
      success: true,
      data: gaiolas,
      timestamp: new Date().toISOString(),
      count: Object.keys(gaiolas).length
    };

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Erro na sincronização:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
})