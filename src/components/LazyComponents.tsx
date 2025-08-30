// Lazy loading de componentes pesados para melhor performance
import { lazy } from 'react';

// Lazy loading dos painéis principais
export const PainelAdmin = lazy(() => import('@/pages/PainelAdmin'));
export const PainelMotorista = lazy(() => import('@/pages/PainelMotorista'));
export const PainelVagas = lazy(() => import('@/pages/PainelVagas'));
export const PainelTabela = lazy(() => import('@/pages/PainelTabela'));

// Lazy loading de componentes específicos
export const ImportPlanilha = lazy(() => import('@/components/ImportPlanilha'));
export const ExportData = lazy(() => import('@/components/ExportData'));
export const VagaCard = lazy(() => import('@/components/VagaCard'));
