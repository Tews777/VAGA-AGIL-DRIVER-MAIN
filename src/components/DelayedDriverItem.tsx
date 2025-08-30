import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DriverData } from "@/hooks/useDriverData";
import { statusStore } from "@/hooks/StatusStore";

interface DelayedDriverItemProps {
  driver: DriverData;
  onSetDriverStatus: (gaiola: string, status: DriverData["status"], vaga?: string) => void;
  onSyncNames: () => void;
  toast: {
    success: (props: { title: string; description: string }) => void;
    error: (props: { title: string; description: string }) => void;
  };
}

export const DelayedDriverItem = ({ 
  driver, 
  onSetDriverStatus, 
  onSyncNames, 
  toast 
}: DelayedDriverItemProps) => {
  // Estado local para acompanhar a edição da vaga
  const [isEditing, setIsEditing] = useState(false);
  const [vagaInput, setVagaInput] = useState(driver.vaga || "");

  return (
    <div className="flex items-center justify-between p-4 border-2 border-red-300 rounded-lg bg-red-50">
      <div className="flex items-center gap-3">
        <Badge className="bg-red-500 text-white">{driver.gaiola}</Badge>
        <div>
          <div className="font-semibold">{driver.motorista}</div>
          <div className="text-sm font-medium text-red-700">
            Status: MOTORISTA ATRASADO
          </div>
          {driver.vaga ? (
            <div className="text-xs text-red-600 font-medium">
              Vaga: {driver.vaga}
            </div>
          ) : (
            <div className="text-xs text-red-600 font-medium">
              Sem vaga atribuída
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <input
              type="text"
              value={vagaInput}
              onChange={(e) => setVagaInput(e.target.value)}
              placeholder="C1, C2..."
              className="w-16 h-8 px-2 border border-gray-300 rounded-md text-sm"
            />
            <Button
              size="sm"
              variant="default"
              className="h-8"
              onClick={() => {
                if (vagaInput.trim()) {
                  // Atualizar status no StatusStore centralizado
                  statusStore.updateDriverStatus({
                    vagaId: vagaInput,
                    gaiola: driver.gaiola,
                    status: "entrar_hub",
                    source: "delayed_driver_item"
                  });
                  
                  // Manter compatibilidade com sistema existente
                  onSetDriverStatus(driver.gaiola, "entrar_hub", vagaInput);
                  setIsEditing(false);
                  
                  // Garantir que os dados estejam atualizados em todos os formatos
                  setTimeout(() => {
                    // Usar a função de sincronização para manter nomes consistentes
                    onSyncNames();
                  }, 200);
                  
                  toast({
                    title: "Vaga atribuída",
                    description: `O motorista atrasado foi designado para a vaga ${vagaInput}`,
                  });
                }
              }}
            >
              Salvar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => setIsEditing(false)}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => {
                setIsEditing(true);
                setVagaInput(driver.vaga || "");
              }}
            >
              {driver.vaga ? "Alterar Vaga" : "Definir Vaga"}
            </Button>
            
            {driver.vaga && (
              <Button
                size="sm"
                variant="default"
                className="h-8 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  // ✅ COMPORTAMENTO ORIGINAL PRIMEIRO
                  // Chamar motorista atrasado para a vaga definida
                  onSetDriverStatus(driver.gaiola, "entrar_hub", driver.vaga);
                  
                  // ✨ StatusStore como complemento (não crítico)
                  try {
                    statusStore.updateDriverStatus({
                      vagaId: driver.vaga || "",
                      gaiola: driver.gaiola,
                      status: "entrar_hub",
                      source: "delayed_driver_item_call"
                    });
                  } catch (error) {
                    console.warn('[StatusStore] Erro na sincronização (não crítico):', error);
                  }
                  
                  // Garantir que os dados estejam atualizados em todos os formatos
                  setTimeout(() => {
                    // Usar a função de sincronização para manter nomes consistentes
                    onSyncNames();
                  }, 200);
                  
                  toast({
                    title: "Motorista chamado",
                    description: `O motorista atrasado foi chamado para a vaga ${driver.vaga}`,
                  });
                }}
              >
                Chamar
              </Button>
            )}
            
            <Button
              size="sm"
              variant="default"
              className="h-8 bg-slate-600 hover:bg-slate-700"
              onClick={() => {
                // ✅ COMPORTAMENTO ORIGINAL PRIMEIRO
                onSetDriverStatus(driver.gaiola, "esperar_fora_hub");
                
                // ✨ StatusStore como complemento (não crítico)
                try {
                  statusStore.updateDriverStatus({
                    gaiola: driver.gaiola,
                    status: "esperar_fora_hub",
                    source: "delayed_driver_item_reset"
                  });
                } catch (error) {
                  console.warn('[StatusStore] Erro na sincronização (não crítico):', error);
                }
              }}
            >
              Resetar Status
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default DelayedDriverItem;
