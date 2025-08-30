# 🧪 TESTING STRATEGY & IMPLEMENTATION

## 📊 **TESTING PYRAMID OVERVIEW**

```
         /\
        /  \    E2E Tests (10%)
       /____\   - Critical user flows
      /      \  - Cross-browser testing
     /        \ - Performance testing
    /          \
   /__________  \ Integration Tests (20%)
  /            \ - Component interaction
 /              \ - API integration
/________________\ - Data flow validation
                  
                   Unit Tests (70%)
                   - Individual functions
                   - Hooks testing
                   - Pure logic validation
```

## 🔧 **SETUP & CONFIGURATION**

### **Vitest Configuration**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage',
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        },
        './src/hooks/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      },
      exclude: [
        'src/test/**',
        'src/**/*.d.ts',
        'src/**/*.config.ts',
        'src/**/*.stories.tsx'
      ]
    },
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './src/test')
    }
  }
});
```

### **Test Setup & Utilities**
```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
import { beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setupIntersectionObserverMock } from './mocks/intersectionObserver';
import { setupLocalStorageMock } from './mocks/localStorage';
import { setupWindowEventsMock } from './mocks/windowEvents';

// Setup mocks
setupIntersectionObserverMock();
setupLocalStorageMock();
setupWindowEventsMock();

// Auto cleanup
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

// Global test configuration
beforeEach(() => {
  // Reset timers
  vi.useFakeTimers();
  
  // Mock window.location
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000',
      pathname: '/',
      search: '',
      hash: ''
    },
    writable: true
  });
});
```

### **Test Utilities & Helpers**
```typescript
// src/test/utils/testUtils.tsx
import React, { PropsWithChildren } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppContextProvider } from '@/contexts/AppContext';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  queryClient?: QueryClient;
}

export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });
};

export const createTestWrapper = (options: CustomRenderOptions = {}) => {
  const { initialEntries = ['/'], queryClient = createQueryClient() } = options;

  return function TestWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <AppContextProvider>
          <BrowserRouter>
            {children}
          </BrowserRouter>
        </AppContextProvider>
      </QueryClientProvider>
    );
  };
};

export const customRender = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { queryClient, initialEntries, ...renderOptions } = options;
  const Wrapper = createTestWrapper({ queryClient, initialEntries });

  return render(ui, {
    wrapper: Wrapper,
    ...renderOptions
  });
};

// Mock data generators
export const mockVagaData = (overrides: Partial<VagaData> = {}): VagaData => ({
  id: '1',
  status: 'esperar',
  gaiola: '',
  check: false,
  chamadoEm: null,
  finalizadoEm: null,
  ...overrides
});

export const mockDriverData = (overrides: Partial<DriverData> = {}): DriverData => ({
  id: '1',
  name: 'João Silva',
  gaiola: 'A-1',
  shift: 'morning',
  status: 'esperar_fora_hub',
  vaga: '',
  chegadaEm: null,
  check: false,
  ...overrides
});
```

## 🧪 **UNIT TESTS**

### **Hooks Testing**
```typescript
// src/hooks/__tests__/useVagaData.test.ts
import { renderHook, act } from '@testing-library/react';
import { useVagaData } from '../useVagaData';
import { createTestWrapper, mockVagaData } from '@test/utils/testUtils';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('useVagaData Hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Data Loading', () => {
    it('should load vagas data from localStorage on initialization', async () => {
      const mockData = {
        '1': mockVagaData({ id: '1', status: 'esperar' }),
        '2': mockVagaData({ id: '2', status: 'chamado', gaiola: 'A-1' })
      };
      localStorage.setItem('vagas_data', JSON.stringify(mockData));

      const { result } = renderHook(() => useVagaData(), {
        wrapper: createTestWrapper()
      });

      await act(async () => {
        await result.current.loadAllVagasData();
      });

      expect(result.current.vagasData).toEqual(mockData);
      expect(result.current.vagasArray).toHaveLength(2);
    });

    it('should handle empty localStorage gracefully', async () => {
      const { result } = renderHook(() => useVagaData(), {
        wrapper: createTestWrapper()
      });

      await act(async () => {
        await result.current.loadAllVagasData();
      });

      expect(result.current.vagasData).toEqual({});
      expect(result.current.vagasArray).toHaveLength(0);
    });

    it('should handle corrupted localStorage data', async () => {
      localStorage.setItem('vagas_data', 'invalid-json');

      const { result } = renderHook(() => useVagaData(), {
        wrapper: createTestWrapper()
      });

      await act(async () => {
        await result.current.loadAllVagasData();
      });

      expect(result.current.vagasData).toEqual({});
      expect(result.current.error).toContain('Failed to load');
    });
  });

  describe('Status Updates', () => {
    it('should update vaga status correctly', async () => {
      const { result } = renderHook(() => useVagaData(), {
        wrapper: createTestWrapper()
      });

      await act(async () => {
        await result.current.updateVagaStatus('1', 'chamado', 'A-1');
      });

      expect(result.current.vagasData['1']).toEqual(
        expect.objectContaining({
          id: '1',
          status: 'chamado',
          gaiola: 'A-1',
          chamadoEm: expect.any(String)
        })
      );
    });

    it('should trigger custom events on status update', async () => {
      const eventSpy = vi.spyOn(window, 'dispatchEvent');
      
      const { result } = renderHook(() => useVagaData(), {
        wrapper: createTestWrapper()
      });

      await act(async () => {
        await result.current.updateVagaStatus('1', 'carregando', 'A-1');
      });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'vaga_data_update',
          detail: expect.objectContaining({
            vagaId: '1',
            status: 'carregando'
          })
        })
      );
    });

    it('should handle concurrent updates correctly', async () => {
      const { result } = renderHook(() => useVagaData(), {
        wrapper: createTestWrapper()
      });

      // Simular updates simultâneos
      await act(async () => {
        await Promise.all([
          result.current.updateVagaStatus('1', 'chamado', 'A-1'),
          result.current.updateVagaStatus('1', 'carregando', 'A-1')
        ]);
      });

      // O último update deve prevalecer
      expect(result.current.vagasData['1'].status).toBe('carregando');
    });
  });

  describe('Event Listeners', () => {
    it('should respond to storage events', async () => {
      const { result } = renderHook(() => useVagaData(), {
        wrapper: createTestWrapper()
      });

      const newData = { '1': mockVagaData({ status: 'finalizado' }) };

      await act(async () => {
        // Simular mudança em outra aba
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'vagas_data',
          newValue: JSON.stringify(newData),
          storageArea: localStorage
        }));
      });

      expect(result.current.vagasData).toEqual(newData);
    });

    it('should cleanup event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      const { unmount } = renderHook(() => useVagaData(), {
        wrapper: createTestWrapper()
      });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    });
  });
});
```

### **Component Testing**
```typescript
// src/components/__tests__/VagaCard.test.tsx
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { VagaCard } from '../VagaCard';
import { customRender, mockVagaData } from '@test/utils/testUtils';
import { vi, describe, it, expect } from 'vitest';

describe('VagaCard Component', () => {
  const defaultProps = {
    vaga: mockVagaData(),
    onStatusUpdate: vi.fn(),
    onDelete: vi.fn()
  };

  it('should render vaga information correctly', () => {
    const vaga = mockVagaData({
      id: '5',
      status: 'chamado',
      gaiola: 'B-3'
    });

    customRender(<VagaCard {...defaultProps} vaga={vaga} />);

    expect(screen.getByText('VAGA 05')).toBeInTheDocument();
    expect(screen.getByText('CHAMADO')).toBeInTheDocument();
    expect(screen.getByText('B-3')).toBeInTheDocument();
  });

  it('should display correct status badge colors', () => {
    const statuses: Array<{ status: VagaStatus; expectedClass: string }> = [
      { status: 'esperar', expectedClass: 'bg-blue-500' },
      { status: 'chamado', expectedClass: 'bg-yellow-500' },
      { status: 'carregando', expectedClass: 'bg-orange-500' },
      { status: 'finalizado', expectedClass: 'bg-green-500' }
    ];

    statuses.forEach(({ status, expectedClass }) => {
      const { unmount } = customRender(
        <VagaCard {...defaultProps} vaga={mockVagaData({ status })} />
      );

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveClass(expectedClass);

      unmount();
    });
  });

  it('should handle status transitions correctly', async () => {
    const onStatusUpdate = vi.fn();
    const vaga = mockVagaData({ status: 'esperar' });

    customRender(
      <VagaCard {...defaultProps} vaga={vaga} onStatusUpdate={onStatusUpdate} />
    );

    const actionButton = screen.getByRole('button', { name: /chamar/i });
    fireEvent.click(actionButton);

    await waitFor(() => {
      expect(onStatusUpdate).toHaveBeenCalledWith('1', 'chamado');
    });
  });

  it('should show timer for carregando status', () => {
    const vaga = mockVagaData({
      status: 'carregando',
      chamadoEm: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 min atrás
    });

    customRender(<VagaCard {...defaultProps} vaga={vaga} />);

    expect(screen.getByTestId('vaga-timer')).toBeInTheDocument();
    expect(screen.getByText(/05:00/)).toBeInTheDocument();
  });

  it('should display delayed actions after timeout', async () => {
    vi.useFakeTimers();
    
    const vaga = mockVagaData({
      status: 'chamado',
      chamadoEm: new Date().toISOString()
    });

    customRender(<VagaCard {...defaultProps} vaga={vaga} />);

    // Avançar 5 minutos
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    await waitFor(() => {
      expect(screen.getByText(/ações para motorista atrasado/i)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });
});
```

## 🔗 **INTEGRATION TESTS**

### **Page Integration Testing**
```typescript
// src/pages/__tests__/VagaPanel.integration.test.tsx
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { VagaPanel } from '../VagaPanel';
import { customRender } from '@test/utils/testUtils';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('VagaPanel Integration', () => {
  beforeEach(() => {
    // Setup initial auth state
    localStorage.setItem('vagaLoggedIn', '1');
    localStorage.setItem('vagas_data', JSON.stringify({
      '1': {
        id: '1',
        status: 'esperar',
        gaiola: '',
        check: false,
        chamadoEm: null,
        finalizadoEm: null
      }
    }));
  });

  it('should complete full vaga workflow', async () => {
    customRender(<VagaPanel />, {
      initialEntries: ['/vaga/1']
    });

    // Verificar estado inicial
    expect(screen.getByText('VAGA 01')).toBeInTheDocument();
    expect(screen.getByText('ESPERAR')).toBeInTheDocument();

    // Chamar gaiola
    const gaiolaInput = screen.getByPlaceholderText(/digite a gaiola/i);
    const callButton = screen.getByRole('button', { name: /chamar gaiola/i });

    fireEvent.change(gaiolaInput, { target: { value: 'A-1' } });
    fireEvent.click(callButton);

    // Verificar mudança para chamado
    await waitFor(() => {
      expect(screen.getByText('CHAMADO')).toBeInTheDocument();
    });

    // Simular chegada do motorista
    const loadingButton = screen.getByRole('button', { name: /chegou/i });
    fireEvent.click(loadingButton);

    // Verificar mudança para carregando
    await waitFor(() => {
      expect(screen.getByText('CARREGANDO')).toBeInTheDocument();
    });

    // Finalizar carregamento
    const finishButton = screen.getByRole('button', { name: /finalizar/i });
    fireEvent.click(finishButton);

    // Verificar finalização
    await waitFor(() => {
      expect(screen.getByText('FINALIZADO')).toBeInTheDocument();
    });
  });

  it('should sync with other components', async () => {
    const { rerender } = customRender(<VagaPanel />, {
      initialEntries: ['/vaga/1']
    });

    // Simular update externo via evento
    act(() => {
      window.dispatchEvent(new CustomEvent('vaga_data_update', {
        detail: {
          vagaId: '1',
          status: 'chamado',
          gaiola: 'B-2'
        }
      }));
    });

    await waitFor(() => {
      expect(screen.getByText('CHAMADO')).toBeInTheDocument();
      expect(screen.getByText('B-2')).toBeInTheDocument();
    });
  });

  it('should handle delayed driver scenarios', async () => {
    vi.useFakeTimers();

    customRender(<VagaPanel />, {
      initialEntries: ['/vaga/1']
    });

    // Chamar gaiola
    fireEvent.change(
      screen.getByPlaceholderText(/digite a gaiola/i),
      { target: { value: 'A-1' } }
    );
    fireEvent.click(screen.getByRole('button', { name: /chamar gaiola/i }));

    // Avançar 5 minutos
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    // Verificar ações de atraso
    await waitFor(() => {
      expect(screen.getByText(/ações para motorista atrasado/i)).toBeInTheDocument();
    });

    // Testar ação "não vai entrar"
    const wontEnterButton = screen.getByRole('button', { name: /não entrará/i });
    fireEvent.click(wontEnterButton);

    // Verificar notificação
    await waitFor(() => {
      expect(screen.getByText(/não entrará no hub/i)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });
});
```

## 🤖 **E2E TESTS WITH PLAYWRIGHT**

### **Playwright Configuration**
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  }
});
```

### **Critical User Flows**
```typescript
// e2e/vaga-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Vaga Management Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('complete vaga lifecycle', async ({ page }) => {
    // Login como vaga
    await page.fill('[data-testid="vaga-input"]', '1');
    await page.click('[data-testid="enter-button"]');

    // Verificar página da vaga
    await expect(page.locator('h1')).toContainText('VAGA 01');
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('ESPERAR');

    // Chamar gaiola
    await page.fill('[data-testid="gaiola-input"]', 'A-1');
    await page.click('[data-testid="call-button"]');

    // Verificar mudança de status
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('CHAMADO');
    await expect(page.locator('[data-testid="gaiola-display"]')).toContainText('A-1');

    // Simular chegada do motorista
    await page.click('[data-testid="loading-button"]');
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('CARREGANDO');

    // Verificar timer apareceu
    await expect(page.locator('[data-testid="vaga-timer"]')).toBeVisible();

    // Finalizar carregamento
    await page.click('[data-testid="finish-button"]');
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('FINALIZADO');
  });

  test('delayed driver workflow', async ({ page }) => {
    // Setup - chamar gaiola
    await page.fill('[data-testid="vaga-input"]', '1');
    await page.click('[data-testid="enter-button"]');
    await page.fill('[data-testid="gaiola-input"]', 'A-1');
    await page.click('[data-testid="call-button"]');

    // Simular passagem de tempo (5 minutos)
    await page.evaluate(() => {
      // Mock da passagem de tempo
      window.dispatchEvent(new CustomEvent('test:advance-time', {
        detail: { minutes: 5 }
      }));
    });

    // Verificar ações de atraso aparecem
    await expect(page.locator('[data-testid="delayed-actions"]')).toBeVisible();

    // Testar ação "motorista não vai entrar"
    await page.click('[data-testid="wont-enter-button"]');

    // Verificar notificação
    await expect(page.locator('[data-testid="notification"]')).toContainText('não entrará no hub');

    // Verificar volta ao status esperar
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('ESPERAR');
  });

  test('cross-panel synchronization', async ({ context }) => {
    // Abrir duas abas
    const vagaPage = await context.newPage();
    const adminPage = await context.newPage();

    // Setup vaga page
    await vagaPage.goto('/');
    await vagaPage.fill('[data-testid="vaga-input"]', '1');
    await vagaPage.click('[data-testid="enter-button"]');

    // Setup admin page
    await adminPage.goto('/admin');
    await adminPage.fill('[data-testid="admin-password"]', 'GR2024');
    await adminPage.click('[data-testid="admin-login"]');

    // Ação na vaga page
    await vagaPage.fill('[data-testid="gaiola-input"]', 'A-1');
    await vagaPage.click('[data-testid="call-button"]');

    // Verificar sincronização na admin page
    await expect(adminPage.locator('[data-testid="vaga-1-status"]')).toContainText('CHAMADO');
    await expect(adminPage.locator('[data-testid="vaga-1-gaiola"]')).toContainText('A-1');
  });
});
```

### **Performance Tests**
```typescript
// e2e/performance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('page load performance', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/vaga/1');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });

  test('multiple concurrent updates', async ({ page }) => {
    await page.goto('/admin');
    await page.fill('[data-testid="admin-password"]', 'GR2024');
    await page.click('[data-testid="admin-login"]');

    // Simular múltiplas atualizações simultâneas
    const updatePromises = [];
    for (let i = 1; i <= 10; i++) {
      updatePromises.push(
        page.click(`[data-testid="vaga-${i}-sync"]`)
      );
    }

    await Promise.all(updatePromises);

    // Verificar que a interface permanece responsiva
    const responseTime = await page.evaluate(async () => {
      const start = performance.now();
      await new Promise(resolve => setTimeout(resolve, 0));
      return performance.now() - start;
    });

    expect(responseTime).toBeLessThan(100);
  });
});
```

## 📊 **TEST REPORTING & COVERAGE**

### **Coverage Reports**
```typescript
// vitest.coverage.config.ts
export default {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'lcov', 'json-summary'],
    reportsDirectory: './coverage',
    thresholds: {
      global: {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85
      },
      // Diferentes thresholds por pasta
      './src/hooks/': {
        branches: 90,
        functions: 95,
        lines: 90,
        statements: 90
      },
      './src/components/': {
        branches: 80,
        functions: 80,
        lines: 85,
        statements: 85
      },
      './src/utils/': {
        branches: 95,
        functions: 95,
        lines: 95,
        statements: 95
      }
    },
    watermarks: {
      statements: [50, 80],
      functions: [50, 80],
      branches: [50, 80],
      lines: [50, 80]
    }
  }
};
```

### **Test Documentation Generator**
```typescript
// scripts/generate-test-docs.ts
import fs from 'fs';
import path from 'path';

interface TestResult {
  file: string;
  tests: number;
  passed: number;
  failed: number;
  coverage: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

export const generateTestDocumentation = (results: TestResult[]) => {
  const markdown = `
# 📊 Test Coverage Report

## Summary
- Total Tests: ${results.reduce((acc, r) => acc + r.tests, 0)}
- Passed: ${results.reduce((acc, r) => acc + r.passed, 0)}
- Failed: ${results.reduce((acc, r) => acc + r.failed, 0)}

## Coverage by Module

${results.map(result => `
### ${result.file}
- Tests: ${result.tests} (${result.passed} passed, ${result.failed} failed)
- Statements: ${result.coverage.statements}%
- Branches: ${result.coverage.branches}%
- Functions: ${result.coverage.functions}%
- Lines: ${result.coverage.lines}%
`).join('')}
`;

  fs.writeFileSync('TEST_COVERAGE.md', markdown);
};
```

Esta estratégia de testes garante qualidade enterprise com cobertura abrangente dos cenários críticos do sistema!
