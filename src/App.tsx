import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";

// Lazy loading para melhor performance
const Login = lazy(() => import("./pages/Login"));
const PainelVagas = lazy(() => import("./pages/PainelVagas"));
const PainelAdmin = lazy(() => import("./pages/PainelAdmin"));
const PainelTabela = lazy(() => import("./pages/PainelTabela"));
const PainelMotorista = lazy(() => import("./pages/PainelMotorista"));
const PaginaDebug = lazy(() => import("./pages/PaginaDebug"));
import SupabaseIntegration from "@/components/SupabaseIntegration";
import DebugSupabase from "@/components/DebugSupabase";
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading component otimizado
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/vaga/:vagaId" element={<PainelVagas />} />
            <Route path="/admin" element={<PainelAdmin />} />
            <Route path="/table" element={<PainelTabela />} />
            <Route path="/drivers" element={<PainelMotorista />} />
            <Route path="/debug" element={<PaginaDebug />} />
            <Route path="/supabase" element={<SupabaseIntegration />} />
          <Route path="/debug" element={<DebugSupabase />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </ErrorBoundary>
);

export default App;
