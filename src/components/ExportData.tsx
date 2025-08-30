// ExportData.tsx - Componente de exportação e relatórios
// Versão profissional refatorada com padrões enterprise-grade

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Download, FileSpreadsheet, Calendar, TrendingUp, BarChart3, 
  FileText, Settings, CheckCircle, AlertTriangle, Clock, 
  Target, Activity, Users, Truck 
} from "lucide-react";
import { VagaData } from "@/hooks/useVagaData";
import { 
  exportToCSV, prepareExportData, generateSummaryReport, 
  formatDuration, getActionDescription 
} from "@/utils/dataExport";
import { useToast } from "@/hooks/use-toast";

// Interfaces TypeScript
export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf';
  includeHeaders: boolean;
  includeMetadata: boolean;
  includeCharts: boolean;
  groupByVaga: boolean;
  filterStatus?: string[];
  sortBy: 'date' | 'vaga' | 'duration' | 'status';
  sortOrder: 'asc' | 'desc';
}

export interface ExportProgress {
  stage: 'preparing' | 'processing' | 'generating' | 'completed';
  progress: number;
  message?: string;
  recordsProcessed?: number;
  totalRecords?: number;
}

export interface ExportDataProps {
  vagasData: Record<string, VagaData>;
  enableAdvancedFeatures?: boolean;
  maxRecords?: number;
  allowCustomFormats?: boolean;
}

export interface ReportMetrics {
  totalGaiolas: number;
  totalChamados: number;
  totalFinalizados: number;
  tempoMedioCarregamento: number;
  eficienciaGeral: number;
  vagaMaisAtiva?: string;
  vagaMaisAtivaCont: number;
  performance: Record<string, {
    gaiolas: number;
    tempoMedio: number;
    eficiencia: number;
    chamados: number;
    finalizados: number;
  }>;
  tendenciaSemanal: {
    periodo: string;
    gaiolas: number;
    eficiencia: number;
  }[];
  distribuicaoStatus: Record<string, number>;
  horariosAtividade: Record<number, number>;
}

export interface CustomFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between';
  value: string | number | [string | number, string | number];
}

// Constantes
const EXPORT_CONSTANTS = {
  DEFAULT_MAX_RECORDS: 50000,
  DATE_FORMATS: {
    ISO: 'YYYY-MM-DD',
    BR: 'DD/MM/YYYY',
    US: 'MM/DD/YYYY'
  },
  STATUS_OPTIONS: [
    { value: 'esperar', label: 'Aguardando', color: 'blue' },
    { value: 'chamado', label: 'Chamado', color: 'yellow' },
    { value: 'carregando', label: 'Carregando', color: 'orange' },
    { value: 'finalizado', label: 'Finalizado', color: 'green' }
  ],
  SORT_OPTIONS: [
    { value: 'date', label: 'Data/Hora' },
    { value: 'vaga', label: 'Vaga' },
    { value: 'duration', label: 'Duração' },
    { value: 'status', label: 'Status' }
  ]
} as const;

export const ExportData: React.FC<ExportDataProps> = ({
  vagasData,
  enableAdvancedFeatures = true,
  maxRecords = EXPORT_CONSTANTS.DEFAULT_MAX_RECORDS,
  allowCustomFormats = true
}) => {
  const { toast } = useToast();
  
  // Estados locais
  const [startDate, setStartDate] = useState(
    () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    includeHeaders: true,
    includeMetadata: true,
    includeCharts: false,
    groupByVaga: false,
    sortBy: 'date',
    sortOrder: 'desc'
  });
  const [customFilters, setCustomFilters] = useState<CustomFilter[]>([]);
  const [selectedTab, setSelectedTab] = useState('basic');

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);

  // Validação de datas
  const dateValidation = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    
    const errors: string[] = [];
    
    if (start > end) {
      errors.push('Data inicial deve ser anterior à data final');
    }
    
    if (start > now) {
      errors.push('Data inicial não pode ser no futuro');
    }
    
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 365) {
      errors.push('Período máximo de 1 ano');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      periodDays: diffDays
    };
  }, [startDate, endDate]);

  // Função para criar métricas vazias
  const createEmptyMetrics = useCallback((): ReportMetrics => ({
    totalGaiolas: 0,
    totalChamados: 0,
    totalFinalizados: 0,
    tempoMedioCarregamento: 0,
    eficienciaGeral: 0,
    vagaMaisAtivaCont: 0,
    performance: {},
    tendenciaSemanal: [],
    distribuicaoStatus: {},
    horariosAtividade: {}
  }), []);

  // Função para calcular tendência semanal
  const calculateWeeklyTrend = useCallback((
    data: Record<string, VagaData>, 
    start: string, 
    end: string
  ) => {
    const trends: { periodo: string; gaiolas: number; eficiencia: number }[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Dividir período em semanas
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekData = generateSummaryReport(
        data, 
        currentDate.toISOString().split('T')[0],
        weekEnd.toISOString().split('T')[0]
      );
      
      trends.push({
        periodo: `${currentDate.getDate()}/${currentDate.getMonth() + 1}`,
        gaiolas: weekData.totalGaiolas,
        eficiencia: weekData.totalChamados > 0 
          ? (weekData.totalFinalizados / weekData.totalChamados) * 100 
          : 0
      });
      
      currentDate.setDate(currentDate.getDate() + 7);
    }
    
    return trends;
  }, []);

  // Função para enriquecer dados de performance
  const enhancePerformanceData = useCallback((performance: any) => {
    const enhanced: Record<string, any> = {};
    
    Object.entries(performance).forEach(([vagaId, data]: [string, any]) => {
      enhanced[vagaId] = {
        ...data,
        eficiencia: data.chamados > 0 ? (data.finalizados / data.chamados) * 100 : 0,
        finalizados: data.finalizados || 0,
        chamados: data.chamados || 0
      };
    });
    
    return enhanced;
  }, []);

  // Gerar relatório de métricas
  const reportMetrics = useMemo((): ReportMetrics => {
    try {
      const baseReport = generateSummaryReport(vagasData, startDate, endDate);
      
      // Calcular métricas adicionais
      const allEntries = Object.values(vagasData).flatMap(vaga => 
        vaga.history.filter(entry => {
          const entryDate = entry.timestamp.split('T')[0];
          return entryDate >= startDate && entryDate <= endDate;
        })
      );

      // Distribuição por status
      const distribuicaoStatus: Record<string, number> = {};
      allEntries.forEach(entry => {
        if (entry.action && entry.action !== 'gaiola_set') {
          distribuicaoStatus[entry.action] = (distribuicaoStatus[entry.action] || 0) + 1;
        }
      });

      // Atividade por horário
      const horariosAtividade: Record<number, number> = {};
      allEntries.forEach(entry => {
        const hour = new Date(entry.timestamp).getHours();
        horariosAtividade[hour] = (horariosAtividade[hour] || 0) + 1;
      });

      // Eficiência geral
      const totalFinalizados = baseReport.totalFinalizados;
      const totalChamados = baseReport.totalChamados;
      const eficienciaGeral = totalChamados > 0 ? (totalFinalizados / totalChamados) * 100 : 0;

      // Tendência semanal
      const tendenciaSemanal = calculateWeeklyTrend(vagasData, startDate, endDate);

      return {
        ...baseReport,
        eficienciaGeral,
        distribuicaoStatus,
        horariosAtividade,
        tendenciaSemanal,
        performance: enhancePerformanceData(baseReport.performance)
      };
    } catch (error) {
      console.error('Erro ao gerar métricas:', error);
      return createEmptyMetrics();
    }
  }, [vagasData, startDate, endDate, createEmptyMetrics, calculateWeeklyTrend, enhancePerformanceData]);

  // Função principal de exportação
  const handleExport = useCallback(async () => {
    if (!dateValidation.isValid) {
      toast({
        title: "❌ Erro nas datas",
        description: dateValidation.errors.join(', '),
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    setExportProgress({
      stage: 'preparing',
      progress: 0,
      message: 'Preparando exportação...'
    });

    // Criar AbortController
    abortControllerRef.current = new AbortController();

    try {
      // Simular preparação
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setExportProgress({
        stage: 'processing',
        progress: 25,
        message: 'Processando dados...'
      });

      // Preparar dados com filtros
      const exportData = await prepareFilteredExportData();
      
      if (exportData.length === 0) {
        toast({
          title: "⚠️ Nenhum dado encontrado",
          description: "Não há registros no período e filtros selecionados",
          variant: "destructive",
        });
        return;
      }

      setExportProgress({
        stage: 'generating',
        progress: 75,
        message: 'Gerando arquivo...',
        recordsProcessed: exportData.length,
        totalRecords: exportData.length
      });

      // Gerar arquivo
      const filename = generateFilename();
      
      switch (exportOptions.format) {
        case 'csv':
          await exportToCSV(exportData, filename);
          break;
        case 'json':
          await exportToJSON(exportData, filename);
          break;
        case 'pdf':
          await exportToPDF(exportData, filename);
          break;
        default:
          throw new Error('Formato de exportação não suportado');
      }

      setExportProgress({
        stage: 'completed',
        progress: 100,
        message: 'Exportação concluída!'
      });

      // Salvar histórico de exportação
      saveExportHistory(exportData.length, exportOptions.format);

      toast({
        title: "✅ Relatório exportado",
        description: `${exportData.length} registros exportados para ${filename}`,
      });

    } catch (error) {
      console.error('Erro na exportação:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        title: "❌ Erro na exportação",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setExportProgress(null);
      abortControllerRef.current = null;
    }
  }, [dateValidation, exportOptions, startDate, endDate, toast]);

  // Função para preparar dados filtrados
  const prepareFilteredExportData = useCallback(async () => {
    let exportData = prepareExportData(vagasData, startDate, endDate);
    
    // Aplicar filtros de status
    if (exportOptions.filterStatus && exportOptions.filterStatus.length > 0) {
      exportData = exportData.filter(record => 
        exportOptions.filterStatus!.includes(record.acao)
      );
    }

    // Aplicar filtros customizados
    customFilters.forEach(filter => {
      exportData = applyCustomFilter(exportData, filter);
    });

    // Aplicar ordenação
    exportData.sort((a, b) => {
      const multiplier = exportOptions.sortOrder === 'asc' ? 1 : -1;
      
      switch (exportOptions.sortBy) {
        case 'date':
          return multiplier * (new Date(a.data + ' ' + a.hora).getTime() - new Date(b.data + ' ' + b.hora).getTime());
        case 'vaga':
          return multiplier * a.vaga.localeCompare(b.vaga);
        case 'duration':
          return multiplier * ((a.duracao_segundos || 0) - (b.duracao_segundos || 0));
        case 'status':
          return multiplier * a.acao.localeCompare(b.acao);
        default:
          return 0;
      }
    });

    // Limitar registros se necessário
    if (exportData.length > maxRecords) {
      exportData = exportData.slice(0, maxRecords);
      toast({
        title: "⚠️ Dados limitados",
        description: `Exportação limitada a ${maxRecords} registros mais recentes`,
      });
    }

    return exportData;
  }, [vagasData, startDate, endDate, exportOptions, customFilters, maxRecords, toast]);

  // Função para aplicar filtro customizado
  const applyCustomFilter = useCallback((data: any[], filter: CustomFilter) => {
    return data.filter(record => {
      const fieldValue = record[filter.field];
      
      switch (filter.operator) {
        case 'equals':
          return fieldValue === filter.value;
        case 'contains':
          return String(fieldValue).toLowerCase().includes(String(filter.value).toLowerCase());
        case 'greater':
          return Number(fieldValue) > Number(filter.value);
        case 'less':
          return Number(fieldValue) < Number(filter.value);
        case 'between':
          const [min, max] = filter.value as [number, number];
          return Number(fieldValue) >= min && Number(fieldValue) <= max;
        default:
          return true;
      }
    });
  }, []);

  // Função para gerar nome do arquivo
  const generateFilename = useCallback(() => {
    const formatSuffix = exportOptions.format.toUpperCase();
    const dateRange = `${startDate}_${endDate}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    return `relatorio_vagas_${dateRange}_${timestamp}.${exportOptions.format}`;
  }, [startDate, endDate, exportOptions.format]);

  // Funções de exportação específicas
  const exportToJSON = useCallback(async (data: any[], filename: string) => {
    const jsonData = {
      metadata: {
        exportDate: new Date().toISOString(),
        period: { start: startDate, end: endDate },
        totalRecords: data.length,
        options: exportOptions
      },
      summary: reportMetrics,
      records: data
    };
    
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { 
      type: 'application/json' 
    });
    
    downloadBlob(blob, filename);
  }, [startDate, endDate, exportOptions, reportMetrics]);

  const exportToPDF = useCallback(async (data: any[], filename: string) => {
    // Implementação simplificada - em produção usar biblioteca como jsPDF
    const htmlContent = generateHTMLReport(data, reportMetrics);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    downloadBlob(blob, filename.replace('.pdf', '.html'));
  }, [reportMetrics]);

  // Função auxiliar para download
  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // Função para gerar relatório HTML
  const generateHTMLReport = useCallback((data: any[], metrics: ReportMetrics) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório de Performance - Vagas Ágil Driver</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
            .metric { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
            .metric-value { font-size: 24px; font-weight: bold; color: #2563eb; }
            .metric-label { font-size: 12px; color: #666; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f5f5f5; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Relatório de Performance</h1>
            <p>Período: ${startDate} a ${endDate}</p>
          </div>
          
          <div class="metrics">
            <div class="metric">
              <div class="metric-value">${metrics.totalGaiolas}</div>
              <div class="metric-label">Gaiolas Processadas</div>
            </div>
            <div class="metric">
              <div class="metric-value">${metrics.totalChamados}</div>
              <div class="metric-label">Total Chamados</div>
            </div>
            <div class="metric">
              <div class="metric-value">${metrics.totalFinalizados}</div>
              <div class="metric-label">Finalizados</div>
            </div>
            <div class="metric">
              <div class="metric-value">${metrics.eficienciaGeral.toFixed(1)}%</div>
              <div class="metric-label">Eficiência Geral</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Vaga</th>
                <th>Data</th>
                <th>Hora</th>
                <th>Gaiola</th>
                <th>Ação</th>
                <th>Duração</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(record => `
                <tr>
                  <td>${record.vaga}</td>
                  <td>${record.data}</td>
                  <td>${record.hora}</td>
                  <td>${record.gaiola}</td>
                  <td>${getActionDescription(record.acao)}</td>
                  <td>${record.duracao_formatada || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
  }, [startDate, endDate]);

  // Função para salvar histórico
  const saveExportHistory = useCallback((recordCount: number, format: string) => {
    try {
      const history = JSON.parse(localStorage.getItem('export_history') || '[]');
      const newEntry = {
        date: new Date().toISOString(),
        period: { start: startDate, end: endDate },
        recordCount,
        format,
        options: exportOptions
      };
      
      history.unshift(newEntry);
      localStorage.setItem('export_history', JSON.stringify(history.slice(0, 20))); // Manter 20 históricos
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }
  }, [startDate, endDate, exportOptions]);

  // Função para cancelar exportação
  const cancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      toast({
        title: "Exportação cancelada",
        description: "A operação foi interrompida pelo usuário",
      });
    }
  }, [toast]);

  // Handlers para opções de exportação
  const updateExportOption = useCallback(<K extends keyof ExportOptions>(
    key: K, 
    value: ExportOptions[K]
  ) => {
    setExportOptions(prev => ({ ...prev, [key]: value }));
  }, []);

  // Verificar se há dados no período
  const hasDataInPeriod = useMemo(() => {
    return reportMetrics.totalGaiolas > 0;
  }, [reportMetrics.totalGaiolas]);

  return (
    <div className="space-y-6">
      {/* Card Principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Exportar Dados e Relatórios
          </CardTitle>
          <CardDescription>
            Gere relatórios detalhados de performance e atividades das vagas
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Tabs para organizar funcionalidades */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="advanced">Avançado</TabsTrigger>
              <TabsTrigger value="analytics">Análises</TabsTrigger>
            </TabsList>

            {/* Tab Básico */}
            <TabsContent value="basic" className="space-y-4">
              {/* Seleção de período */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data Inicial
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    max={endDate}
                    disabled={isExporting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data Final
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    max={new Date().toISOString().split('T')[0]}
                    disabled={isExporting}
                  />
                </div>
              </div>

              {/* Validação de datas */}
              {!dateValidation.isValid && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {dateValidation.errors.join(', ')}
                  </AlertDescription>
                </Alert>
              )}

              {/* Informações do período */}
              {dateValidation.isValid && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Período selecionado: {dateValidation.periodDays} dia(s) • 
                    {hasDataInPeriod ? ` ${reportMetrics.totalGaiolas} gaiolas encontradas` : ' Nenhum dado encontrado'}
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* Tab Avançado */}
            <TabsContent value="advanced" className="space-y-4">
              {/* Opções de exportação */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Formato de Exportação</Label>
                  <Select 
                    value={exportOptions.format} 
                    onValueChange={(value: 'csv' | 'json' | 'pdf') => 
                      updateExportOption('format', value)
                    }
                    disabled={isExporting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV (Excel)</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      {allowCustomFormats && (
                        <SelectItem value="pdf">PDF/HTML</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ordenar Por</Label>
                  <Select 
                    value={exportOptions.sortBy} 
                    onValueChange={(value: ExportOptions['sortBy']) => 
                      updateExportOption('sortBy', value)
                    }
                    disabled={isExporting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPORT_CONSTANTS.SORT_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Opções adicionais */}
              <div className="space-y-3">
                <Label>Opções de Conteúdo</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-headers"
                      checked={exportOptions.includeHeaders}
                      onCheckedChange={(checked) => 
                        updateExportOption('includeHeaders', !!checked)
                      }
                      disabled={isExporting}
                    />
                    <Label htmlFor="include-headers" className="text-sm">
                      Incluir cabeçalhos
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-metadata"
                      checked={exportOptions.includeMetadata}
                      onCheckedChange={(checked) => 
                        updateExportOption('includeMetadata', !!checked)
                      }
                      disabled={isExporting}
                    />
                    <Label htmlFor="include-metadata" className="text-sm">
                      Incluir metadados
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="group-by-vaga"
                      checked={exportOptions.groupByVaga}
                      onCheckedChange={(checked) => 
                        updateExportOption('groupByVaga', !!checked)
                      }
                      disabled={isExporting}
                    />
                    <Label htmlFor="group-by-vaga" className="text-sm">
                      Agrupar por vaga
                    </Label>
                  </div>

                  {enableAdvancedFeatures && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="include-charts"
                        checked={exportOptions.includeCharts}
                        onCheckedChange={(checked) => 
                          updateExportOption('includeCharts', !!checked)
                        }
                        disabled={isExporting}
                      />
                      <Label htmlFor="include-charts" className="text-sm">
                        Incluir gráficos
                      </Label>
                    </div>
                  )}
                </div>
              </div>

              {/* Filtros de status */}
              <div className="space-y-2">
                <Label>Filtrar por Status</Label>
                <div className="flex flex-wrap gap-2">
                  {EXPORT_CONSTANTS.STATUS_OPTIONS.map(status => (
                    <div key={status.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status.value}`}
                        checked={exportOptions.filterStatus?.includes(status.value) ?? false}
                        onCheckedChange={(checked) => {
                          const currentFilters = exportOptions.filterStatus || [];
                          if (checked) {
                            updateExportOption('filterStatus', [...currentFilters, status.value]);
                          } else {
                            updateExportOption('filterStatus', 
                              currentFilters.filter(s => s !== status.value)
                            );
                          }
                        }}
                        disabled={isExporting}
                      />
                      <Label htmlFor={`status-${status.value}`} className="text-sm">
                        <Badge variant="outline" className={`text-${status.color}-600`}>
                          {status.label}
                        </Badge>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Tab Análises */}
            <TabsContent value="analytics" className="space-y-4">
              {/* Resumo do período */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    <Truck className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {reportMetrics.totalGaiolas}
                  </div>
                  <div className="text-sm text-blue-700">Gaiolas Processadas</div>
                </div>
                
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    <Users className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {reportMetrics.totalChamados}
                  </div>
                  <div className="text-sm text-yellow-700">Total Chamados</div>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {reportMetrics.totalFinalizados}
                  </div>
                  <div className="text-sm text-green-700">Finalizados</div>
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    <Target className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {reportMetrics.eficienciaGeral.toFixed(1)}%
                  </div>
                  <div className="text-sm text-purple-700">Eficiência</div>
                </div>
              </div>

              {/* Tempo médio */}
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-gray-600" />
                  <span className="text-sm text-gray-600">Tempo Médio de Carregamento</span>
                </div>
                <div className="text-lg font-bold text-gray-700">
                  {formatDuration(Math.round(reportMetrics.tempoMedioCarregamento))}
                </div>
              </div>

              {/* Vaga mais ativa */}
              {reportMetrics.vagaMaisAtiva && (
                <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                  <Badge variant="secondary" className="text-sm mb-2">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Vaga Mais Ativa
                  </Badge>
                  <div className="text-lg font-semibold">
                    VAGA {reportMetrics.vagaMaisAtiva} • {reportMetrics.vagaMaisAtivaCont} gaiolas
                  </div>
                </div>
              )}

              {/* Top 5 vagas */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4" />
                  Top 5 Vagas do Período
                </Label>
                <div className="space-y-2">
                  {Object.entries(reportMetrics.performance)
                    .sort(([,a], [,b]) => b.gaiolas - a.gaiolas)
                    .slice(0, 5)
                    .map(([vagaId, data], index) => (
                      <div key={vagaId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant={index === 0 ? "default" : "secondary"}>
                            #{index + 1}
                          </Badge>
                          <span className="font-medium">VAGA {vagaId.padStart(2, '0')}</span>
                        </div>
                        <div className="flex gap-6 text-sm">
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {data.gaiolas}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(Math.round(data.tempoMedio))}
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {data.eficiencia.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Distribuição de atividade por horário */}
              {Object.keys(reportMetrics.horariosAtividade).length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-3">
                    Horários de Maior Atividade
                  </Label>
                  <div className="grid grid-cols-6 gap-2">
                    {Array.from({length: 24}, (_, hour) => {
                      const count = reportMetrics.horariosAtividade[hour] || 0;
                      const maxCount = Math.max(...Object.values(reportMetrics.horariosAtividade));
                      const intensity = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      
                      return (
                        <div key={hour} className="text-center">
                          <div 
                            className="h-8 bg-blue-500 rounded mb-1"
                            style={{
                              opacity: intensity / 100,
                              backgroundColor: intensity > 0 ? '#3b82f6' : '#e5e7eb'
                            }}
                            title={`${hour}h: ${count} atividades`}
                          />
                          <div className="text-xs text-gray-600">{hour}h</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Progresso da exportação */}
          {isExporting && exportProgress && (
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="font-medium text-blue-800">
                    {exportProgress.message}
                  </span>
                </div>
                <Button 
                  onClick={cancelExport}
                  variant="outline" 
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  Cancelar
                </Button>
              </div>
              
              <Progress value={exportProgress.progress} className="w-full" />
              
              {exportProgress.recordsProcessed && exportProgress.totalRecords && (
                <div className="text-sm text-blue-700">
                  {exportProgress.recordsProcessed} de {exportProgress.totalRecords} registros processados
                </div>
              )}
            </div>
          )}

          {/* Botão principal de exportação */}
          <Button 
            onClick={handleExport} 
            className="w-full" 
            size="lg"
            disabled={isExporting || !dateValidation.isValid || !hasDataInPeriod}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting 
              ? 'Exportando...' 
              : `Baixar Relatório ${exportOptions.format.toUpperCase()}`
            }
          </Button>

          {/* Informações adicionais */}
          <div className="text-xs text-gray-600 text-center space-y-1">
            <p>
              O arquivo contém todos os registros de atividades, tempos e performance das vagas no período selecionado.
            </p>
            {exportOptions.includeMetadata && (
              <p>
                Inclui metadados como período de exportação, opções selecionadas e resumo analítico.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExportData;