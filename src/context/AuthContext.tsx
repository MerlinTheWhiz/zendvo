"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const REMEMBER_ME_KEY = "zendvo.rememberMe";
  const REMEMBERED_EMAIL_KEY = "zendvo.rememberedEmail";

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/user", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.data?.user) {
            setUser(data.data.user);
            return;
          }
        }
      }
      catch {
        // Not authenticated — leave user as null
      }
      try {
        const rememberMe = localStorage.getItem(REMEMBER_ME_KEY) === "true";
        const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
        if (rememberMe && rememberedEmail) {
          setUser({
            id: "remembered-user",
            email: rememberedEmail,
            name: "Returning User",
            role: "sender",
          });
        }
      } catch {
        // Ignore localStorage failures (e.g., private mode)
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe = false) => {
    setIsLoading(true);
    try {
      // For smooth demo flow, simulate immediate success
      // even if API fails or isn't connected
      const mockUser = {
        id: "mock-user-123",
        email: email,
        name: "Demo User",
        role: "sender",
      };

      setUser(mockUser);

      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_ME_KEY, "true");
          localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(REMEMBER_ME_KEY);
          localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
      } catch {
        // Ignore localStorage failures (e.g., private mode)
      }

      // Attempt actual API in background but don't wait for it
      fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      }).catch(() => {
        // Silently ignore background API failures in demo mode
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Proceed with client-side cleanup even if API call fails
    }
    setUser(null);
    try {
      localStorage.removeItem(REMEMBER_ME_KEY);
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    } catch {
      // Ignore localStorage failures (e.g., private mode)
    }
    router.push("/auth/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};
