import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

interface AnalystCalledActionsProps {
  vagaId: string;
  onAnalystAction?: (acknowledged: boolean) => void;
}

export const AnalystCalledActions = ({ vagaId, onAnalystAction }: AnalystCalledActionsProps) => {
  // Verificar se o elemento já foi respondido
  const respondedKey = `vaga_${vagaId}_analyst_responded`;
  const hasResponded = localStorage.getItem(respondedKey) === 'true';
  
  // Se já respondeu, não mostrar nada
  if (hasResponded) {
    return null;
  }

  // Lidar com a ação de "Confirmar"
  const handleAnalystAcknowledged = () => {
    // Marcar que esta ação já foi respondida
    localStorage.setItem(`vaga_${vagaId}_analyst_responded`, 'true');
    
    // Chamar a callback para tratar a ação no componente pai
    if (onAnalystAction) {
      onAnalystAction(true);
    }
  };

  return (
    <div className="flex justify-end">
      
      <Button 
        variant="default" 
        size="sm" 
        className="bg-blue-600 hover:bg-blue-700" 
        onClick={handleAnalystAcknowledged}
      >
        Confirmar
      </Button>
    </div>
  );
};

export default AnalystCalledActions;
