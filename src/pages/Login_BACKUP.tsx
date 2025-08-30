// Login.tsx - Interface e lógica de autenticação localStorage
// Versão profissional refatorada com padrões enterprise-grade

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  LogIn, Eye, EyeOff, Truck, Shield, Info, 
  CheckCircle, XCircle, AlertTriangle 
} from "lucide-react";

// Interfaces TypeScript
interface LoginCredentials {
  identifier: string; // Pode ser número da vaga ou "admin"
  password: string;
}

interface LoginValidation {
  isValid: boolean;
  userType: "vaga" | "admin" | null;
  vagaNumber?: number;
  errors: string[];
}

interface LoginProps {}

// Constantes
const CONSTANTS = {
  VAGA_PASSWORD: import.meta.env.VITE_VAGA_PASSWORD || "",
  ADMIN_IDENTIFIER: "admin",
  ADMIN_PASSWORD: import.meta.env.VITE_ADMIN_PASSWORD || "",
  MIN_VAGA: 1,
  MAX_VAGA: 30,
  STORAGE_KEYS: {
    VAGA_LOGGED_IN: "vagaLoggedIn",
    USER_TYPE: "userType",
    LAST_ACCESSED_VAGA: "lastAccessedVaga"
  },
  ROUTES: {
    ADMIN: "/admin",
    VAGA: "/vaga",
    DRIVERS: "/drivers"
  }
} as const;

const Login: React.FC<LoginProps> = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Estados locais
  const [credentials, setCredentials] = useState<LoginCredentials>({
    identifier: "",
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAccessedVaga, setLastAccessedVaga] = useState<string>("");

  // Carregar última vaga acessada
  useEffect(() => {
    const lastVaga = localStorage.getItem(CONSTANTS.STORAGE_KEYS.LAST_ACCESSED_VAGA) || "";
    setLastAccessedVaga(lastVaga);
    if (lastVaga) {
      setCredentials(prev => ({ ...prev, identifier: lastVaga }));
    }
  }, []);

  // Função de validação - MEMOIZADA
  const validateCredentials = useCallback((creds: LoginCredentials): LoginValidation => {
    const errors: string[] = [];
    let isValid = false;
    let userType: "vaga" | "admin" | null = null;
    let vagaNumber: number | undefined;

    // Validações básicas
    if (!creds.identifier.trim()) {
      errors.push("Identificador é obrigatório");
    }
    
    if (!creds.password.trim()) {
      errors.push("Senha é obrigatória");
    }

    if (errors.length > 0) {
      return { isValid: false, userType: null, errors };
    }

    // Validação para Admin
    if (creds.identifier.toLowerCase() === CONSTANTS.ADMIN_IDENTIFIER) {
      if (creds.password === CONSTANTS.ADMIN_PASSWORD) {
        isValid = true;
        userType = "admin";
      } else {
        errors.push("Senha do administrador incorreta");
      }
    } 
    // Validação para Vaga
    else {
      const vagaNum = parseInt(creds.identifier);
      
      if (isNaN(vagaNum)) {
        errors.push("Número da vaga deve ser um número válido");
      } else if (vagaNum < CONSTANTS.MIN_VAGA || vagaNum > CONSTANTS.MAX_VAGA) {
        errors.push(`Vaga deve estar entre ${CONSTANTS.MIN_VAGA} e ${CONSTANTS.MAX_VAGA}`);
      } else if (creds.password === CONSTANTS.VAGA_PASSWORD) {
        isValid = true;
        userType = "vaga";
        vagaNumber = vagaNum;
      } else {
        errors.push("Senha da vaga incorreta");
      }
    }

    return { isValid, userType, vagaNumber, errors };
  }, []);

  // Função de login - OTIMIZADA
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validation = validateCredentials(credentials);
      
      if (!validation.isValid) {
        toast({
          title: "Erro no login",
          description: validation.errors.join(". "),
          variant: "destructive",
        });
        return;
      }

      // Processamento baseado no tipo de usuário
      if (validation.userType === "admin") {
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.USER_TYPE, "admin");
        
        toast({
          title: "✅ Login Admin realizado",
          description: "Bem-vindo ao painel administrativo",
        });
        
        navigate(CONSTANTS.ROUTES.ADMIN);
        
      } else if (validation.userType === "vaga" && validation.vagaNumber) {
        const vagaStr = validation.vagaNumber.toString();
        
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.VAGA_LOGGED_IN, vagaStr);
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.USER_TYPE, "vaga");
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.LAST_ACCESSED_VAGA, vagaStr);
        
        toast({
          title: "✅ Login realizado",
          description: `Bem-vindo à Vaga ${validation.vagaNumber}`,
        });
        
        navigate(`${CONSTANTS.ROUTES.VAGA}/${validation.vagaNumber}`);
      }
      
    } catch (error) {
      console.error("Erro no processo de login:", error);
      toast({
        title: "Erro interno",
        description: "Ocorreu um erro durante o login. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [credentials, validateCredentials, navigate, toast]);

  // Função para navegar para visualização de motoristas
  const handleViewDrivers = useCallback(() => {
    navigate(CONSTANTS.ROUTES.DRIVERS);
  }, [navigate]);

  // Função para alternar visibilidade da senha
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  // Função para usar vaga sugerida
  const handleUseSuggestedVaga = useCallback(() => {
    if (lastAccessedVaga) {
      setCredentials(prev => ({ 
        ...prev, 
        identifier: lastAccessedVaga 
      }));
    }
  }, [lastAccessedVaga]);

  // Limpar campos
  const handleClearFields = useCallback(() => {
    setCredentials({ identifier: "", password: "" });
  }, []);

  // Validação em tempo real - MEMOIZADA
  const currentValidation = useMemo(() => {
    if (!credentials.identifier && !credentials.password) {
      return null;
    }
    return validateCredentials(credentials);
  }, [credentials, validateCredentials]);

  // Verificar se pode fazer login
  const canLogin = useMemo(() => {
    return credentials.identifier.trim() && credentials.password.trim() && !isLoading;
  }, [credentials, isLoading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-blue-600 rounded-full">
              <Truck className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Sistema de Vagas</h1>
              <p className="text-slate-600">Shopee Hub - Florianópolis</p>
            </div>
          </div>
        </div>

        {/* Card Principal */}
        <Card className="border shadow-lg bg-white">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
              <LogIn className="h-6 w-6" />
              Autenticação
            </CardTitle>
            <p className="text-slate-600">Faça login para acessar seu painel</p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Sugestão de última vaga */}
            {lastAccessedVaga && credentials.identifier !== lastAccessedVaga && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-700">
                      Último acesso: Vaga {lastAccessedVaga}
                    </span>
                  </div>
                  <Button 
                    onClick={handleUseSuggestedVaga}
                    variant="outline" 
                    size="sm"
                    className="text-blue-600 border-blue-200 hover:bg-blue-100"
                  >
                    Usar
                  </Button>
                </div>
              </div>
            )}

            {/* Formulário */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-slate-700 font-medium">
                  Número da Vaga (1-30) ou "admin"
                </Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="Ex: 1, 2, 3... ou admin"
                  value={credentials.identifier}
                  onChange={(e) => setCredentials(prev => ({ 
                    ...prev, 
                    identifier: e.target.value 
                  }))}
                  className="text-lg"
                  disabled={isLoading}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua senha"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ 
                      ...prev, 
                      password: e.target.value 
                    }))}
                    className="text-lg pr-10"
                    disabled={isLoading}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={togglePasswordVisibility}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-slate-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-slate-400" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Validação em tempo real */}
              {currentValidation && !currentValidation.isValid && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      {currentValidation.errors.map((error, index) => (
                        <p key={index} className="text-sm text-red-700">{error}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Validação positiva */}
              {currentValidation && currentValidation.isValid && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-green-700">
                      {currentValidation.userType === "admin" 
                        ? "Credenciais de administrador válidas" 
                        : `Credenciais da Vaga ${currentValidation.vagaNumber} válidas`
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Botões */}
              <div className="space-y-3">
                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg py-3"
                  disabled={!canLogin}
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Entrando...
                    </>
                  ) : (
                    <>
                      <LogIn className="h-5 w-5 mr-2" />
                      Entrar
                    </>
                  )}
                </Button>

                <Button 
                  type="button"
                  onClick={handleClearFields}
                  variant="outline" 
                  className="w-full"
                  disabled={isLoading}
                >
                  Limpar Campos
                </Button>
              </div>
            </form>
            
            {/* Acesso público */}
            <div className="pt-4 border-t">
              <Button 
                onClick={handleViewDrivers}
                variant="outline" 
                className="w-full text-slate-600 border-slate-300 hover:bg-slate-50"
                disabled={isLoading}
              >
                <Truck className="h-4 w-4 mr-2" />
                Ver Status dos Motoristas (Público)
              </Button>
            </div>
            
            {/* Informações de credenciais */}
            <div className="mt-6 p-4 bg-slate-50 rounded-lg space-y-2">
              <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Credenciais de Acesso
              </h4>
              <div className="space-y-1 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Vagas (1-30):</span>
                  <Badge variant="outline">senha "{CONSTANTS.VAGA_PASSWORD}"</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Admin:</span>
                  <div className="space-x-1">
                    <Badge variant="outline">usuário "{CONSTANTS.ADMIN_IDENTIFIER}"</Badge>
                    <Badge variant="outline">senha "{CONSTANTS.ADMIN_PASSWORD}"</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;