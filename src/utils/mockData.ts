// Sistema de dados em tempo real - substitui dados mockados
export const loadMockData = () => {
  // Primeiro, tentar carregar dados reais da planilha
  const savedData = localStorage.getItem('mock_gaiolas_data');
  if (savedData) {
    try {
      const parsed = JSON.parse(savedData);
      console.log('Dados carregados do localStorage:', Object.keys(parsed).length, 'gaiolas');
      return parsed;
    } catch (error) {
      console.error('Erro ao carregar dados salvos:', error);
    }
  }

  // Se não há dados, retornar objeto vazio - dados serão carregados via sincronização
  console.log('Nenhum dado encontrado, aguardando sincronização...');
  return {};
};

// Função para atualizar status de uma gaiola
export const updateGaiolaStatus = (gaiolaId: string, status: string, vagaId?: string) => {
  const savedData = localStorage.getItem('mock_gaiolas_data');
  if (!savedData) {
    console.warn('Nenhum dado encontrado para atualizar');
    return;
  }

  try {
    const gaiolas = JSON.parse(savedData);
    if (gaiolas[gaiolaId]) {
      gaiolas[gaiolaId].status = status;
      if (status === 'chamado' && vagaId) {
        gaiolas[gaiolaId].chamadoPor = vagaId;
        gaiolas[gaiolaId].chamadoEm = new Date().toISOString();
        gaiolas[gaiolaId].vaga = vagaId;
      }
      localStorage.setItem('mock_gaiolas_data', JSON.stringify(gaiolas));
      console.log(`Status da gaiola ${gaiolaId} atualizado para ${status}`);
    } else {
      console.warn(`Gaiola ${gaiolaId} não encontrada`);
    }
  } catch (error) {
    console.error('Erro ao atualizar status da gaiola:', error);
  }
};

// Função para verificar se gaiola já foi chamada
export const isGaiolaChamada = (gaiolaId: string): { chamada: boolean, vagaId?: string } => {
  const savedData = localStorage.getItem('mock_gaiolas_data');
  if (!savedData) return { chamada: false };

  try {
    const gaiolas = JSON.parse(savedData);
    const gaiola = gaiolas[gaiolaId];
    if (gaiola && gaiola.status === 'chamado') {
      return { chamada: true, vagaId: gaiola.chamadoPor };
    }
  } catch (error) {
    console.error('Erro ao verificar status da gaiola:', error);
  }
  
  return { chamada: false };
};

// Função para forçar sincronização manual
export const triggerManualSync = () => {
  window.dispatchEvent(new CustomEvent('gaiolasManualSync'));
};

// Manter compatibilidade com código existente
export const generateMockGaiolas = () => {
  return loadMockData();
};

export const saveMockData = () => {
  return loadMockData();
};