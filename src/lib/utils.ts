import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Função utilitária para processar e formatar o tipo de veículo de maneira consistente
 * em toda a aplicação.
 * 
 * @param tipoVeiculo - O tipo de veículo a ser formatado ou undefined/null
 * @returns String formatada ou string vazia se não houver tipo
 */
export function formatarTipoVeiculo(tipoVeiculo: string | undefined | null): string {
  // Caso seja undefined ou null, retorna string vazia
  if (tipoVeiculo === undefined || tipoVeiculo === null) {
    return "";
  }
  
  // Verificar se é uma string válida antes de chamar trim()
  if (typeof tipoVeiculo !== 'string') {
    console.warn('formatarTipoVeiculo: tipoVeiculo não é uma string:', typeof tipoVeiculo, tipoVeiculo);
    return "";
  }
  
  // Trim e converter para maiúsculas
  const formatado = tipoVeiculo.trim().toUpperCase();
  
  // Se após formatação ficar vazio, retornar string vazia
  return formatado || "";
}

/**
 * Função utilitária que garante que qualquer objeto de motorista (seja do formato Driver ou DriverData)
 * tenha o campo tipoVeiculo preservado.
 * 
 * @param driverData - O objeto de motorista a ser processado
 * @returns O objeto com o campo tipoVeiculo preservado
 */
export function preservarTipoVeiculo<T extends Record<string, any>>(driverData: T): T {
  // Se o motorista não tem tipoVeiculo definido, garantir que seja undefined e não null
  if (!driverData) {
    return driverData;
  }
  
  // Se tipoVeiculo não existir no objeto, adiciona como undefined
  if (!('tipoVeiculo' in driverData)) {
    console.log('🚗 preservarTipoVeiculo: Adicionando campo tipoVeiculo como undefined');
    return {
      ...driverData,
      tipoVeiculo: undefined
    };
  }
  
  // Se tipoVeiculo existir, garantir que seja string ou undefined, nunca null
  const tipoVeiculo = driverData.tipoVeiculo === null ? undefined : driverData.tipoVeiculo;
  
  console.log(`🚗 preservarTipoVeiculo: Preservando tipo de veículo: "${tipoVeiculo || 'não definido'}"`);
  
  return {
    ...driverData,
    tipoVeiculo
  };
}

/**
 * Função para obter as classes CSS para exibição do tipo de veículo
 * de forma consistente em toda a aplicação.
 * 
 * @param tipoVeiculo - O tipo de veículo
 * @returns String com classes CSS para o elemento
 */
export function getTipoVeiculoClasses(tipoVeiculo: string | undefined | null): string {
  return tipoVeiculo 
    ? 'text-blue-600 bg-blue-50' 
    : 'text-gray-600 bg-gray-50';
}
