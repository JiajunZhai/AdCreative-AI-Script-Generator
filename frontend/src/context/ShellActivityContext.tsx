import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface RouteShellActivity {
  busy: boolean;
  /** Short status for aria-label / title */
  label: string;
}

interface ShellActivityContextValue {
  generator: RouteShellActivity;
  oracle: RouteShellActivity;
  setGeneratorShell: (busy: boolean, label?: string) => void;
  setOracleShell: (busy: boolean, label?: string) => void;
}

const defaultActivity: RouteShellActivity = { busy: false, label: '' };

const ShellActivityContext = createContext<ShellActivityContextValue | null>(null);

export const ShellActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [generator, setGenerator] = useState<RouteShellActivity>(defaultActivity);
  const [oracle, setOracle] = useState<RouteShellActivity>(defaultActivity);

  const setGeneratorShell = useCallback((busy: boolean, label = '') => {
    setGenerator({ busy, label: busy ? label : '' });
  }, []);

  const setOracleShell = useCallback((busy: boolean, label = '') => {
    setOracle({ busy, label: busy ? label : '' });
  }, []);

  const value = useMemo(
    () => ({
      generator,
      oracle,
      setGeneratorShell,
      setOracleShell,
    }),
    [generator, oracle, setGeneratorShell, setOracleShell]
  );

  return <ShellActivityContext.Provider value={value}>{children}</ShellActivityContext.Provider>;
};

export function useShellActivity(): ShellActivityContextValue {
  const ctx = useContext(ShellActivityContext);
  if (!ctx) {
    throw new Error('useShellActivity must be used within ShellActivityProvider');
  }
  return ctx;
}
