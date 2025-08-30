import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { notifyDelayedDriverCalled, notifyDriverEnterConfirmation } from "@/utils/notificationSystem";

interface DelayedDriverActionsProps {
  vagaId: string;
  gaiola: string;
  onDriverAction: (willEnter: boolean) => void;
  isDelayed?: boolean;
  isAdmin?: boolean;
}

export const DelayedDriverActions = ({ 
  vagaId, 
  gaiola, 
  onDriverAction, 
  isDelayed = true,
  isAdmin = false 
}: DelayedDriverActionsProps) => {
  // Sempre verificar se o elemento já foi respondido
  const respondedKey = `vaga_${vagaId}_delayed_responded`;
  const hasResponded = localStorage.getItem(respondedKey) === 'true';
  
  // Se já respondeu, ou não está atrasado, ou não tem gaiola, não mostrar nada
  if (hasResponded || !isDelayed || !gaiola) {
    console.log(`DelayedDriverActions: não exibindo botões para vaga ${vagaId} (respondido: ${hasResponded}, isDelayed: ${isDelayed})`);
    return null;
  }

  console.log(`DelayedDriverActions: exibindo botões para vaga ${vagaId} com gaiola ${gaiola}`);
  
  // Lidar com a ação de "Sim" - Motorista vai entrar no hub
  const handleDriverWillEnter = () => {
    // Primeiro marcar como respondido para evitar cliques duplos
    localStorage.setItem(`vaga_${vagaId}_delayed_responded`, 'true');
    
    // Notificar que motorista atrasado foi chamado para entrar no hub
    notifyDelayedDriverCalled(vagaId, gaiola);
    
    // Adicionar a nova notificação de confirmação de entrada
    notifyDriverEnterConfirmation(vagaId, gaiola);
    
    // Chamar a callback para tratar a ação no componente pai
    onDriverAction(true);
  };
  
  // Lidar com a ação de "Não" - Motorista não vai entrar no hub
  // Esta ação só está disponível para o Admin
  const handleDriverWontEnter = () => {
    // Primeiro marcar como respondido para evitar cliques duplos
    localStorage.setItem(`vaga_${vagaId}_delayed_responded`, 'true');
    
    // Chamar a callback para tratar a ação no componente pai
    onDriverAction(false);
  };

  return (
    <div className="w-full">      
      <div className="text-sm text-center text-gray-700 font-medium mb-3">
        {isAdmin ? 
          "O motorista vai entrar no hub para carregar?" :
          "Se o motorista chegar, clique em Sim para liberar a entrada:"
        }
      </div>
      
      <div className="flex justify-center gap-4">
        <Button 
          variant="default" 
          className="bg-green-500 hover:bg-green-600 w-20 h-10 font-bold text-white text-base border-0" 
          onClick={handleDriverWillEnter}
        >
          Sim
        </Button>
        
        {/* Botão "Não" só aparece para o Admin */}
        {isAdmin && (
          <Button 
            variant="default" 
            className="bg-red-500 hover:bg-red-600 w-20 h-10 font-bold text-white text-base border-0" 
            onClick={handleDriverWontEnter}
          >
            Não
          </Button>
        )}
      </div>
    </div>
  );
};

export default DelayedDriverActions;
