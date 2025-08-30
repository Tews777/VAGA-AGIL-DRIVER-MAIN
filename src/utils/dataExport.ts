import { VagaData, HistoryEntry } from "@/hooks/useVagaData";

export interface ExportData {
  vaga: string;
  data: string;
  hora: string;
  gaiola: string;
  acao: string;
  status_anterior?: string;
  status_novo?: string;
  duracao_segundos?: number;
  duracao_formatada?: string;
  check_status?: boolean;
  usuario: string;
}

export const formatDuration = (seconds: number): string => {
  if (!seconds) return "00:00:00";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const getActionDescription = (action: string): string => {
  const descriptions: Record<string, string> = {
    gaiola_set: "Gaiola Definida",
    chamado: "Chamado Realizado",
    carregando: "Iniciou Carregamento",
    finalizado: "Finalizou Carregamento",
    reset: "Reset da Vaga",
    check_toggle: "Toggle Check"
  };
  
  return descriptions[action] || action;
};

export const prepareExportData = (
  vagasData: Record<string, VagaData>, 
  startDate: string, 
  endDate: string
): ExportData[] => {
  const exportData: ExportData[] = [];
  
  Object.values(vagasData).forEach(vaga => {
    vaga.history.forEach(entry => {
      const entryDate = entry.timestamp.split('T')[0];
      
      if (entryDate >= startDate && entryDate <= endDate) {
        const date = new Date(entry.timestamp);
        
        exportData.push({
          vaga: `VAGA ${vaga.id.padStart(2, '0')}`,
          data: date.toLocaleDateString('pt-BR'),
          hora: date.toLocaleTimeString('pt-BR'),
          gaiola: entry.details.gaiola || vaga.gaiola || "---",
          acao: getActionDescription(entry.action),
          status_anterior: entry.details.oldStatus,
          status_novo: entry.details.newStatus,
          duracao_segundos: entry.details.duration,
          duracao_formatada: entry.details.duration ? formatDuration(entry.details.duration) : undefined,
          check_status: entry.details.checkStatus,
          usuario: entry.user
        });
      }
    });
  });
  
  // Ordenar por data/hora
  exportData.sort((a, b) => {
    const dateA = new Date(`${a.data.split('/').reverse().join('-')} ${a.hora}`);
    const dateB = new Date(`${b.data.split('/').reverse().join('-')} ${b.hora}`);
    return dateA.getTime() - dateB.getTime();
  });
  
  return exportData;
};

export const exportToCSV = (data: ExportData[], filename: string = "relatorio_vagas.csv"): void => {
  const headers = [
    "Vaga",
    "Data", 
    "Hora",
    "Gaiola",
    "Ação",
    "Status Anterior",
    "Status Novo",
    "Duração (segundos)",
    "Duração (formatada)",
    "Check Status",
    "Usuário"
  ];
  
  const csvContent = [
    headers.join(","),
    ...data.map(row => [
      row.vaga,
      row.data,
      row.hora,
      row.gaiola,
      row.acao,
      row.status_anterior || "",
      row.status_novo || "",
      row.duracao_segundos || "",
      row.duracao_formatada || "",
      row.check_status !== undefined ? (row.check_status ? "SIM" : "NÃO") : "",
      row.usuario
    ].map(field => `"${field}"`).join(","))
  ].join("\n");
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const generateSummaryReport = (vagasData: Record<string, VagaData>, startDate: string, endDate: string) => {
  const summary = {
    totalVagas: Object.keys(vagasData).length,
    totalGaiolas: 0,
    totalChamados: 0,
    totalFinalizados: 0,
    tempoMedioCarregamento: 0,
    tempoMedioChamado: 0,
    vagaMaisAtiva: "",
    vagaMaisAtivaCont: 0,
    performance: {} as Record<string, any>
  };
  
  Object.values(vagasData).forEach(vaga => {
    const rangeHistory = vaga.history.filter(entry => {
      const entryDate = entry.timestamp.split('T')[0];
      return entryDate >= startDate && entryDate <= endDate;
    });
    
    const finalizados = rangeHistory.filter(entry => entry.action === "finalizado");
    const chamados = rangeHistory.filter(entry => entry.action === "chamado");
    
    summary.totalGaiolas += finalizados.length;
    summary.totalChamados += chamados.length;
    summary.totalFinalizados += finalizados.length;
    
    if (finalizados.length > summary.vagaMaisAtivaCont) {
      summary.vagaMaisAtivaCont = finalizados.length;
      summary.vagaMaisAtiva = `VAGA ${vaga.id.padStart(2, '0')}`;
    }
    
    // Calcular tempos médios
    const temposCarregamento = finalizados
      .map(entry => entry.details.duration)
      .filter(duration => duration !== undefined) as number[];
    
    if (temposCarregamento.length > 0) {
      const somaCarregamento = temposCarregamento.reduce((acc, curr) => acc + curr, 0);
      summary.tempoMedioCarregamento += somaCarregamento / temposCarregamento.length;
    }
    
    summary.performance[vaga.id] = {
      gaiolas: finalizados.length,
      chamados: chamados.length,
      tempoMedio: temposCarregamento.length > 0 ? 
        temposCarregamento.reduce((acc, curr) => acc + curr, 0) / temposCarregamento.length : 0
    };
  });
  
  summary.tempoMedioCarregamento = summary.tempoMedioCarregamento / Object.keys(vagasData).length;
  
  return summary;
};