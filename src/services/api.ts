import { supabase } from '../supabase';
import { Session } from '@supabase/supabase-js';
import { SubscriptionData, PriceChange } from '../types/subscription';

// Other interfaces
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

interface ScanEmailsResponse {
  success: boolean;
  message: string;
  count: number;
  subscriptions: SubscriptionData[];
  priceChanges: PriceChange[] | null;
}

interface ScanEmailsApiResponse {
  subscriptions: SubscriptionData[];
  count: number;
  priceChanges: PriceChange[] | null;
}

// Use API URL from environment variables or default to api.quits.cc
const API_URL = import.meta.env.VITE_API_URL || 'https://api.quits.cc';
console.log('API Service initialized with API_URL:', API_URL);

// Explicitly disable mock data
const USE_MOCK_DATA = false;

// Mock data for local development
const MOCK_SUBSCRIPTIONS: SubscriptionData[] = [
  {
    id: 'mock-1',
    provider: 'Netflix',
    price: 15.99,
    frequency: 'monthly',
    renewal_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    term_months: 1,
    is_price_increase: false,
    lastDetectedDate: new Date().toISOString(),
    title: 'Netflix Standard'
  },
  {
    id: 'mock-2',
    provider: 'Spotify',
    price: 9.99,
    frequency: 'monthly',
    renewal_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    term_months: 1,
    is_price_increase: false,
    lastDetectedDate: new Date().toISOString(),
    title: 'Spotify Premium'
  },
  {
    id: 'mock-3',
    provider: 'Adobe',
    price: 52.99,
    frequency: 'monthly',
    renewal_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    term_months: 12,
    is_price_increase: true,
    lastDetectedDate: new Date().toISOString(),
    title: 'Adobe Creative Cloud'
  },
  {
    id: 'mock-4',
    provider: 'Disney+',
    price: 7.99,
    frequency: 'monthly',
    renewal_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    term_months: 1,
    is_price_increase: false,
    lastDetectedDate: new Date().toISOString(),
    title: 'Disney+ Basic'
  }
];

const MOCK_PRICE_CHANGES: PriceChange[] = [
  {
    provider: 'Adobe',
    oldPrice: 49.99,
    newPrice: 52.99,
    change: 3.00,
    percentageChange: 6.0,
    term_months: 12,
    renewal_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    provider: 'Netflix',
    oldPrice: 13.99,
    newPrice: 15.99,
    change: 2.00,
    percentageChange: 14.3,
    term_months: 1,
    renewal_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const MOCK_NOTIFICATIONS = [
  {
    id: '1',
    title: 'Netflix price increase',
    message: 'Your Netflix subscription price will increase from $13.99 to $15.99 on your next billing cycle.',
    type: 'price_increase',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    read: false
  },
  {
    id: '2',
    title: 'Spotify renewal coming up',
    message: 'Your Spotify Premium subscription will renew in 7 days at $9.99.',
    type: 'renewal_reminder',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    read: false
  }
];

// Make sure the ApiService class is exported
export class ApiService {
  private static instance: ApiService;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;
  
  private constructor() {}

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
      console.log('Created new ApiService instance');
    }
    return ApiService.instance;
  }

  private async refreshAuthToken(): Promise<void> {
    if (this.isRefreshing) {
      return this.refreshPromise!;
    }

    this.isRefreshing = true;
    this.refreshPromise = new Promise(async (resolve, reject) => {
      try {
        const { data: { session }, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error('Token refresh failed:', error);
          throw error;
        }

        if (!session) {
          throw new Error('No session after refresh');
        }

        if (session.provider_token) {
          sessionStorage.setItem('gmail_access_token', session.provider_token);
        }

        resolve();
      } catch (error) {
        console.error('Failed to refresh token:', error);
        sessionStorage.removeItem('gmail_access_token');
        await supabase.auth.signOut();
        window.location.href = '/login';
        reject(error);
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    });

    return this.refreshPromise;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    // For local development with mock data, return empty headers
    if (USE_MOCK_DATA) {
      console.log('Using mock data, skipping auth headers');
      return {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      };
    }
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Error getting session:', sessionError);
        throw new Error('Failed to get authentication session');
      }

      if (!session) {
        console.error('No session found');
        await this.refreshAuthToken();
        const { data: { session: refreshedSession } } = await supabase.auth.getSession();
        if (!refreshedSession) {
        throw new Error('Not authenticated. Please sign in again.');
        }
        return this.constructHeaders(refreshedSession);
      }

      return this.constructHeaders(session);
    } catch (error) {
      console.error('Error getting auth headers:', error);
      sessionStorage.removeItem('gmail_access_token');
      if (error instanceof Error && 
          (error.message.includes('Not authenticated') || 
           error.message.includes('Invalid token'))) {
        await supabase.auth.signOut();
        window.location.href = '/login';
      }
      throw error;
    }
  }

  private constructHeaders(session: Session): Record<string, string> {
      const gmailToken = sessionStorage.getItem('gmail_access_token');
      if (!gmailToken) {
        throw new Error('No Gmail access token available. Please sign in with Google again.');
      }

      if (!session.user?.id) {
        throw new Error('No user ID available. Please sign in again.');
      }

    const accessToken = session.access_token.trim();
    if (!accessToken.includes('.')) {
      throw new Error('Invalid token format. Please sign in again.');
    }

      console.log('Created auth headers:', {
        hasAccessToken: true,
        hasGmailToken: true,
        hasUserId: true,
        userId: session.user.id,
        email: session.user.email
      });

      return {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
        'X-Gmail-Token': gmailToken,
      'X-User-ID': session.user.id,
      'Origin': window.location.origin
    };
  }

  public async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    // For local development with mock data
    if (USE_MOCK_DATA) {
      console.log('Using mock data for endpoint:', endpoint);
      if (endpoint === '/api/scan-emails') {
        return this.getMockScanResults() as ApiResponse<T>;
      }
      if (endpoint === '/api/notifications') {
        return { success: true, data: MOCK_NOTIFICATIONS } as ApiResponse<T>;
      }
      return { success: true, data: {} as T };
    }

    // In regular API request flow
    try {
      const headers = await this.getAuthHeaders();
      
      const url = `${API_URL}${endpoint}`;
      console.log('Making API request to:', url);
      
      // Set default options for all requests
      const fetchOptions: RequestInit = {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
        credentials: 'include',
        mode: 'cors'
      };

      // For OPTIONS requests, make sure proper CORS headers are included
      if (options.method === 'OPTIONS') {
        fetchOptions.headers = {
          ...fetchOptions.headers,
          'Access-Control-Request-Method': 'POST,GET,PUT,DELETE',
          'Access-Control-Request-Headers': 'Content-Type, Authorization, X-Gmail-Token, X-User-ID'
        };
      }
      
      // Log request details for debugging
      console.log('Request details:', {
        url,
        method: options.method || 'GET',
        headers: Object.keys(fetchOptions.headers),
        hasBody: !!options.body
      });

      const response = await fetch(url, fetchOptions);
      
      console.log('API response status:', response.status);
      
      if (response.status === 401) {
        console.log('Unauthorized response, attempting to refresh token...');
        await this.refreshAuthToken();
        // Retry with new token
        const newHeaders = await this.getAuthHeaders();
        const retryOptions = {
          ...options,
          headers: {
            ...newHeaders,
            ...options.headers,
          },
          credentials: 'include',
          mode: 'cors'
        };
        const retryResponse = await fetch(url, retryOptions);
        if (retryResponse.status === 401) {
          console.error('Still unauthorized after token refresh');
          throw new Error('Authentication failed after token refresh. Please sign in again.');
        }
        return this.processResponse<T>(retryResponse);
      }
      
      return this.processResponse<T>(response);
    } catch (error) {
      console.error('API request error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown API error',
        details: error instanceof Error ? error.stack : undefined
      };
    }
  }

  private async processResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      // Check if the response has JSON content
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();

      if (!response.ok) {
          return {
            success: false,
            error: data.message || `API error: ${response.status}`,
            details: data.details || JSON.stringify(data)
          };
        }
        
        return {
          success: true,
          data: data as T
        };
          } else {
        // Handle non-JSON responses
        const text = await response.text();
        
        if (!response.ok) {
          return {
            success: false,
            error: `API error: ${response.status}`,
            details: text
          };
        }
        
        // For successful non-JSON responses
        return {
          success: true,
          data: { message: text } as unknown as T
        };
      }
    } catch (error) {
      console.error('Error processing API response:', error);
      return {
        success: false,
        error: 'Failed to process API response',
        details: error instanceof Error ? error.message : undefined
      };
    }
  }

  public async scanEmails(): Promise<ApiResponse<ScanEmailsApiResponse>> {
    console.log('Scanning emails...');
    
    // For local development with mock data, return mock data
    if (USE_MOCK_DATA) {
      console.log('Using mock scan data');
      return this.getMockScanResults();
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No session found');
        throw new Error('Not authenticated. Please sign in again.');
      }
      
      // Log session information for debugging (omitting sensitive data)
      console.log('Auth session:', {
        hasUser: !!session.user,
        userId: session.user?.id,
        hasAccessToken: !!session.access_token,
        tokenLength: session.access_token?.length || 0,
        expiresAt: session.expires_at,
      });
      
      // Ensure we have a valid Gmail token
      const { ensureValidGmailToken } = await import('./googleAuth');
      const isGmailTokenValid = await ensureValidGmailToken();
      
      if (!isGmailTokenValid) {
        console.error('Failed to get valid Gmail token');
        return {
          success: false,
          error: 'Gmail authorization required',
          details: 'Please connect your Gmail account again to scan emails.'
        };
      }
      
      const gmailToken = sessionStorage.getItem('gmail_access_token');
      
      if (!gmailToken) {
        console.error('Gmail token not found even after validation check');
        throw new Error('Gmail token not found. Please connect your Gmail account.');
      }
      
      // Log Gmail token info (partial) for debugging
      console.log('Gmail token info:', {
        tokenLength: gmailToken.length,
        firstChars: gmailToken.substring(0, 10) + '...',
        lastChars: '...' + gmailToken.substring(gmailToken.length - 10),
      });
      
      console.log('Sending request to scan emails...');
      
      try {
        const requestUrl = `${API_URL}/api/scan-emails`;
        console.log('Request URL:', requestUrl);
        
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'X-Gmail-Token': gmailToken,
          'X-User-ID': session.user.id,
          'Origin': window.location.origin
        };
        
        console.log('Request headers (sanitized):', {
          ...headers,
          'Authorization': 'Bearer [REDACTED]',
          'X-Gmail-Token': '[REDACTED]'
        });
        
        const response = await fetch(requestUrl, {
          method: 'POST',
          headers,
          credentials: 'include',
          mode: 'cors',
          body: JSON.stringify({
            userId: session.user.id,
          })
        });
        
        console.log('Scan response status:', response.status);
        console.log('Response headers:', {
          'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
          'content-type': response.headers.get('content-type'),
          'cors-exposed-headers': response.headers.get('access-control-expose-headers')
        });
        
        if (response.status === 401) {
          // Token is likely invalid - clear it so we can request a new one
          console.error('Gmail token rejected (401)');
          sessionStorage.removeItem('gmail_access_token');
          sessionStorage.removeItem('gmail_token_expiry');
          
          return {
            success: false,
            error: 'Gmail authorization expired',
            details: 'Your Gmail authorization has expired. Please connect Gmail again.'
          };
        }
        
        if (!response.ok) {
          let errorText;
          try {
            const errorData = await response.json();
            errorText = errorData.message || errorData.error || `Server returned ${response.status}`;
            console.error('Error response body:', errorData);
          } catch (e) {
            try {
              errorText = await response.text();
              console.error('Error response text:', errorText);
            } catch (textError) {
              errorText = `Server returned ${response.status}`;
              console.error('Failed to read error response');
            }
          }
          
          console.error('Email scan failed:', errorText);
          return { 
            success: false, 
            error: `Failed to scan emails: ${errorText}`,
            details: `Status: ${response.status} ${response.statusText}`
          };
        }
        
        const data = await response.json();
        console.log('Email scan complete:', data);
        
        return {
          success: true,
          data: {
            subscriptions: data.subscriptions || [],
            count: data.count || 0,
            priceChanges: data.priceChanges || null
          }
        };
        
      } catch (fetchError) {
        console.error('Error scanning emails (fetch error):', fetchError);
        return {
          success: false,
          error: 'Failed to scan emails: Network error',
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        };
      }
    } catch (error) {
      console.error('Error scanning emails (general error):', error);
      return {
        success: false,
        error: 'Failed to scan emails: Authentication error',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Helper to generate consistent mock data for development
  private getMockScanResults(): ApiResponse<ScanEmailsApiResponse> {
    const mockSubscriptions: SubscriptionData[] = [
      {
        id: 'mock-1',
        provider: 'Netflix',
        title: 'Premium Plan',
        price: 15.99,
        frequency: 'monthly',
        renewal_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        category: 'Entertainment',
        last_payment_date: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000).toISOString(),
        term_months: 1,
        is_price_increase: false,
        lastDetectedDate: new Date().toISOString()
      },
      {
        id: 'mock-2',
        provider: 'Spotify',
        title: 'Family Plan',
        price: 14.99,
        frequency: 'monthly',
        renewal_date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(), // 12 days from now
        category: 'Entertainment',
        last_payment_date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
        term_months: 1,
        is_price_increase: false,
        lastDetectedDate: new Date().toISOString()
      },
      {
        id: 'mock-3',
        provider: 'Adobe',
        title: 'Creative Cloud',
        price: 52.99,
        frequency: 'monthly',
        renewal_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
        category: 'Productivity',
        last_payment_date: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString(),
        term_months: 1,
        is_price_increase: false,
        lastDetectedDate: new Date().toISOString()
      },
      {
        id: 'mock-4',
        provider: 'Notion',
        title: 'Pro Plan',
        price: 48,
        frequency: 'yearly',
        renewal_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days from now
        category: 'Productivity',
        last_payment_date: new Date(Date.now() - 320 * 24 * 60 * 60 * 1000).toISOString(),
        term_months: 12,
        is_price_increase: false,
        lastDetectedDate: new Date().toISOString()
      },
      {
        id: 'mock-5',
        provider: 'Google',
        title: 'Google One Storage',
        price: 29.99,
        frequency: 'yearly',
        renewal_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
        category: 'Cloud Storage',
        last_payment_date: new Date(Date.now() - 363 * 24 * 60 * 60 * 1000).toISOString(),
        term_months: 12,
        is_price_increase: false,
        lastDetectedDate: new Date().toISOString()
      },
      {
        id: 'mock-6',
        provider: 'Amazon',
        title: 'Prime Membership',
        price: 139,
        frequency: 'yearly',
        renewal_date: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(), // 120 days from now
        category: 'Shopping',
        last_payment_date: new Date(Date.now() - 245 * 24 * 60 * 60 * 1000).toISOString(),
        term_months: 12,
        is_price_increase: false,
        lastDetectedDate: new Date().toISOString()
      }
    ];
    
    // Save mock results
    localStorage.setItem('last_scan_count', mockSubscriptions.length.toString());
    localStorage.setItem('last_subscriptions', JSON.stringify(mockSubscriptions));

      return {
        success: true,
      data: {
        subscriptions: mockSubscriptions,
        count: mockSubscriptions.length,
        priceChanges: null
      }
    };
  }

  public async getNotifications(): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/notifications');
  }

  public async markNotificationAsRead(id: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/api/notifications/${id}/read`, {
      method: 'POST'
    });
  }

  public async getNotificationSettings(): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/notification-settings');
  }

  public async updateNotificationSettings(settings: any): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/notification-settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  }

  public async getSubscriptionAnalytics(): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/subscription-analytics');
  }

  public async testCors(): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/test-cors');
  }

  public async testApiConnection(): Promise<ApiResponse<any>> {
    try {
      console.log('Testing API connectivity...');
      const publicResponse = await fetch(`${API_URL}/api/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Origin': window.location.origin
        },
        mode: 'cors',
      });
      
      let authenticatedResponse;
      try {
        const headers = await this.getAuthHeaders();
        authenticatedResponse = await fetch(`${API_URL}/api/auth/profile`, {
          method: 'GET',
          headers: headers,
          credentials: 'include',
          mode: 'cors',
        });
      } catch (authError) {
        console.log('Auth test failed:', authError);
        authenticatedResponse = { status: 'auth_failed', statusText: String(authError) };
      }
      
      return {
        success: true,
        data: {
          publicEndpoint: {
            url: `${API_URL}/api/health`,
            status: publicResponse.status,
            statusText: publicResponse.statusText,
            ok: publicResponse.ok,
            headers: Object.fromEntries(publicResponse.headers.entries()),
            body: await publicResponse.json().catch(() => 'Could not parse JSON')
          },
          authenticatedEndpoint: {
            url: `${API_URL}/api/auth/profile`,
            status: authenticatedResponse.status || 'undefined',
            statusText: authenticatedResponse.statusText || 'undefined',
            ok: authenticatedResponse.ok || false,
            headers: authenticatedResponse.headers ? 
              Object.fromEntries(authenticatedResponse.headers.entries()) : 
              'No headers'
          },
          scanEmailsEndpoint: await this.testScanEmailsCors(),
          apiUrl: API_URL
        }
      };
    } catch (error) {
      console.error('API connection test failed:', error);
      return {
        success: false,
        error: 'API connection test failed',
        details: String(error)
      };
    }
  }
  
  // Test CORS for scan-emails endpoint specifically
  private async testScanEmailsCors(): Promise<any> {
    try {
      // First test OPTIONS preflight
      const optionsResponse = await fetch(`${API_URL}/api/scan-emails`, {
        method: 'OPTIONS',
        headers: {
          'Origin': window.location.origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization, X-Gmail-Token'
        },
        mode: 'cors'
      });
      
      // Then test POST request with minimal body
      const headers = await this.getAuthHeaders();
      const postResponse = await fetch(`${API_URL}/api/scan-emails`, {
        method: 'POST',
        headers: headers,
        mode: 'cors',
        credentials: 'include',
        body: JSON.stringify({ test: true })
      }).catch(error => {
        return {
          ok: false,
          status: 'error',
          statusText: String(error),
          error: error
        };
      });
      
      return {
        optionsPreflight: {
          status: optionsResponse.status,
          statusText: optionsResponse.statusText,
          ok: optionsResponse.ok,
          headers: Object.fromEntries(optionsResponse.headers.entries())
        },
        postRequest: {
          status: postResponse.status || 'error',
          statusText: postResponse.statusText || 'unknown',
          ok: postResponse.ok || false,
          headers: postResponse.headers ? 
            Object.fromEntries(postResponse.headers.entries()) : 
            'No headers',
          body: postResponse.json ? 
            await postResponse.json().catch(() => 'Could not parse JSON') : 
            'No body'
        }
      };
    } catch (error) {
      console.error('Scan emails CORS test failed:', error);
      return {
        error: 'Scan emails CORS test failed',
        details: String(error)
      };
    }
  }

  // Utility method to test Gmail token validity
  public async testGmailToken(): Promise<ApiResponse<any>> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return {
          success: false,
          error: 'Not authenticated',
          details: 'No valid session found'
        };
      }
      
      const gmailToken = sessionStorage.getItem('gmail_access_token');
      
      if (!gmailToken) {
        return {
          success: false,
          error: 'No Gmail token',
          details: 'Gmail token not found in session storage'
        };
      }
      
      // Try a simple Gmail API request to verify token validity
      try {
        const response = await fetch(`${API_URL}/api/test-gmail-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'X-Gmail-Token': gmailToken,
            'X-User-ID': session.user.id
          },
          body: JSON.stringify({ test: true })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          return {
            success: false,
            error: 'Gmail token validation failed',
            details: errorData.error || `Status: ${response.status}`
          };
        }
        
        const data = await response.json();
        return {
          success: true,
          data: {
            tokenValid: true,
            tokenDetails: data
          }
        };
      } catch (fetchError) {
        return {
          success: false,
          error: 'Gmail token validation request failed',
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        };
      }
    } catch (error) {
      return {
        success: false,
        error: 'Error validating Gmail token',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Transform raw subscription data to frontend format
const transformSubscriptionData = (data: Partial<SubscriptionData>): SubscriptionData => {
  const frequency = data.frequency === 'yearly' ? 'yearly' : 'monthly';
  return {
    id: data.id || `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    provider: data.provider || 'Unknown',
    price: data.price || null,
    frequency,
    renewal_date: data.renewal_date || null,
    term_months: data.term_months || null,
    is_price_increase: data.is_price_increase || false,
    lastDetectedDate: data.lastDetectedDate || new Date().toISOString(),
    title: data.title
  };
};

// Helper function to process provider-specific information
const processProviderSpecificInfo = (data: SubscriptionData): SubscriptionData => {
  // Hardcoded mapping for common subscription services
  const directServiceMap: Record<string, string> = {
    // Popular streaming services
    'netflix': 'Netflix',
    'spotify': 'Spotify',
    'apple': 'Apple',
    'youtube': 'YouTube Premium',
    'disney': 'Disney+',
    'hbo': 'HBO Max',
    'prime': 'Amazon Prime',
    'amazon': 'Amazon',
    'pandora': 'Pandora',
    'hulu': 'Hulu',
    'crunchyroll': 'Crunchyroll',
    'peacock': 'Peacock',
    'paramount': 'Paramount+',
    'showtime': 'Showtime',
    'starz': 'Starz',
    
    // Sports subscriptions
    'nba': 'NBA League Pass',
    'nfl': 'NFL Game Pass',
    'mlb': 'MLB.tv',
    'ufc': 'UFC Fight Pass',
    'espn': 'ESPN+',
    
    // Language learning services
    'babbel': 'Babbel',
    'duolingo': 'Duolingo',
    'rosetta': 'Rosetta Stone',
    
    // Software services
    'adobe': 'Adobe',
    'office': 'Microsoft Office',
    'microsoft': 'Microsoft',
    'autodesk': 'Autodesk',
    'dropbox': 'Dropbox',
    'github': 'GitHub',
    'slack': 'Slack',
    'zoom': 'Zoom',
    
    // Other popular subscriptions
    'nytimes': 'New York Times',
    'wsj': 'Wall Street Journal',
    'medium': 'Medium',
    'patreon': 'Patreon',
    'onlyfans': 'OnlyFans',
    'substack': 'Substack',
    
    // Utilities
    'domain': 'Domain Registration',
    'hosting': 'Web Hosting',
    'vpn': 'VPN Service',
    'cloud': 'Cloud Storage',
  };
  
  // Extract provider name from input if we haven't already determined it from the title
  let providerName = data.provider || '';
  const rawProvider = providerName.toLowerCase();
  
  // Step 1: Direct match against common services
  for (const [key, value] of Object.entries(directServiceMap)) {
    if (rawProvider.includes(key)) {
      providerName = value;
      console.log(`Direct match found: ${key} → ${value}`);
      break;
    }
  }
  
  // Step 2: Handle email-like formats
  if (providerName === data.provider && providerName.includes('@')) {
    // Extract domain part
    const emailParts = providerName.split('@');
    if (emailParts[1]) {
      const domainPart = emailParts[1].split('.')[0];
      
      // Check if domain matches any known service
      for (const [key, value] of Object.entries(directServiceMap)) {
        if (domainPart.toLowerCase() === key) {
          providerName = value;
          console.log(`Domain match found: ${domainPart} → ${value}`);
          break;
        }
      }
      
      // If still no match, format the domain as the service name
      if (providerName === data.provider) {
        providerName = domainPart.charAt(0).toUpperCase() + domainPart.slice(1);
        console.log(`Using formatted domain: ${providerName}`);
      }
    }
  }
  
  // Step 3: Handle generic "from" or noreply patterns
  if (providerName === data.provider) {
    const lowerProvider = providerName.toLowerCase();
    if (lowerProvider.startsWith('noreply@') || 
        lowerProvider.startsWith('no-reply@') || 
        lowerProvider.startsWith('notify@') || 
        lowerProvider.startsWith('notifications@') || 
        lowerProvider.startsWith('info@') || 
        lowerProvider.startsWith('support@') || 
        lowerProvider.startsWith('billing@')) {
      
      const domain = lowerProvider.split('@')[1]?.split('.')[0];
      if (domain) {
        // Capitalize first letter of each word
        providerName = domain
          .split(/[-_.]/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        console.log(`From email pattern: ${providerName}`);
      }
    }
  }
  
  // Step 4: Extract company name from broader context if available
  if (!providerName || providerName === data.provider) {
    // One last attempt - try to extract a valid company name from the provider field
    const extractedName = extractCompanyName(data.provider);
    if (extractedName) {
      providerName = extractedName;
      console.log(`Extracted company name: ${providerName}`);
    } else {
      providerName = "Unknown Service";
      console.log(`Fallback to Unknown Service`);
    }
  }

  // Handle price: use provided price or try to extract from raw data
  let price = 0;
  if (data.price !== null && data.price !== undefined) {
    price = Number(data.price);
  } else if (typeof data.provider === 'string') {
    // Try to extract a price from the provider field if it contains monetary values
    const extractedPrice = extractPriceFromString(data.provider);
    if (extractedPrice !== null) {
      price = extractedPrice;
      console.log(`Extracted price: ${price}`);
    }
  }
  
  return {
    ...data,
    provider: providerName,
    price: price,
    frequency: data.frequency || 'monthly',
    renewal_date: data.renewal_date ? new Date(data.renewal_date).toISOString() : null,
    term_months: data.term_months ? Number(data.term_months) : null,
  };
};

// Helper function to process Apple subscription emails
function processAppleSubscription(data: SubscriptionData): SubscriptionData {
  console.log('Processing Apple subscription');
  let provider = 'Apple Subscription';
  let price = 0;
  let frequency: 'monthly' | 'yearly' = data.frequency === 'yearly' ? 'yearly' : 'monthly';
  let renewalDate = null;
  
  // Look for specific app name pattern
  if (typeof data.provider === 'string') {
    // Extract app name
    const appMatch = data.provider.match(/App\s+(.+?)(?=\s+Subscription|$)/i);
    if (appMatch && appMatch[1]) {
      provider = appMatch[1].trim();
      console.log(`Found app name: ${provider}`);
    }
    
    // Look for Babbel specifically
    if (data.provider.toLowerCase().includes('babbel')) {
      provider = 'Babbel';
      console.log('Detected Babbel subscription');
    }
    
    // Extract renewal price with Euro symbol
    const euroMatch = data.provider.match(/€\s*(\d+[\.,]\d+)(?:\/(\d+)\s*(months|month))?/i);
    if (euroMatch) {
      const fullAmount = parseFloat(euroMatch[1].replace(',', '.'));
      console.log(`Found Euro amount: ${fullAmount}`);
      
      // Check if there's a period mentioned
      if (euroMatch[2] && euroMatch[3]) {
        const period = parseInt(euroMatch[2]);
        // Calculate monthly price
        if (period > 1) {
          price = fullAmount / period;
          console.log(`Extracted price: ${price}`);
        }
      }
    }
  }
  
  return {
    ...data,
    provider: provider,
    price: price,
    frequency: frequency,
    renewal_date: renewalDate,
    term_months: data.term_months ? Number(data.term_months) : null,
  };
}

// Helper function to extract a potential company name from a raw provider string
const extractCompanyName = (str: string): string | null => {
  if (!str) return null;
  
  // Potential company name patterns
  const patterns = [
    // Try to match "Company Name" <email> pattern
    /"([^"]+)"/,
    // Try to match 'Company Name' <email> pattern  
    /'([^']+)'/,
    // Try to match Company Name <email> pattern
    /^([^<]+)</,
    // Try to match words between brackets
    /\[([^\]]+)\]/,
    // Try to match words between parentheses
    /\(([^)]+)\)/,
  ];
  
  for (const pattern of patterns) {
    const matches = str.match(pattern);
    if (matches && matches[1] && matches[1].length > 2) {
      return matches[1].trim();
    }
  }
  
  return null;
};

// Helper function to extract a price from a string (looking for $ or € symbols)
const extractPriceFromString = (str: string): number | null => {
  if (!str) return null;
  
  // Match patterns like $9.99, €10, $13.50
  const matches = str.match(/[\$€£](\d+[.,]?\d*)/);
  if (matches && matches[1]) {
    return parseFloat(matches[1].replace(',', '.'));
  }
  
  // Also try to match numbers followed by currency symbols
  const altMatches = str.match(/(\d+[.,]?\d*)[\$€£]/);
  if (altMatches && altMatches[1]) {
    return parseFloat(altMatches[1].replace(',', '.'));
  }
  
  // Match euro formats with comma decimal separator
  const euroMatches = str.match(/(\d+),(\d+)\s*€/);
  if (euroMatches) {
    return parseFloat(`${euroMatches[1]}.${euroMatches[2]}`);
  }
  
  // Match "X months" patterns
  const periodMatch = str.match(/€\s*(\d+[.,]\d+)\/(\d+)\s*months/i);
  if (periodMatch && periodMatch[1] && periodMatch[2]) {
    const totalAmount = parseFloat(periodMatch[1].replace(',', '.'));
    const months = parseInt(periodMatch[2]);
    if (!isNaN(totalAmount) && !isNaN(months) && months > 0) {
      return totalAmount / months; // Return monthly equivalent
    }
  }
  
  return null;
};

// Export the service and helper functions
export const apiService = ApiService.getInstance(); 

// Scan emails for subscriptions
export const scanEmails = async (): Promise<ApiResponse<ScanEmailsApiResponse>> => {
  try {
    const response = await apiService.makeRequest<ScanEmailsApiResponse>('/scan-emails', {
      method: 'POST'
    });

    if (!response.success || !response.data) {
      throw new Error('No data received from scan-emails endpoint');
    }

    return response;
  } catch (error) {
    console.error('Error scanning emails:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scan emails'
    };
  }
};
