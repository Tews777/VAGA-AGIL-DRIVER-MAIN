import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

/**
 * Hook para gerenciar o tempo de inatividade e fazer logout automático
 * @param timeoutMinutes Tempo de inatividade em minutos antes do logout
 */
export function useInactivityTimeout(timeoutMinutes: number = 30) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  useEffect(() => {
    let inactivityTimeout: NodeJS.Timeout | null = null;
    
    // Função para resetar o timer
    const resetTimer = () => {
      // Limpar o timeout anterior se existir
      if (inactivityTimeout) {
        clearTimeout(inactivityTimeout);
      }
      
      // Configurar novo timeout
      inactivityTimeout = setTimeout(() => {
        // Verificar se o usuário está logado
        const userType = localStorage.getItem('userType');
        if (userType) {
          // Fazer logout
          localStorage.removeItem('userType');
          localStorage.removeItem('vagaLoggedIn');
          
          // Notificar o usuário
          toast({
            title: 'Sessão expirada',
            description: 'Você foi desconectado devido a inatividade',
            variant: 'destructive',
          });
          
          // Redirecionar para a página de login
          navigate('/');
        }
      }, timeoutMinutes * 60 * 1000); // Converter minutos para milissegundos
    };
    
    // Eventos para resetar o timer
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    // Adicionar listeners para todos os eventos
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });
    
    // Inicializar o timer
    resetTimer();
    
    // Limpar na desmontagem do componente
    return () => {
      // Remover todos os listeners
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
      
      // Limpar o timeout
      if (inactivityTimeout) {
        clearTimeout(inactivityTimeout);
      }
    };
  }, [navigate, timeoutMinutes, toast]);
}
