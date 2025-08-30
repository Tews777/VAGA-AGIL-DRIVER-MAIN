// MotoristaCard.tsx - Componente individual de card de motorista
// Otimizado para uso com react-window

import React, { memo } from 'react';
import { Button } from "@/components/ui/button";

export interface Motorista {
  id: string;
  gaiola: string;
  name?: string;
  status: "chegou" | "esperar_fora_hub" | "entrar_hub" | "atrasado" | "noshow" | "reverter_noshow";
  vaga?: string;
  chegadaEm?: string;
  tipoVeiculo?: string;
  shift?: string;
  hub?: string;
  rota?: string;
}

interface MotoristaCardProps {
  data: Motorista;
  isSelected: boolean;
  onClick: (gaiola: string) => void;
  disabled: boolean;
}

const MotoristaCard: React.FC<MotoristaCardProps> = memo(({ 
  data, 
  isSelected, 
  onClick, 
  disabled 
}) => {
  const getStatusStyles = (status: string) => {
    switch (status) {
      case "chegou":
        return "border-green-500 bg-green-50 hover:bg-green-100 cursor-pointer";
      case "esperar_fora_hub":
        return "border-yellow-500 bg-yellow-50";
      case "entrar_hub":
        return "border-blue-500 bg-blue-50";
      case "atrasado":
        return "border-red-500 bg-red-50";
      case "noshow":
        return "border-gray-800 bg-gray-100";
      case "reverter_noshow":
        return "border-blue-600 bg-blue-50";
      default:
        return "border-gray-300 bg-gray-50";
    }
  };

  const canClick = data.status === "chegou" && !disabled;

  return (
    <Button
      variant={isSelected ? "default" : "outline"}
      size="sm"
      className={`
        text-xs font-mono h-full w-full min-h-[56px]
        ${getStatusStyles(data.status)}
        ${data.vaga ? "ring-2 ring-purple-300" : ""}
        transition-all duration-200 hover:scale-105
        flex flex-col items-center justify-center p-2
      `}
      onClick={() => canClick && onClick(data.gaiola)}
      disabled={!canClick}
    >
      <div className="text-center w-full space-y-1">
        <div className="font-bold text-sm leading-tight">{data.gaiola}</div>
        {data.vaga && (
          <div className="text-xs text-purple-600 font-medium">V{data.vaga}</div>
        )}
        {data.name && (
          <div className="text-xs text-gray-600 truncate max-w-full" title={data.name}>
            {data.name.length > 10 ? `${data.name.substring(0, 10)}...` : data.name}
          </div>
        )}
      </div>
    </Button>
  );
});

MotoristaCard.displayName = 'MotoristaCard';

export default MotoristaCard;
