import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { initiateGoogleAuth } from '../services/googleAuth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  scanEmails: () => Promise<void>;
  login: (tokens: any) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check active sessions and sets the user
    const initializeAuth = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        
        // Check if we have provider tokens in the session
        if (session?.provider_token) {
          sessionStorage.setItem('gmail_access_token', session.provider_token);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setLoading(true);
      try {
        console.log('Auth state changed:', event, session?.user?.email);
        console.log('Provider token available:', !!session?.provider_token);
        
        if (event === 'SIGNED_OUT') {
          setUser(null);
          sessionStorage.removeItem('gmail_access_token');
        } else if (session?.user) {
          setUser(session.user);
          // Store provider token if available
          if (session.provider_token) {
            console.log('Storing provider token');
            sessionStorage.setItem('gmail_access_token', session.provider_token);
          }
        }
      } catch (error) {
        console.error('Error handling auth state change:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null); // Immediately clear the user state
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const redirectTo = window.location.host.includes('localhost')
        ? 'http://localhost:3000/auth/callback'
        : `${window.location.origin}/auth/callback`;

      console.log('Starting Google sign-in with redirect:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          },
          skipBrowserRedirect: false
        }
      });

      if (error) {
        throw error;
      }

      if (!data.url) {
        throw new Error('No URL returned from Supabase OAuth');
      }

      console.log('Redirecting to OAuth URL:', data.url);
      window.location.href = data.url;
    } catch (error) {
      console.error('Error initiating Google sign-in:', error);
      setError(error instanceof Error ? error.message : 'Failed to start Google sign-in');
    } finally {
      setLoading(false);
    }
  };

  const login = async (tokens: any) => {
    try {
      console.log('Logging in with tokens:', {
        hasAccessToken: !!tokens.access_token,
        hasIdToken: !!tokens.id_token,
        hasUser: !!tokens.user
      });

      // Store the Gmail token for later use
      if (tokens.access_token) {
        sessionStorage.setItem('gmail_access_token', tokens.access_token);
      }

      // Sign in with Supabase using the Google ID token
      if (tokens.id_token) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: tokens.id_token,
        });

        if (error) {
          console.error('Supabase sign in error:', error);
          throw error;
        }

        console.log('Supabase sign in successful:', {
          hasSession: !!data.session,
          hasUser: !!data.user
        });

        setUser(data.user);
        return data;
      } else {
        throw new Error('No ID token provided');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Failed to login');
      throw error;
    }
  };

  const scanEmails = async () => {
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const { data: { session: currentSession } } = session;
      const gmailToken = localStorage.getItem('gmail_token');
      
      console.log('Scan emails - Session:', {
        hasSession: !!currentSession,
        hasAccessToken: !!currentSession?.access_token,
        hasProviderToken: !!currentSession?.provider_token,
        hasStoredGmailToken: !!gmailToken,
        userId: currentSession?.user?.id
      });
      
      if (!currentSession?.access_token) {
        throw new Error('Not authenticated with Supabase');
      }

      if (!gmailToken) {
        throw new Error('No Gmail access token available. Please sign in with Google again.');
      }

      if (!currentSession.user?.id) {
        throw new Error('No user ID available');
      }

      // Use the API URL from environment or fallback to a default
      const apiUrl = process.env.REACT_APP_API_URL || 'https://api.quits.cc';
      const apiUrlWithProtocol = apiUrl.startsWith('http') ? apiUrl : `https://${apiUrl.replace(/^\/+/, '')}`;
      console.log('Scanning emails using API URL:', apiUrlWithProtocol);

      // Common fetch options
      const fetchOptions = {
        credentials: 'include' as RequestCredentials,
        mode: 'cors' as RequestMode,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
          'X-Gmail-Token': gmailToken,
          'X-User-ID': currentSession.user.id
        }
      };

      // First, try a health check
      try {
        const healthCheck = await fetch(`${apiUrlWithProtocol}/health`, {
          method: 'GET',
          ...fetchOptions
        });
        
        if (!healthCheck.ok) {
          throw new Error(`Health check failed with status ${healthCheck.status}`);
        }
        
        const healthData = await healthCheck.json();
        console.log('Health check response:', healthData);
      } catch (error) {
        console.error('Health check failed:', error);
        throw new Error('Backend service is not responding. Please try again later.');
      }

      // Add retry logic
      const maxRetries = 3;
      let lastError;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Attempt ${attempt} of ${maxRetries} to scan emails`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

          console.log('Making request to:', `${apiUrlWithProtocol}/api/scan-emails`);
          console.log('With headers:', {
            ...fetchOptions.headers,
            'Authorization': 'Bearer [REDACTED]',
            'X-Gmail-Token': '[REDACTED]'
          });

          const response = await fetch(`${apiUrlWithProtocol}/api/scan-emails`, {
            method: 'GET',
            signal: controller.signal,
            ...fetchOptions
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`API error (attempt ${attempt}):`, {
              status: response.status,
              statusText: response.statusText,
              error: errorText
            });
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          console.log('Scan emails response:', data);
          
          if (!data.success) {
            throw new Error(data.error || 'Failed to scan emails');
          }

          // Store subscriptions in local state if needed
          if (data.subscriptions) {
            const { data: existingData, error } = await supabase
              .from('subscriptions')
              .select('*')
              .eq('user_id', currentSession.user.id);

            if (error) {
              console.error('Error fetching subscriptions:', error);
            } else {
              console.log('Current subscriptions:', existingData);
            }
          }

          return data;
        } catch (error: any) {
          lastError = error;
          console.error(`Error on attempt ${attempt}:`, error);
          
          if (attempt === maxRetries) {
            throw error;
          }
          
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }

      throw lastError;
    } catch (error: any) {
      console.error('Error scanning emails:', error);
      throw new Error(error.message || 'Failed to scan emails');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    scanEmails,
    login
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 