// VirtualizedMotoristaList.tsx - Lista virtualizada de motoristas
// Usa react-window para otimização de performance

import React, { memo, useMemo, useCallback } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import MotoristaCard, { type Motorista } from './MotoristaCard';

interface VirtualizedMotoristaListProps {
  motoristas: Motorista[];
  selectedGaiola?: string;
  onGaiolaClick: (gaiola: string) => void;
  disabled: boolean;
  searchTerm: string;
  containerHeight?: number;
  containerWidth?: number;
}

// Configurações da grid - Responsivas
const getItemDimensions = (containerWidth: number) => {
  const minItemWidth = 100;
  const maxItemWidth = 140;
  const gap = 8;
  
  // Calcular quantas colunas cabem
  const availableWidth = containerWidth - gap;
  const columnsPerRow = Math.floor(availableWidth / (minItemWidth + gap));
  
  // Calcular largura otimizada do item
  const itemWidth = Math.min(
    maxItemWidth,
    Math.max(minItemWidth, (availableWidth - (columnsPerRow - 1) * gap) / columnsPerRow)
  );
  
  return {
    ITEM_HEIGHT: 64, // altura de cada card + gap
    ITEM_WIDTH: itemWidth,
    GAP: gap,
    COLUMNS_PER_ROW: Math.max(1, columnsPerRow)
  };
};

interface CellProps {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  data: {
    motoristas: Motorista[];
    selectedGaiola?: string;
    onGaiolaClick: (gaiola: string) => void;
    disabled: boolean;
    dimensions: ReturnType<typeof getItemDimensions>;
  };
}

// Componente de célula individual para a grid
const Cell: React.FC<CellProps> = memo(({ columnIndex, rowIndex, style, data }) => {
  const { motoristas, selectedGaiola, onGaiolaClick, disabled, dimensions } = data;
  const { COLUMNS_PER_ROW, GAP } = dimensions;
  const index = rowIndex * COLUMNS_PER_ROW + columnIndex;
  
  if (index >= motoristas.length) {
    return <div style={style} />;
  }

  const motorista = motoristas[index];
  
  return (
    <div style={{
      ...style,
      padding: GAP / 2,
      left: (style.left as number) + GAP / 2,
      top: (style.top as number) + GAP / 2,
      width: (style.width as number) - GAP,
      height: (style.height as number) - GAP,
    }}>
      <MotoristaCard
        data={motorista}
        isSelected={motorista.gaiola === selectedGaiola}
        onClick={onGaiolaClick}
        disabled={disabled}
      />
    </div>
  );
});

Cell.displayName = 'Cell';

const VirtualizedMotoristaList: React.FC<VirtualizedMotoristaListProps> = memo(({
  motoristas,
  selectedGaiola,
  onGaiolaClick,
  disabled,
  searchTerm,
  containerHeight = 400,
  containerWidth = 600
}) => {
  // Calcular dimensões responsivas
  const dimensions = useMemo(() => getItemDimensions(containerWidth), [containerWidth]);

  // Filtrar motoristas baseado no termo de busca
  const filteredMotoristas = useMemo(() => {
    if (!searchTerm.trim()) return motoristas;
    
    const term = searchTerm.toLowerCase();
    return motoristas.filter(motorista => 
      motorista.gaiola.toLowerCase().includes(term) ||
      motorista.name?.toLowerCase().includes(term) ||
      motorista.vaga?.includes(term)
    );
  }, [motoristas, searchTerm]);

  // Calcular dimensões da grid
  const { rowCount } = useMemo(() => {
    const rows = Math.ceil(filteredMotoristas.length / dimensions.COLUMNS_PER_ROW);
    return {
      rowCount: Math.max(1, rows)
    };
  }, [filteredMotoristas.length, dimensions.COLUMNS_PER_ROW]);

  // Dados para passar para as células
  const gridData = useMemo(() => ({
    motoristas: filteredMotoristas,
    selectedGaiola,
    onGaiolaClick,
    disabled,
    dimensions
  }), [filteredMotoristas, selectedGaiola, onGaiolaClick, disabled, dimensions]);

  // Callback otimizado para evitar re-renders desnecessários
  const handleGaiolaClick = useCallback((gaiola: string) => {
    onGaiolaClick(gaiola);
  }, [onGaiolaClick]);

  // Se não há motoristas filtrados, mostrar mensagem
  if (filteredMotoristas.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500">
        <div className="text-center">
          <div className="text-lg font-medium">Nenhum motorista encontrado</div>
          {searchTerm && (
            <div className="text-sm">
              Nenhum resultado para "{searchTerm}"
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Grid
        columnCount={dimensions.COLUMNS_PER_ROW}
        columnWidth={dimensions.ITEM_WIDTH}
        height={containerHeight}
        width={containerWidth}
        rowCount={rowCount}
        rowHeight={dimensions.ITEM_HEIGHT}
        itemData={gridData}
        style={{
          overflowX: 'hidden',
          overflowY: 'auto'
        }}
        overscanRowCount={2} // Pre-render 2 linhas extras para scroll suave
        overscanColumnCount={1} // Pre-render 1 coluna extra
      >
        {Cell}
      </Grid>
    </div>
  );
});

VirtualizedMotoristaList.displayName = 'VirtualizedMotoristaList';

export default VirtualizedMotoristaList;
