import React, { memo, useMemo, useState, useEffect, useRef } from 'react';

interface VirtualizedListProps {
  items: any[];
  itemHeight: number;
  height: number;
  renderItem: (item: any, index: number) => React.ReactNode;
}

// Componente de lista virtualizada simples para melhor performance
export const VirtualizedList = memo<VirtualizedListProps>(({ 
  items, 
  itemHeight, 
  height, 
  renderItem 
}) => {
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleCount = Math.ceil(height / itemHeight);
  const buffer = 5; // Buffer para scroll suave

  useEffect(() => {
    const newEndIndex = Math.min(
      startIndex + visibleCount + buffer,
      items.length
    );
    setEndIndex(newEndIndex);
  }, [startIndex, visibleCount, items.length]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const newStartIndex = Math.max(
      0,
      Math.floor(scrollTop / itemHeight) - buffer
    );
    setStartIndex(newStartIndex);
  };

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        Nenhum item encontrado
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height, overflow: 'auto' }}
      onScroll={handleScroll}
      className="relative"
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${startIndex * itemHeight}px)`,
            position: 'absolute',
            top: 0,
            width: '100%',
          }}
        >
          {visibleItems.map((item, index) => (
            <div key={startIndex + index} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
