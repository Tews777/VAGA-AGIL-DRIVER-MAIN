import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Notification, getNotifications, markNotificationAsRead, setupNotificationListener } from "@/utils/notificationSystem";
import { useToast } from "@/hooks/use-toast";

interface NotificationCenterProps {
  context: "admin" | "vaga";
  vagaId?: string;
}

export function NotificationCenter({ context, vagaId }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Carregar notificações e configurar listener
  useEffect(() => {
    // Carregar notificações iniciais
    const loadNotifications = () => {
      const allNotifications = getNotifications();
      
      // Filtrar notificações relevantes para o contexto atual
      let relevantNotifications = context === "admin" 
        ? allNotifications // Admin vê todas
        : allNotifications.filter(n => n.vagaId === vagaId); // Vaga específica vê só as suas
      
      // Se for o contexto de vaga, excluir as notificações que estão sendo exibidas inline
      if (context === "vaga") {
        relevantNotifications = relevantNotifications.filter(
          n => n.type !== 'driver_wont_enter' && n.type !== 'delayed_driver_called'
        );
      }
      
      setNotifications(relevantNotifications);
      setUnreadCount(relevantNotifications.filter(n => !n.read).length);
    };
    
    loadNotifications();
    
    // Configurar listener para novas notificações
    const removeListener = setupNotificationListener((newNotification) => {
      // Verificar se a notificação é relevante para este contexto
      const isRelevant = context === "admin" || 
        (context === "vaga" && newNotification.vagaId === vagaId);
      
      // Se for contexto de vaga, não mostrar no centro de notificações as que serão exibidas inline
      const shouldShowInNotificationCenter = 
        context !== "vaga" || 
        (newNotification.type !== 'driver_wont_enter' && newNotification.type !== 'delayed_driver_called');
      
      if (isRelevant && shouldShowInNotificationCenter) {
        // Verificar se já existe uma notificação idêntica nos últimos 15 segundos
        const now = Date.now();
        const isDuplicate = notifications.some(n => 
          n.type === newNotification.type && 
          n.vagaId === newNotification.vagaId && 
          n.gaiola === newNotification.gaiola &&
          (now - n.timestamp) < 15000 // 15 segundos
        );
        
        // Se não for duplicada, adicionar à lista e exibir toast
        if (!isDuplicate) {
          setNotifications(prev => [newNotification, ...prev.slice(0, 19)]);
          setUnreadCount(prev => prev + 1);
          
          // Mostrar toast para notificações novas
          toast({
            title: getNotificationTitle(newNotification),
            description: newNotification.message,
            variant: getNotificationVariant(newNotification)
          });
        } else {
          console.log('Notificação duplicada ignorada no NotificationCenter:', newNotification);
        }
      }
    });
    
    // Listener para atualizações gerais de notificações
    const handleNotificationUpdate = () => loadNotifications();
    window.addEventListener('vaga_agil_notification_updated', handleNotificationUpdate);
    
    return () => {
      removeListener();
      window.removeEventListener('vaga_agil_notification_updated', handleNotificationUpdate);
    };
  }, [context, vagaId, toast]);

  // Funções auxiliares para formatação
  const getNotificationTitle = (notification: Notification): string => {
    switch(notification.type) {
      case 'analyst_call': return 'Analista chamado';
      case 'driver_delay': return 'Motorista atrasado';
      case 'delayed_driver_called': return 'Motorista atrasado chamado';
      case 'driver_wont_enter': return 'BIPAR GAIOLA';
      default: return 'Nova notificação';
    }
  };
  
  const getNotificationVariant = (notification: Notification): "default" | "destructive" => {
    switch(notification.type) {
      case 'driver_delay': 
      case 'driver_wont_enter': 
        return 'destructive';
      default: 
        return 'default';
    }
  };
  
  const getNotificationClass = (notification: Notification): string => {
    switch(notification.type) {
      case 'analyst_call': return 'bg-blue-50 border-blue-200';
      case 'driver_delay': return 'bg-red-50 border-red-200';
      case 'delayed_driver_called': return 'bg-green-50 border-green-200';
      case 'driver_wont_enter': return 'bg-orange-100 border-orange-300 font-bold';
      default: return 'bg-slate-50 border-slate-200';
    }
  };
  
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };
  
  // Marcar notificação como lida
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markNotificationAsRead(notification.id);
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? {...n, read: true} : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 bg-red-500 text-white h-5 min-w-5 flex items-center justify-center p-0 px-[5px] text-xs rounded-full">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 max-h-80 overflow-auto" align="end">
        <div className="p-4 font-medium border-b">
          Notificações
        </div>
        {notifications.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            Nenhuma notificação
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`p-3 cursor-pointer hover:bg-slate-100 flex items-start justify-between ${notification.read ? 'opacity-70' : ''} ${getNotificationClass(notification)}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div>
                  <div className="font-medium text-sm">
                    {getNotificationTitle(notification)}
                  </div>
                  <div className="text-sm">{notification.message}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {formatTimestamp(notification.timestamp)}
                  </div>
                </div>
                {!notification.read && (
                  <Badge className="bg-blue-500">Nova</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
