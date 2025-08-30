import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { processExcel, DriverPlanilha } from "@/utils/uploadPlanilha";

interface ImportPlanilhaProps {
  onUpload: (drivers: DriverPlanilha[]) => void;
}

export function ImportPlanilha({ onUpload }: ImportPlanilhaProps) {
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verificar extensão
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls'].includes(fileExt || '')) {
      toast({
        title: "Erro no upload",
        description: "Por favor, selecione um arquivo Excel (.xlsx ou .xls)",
        variant: "destructive",
      });
      // Limpar o input para permitir nova seleção
      e.target.value = '';
      return;
    }

    try {
      const drivers = await processExcel(file);
      onUpload(drivers);
      toast({
        title: "Upload realizado com sucesso",
        description: `${drivers.length} motoristas importados da planilha`,
      });
    } catch (error) {
      toast({
        title: "Erro no processamento",
        description: error instanceof Error ? error.message : "Erro ao processar planilha",
        variant: "destructive",
      });
    } finally {
      // Limpar o input para permitir novo upload
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Upload className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Import de Planilha</h2>
      </div>
      
      <p className="text-sm text-slate-600">
        Importe dados de uma planilha Excel (.xlsx, .xls) com as colunas: Turno, Gaiola, Nome, Tipo de Veículo (opcional)
      </p>

      <div className="flex gap-2">
        <Input
          id="file-upload"
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          className="flex-1"
        />
        <Button 
          variant="secondary"
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          Selecionar
        </Button>
      </div>

      <div className="text-sm text-slate-600">
        <p>Formato esperado da planilha:</p>
        <ul className="list-disc list-inside mt-1">
          <li>Turno: AM, PM ou SD</li>
          <li>Gaiola: Código da gaiola (A-1, B-2, Z-15...)</li>
          <li>Nome: Nome do motorista</li>
          <li>Tipo de Veículo: Tipo do veículo (PASSEIO, VAN, MOTO, etc.) - opcional</li>
        </ul>
      </div>
    </div>
  );
}
