// use-mobile.tsx - Hook para responsividade e detecção de dispositivos
// Versão profissional refatorada com padrões enterprise-grade

import { useState, useEffect, useCallback, useMemo } from "react";

// Interfaces TypeScript
export interface BreakpointConfig {
  mobile: number;
  tablet: number;
  desktop: number;
  wide: number;
}

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
  touchSupported: boolean;
  pixelRatio: number;
}

export interface UseMobileReturn {
  isMobile: boolean;
  deviceInfo: DeviceInfo;
  breakpoints: BreakpointConfig;
  isBreakpoint: (breakpoint: keyof BreakpointConfig) => boolean;
  getOptimalLayout: () => "mobile" | "tablet" | "desktop" | "wide";
}

// Constantes
const DEFAULT_BREAKPOINTS: BreakpointConfig = {
  mobile: 768,    // < 768px
  tablet: 1024,   // 768px - 1024px
  desktop: 1440,  // 1024px - 1440px
  wide: 1920      // > 1440px
} as const;

const CONSTANTS = {
  DEBOUNCE_DELAY: 100, // ms para debounce de resize
  STORAGE_KEY: 'device_preferences',
  MEDIA_QUERY_OPTIONS: {
    passive: true
  }
} as const;

export const useIsMobile = (customBreakpoints?: Partial<BreakpointConfig>): UseMobileReturn => {
  // Merge breakpoints customizados com os padrões
  const breakpoints = useMemo(() => ({
    ...DEFAULT_BREAKPOINTS,
    ...customBreakpoints
  }), [customBreakpoints]);

  // Estados principais
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isWide: false,
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    orientation: "landscape",
    touchSupported: false,
    pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1
  });

  // Função para detectar suporte a touch
  const detectTouchSupport = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-ignore - Para compatibilidade com navegadores mais antigos
      navigator.msMaxTouchPoints > 0
    );
  }, []);

  // Função para calcular informações do dispositivo
  const calculateDeviceInfo = useCallback((): DeviceInfo => {
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isWide: false,
        width: 1024,
        height: 768,
        orientation: "landscape",
        touchSupported: false,
        pixelRatio: 1
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const orientation = width < height ? "portrait" : "landscape";
    const touchSupported = detectTouchSupport();
    const pixelRatio = window.devicePixelRatio || 1;

    // Determinar tipo de dispositivo baseado nos breakpoints
    const isMobile = width < breakpoints.mobile;
    const isTablet = width >= breakpoints.mobile && width < breakpoints.desktop;
    const isDesktop = width >= breakpoints.desktop && width < breakpoints.wide;
    const isWide = width >= breakpoints.wide;

    return {
      isMobile,
      isTablet,
      isDesktop,
      isWide,
      width,
      height,
      orientation,
      touchSupported,
      pixelRatio
    };
  }, [breakpoints, detectTouchSupport]);

  // Função debounced para atualizar informações do dispositivo
  const updateDeviceInfo = useCallback(() => {
    let timeoutId: NodeJS.Timeout;
    
    const debouncedUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const newDeviceInfo = calculateDeviceInfo();
        setDeviceInfo(prevInfo => {
          // Só atualizar se houve mudança significativa
          if (
            prevInfo.isMobile !== newDeviceInfo.isMobile ||
            prevInfo.isTablet !== newDeviceInfo.isTablet ||
            prevInfo.isDesktop !== newDeviceInfo.isDesktop ||
            prevInfo.isWide !== newDeviceInfo.isWide ||
            prevInfo.orientation !== newDeviceInfo.orientation ||
            Math.abs(prevInfo.width - newDeviceInfo.width) > 10 // Evitar updates desnecessários
          ) {
            console.log('Device info updated:', {
              from: `${prevInfo.width}x${prevInfo.height}`,
              to: `${newDeviceInfo.width}x${newDeviceInfo.height}`,
              device: newDeviceInfo.isMobile ? 'mobile' : 
                     newDeviceInfo.isTablet ? 'tablet' : 
                     newDeviceInfo.isDesktop ? 'desktop' : 'wide'
            });
            
            return newDeviceInfo;
          }
          return prevInfo;
        });
      }, CONSTANTS.DEBOUNCE_DELAY);
    };

    debouncedUpdate();
    
    return () => clearTimeout(timeoutId);
  }, [calculateDeviceInfo]);

  // Função para verificar se está em um breakpoint específico
  const isBreakpoint = useCallback((breakpoint: keyof BreakpointConfig): boolean => {
    const width = deviceInfo.width;
    
    switch (breakpoint) {
      case 'mobile':
        return width < breakpoints.mobile;
      case 'tablet':
        return width >= breakpoints.mobile && width < breakpoints.desktop;
      case 'desktop':
        return width >= breakpoints.desktop && width < breakpoints.wide;
      case 'wide':
        return width >= breakpoints.wide;
      default:
        return false;
    }
  }, [deviceInfo.width, breakpoints]);

  // Função para obter layout ótimo
  const getOptimalLayout = useCallback((): "mobile" | "tablet" | "desktop" | "wide" => {
    if (deviceInfo.isMobile) return "mobile";
    if (deviceInfo.isTablet) return "tablet";
    if (deviceInfo.isDesktop) return "desktop";
    return "wide";
  }, [deviceInfo]);

  // Setup de listeners para mudanças de viewport
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Atualizar informações iniciais
    setDeviceInfo(calculateDeviceInfo());

    // Listeners para mudanças
    const handleResize = updateDeviceInfo;
    const handleOrientationChange = updateDeviceInfo;

    // Adicionar listeners
    window.addEventListener('resize', handleResize, CONSTANTS.MEDIA_QUERY_OPTIONS);
    window.addEventListener('orientationchange', handleOrientationChange, CONSTANTS.MEDIA_QUERY_OPTIONS);

    // Media queries para breakpoints específicos
    const mediaQueries: MediaQueryList[] = [];
    const mediaHandlers: (() => void)[] = [];

    Object.entries(breakpoints).forEach(([key, value]) => {
      const mql = window.matchMedia(`(max-width: ${value - 1}px)`);
      const handler = () => updateDeviceInfo();
      
      mql.addEventListener('change', handler);
      mediaQueries.push(mql);
      mediaHandlers.push(handler);
    });

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      
      mediaQueries.forEach((mql, index) => {
        mql.removeEventListener('change', mediaHandlers[index]);
      });
    };
  }, [calculateDeviceInfo, updateDeviceInfo, breakpoints]);

  // Salvar preferências do dispositivo no localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const preferences = {
        lastKnownDevice: getOptimalLayout(),
        touchSupported: deviceInfo.touchSupported,
        pixelRatio: deviceInfo.pixelRatio,
        timestamp: Date.now()
      };
      
      localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Não foi possível salvar preferências do dispositivo:', error);
    }
  }, [deviceInfo, getOptimalLayout]);

  // Valor memoizado para isMobile para compatibilidade com a API original
  const isMobile = useMemo(() => deviceInfo.isMobile, [deviceInfo.isMobile]);

  return {
    isMobile,
    deviceInfo,
    breakpoints,
    isBreakpoint,
    getOptimalLayout
  };
};

// Export da função original para compatibilidade
export { useIsMobile as default };
