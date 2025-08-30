// Login_SUPABASE.tsx - Interface de autenticação com Supabase Auth
// Versão híbrida: Supabase Auth + localStorage como fallback

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { 
  LogIn, Eye, EyeOff, Truck, Shield, Info, 
  CheckCircle, XCircle, AlertTriangle, UserPlus,
  Cloud, CloudOff, Wifi, WifiOff
} from "lucide-react";

// Interfaces TypeScript
interface LoginCredentials {
  email: string;
  password: string;
  identifier?: string; // Para modo legacy (número da vaga)
}

interface SupabaseUser {
  id: string;
  email: string;
  user_metadata: {
    vaga_number?: number;
    user_type?: 'vaga' | 'admin';
    display_name?: string;
  };
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
  // Credenciais legacy (fallback)
  VAGA_PASSWORD: import.meta.env.VITE_VAGA_PASSWORD || "",
  ADMIN_IDENTIFIER: "admin",
  ADMIN_PASSWORD: import.meta.env.VITE_ADMIN_PASSWORD || "",
  MIN_VAGA: 1,
  MAX_VAGA: 30,
  
  // Configurações Supabase
  DEFAULT_ADMIN_EMAIL: "admin@vagaagil.com",
  
  STORAGE_KEYS: {
    VAGA_LOGGED_IN: "vagaLoggedIn",
    USER_TYPE: "userType",
    LAST_ACCESSED_VAGA: "lastAccessedVaga",
    AUTH_MODE: "authMode", // 'supabase' ou 'legacy'
    USER_SESSION: "userSession"
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
  const [authMode, setAuthMode] = useState<'supabase' | 'legacy'>('supabase');
  const [isSupabaseAvailable, setIsSupabaseAvailable] = useState(isSupabaseConfigured());
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: "",
    password: "",
    identifier: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [lastAccessedVaga, setLastAccessedVaga] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

  // Verificar conectividade do Supabase
  useEffect(() => {
    const checkSupabaseConnection = async () => {
      if (!isSupabaseConfigured()) {
        setIsSupabaseAvailable(false);
        setAuthMode('legacy');
        setConnectionStatus('disconnected');
        return;
      }

      setConnectionStatus('connecting');
      try {
        // Teste simples de conectividade
        const { data, error } = await supabase.from('usuarios').select('email').limit(1);
        if (error && error.code !== 'PGRST116') { // PGRST116 = tabela não encontrada (ok para teste)
          throw error;
        }
        
        setIsSupabaseAvailable(true);
        setConnectionStatus('connected');
        console.log('✅ Supabase conectado com sucesso');
        
        // Verificar se há sessão ativa
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('🔐 Sessão ativa encontrada:', session.user.email);
          handleExistingSession(session);
        }
        
      } catch (error: any) {
        console.error('❌ Erro de conexão Supabase:', error);
        setIsSupabaseAvailable(false);
        setAuthMode('legacy');
        setConnectionStatus('disconnected');
        
        toast({
          title: "⚠️ Modo Offline",
          description: "Usando autenticação local. Funcionalidades limitadas.",
          duration: 3000,
        });
      }
    };

    checkSupabaseConnection();
  }, []);

  // Carregar dados de sessão existente
  const handleExistingSession = useCallback(async (session: any) => {
    try {
      const user = session.user;
      const userType = user.user_metadata?.user_type || 'vaga';
      const vagaNumber = user.user_metadata?.vaga_number;
      
      // Salvar dados da sessão
      localStorage.setItem(CONSTANTS.STORAGE_KEYS.AUTH_MODE, 'supabase');
      localStorage.setItem(CONSTANTS.STORAGE_KEYS.USER_TYPE, userType);
      localStorage.setItem(CONSTANTS.STORAGE_KEYS.USER_SESSION, JSON.stringify({
        id: user.id,
        email: user.email,
        userType,
        vagaNumber
      }));
      
      if (userType === 'admin') {
        navigate(CONSTANTS.ROUTES.ADMIN);
      } else if (userType === 'vaga' && vagaNumber) {
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.VAGA_LOGGED_IN, vagaNumber.toString());
        navigate(`${CONSTANTS.ROUTES.VAGA}/${vagaNumber}`);
      }
      
    } catch (error) {
      console.error('Erro ao processar sessão existente:', error);
    }
  }, [navigate]);

  // Carregar última vaga acessada
  useEffect(() => {
    const lastVaga = localStorage.getItem(CONSTANTS.STORAGE_KEYS.LAST_ACCESSED_VAGA) || "";
    setLastAccessedVaga(lastVaga);
    if (lastVaga && authMode === 'legacy') {
      setCredentials(prev => ({ ...prev, identifier: lastVaga }));
    }
  }, [authMode]);

  // ===== FUNÇÕES SUPABASE AUTH =====

  // Função para login com Supabase
  const handleSupabaseLogin = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.user) {
        const userType = data.user.user_metadata?.user_type || 'vaga';
        const vagaNumber = data.user.user_metadata?.vaga_number;
        
        // Salvar dados da sessão
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.AUTH_MODE, 'supabase');
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.USER_TYPE, userType);
        localStorage.setItem(CONSTANTS.STORAGE_KEYS.USER_SESSION, JSON.stringify({
          id: data.user.id,
          email: data.user.email,
          userType,
          vagaNumber
        }));

        toast({
          title: "✅ Login realizado",
          description: `Bem-vindo, ${data.user.email}`,
        });

        if (userType === 'admin') {
          navigate(CONSTANTS.ROUTES.ADMIN);
        } else if (userType === 'vaga' && vagaNumber) {
          localStorage.setItem(CONSTANTS.STORAGE_KEYS.VAGA_LOGGED_IN, vagaNumber.toString());
          localStorage.setItem(CONSTANTS.STORAGE_KEYS.LAST_ACCESSED_VAGA, vagaNumber.toString());
          navigate(`${CONSTANTS.ROUTES.VAGA}/${vagaNumber}`);
        }

        return true;
      }

      return false;

    } catch (error: any) {
      console.error('Erro no login Supabase:', error);
      
      if (error.message?.includes('Invalid login credentials')) {
        throw new Error('Email ou senha incorretos');
      } else if (error.message?.includes('Email not confirmed')) {
        throw new Error('Email não confirmado. Verifique sua caixa de entrada.');
      } else {
        throw new Error(`Erro de autenticação: ${error.message}`);
      }
    }
  }, [navigate, toast]);

  // Função para registro com Supabase
  const handleSupabaseRegister = useCallback(async (email: string, password: string, userType: 'vaga' | 'admin', vagaNumber?: number) => {
    try {
      // Validar email para vaga
      if (userType === 'vaga' && vagaNumber) {
        const expectedEmail = `vaga${vagaNumber.toString().padStart(2, '0')}@vagaagil.com`;
        if (email !== expectedEmail) {
          throw new Error(`Para Vaga ${vagaNumber}, use o email: ${expectedEmail}`);
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            user_type: userType,
            vaga_number: vagaNumber,
            display_name: userType === 'admin' ? 'Administrador' : `Vaga ${vagaNumber}`
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        toast({
          title: "✅ Conta criada",
          description: "Verifique seu email para confirmar a conta",
          duration: 5000,
        });

        // Inserir dados do usuário na tabela personalizada
        const { error: insertError } = await supabase
          .from('usuarios')
          .insert([{
            id: data.user.id,
            email: data.user.email,
            user_type: userType,
            vaga_number: vagaNumber,
            display_name: userType === 'admin' ? 'Administrador' : `Vaga ${vagaNumber}`,
            created_at: new Date().toISOString()
          }]);

        if (insertError) {
          console.error('Erro ao inserir dados do usuário:', insertError);
        }

        return true;
      }

      return false;

    } catch (error: any) {
      console.error('Erro no registro Supabase:', error);
      
      if (error.message?.includes('User already registered')) {
        throw new Error('Este email já está em uso');
      } else {
        throw new Error(`Erro no registro: ${error.message}`);
      }
    }
  }, [toast]);

  // ===== VALIDAÇÃO LEGACY =====

  const validateLegacyCredentials = useCallback((creds: LoginCredentials): LoginValidation => {
    const errors: string[] = [];
    let isValid = false;
    let userType: "vaga" | "admin" | null = null;
    let vagaNumber: number | undefined;

    if (!creds.identifier?.trim()) {
      errors.push("Identificador é obrigatório");
    }
    
    if (!creds.password.trim()) {
      errors.push("Senha é obrigatória");
    }

    if (errors.length > 0) {
      return { isValid: false, userType: null, errors };
    }

    // Validação para Admin
    if (creds.identifier?.toLowerCase() === CONSTANTS.ADMIN_IDENTIFIER) {
      if (creds.password === CONSTANTS.ADMIN_PASSWORD) {
        isValid = true;
        userType = "admin";
      } else {
        errors.push("Senha do administrador incorreta");
      }
    } 
    // Validação para Vaga
    else {
      const vagaNum = parseInt(creds.identifier!);
      
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

  // ===== FUNÇÃO PRINCIPAL DE LOGIN =====

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (authMode === 'supabase' && isSupabaseAvailable) {
        // Modo Supabase
        if (!credentials.email || !credentials.password) {
          throw new Error('Email e senha são obrigatórios');
        }

        await handleSupabaseLogin(credentials.email, credentials.password);
        
      } else {
        // Modo Legacy
        const validation = validateLegacyCredentials(credentials);
        
        if (!validation.isValid) {
          throw new Error(validation.errors.join(". "));
        }

        // Processamento legacy
        if (validation.userType === "admin") {
          localStorage.setItem(CONSTANTS.STORAGE_KEYS.USER_TYPE, "admin");
          localStorage.setItem(CONSTANTS.STORAGE_KEYS.AUTH_MODE, "legacy");
          
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
          localStorage.setItem(CONSTANTS.STORAGE_KEYS.AUTH_MODE, "legacy");
          
          toast({
            title: "✅ Login realizado",
            description: `Bem-vindo à Vaga ${validation.vagaNumber}`,
          });
          
          navigate(`${CONSTANTS.ROUTES.VAGA}/${validation.vagaNumber}`);
        }
      }
      
    } catch (error: any) {
      console.error("Erro no processo de login:", error);
      toast({
        title: "Erro no login",
        description: error.message || "Ocorreu um erro durante o login",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [authMode, isSupabaseAvailable, credentials, handleSupabaseLogin, validateLegacyCredentials, navigate, toast]);

  // ===== FUNÇÃO DE REGISTRO =====

  const handleRegister = useCallback(async () => {
    if (!isSupabaseAvailable) {
      toast({
        title: "⚠️ Registro indisponível",
        description: "Registro só funciona com Supabase conectado",
        variant: "destructive",
      });
      return;
    }

    setIsRegistering(true);

    try {
      if (!credentials.email || !credentials.password) {
        throw new Error('Email e senha são obrigatórios para registro');
      }

      // Determinar tipo de usuário baseado no email
      let userType: 'vaga' | 'admin' = 'admin';
      let vagaNumber: number | undefined;

      if (credentials.email === CONSTANTS.DEFAULT_ADMIN_EMAIL) {
        userType = 'admin';
      } else if (credentials.email.match(/^vaga(\d{2})@vagaagil\.com$/)) {
        userType = 'vaga';
        const match = credentials.email.match(/^vaga(\d{2})@vagaagil\.com$/);
        vagaNumber = parseInt(match![1]);
        
        if (vagaNumber < CONSTANTS.MIN_VAGA || vagaNumber > CONSTANTS.MAX_VAGA) {
          throw new Error(`Número da vaga deve estar entre ${CONSTANTS.MIN_VAGA} e ${CONSTANTS.MAX_VAGA}`);
        }
      } else {
        throw new Error('Email deve ser admin@vagaagil.com ou vaga[XX]@vagaagil.com (ex: vaga01@vagaagil.com)');
      }

      await handleSupabaseRegister(credentials.email, credentials.password, userType, vagaNumber);
      
    } catch (error: any) {
      console.error("Erro no registro:", error);
      toast({
        title: "Erro no registro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  }, [isSupabaseAvailable, credentials, handleSupabaseRegister, toast]);

  // ===== FUNÇÕES AUXILIARES =====

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const handleUseSuggestedVaga = useCallback(() => {
    if (lastAccessedVaga) {
      if (authMode === 'supabase') {
        setCredentials(prev => ({ 
          ...prev, 
          email: `vaga${lastAccessedVaga.padStart(2, '0')}@vagaagil.com`
        }));
      } else {
        setCredentials(prev => ({ 
          ...prev, 
          identifier: lastAccessedVaga 
        }));
      }
    }
  }, [lastAccessedVaga, authMode]);

  const handleClearFields = useCallback(() => {
    setCredentials({ email: "", password: "", identifier: "" });
  }, []);

  const handleViewDrivers = useCallback(() => {
    navigate(CONSTANTS.ROUTES.DRIVERS);
  }, [navigate]);

  const handleSwitchAuthMode = useCallback(() => {
    setAuthMode(prev => prev === 'supabase' ? 'legacy' : 'supabase');
    setCredentials({ email: "", password: "", identifier: "" });
  }, []);

  // ===== VALIDAÇÕES =====

  const currentValidation = useMemo(() => {
    if (authMode === 'supabase') {
      if (!credentials.email && !credentials.password) return null;
      
      const errors: string[] = [];
      if (!credentials.email.includes('@')) errors.push('Email inválido');
      if (credentials.password.length < 6) errors.push('Senha deve ter pelo menos 6 caracteres');
      
      return {
        isValid: errors.length === 0,
        userType: credentials.email === CONSTANTS.DEFAULT_ADMIN_EMAIL ? 'admin' as const : 'vaga' as const,
        errors
      };
    } else {
      if (!credentials.identifier && !credentials.password) return null;
      return validateLegacyCredentials(credentials);
    }
  }, [authMode, credentials, validateLegacyCredentials]);

  const canLogin = useMemo(() => {
    if (authMode === 'supabase') {
      return credentials.email.trim() && credentials.password.trim() && !isLoading;
    } else {
      return credentials.identifier?.trim() && credentials.password.trim() && !isLoading;
    }
  }, [authMode, credentials, isLoading]);

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

        {/* Status de Conexão */}
        <Alert className={`border ${
          connectionStatus === 'connected' ? 'border-green-200 bg-green-50' :
          connectionStatus === 'connecting' ? 'border-yellow-200 bg-yellow-50' :
          'border-red-200 bg-red-50'
        }`}>
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' ? <Cloud className="h-4 w-4 text-green-600" /> :
             connectionStatus === 'connecting' ? <Wifi className="h-4 w-4 text-yellow-600 animate-pulse" /> :
             <CloudOff className="h-4 w-4 text-red-600" />}
            <AlertDescription className={
              connectionStatus === 'connected' ? 'text-green-800' :
              connectionStatus === 'connecting' ? 'text-yellow-800' :
              'text-red-800'
            }>
              {connectionStatus === 'connected' ? 'Supabase conectado - Autenticação em nuvem ativa' :
               connectionStatus === 'connecting' ? 'Conectando ao Supabase...' :
               'Modo offline - Usando autenticação local'}
            </AlertDescription>
          </div>
        </Alert>

        {/* Card Principal */}
        <Card className="border shadow-lg bg-white">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
              <LogIn className="h-6 w-6" />
              Autenticação
            </CardTitle>
            <p className="text-slate-600">
              {authMode === 'supabase' ? 'Login com conta Supabase' : 'Login modo legado'}
            </p>
            
            {/* Botão para alternar modo */}
            {isSupabaseAvailable && (
              <Button
                onClick={handleSwitchAuthMode}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                {authMode === 'supabase' ? (
                  <>
                    <WifiOff className="h-4 w-4 mr-2" />
                    Usar modo legado
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4 mr-2" />
                    Usar Supabase
                  </>
                )}
              </Button>
            )}
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Sugestão de última vaga */}
            {lastAccessedVaga && (
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
              {authMode === 'supabase' ? (
                // Campos Supabase
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-700 font-medium">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="vaga01@vagaagil.com ou admin@vagaagil.com"
                      value={credentials.email}
                      onChange={(e) => setCredentials(prev => ({ 
                        ...prev, 
                        email: e.target.value 
                      }))}
                      className="text-lg"
                      disabled={isLoading || isRegistering}
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
                        placeholder="Digite sua senha (min. 6 caracteres)"
                        value={credentials.password}
                        onChange={(e) => setCredentials(prev => ({ 
                          ...prev, 
                          password: e.target.value 
                        }))}
                        className="text-lg pr-10"
                        disabled={isLoading || isRegistering}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={togglePasswordVisibility}
                        disabled={isLoading || isRegistering}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-slate-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-slate-400" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                // Campos Legacy
                <>
                  <div className="space-y-2">
                    <Label htmlFor="identifier" className="text-slate-700 font-medium">
                      Número da Vaga (1-30) ou "admin"
                    </Label>
                    <Input
                      id="identifier"
                      type="text"
                      placeholder="Ex: 1, 2, 3... ou admin"
                      value={credentials.identifier || ""}
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
                    <Label htmlFor="legacy-password" className="text-slate-700 font-medium">
                      Senha
                    </Label>
                    <div className="relative">
                      <Input
                        id="legacy-password"
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
                </>
              )}

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
                        : `Credenciais da Vaga ${currentValidation.vagaNumber || "válidas"}`
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

                {/* Botão de registro (apenas Supabase) */}
                {authMode === 'supabase' && isSupabaseAvailable && (
                  <Button 
                    type="button"
                    onClick={handleRegister}
                    variant="outline" 
                    className="w-full border-green-300 text-green-700 hover:bg-green-50"
                    disabled={!credentials.email || !credentials.password || isLoading || isRegistering}
                  >
                    {isRegistering ? (
                      <>
                        <div className="h-4 w-4 border border-green-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                        Criando conta...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Criar nova conta
                      </>
                    )}
                  </Button>
                )}

                <Button 
                  type="button"
                  onClick={handleClearFields}
                  variant="outline" 
                  className="w-full"
                  disabled={isLoading || isRegistering}
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
                disabled={isLoading || isRegistering}
              >
                <Truck className="h-4 w-4 mr-2" />
                Ver Status dos Motoristas (Público)
              </Button>
            </div>
            
            {/* Informações de credenciais */}
            <div className="mt-6 p-4 bg-slate-50 rounded-lg space-y-2">
              <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {authMode === 'supabase' ? 'Formato de Email' : 'Credenciais de Acesso'}
              </h4>
              <div className="space-y-1 text-sm text-slate-600">
                {authMode === 'supabase' ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span>Admin:</span>
                      <Badge variant="outline">{CONSTANTS.DEFAULT_ADMIN_EMAIL}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Vagas:</span>
                      <Badge variant="outline">vaga01@vagaagil.com, vaga02@vagaagil.com, etc.</Badge>
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
