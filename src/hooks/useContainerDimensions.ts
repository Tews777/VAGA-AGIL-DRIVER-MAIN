// useContainerDimensions.ts - Hook para detectar dimensões do container
// Útil para responsividade da lista virtualizada

import { useState, useEffect, useCallback, RefObject } from 'react';

interface Dimensions {
  width: number;
  height: number;
}

const useContainerDimensions = (ref: RefObject<HTMLElement>): Dimensions => {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });

  const updateDimensions = useCallback(() => {
    if (ref.current) {
      const { offsetWidth, offsetHeight } = ref.current;
      setDimensions(prev => {
        // Só atualiza se as dimensões mudaram significativamente (evita re-renders desnecessários)
        if (Math.abs(prev.width - offsetWidth) > 5 || Math.abs(prev.height - offsetHeight) > 5) {
          return { width: offsetWidth, height: offsetHeight };
        }
        return prev;
      });
    }
  }, [ref]);

  useEffect(() => {
    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    if (ref.current) {
      resizeObserver.observe(ref.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [updateDimensions, ref]);

  return dimensions;
};

export default useContainerDimensions;
