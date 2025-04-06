import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { Box, CircularProgress, Typography, Alert, Button } from '@mui/material';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [tokenReceived, setTokenReceived] = useState<boolean>(false);
  const [processingAuth, setProcessingAuth] = useState<boolean>(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('Auth callback initiated');
        setProcessingAuth(true);
        
        // Get current URL hash and query params
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);
        
        console.log('Auth callback URL:', window.location.href);
        console.log('Has hash parameters:', hashParams.toString() !== '');
        console.log('Has query parameters:', queryParams.toString() !== '');
        
        // Get the session from the URL
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Error getting session:', sessionError);
          throw sessionError;
        }

        if (!session) {
          console.log('No session found, checking for hash parameters');
          // Handle the OAuth callback
          const { data: { user }, error: signInError } = await supabase.auth.getUser();
          if (signInError) {
            throw signInError;
          }
          if (!user) {
            throw new Error('No user found after OAuth callback');
          }
        }

        // Get the latest session to ensure we have the provider token
        const { data: { session: latestSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          throw refreshError;
        }

        // Check for provider token in the latest session
        if (latestSession?.provider_token) {
          console.log('Provider token found in latest session');
          sessionStorage.setItem('gmail_access_token', latestSession.provider_token);
          setTokenReceived(true);
          navigate('/scanning');
        } else {
          console.warn('No provider token in latest session');
          throw new Error('Gmail access was not granted. Please allow access to Gmail to use this feature.');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred during authentication');
      } finally {
        setProcessingAuth(false);
      }
    };

    handleCallback();
  }, [navigate]);

  if (processingAuth) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        gap: 2
      }}>
        <CircularProgress />
        <Typography>Processing authentication...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        gap: 2,
        p: 2
      }}>
        <Alert severity="error" sx={{ maxWidth: 600, width: '100%' }}>
          {error}
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => navigate('/auth/consent')}
          sx={{ mt: 2 }}
        >
          Try Again
        </Button>
      </Box>
    );
  }

  return null;
}; 