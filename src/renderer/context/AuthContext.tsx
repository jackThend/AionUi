import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

// CriterioIA: esta app la usa un unico administrador de tribunal en su propio
// equipo (o via webui en su red local) -- no tiene sentido un sistema de login
// multiusuario, asi que la sesion siempre se considera autenticada.
type AuthStatus = 'authenticated';

export interface AuthUser {
  id: string;
  username: string;
}

interface LoginParams {
  username: string;
  password: string;
  remember?: boolean;
}

interface LoginResult {
  success: boolean;
  message?: string;
}

interface AuthContextValue {
  ready: boolean;
  user: AuthUser | null;
  status: AuthStatus;
  login: (params: LoginParams) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user] = useState<AuthUser | null>(null);

  const login = useCallback((_params: LoginParams): Promise<LoginResult> => {
    return Promise.resolve({ success: true });
  }, []);

  const logout = useCallback(async () => {
    // No-op: no hay sesion que cerrar.
  }, []);

  const refresh = useCallback(async () => {
    // No-op: el estado siempre es 'authenticated'.
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready: true,
      user,
      status: 'authenticated',
      login,
      logout,
      refresh,
    }),
    [login, logout, refresh, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
