import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, ApiError, type User } from '@/lib/api';
import {
  clearToken,
  clearSessionAfterReinstall,
  readCachedUser,
  readRefreshToken,
  readToken,
  writeCachedUser,
  writeRefreshToken,
  writeToken,
} from '@/lib/storage';

interface AppContextValue {
  user: User | null;
  token: string | null;
  ready: boolean;
  signIn: (token: string, refreshToken: string, user: User) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
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
        await clearSessionAfterReinstall();
      } catch (error) {
        console.error('Could not check whether this app installation is new:', error);
        if (active) setReady(true);
        return;
      }
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
          const [savedToken, cachedUser] = await Promise.all([
            readToken(),
            readCachedUser<User>(),
          ]);
          if (active) {
            setToken(savedToken);
            setUser(savedToken ? cachedUser : null);
          }
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
    async signIn(nextToken, refreshToken, nextUser) {
      await Promise.all([
        writeToken(nextToken),
        writeRefreshToken(refreshToken),
        writeCachedUser(nextUser),
      ]);
      setToken(nextToken);
      setUser(nextUser);
    },
    /** Replace only the in-memory profile after the backend confirms an update. */
    async updateUser(nextUser) {
      await writeCachedUser(nextUser);
      setUser(nextUser);
    },
    /** Revoke the server session when possible and always clear local credentials. */
    async signOut() {
      const refreshToken = await readRefreshToken();
      try {
        if (refreshToken) {
          await apiRequest('/auth/logout', {
            method: 'POST',
            body: { refreshToken },
            skipRefresh: true,
          });
        }
      } catch (error) {
        console.warn('Could not revoke the server session during logout:', error);
      } finally {
        await clearToken();
        setToken(null);
        setUser(null);
      }
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
