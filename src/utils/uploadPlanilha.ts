export interface DriverPlanilha {
  Turno: string;
  Letra: string;
  Nome: string;
  TipoVeiculo?: string; // Nova campo para tipo de veículo
}

const normalizeString = (value: unknown): string => {
  return String(value || '').trim();
};

export const processExcel = async (file: File): Promise<DriverPlanilha[]> => {
  try {
    // Import dinâmico do xlsx para reduzir bundle inicial
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

    if (workbook.SheetNames.length === 0) {
      throw new Error("A planilha está vazia");
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Converter para array para podermos verificar o cabeçalho
    const dataArray = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      blankrows: false
    }) as any[][];

    if (!dataArray.length) {
      throw new Error("Nenhum dado encontrado na planilha");
    }

    // Pegar o cabeçalho e normalizar
    const headers = dataArray[0].map(h => String(h || '').trim());
    console.log("Cabeçalhos encontrados:", headers);

    // Encontrar índices das colunas necessárias - com detecção de cabeçalhos mais flexível
    let turnoIdx = headers.findIndex(h => /^turn?o$/i.test(h));
    let letraIdx = headers.findIndex(h => /^letra$/i.test(h) || /^gaiola$/i.test(h));
    let nomeIdx = headers.findIndex(h => /^nome$/i.test(h) || /^motorista$/i.test(h));
    let tipoVeiculoIdx = headers.findIndex(h => /^tipo.*ve[ií]culo$/i.test(h) || /^ve[ií]culo$/i.test(h) || /^tipo$/i.test(h));
    
    // Verificação secundária para cabeçalhos que possam estar com formatação diferente
    if (turnoIdx === -1) {
      turnoIdx = headers.findIndex(h => h.toLowerCase().includes('turno') || h === 'TURNO');
    }
    
    // Verificação secundária ESPECÍFICA para o formato exato "Tipo de Veículo"
    if (tipoVeiculoIdx === -1) {
      tipoVeiculoIdx = headers.findIndex(h => h === 'Tipo de Veículo' || h === 'Tipo De Veículo');
    }
    if (tipoVeiculoIdx === -1) {
      tipoVeiculoIdx = headers.findIndex(h => {
        const lowerH = h.toLowerCase();
        return (
          lowerH.includes('tipo') && (lowerH.includes('veiculo') || lowerH.includes('veículo')) ||
          lowerH === 'veiculo' ||
          lowerH === 'veículo' ||
          lowerH === 'categoria' ||
          lowerH === 'tipo' ||
          lowerH === 'vehicle' || 
          lowerH === 'vehicle type' ||
          lowerH === 'tipoveiculo'
        );
      });
    }
    
    console.log("✅ [UPLOAD] Índices de colunas:", { 
      turno: turnoIdx, 
      letra: letraIdx, 
      nome: nomeIdx, 
      tipoVeiculo: tipoVeiculoIdx 
    });
    
    if (letraIdx === -1) {
      letraIdx = headers.findIndex(h => h.toLowerCase().includes('letra') || 
                                       h.toLowerCase().includes('gaiola') || 
                                       h === 'ID');
    }
    
    if (nomeIdx === -1) {
      nomeIdx = headers.findIndex(h => h.toLowerCase().includes('nome') || 
                                      h.toLowerCase().includes('motorista') || 
                                      h === 'DRIVER');
    }
    
    if (tipoVeiculoIdx === -1) {
      tipoVeiculoIdx = headers.findIndex(h => h.toLowerCase().includes('tipo') || 
                                            h.toLowerCase().includes('veiculo') || 
                                            h.toLowerCase().includes('veículo') ||
                                            h === 'TIPO DE VEICULO' ||
                                            h === 'TIPO DE VEÍCULO');
    }
    
    console.log("Cabeçalhos normalizados:", headers.map(h => h.toLowerCase().trim()));
    console.log("Índices encontrados - Turno:", turnoIdx, "Letra:", letraIdx, "Nome:", nomeIdx, "Tipo Veículo:", tipoVeiculoIdx);

    if (turnoIdx === -1 || letraIdx === -1 || nomeIdx === -1) {
      const missing = [];
      if (turnoIdx === -1) missing.push('Turno');
      if (letraIdx === -1) missing.push('Letra');
      if (nomeIdx === -1) missing.push('Nome');
      throw new Error(`Colunas obrigatórias não encontradas: ${missing.join(', ')}`);
    }

    console.log("Índices das colunas - Turno:", turnoIdx, "Letra:", letraIdx, "Nome:", nomeIdx, "Tipo Veículo:", tipoVeiculoIdx);

    // Processar as linhas de dados (pular o cabeçalho)
    const validRows = dataArray.slice(1)
      .filter(row => row && row.some(cell => cell)); // Ignorar linhas totalmente vazias
    
    console.log(`Total de ${validRows.length} linhas encontradas para processamento`);
    
    // Processar as linhas e pular as que não tiverem todos os dados necessários
    const drivers = validRows
      .map((row, idx) => {
        // Se a linha não tiver dados suficientes, pulamos
        if (!row[turnoIdx] && !row[letraIdx] && !row[nomeIdx]) {
          console.log(`Linha ${idx + 2} vazia, pulando.`);
          return null;
        }
        
        const turno = normalizeString(row[turnoIdx]);
        const letra = normalizeString(row[letraIdx]);
        const nome = normalizeString(row[nomeIdx]);
        const tipoVeiculo = tipoVeiculoIdx !== -1 ? normalizeString(row[tipoVeiculoIdx]) : '';

        // Verificar se todos os campos obrigatórios estão presentes
        if (!turno || !letra || !nome) {
          console.warn(`Linha ${idx + 2} ignorada: dados incompletos (Turno: ${turno}, Letra: ${letra}, Nome: ${nome})`);
          return null; // Ignorar linhas com dados incompletos
        }

        // Validar formato do turno
        const turnoNormalizado = turno.toUpperCase();
        if (!['AM', 'PM', 'SD'].includes(turnoNormalizado)) {
          console.warn(`Linha ${idx + 2} ignorada: Turno "${turno}" inválido. Use AM, PM ou SD`);
          return null;
        }
        
        // Validar o formato da letra (gaiola) - expandido para A-Z
        const letraNormalizada = letra.trim();
        
        // Processar o tipo de veículo corretamente
        let tipoVeiculoProcessado = '';
        if (tipoVeiculoIdx !== -1 && row[tipoVeiculoIdx]) {
          tipoVeiculoProcessado = String(row[tipoVeiculoIdx]).trim();
          console.log(`Linha ${idx + 2}: Tipo de Veículo encontrado: "${tipoVeiculoProcessado}"`);
        }
        
        // Verifica se já está no formato correto (A-Z com números)
        if (letraNormalizada.match(/^[A-Z]-\d{1,3}$/i)) {
          return {
            Turno: turnoNormalizado,
            Letra: letraNormalizada.toUpperCase(),
            Nome: nome,
            TipoVeiculo: tipoVeiculoProcessado // Sempre incluir, mesmo se vazio
          };
        } 
        
        // Tenta fazer uma correção automática simples
        const letraCorrigida = letraNormalizada
          .replace(/^([A-Z])(\d{1,3})$/i, '$1-$2')  // A1 -> A-1
          .replace(/^([A-Z])\s+(\d{1,3})$/i, '$1-$2'); // A 1 -> A-1
          
        if (letraCorrigida.match(/^[A-Z]-\d{1,3}$/i)) {
          console.log(`Linha ${idx + 2}: Letra corrigida de "${letra}" para "${letraCorrigida}"`);
          return {
            Turno: turnoNormalizado,
            Letra: letraCorrigida.toUpperCase(),
            Nome: nome,
            TipoVeiculo: tipoVeiculoProcessado // Sempre incluir, mesmo se vazio
          };
        }
        
        // Se não conseguiu corrigir, apenas avisa e continua
        console.warn(`Linha ${idx + 2}: Formato da gaiola "${letra}" não ideal, mas será aceito`);
        return {
          Turno: turnoNormalizado,
          Letra: letra.toUpperCase(),
          Nome: nome,
          TipoVeiculo: tipoVeiculoProcessado // Sempre incluir, mesmo se vazio
        };
      })
      .filter(driver => driver !== null) as DriverPlanilha[];
      
    console.log("Motoristas processados:", drivers);
    return drivers;

  } catch (error) {
    console.error("Erro ao processar planilha:", error);
    throw error;
  }
};
