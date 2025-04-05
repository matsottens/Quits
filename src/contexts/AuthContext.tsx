import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { SubscriptionData, PriceChange } from '../types/subscription';
import { apiService } from '../services/api';

// Flag to enable mock auth for local development - explicitly set to false
const USE_MOCK_AUTH = false;

// Mock user for local development
const MOCK_USER: User = {
  id: 'mock-user-id',
  email: 'mock-user@example.com',
  created_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  role: ''
};

// Mock session for local development
const MOCK_SESSION: Session = {
  access_token: 'mock-access-token.with.periods',
  refresh_token: 'mock-refresh-token',
  provider_token: 'mock-provider-token',
  provider_refresh_token: null,
  user: MOCK_USER,
  expires_at: Date.now() + 3600,
  token_type: 'bearer',
  expires_in: 3600
};

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
}

interface SubscriptionState {
  isLoading: boolean;
  error: string | null;
  subscriptions: SubscriptionData[];
  priceChanges: PriceChange[] | null;
  lastScanTime: string | null;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
  scanEmails: () => Promise<void>;
  subscriptionState: SubscriptionState;
  isScanning: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }: any) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: USE_MOCK_AUTH ? MOCK_USER : null,
    session: USE_MOCK_AUTH ? MOCK_SESSION : null,
    isLoading: !USE_MOCK_AUTH,
    error: null
  });

  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>({
    isLoading: false,
    error: null,
    subscriptions: [],
    priceChanges: null,
    lastScanTime: null
  });

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => {
    setAuthState(prev => ({ ...prev, error: null }));
  };

  const handleAuthError = (error: Error) => {
    console.error('Auth error:', error);
    setAuthState(prev => ({
      ...prev,
      error: error.message,
      isLoading: false
    }));
  };

  const refreshSession = async () => {
    if (USE_MOCK_AUTH) {
      console.log('Using mock authentication, skipping session refresh');
      return;
    }
    
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        throw error;
      }

      if (session?.provider_token) {
        sessionStorage.setItem('gmail_access_token', session.provider_token);
      }

      setAuthState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
        isLoading: false,
        error: null
      }));
    } catch (error) {
      handleAuthError(error instanceof Error ? error : new Error('Failed to refresh session'));
    }
  };

  const signIn = async (email: string, password: string) => {
    if (USE_MOCK_AUTH) {
      console.log('Using mock authentication, auto-signing in');
      setAuthState({
        user: MOCK_USER,
        session: MOCK_SESSION,
        isLoading: false,
        error: null
      });
      return;
    }
    
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      const { data: { session, user }, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      setAuthState(prev => ({
        ...prev,
        session,
        user,
        isLoading: false,
        error: null
      }));
    } catch (error) {
      handleAuthError(error instanceof Error ? error : new Error('Failed to sign in'));
    }
  };

  const signInWithGoogle = async () => {
    if (USE_MOCK_AUTH) {
      console.log('Using mock authentication, auto-signing in with Google');
      setAuthState({
        user: MOCK_USER,
        session: MOCK_SESSION,
        isLoading: false,
        error: null
      });
      return;
    }
    
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      console.log('Initiating Google sign-in with OAuth...');
      
      // Use the correct redirect URL - make sure it matches what's set in Supabase
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log('Using redirect URL:', redirectUrl);
      
      // Ensure we request the necessary Gmail scopes
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/gmail.readonly email profile',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',  // Force the Google consent screen to appear
            include_granted_scopes: 'true'
          },
          redirectTo: redirectUrl
        }
      });

      if (error) {
        console.error('Google sign-in error:', error);
        throw error;
      } else {
        console.log('Google sign-in initiated successfully, redirecting...');
      }
    } catch (error) {
      console.error('Failed to sign in with Google:', error);
      handleAuthError(error instanceof Error ? error : new Error('Failed to sign in with Google'));
    }
  };

  const signUp = async (email: string, password: string) => {
    if (USE_MOCK_AUTH) {
      console.log('Using mock authentication, auto-signing up');
      setAuthState({
        user: MOCK_USER,
        session: MOCK_SESSION,
        isLoading: false,
        error: null
      });
      return;
    }
    
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      const { data: { session, user }, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) throw error;

      setAuthState(prev => ({
        ...prev,
        session,
        user,
        isLoading: false,
        error: null
      }));
    } catch (error) {
      handleAuthError(error instanceof Error ? error : new Error('Failed to sign up'));
    }
  };

  const signOut = async () => {
    if (USE_MOCK_AUTH) {
      console.log('Using mock authentication, signing out');
      setAuthState({
        user: null,
        session: null,
        isLoading: false,
        error: null
      });
      return;
    }
    
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;

      sessionStorage.removeItem('gmail_access_token');
      
      setAuthState({
        user: null,
        session: null,
        isLoading: false,
        error: null
      });
    } catch (error) {
      handleAuthError(error instanceof Error ? error : new Error('Failed to sign out'));
    }
  };

  const scanEmails = async (): Promise<void> => {
    setIsScanning(true);
    setError(null);
    try {
      const response = await apiService.scanEmails();
      if (!response.ok || !response.data) {
        throw new Error(response.error || 'Failed to scan emails');
      }
      const { subscriptions = [], priceChanges = null } = response.data;
      setSubscriptionState(prev => ({
        ...prev,
        subscriptions,
        priceChanges,
        lastScanTime: new Date().toISOString()
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred while scanning emails');
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (USE_MOCK_AUTH) {
      console.log('Using mock authentication, skipping auth initialization');
      return;
    }
    
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session?.provider_token) {
          sessionStorage.setItem('gmail_access_token', session.provider_token);
        }

        setAuthState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
          isLoading: false
        }));
      } catch (error) {
        handleAuthError(error instanceof Error ? error : new Error('Failed to initialize auth'));
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (session?.provider_token) {
        sessionStorage.setItem('gmail_access_token', session.provider_token);
      }

      setAuthState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
        isLoading: false
      }));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    ...authState,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    refreshSession,
    clearError,
    scanEmails,
    subscriptionState,
    isScanning,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 