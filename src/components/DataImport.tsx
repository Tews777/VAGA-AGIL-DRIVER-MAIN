// DataImport.tsx - Componente de importação via planilhas CORRIGIDO
import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, FileSpreadsheet, Wifi, CheckCircle, XCircle, 
  AlertTriangle, Download, Trash2, RefreshCw 
} from 'lucide-react';
import Papa from 'papaparse';

// Interfaces TypeScript
export interface ImportedData {
  gaiola: string;
  chegou: boolean;
  motorista?: string;
  observacoes?: string;
  status?: "esperar" | "chamado" | "carregando" | "finalizado";
  vaga?: string;
  timestamp?: string;
}

export interface ImportResult {
  success: boolean;
  data: ImportedData[];
  errors: ImportError[];
  totalRows: number;
  validRows: number;
  skippedRows: number;
  duration: number;
}

export interface ImportError {
  row: number;
  field: string;
  value: any;
  message: string;
  severity: "error" | "warning";
}

export interface DataImportProps {
  onDataImported: (result: ImportResult) => void;
  maxFileSize?: number;
  supportedFormats?: string[];
  enableRealtimeSync?: boolean;
}

// Constantes
const CONSTANTS = {
  MAX_FILE_SIZE: 10, // MB
  SUPPORTED_FORMATS: ['.csv', '.xlsx', '.xls'],
  CHUNK_SIZE: 100,
  COLUMN_ALIASES: {
    gaiola: ['gaiola', 'GAIOLA', 'Gaiola', 'letra', 'LETRA', 'Letra'],
    motorista: ['motorista', 'MOTORISTA', 'Motorista', 'nome', 'NOME', 'Nome', 'driver_name'],
    chegou: ['chegou', 'CHEGOU', 'Chegou', 'arrived', 'status'],
    observacoes: ['observacoes', 'OBSERVAÇÕES', 'observações', 'obs', 'notes'],
    vaga: ['vaga', 'VAGA', 'Vaga', 'dock', 'posicao']
  }
};

export const DataImport: React.FC<DataImportProps> = ({
  onDataImported,
  maxFileSize = CONSTANTS.MAX_FILE_SIZE,
  supportedFormats = CONSTANTS.SUPPORTED_FORMATS,
  enableRealtimeSync = false
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Estados do componente
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    stage: "parsing" | "processing" | "completed";
    progress: number;
    message: string;
    currentRow?: number;
    totalRows?: number;
  } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [lastImport, setLastImport] = useState<Date | null>(null);

  // Função para validar linha de dados
  const validateRow = useCallback((data: any, rowIndex: number): ImportError[] => {
    const errors: ImportError[] = [];
    
    if (!data.gaiola || typeof data.gaiola !== 'string' || data.gaiola.trim().length === 0) {
      errors.push({
        row: rowIndex,
        field: 'gaiola',
        value: data.gaiola,
        message: 'Gaiola é obrigatória e deve ser um texto',
        severity: 'error'
      });
    }
    
    return errors;
  }, []);

  // Função para validar arquivo
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      return {
        valid: false,
        error: `Arquivo muito grande. Máximo permitido: ${maxFileSize}MB`
      };
    }

    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const isValidFormat = supportedFormats.some(format => format === fileExtension);
    if (!isValidFormat) {
      return {
        valid: false,
        error: `Formato não suportado. Formatos aceitos: ${supportedFormats.join(', ')}`
      };
    }

    return { valid: true };
  }, [maxFileSize, supportedFormats]);

  // Função para mapear colunas usando aliases
  const mapColumnName = useCallback((columnName: string): string | null => {
    const normalizedName = columnName.trim();
    
    for (const [standardName, aliases] of Object.entries(CONSTANTS.COLUMN_ALIASES)) {
      const aliasArray = aliases as readonly string[];
      if (aliasArray.includes(normalizedName)) {
        return standardName;
      }
    }
    
    return null;
  }, []);

  // Função auxiliar para interpretar valores booleanos
  const parseBooleanValue = useCallback((value: any): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();
      return ['true', '1', 'sim', 'yes', 'chegou'].includes(lowerValue);
    }
    if (typeof value === 'number') return value > 0;
    return false;
  }, []);

  // Função para processar dados CSV
  const processCSVData = useCallback(async (
    data: any[], 
    headers: string[]
  ): Promise<ImportResult> => {
    const startTime = Date.now();
    const errors: ImportError[] = [];
    const processedData: ImportedData[] = [];

    console.log('🔄 Iniciando processamento CSV');
    console.log('📋 Headers encontrados:', headers);
    console.log('📊 Total de linhas:', data.length);

    // Processar cada linha de dados
    for (let i = 0; i < data.length; i++) {
      const originalRow = data[i];
      
      // Tratar caso específico da planilha: LETRA como gaiola, NOME como motorista
      const gaiolaValue = originalRow.LETRA || originalRow.Letra || originalRow.letra || originalRow.gaiola;
      const motoristaValue = originalRow.NOME || originalRow.Nome || originalRow.nome || originalRow.motorista;

      // Validar se tem pelo menos a gaiola
      if (gaiolaValue && gaiolaValue.toString().trim()) {
        try {
          const processedItem: ImportedData = {
            gaiola: gaiolaValue.toString().trim().toUpperCase(),
            chegou: parseBooleanValue(originalRow.chegou || false),
            motorista: motoristaValue?.toString().trim() || undefined,
            observacoes: originalRow.observacoes?.toString().trim() || undefined,
            status: originalRow.status || 'esperar',
            vaga: originalRow.vaga?.toString().trim() || undefined,
            timestamp: new Date().toISOString()
          };
          processedData.push(processedItem);
          console.log('✅ Item processado:', processedItem);
        } catch (itemError) {
          console.error('❌ Erro ao processar item da linha', i + 1, ':', itemError);
          errors.push({
            row: i + 1,
            field: 'processamento',
            value: originalRow,
            message: `Erro ao processar linha: ${itemError}`,
            severity: 'error'
          });
        }
      } else {
        console.log('⚠️ Linha', i + 1, 'ignorada - sem gaiola válida');
      }
    }

    const duration = Date.now() - startTime;
    const result = {
      success: errors.filter(e => e.severity === 'error').length === 0,
      data: processedData,
      errors,
      totalRows: data.length,
      validRows: processedData.length,
      skippedRows: data.length - processedData.length,
      duration
    };
    
    console.log('🎯 Resultado final:', result);
    return result;
  }, [parseBooleanValue]);

  // Função principal de processamento de arquivo
  const handleFileUpload = useCallback(async (file: File) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      toast({
        title: "Arquivo inválido",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportProgress({
      stage: 'parsing',
      progress: 0,
      message: 'Iniciando análise do arquivo...'
    });

    try {
      const result = await new Promise<ImportResult>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            try {
              setImportProgress({
                stage: 'processing',
                progress: 50,
                message: 'Processando dados...'
              });

              const processedResult = await processCSVData(
                results.data as any[], 
                results.meta.fields || []
              );
              
              resolve(processedResult);
            } catch (error) {
              reject(error);
            }
          },
          error: (error) => {
            reject(new Error(`Erro ao processar arquivo: ${error.message}`));
          }
        });
      });

      setImportProgress({
        stage: 'completed',
        progress: 100,
        message: 'Importação concluída!'
      });

      setLastImport(new Date());
      onDataImported(result);

      toast({
        title: result.success ? "✅ Importação bem-sucedida" : "⚠️ Importação com avisos",
        description: `${result.validRows} linhas processadas de ${result.totalRows}`,
      });

    } catch (error) {
      console.error('Erro na importação:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        title: "❌ Erro na importação",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setImportProgress(null);
      abortControllerRef.current = null;
    }
  }, [validateFile, processCSVData, onDataImported, toast]);

  // Handlers de drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, [handleFileUpload]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
      e.target.value = '';
    }
  }, [handleFileUpload]);

  const downloadTemplate = useCallback(() => {
    const csvContent = 'Turno,LETRA,NOME\nPM,A-1,João Silva\nPM,A-2,Maria Santos';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_motoristas.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Importação de Dados
        </h2>
        <p className="text-gray-600">
          Faça upload de planilhas CSV ou Excel com dados dos motoristas
        </p>
      </div>

      {/* Status da importação */}
      {isImporting && importProgress && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3 mb-3">
              <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
              <span className="text-blue-800 font-medium">
                {importProgress.message}
              </span>
            </div>
            <Progress value={importProgress.progress} className="w-full" />
            {importProgress.currentRow && importProgress.totalRows && (
              <p className="text-sm text-blue-600 mt-2">
                Linha {importProgress.currentRow} de {importProgress.totalRows}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Área de upload */}
      <Card className={`border-2 border-dashed transition-colors duration-200 ${
        dragActive 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-300 hover:border-gray-400'
      }`}>
        <CardContent
          className="p-8 text-center cursor-pointer"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={supportedFormats.join(',')}
            onChange={handleInputChange}
            className="hidden"
            disabled={isImporting}
          />
          
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <Upload className="h-8 w-8 text-gray-600" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Clique para selecionar ou arraste arquivos aqui
              </h3>
              <p className="text-gray-600">
                Formatos suportados: {supportedFormats.join(', ')}
              </p>
              <p className="text-sm text-gray-500">
                Tamanho máximo: {maxFileSize}MB
              </p>
            </div>
            
            <Button
              variant="outline"
              className="mt-4"
              disabled={isImporting}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Selecionar Arquivo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Template de exemplo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Download className="h-5 w-5" />
            <span>Template de Exemplo</span>
          </CardTitle>
          <CardDescription>
            Baixe um template para facilitar a importação dos dados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Template com as colunas: <Badge variant="outline">Turno</Badge>, 
                <Badge variant="outline" className="ml-1">LETRA</Badge>, 
                <Badge variant="outline" className="ml-1">NOME</Badge>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar Template
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Informações sobre a última importação */}
      {lastImport && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Última importação realizada em: {lastImport.toLocaleString('pt-BR')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
