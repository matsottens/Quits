import axios from 'axios';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
}

export interface GoogleAuthResponse {
  user: GoogleUserInfo;
  access_token: string;
  refresh_token: string;
  id_token: string;
}

export const initiateGoogleAuth = () => {
  console.log('Initiating Google Auth with redirect URI:', import.meta.env.VITE_GOOGLE_REDIRECT_URI);
  
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    redirect_uri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || '',
    response_type: 'code',
    scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  console.log('Redirecting to:', authUrl);
  
  window.location.href = authUrl;
};

export const handleGoogleAuthCallback = async (code: string): Promise<boolean> => {
  try {
    console.log('Handling Google Auth callback with code...');
    
    // Exchange code for tokens
    const tokenResponse = await fetch(`${API_URL}/auth/google/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Failed to exchange code for tokens:', errorData);
      return false;
    }
    
    const tokenData = await tokenResponse.json();
    console.log('Received token data:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
    });
    
    // Store Gmail token in session storage
    if (tokenData.access_token) {
      sessionStorage.setItem('gmail_access_token', tokenData.access_token);
      sessionStorage.setItem('gmail_token_expiry', (Date.now() + (tokenData.expires_in || 3600) * 1000).toString());
      console.log('Gmail token stored successfully. Expiry:', new Date(parseInt(sessionStorage.getItem('gmail_token_expiry') || '0')));
    } else {
      console.error('No access token received from Google');
      return false;
    }
    
    // Store refresh token if provided
    if (tokenData.refresh_token) {
      localStorage.setItem('gmail_refresh_token', tokenData.refresh_token);
      console.log('Gmail refresh token stored');
    }
    
    return true;
  } catch (error) {
    console.error('Error handling Google Auth callback:', error);
    return false;
  }
}

// Check if Gmail token is valid and refresh if necessary
export const ensureValidGmailToken = async (): Promise<boolean> => {
  const gmailToken = sessionStorage.getItem('gmail_access_token');
  const gmailTokenExpiry = sessionStorage.getItem('gmail_token_expiry');
  
  console.log('Checking Gmail token validity:', {
    hasToken: !!gmailToken,
    expiryTime: gmailTokenExpiry ? new Date(parseInt(gmailTokenExpiry)) : 'none',
    isExpired: gmailTokenExpiry ? Date.now() > parseInt(gmailTokenExpiry) : true
  });
  
  // If token is missing or expired, try to refresh
  if (!gmailToken || (gmailTokenExpiry && Date.now() > parseInt(gmailTokenExpiry))) {
    const refreshToken = localStorage.getItem('gmail_refresh_token');
    
    if (!refreshToken) {
      console.error('No refresh token available, need to re-authenticate');
      return false;
    }
    
    try {
      console.log('Refreshing Gmail token...');
      
      // Call token refresh endpoint
      const response = await fetch(`${API_URL}/auth/google/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      
      if (!response.ok) {
        console.error('Failed to refresh token, status:', response.status);
        // Clear invalid refresh token
        localStorage.removeItem('gmail_refresh_token');
        return false;
      }
      
      const tokenData = await response.json();
      
      if (!tokenData.access_token) {
        console.error('No access token in refresh response');
        return false;
      }
      
      // Store new token
      sessionStorage.setItem('gmail_access_token', tokenData.access_token);
      sessionStorage.setItem('gmail_token_expiry', (Date.now() + (tokenData.expires_in || 3600) * 1000).toString());
      
      console.log('Gmail token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Error refreshing Gmail token:', error);
      return false;
    }
  }
  
  return true; // Token is valid
}

export const handleGoogleCallback = async (code: string): Promise<GoogleAuthResponse> => {
  try {
    console.log('GoogleAuth - Starting token exchange');
    console.log('GoogleAuth - Using redirect URI:', import.meta.env.VITE_GOOGLE_REDIRECT_URI);
    console.log('GoogleAuth - Client ID available:', !!import.meta.env.VITE_GOOGLE_CLIENT_ID);
    console.log('GoogleAuth - Client Secret available:', !!import.meta.env.VITE_GOOGLE_CLIENT_SECRET);
    
    const tokenData = {
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: import.meta.env.VITE_GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    };

    console.log('GoogleAuth - Token request data:', {
      ...tokenData,
      client_secret: tokenData.client_secret ? '[REDACTED]' : undefined
    });

    // Exchange code for tokens
    const tokenResponse = await axios.post(GOOGLE_TOKEN_URL, tokenData);

    console.log('GoogleAuth - Token exchange successful');
    const { access_token, refresh_token, id_token } = tokenResponse.data;

    // Get user info
    console.log('GoogleAuth - Fetching user info');
    const userInfoResponse = await axios.get(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    console.log('GoogleAuth - User info received:', {
      email: userInfoResponse.data.email,
      name: userInfoResponse.data.name
    });

    // Store tokens securely (you might want to use a more secure method)
    localStorage.setItem('google_access_token', access_token);
    localStorage.setItem('google_refresh_token', refresh_token);

    return {
      user: userInfoResponse.data,
      access_token,
      refresh_token,
      id_token
    };
  } catch (error: any) {
    console.error('GoogleAuth - Error in callback handling:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      details: error.response?.data?.error_description
    });
    throw error;
  }
};

export const refreshGoogleToken = async (refreshToken: string): Promise<string> => {
  try {
    const response = await axios.post(GOOGLE_TOKEN_URL, {
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const { access_token } = response.data;
    localStorage.setItem('google_access_token', access_token);

    return access_token;
  } catch (error) {
    console.error('Error refreshing Google token:', error);
    throw error;
  }
};

export const getGoogleAccessToken = (): string | null => {
  return localStorage.getItem('google_access_token');
};

export const getGoogleRefreshToken = (): string | null => {
  return localStorage.getItem('google_refresh_token');
};

export const logoutGoogle = () => {
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_refresh_token');
}; 