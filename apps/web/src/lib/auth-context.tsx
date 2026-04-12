"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "@/types";
import { mockLogin, mockSignup, mockLogout, mockResetPassword } from "./api";
import { useRouter } from "next/navigation";

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string, code?: string, newPassword?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check local storage for mocked session
    const token = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("auth_user");
    
    if (token && storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const { user, token } = await mockLogin(email, password);
      localStorage.setItem("auth_token", token);
      localStorage.setItem("auth_user", JSON.stringify(user));
      setCurrentUser(user);
    } catch (err: any) {
      setError(err.message || "Failed to sign in.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const { user, token } = await mockSignup(email, password);
      localStorage.setItem("auth_token", token);
      localStorage.setItem("auth_user", JSON.stringify(user));
      setCurrentUser(user);
    } catch (err: any) {
      setError(err.message || "Failed to sign up.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await mockLogout();
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      setCurrentUser(null);
      router.push("/auth/login");
    } catch (err: any) {
      setError("Failed to sign out.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string, code?: string, newPassword?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await mockResetPassword(email, code, newPassword);
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, error, login, signup, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
