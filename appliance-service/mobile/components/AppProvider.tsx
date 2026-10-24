import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, ApiError, type User } from '@/lib/api';
import { clearToken, readToken, writeToken } from '@/lib/storage';

interface AppContextValue {
  user: User | null;
  token: string | null;
  ready: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  updateUser: (user: User) => void;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Restore the saved session once and expose login/profile actions to app screens. */
export function AppProvider({ children }: React.PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    // Restore only from secure storage and validate the token before showing the account session.
    async function restore() {
      try {
        const savedToken = await readToken();
        if (!savedToken) return;
        const response = await apiRequest<{ user: User }>('/user/profile', { token: savedToken });
        if (active) {
          setToken(savedToken);
          setUser(response.user);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clearToken();
        } else {
          const savedToken = await readToken();
          if (active) setToken(savedToken);
        }
      } finally {
        if (active) setReady(true);
      }
    }
    void restore();
    return () => { active = false; };
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    user,
    token,
    ready,
    /** Store verified credentials before updating the in-memory session. */
    async signIn(nextToken, nextUser) {
      await writeToken(nextToken);
      setToken(nextToken);
      setUser(nextUser);
    },
    /** Replace only the in-memory profile after the backend confirms an update. */
    updateUser(nextUser) {
      setUser(nextUser);
    },
    /** Clear platform token storage before dropping the current session. */
    async signOut() {
      await clearToken();
      setToken(null);
      setUser(null);
    },
  }), [user, token, ready]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Read the shared user session and fail loudly if a screen is mounted outside its provider. */
export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider.');
  return context;
}
