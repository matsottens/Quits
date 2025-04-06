import { supabase } from '../supabase';
import { Session } from '@supabase/supabase-js';
import { SubscriptionData, PriceChange } from '../types/subscription';
import { defineConfig } from 'vite';

// Other interfaces
interface ApiResponse<T = any> {
  ok: boolean;
  status: string;
  statusText: string;
  headers?: Headers;
  data?: T;
  error?: string;
  success: boolean;
}

interface ApiError extends ApiResponse<never> {
  ok: false;
  success: false;
  error: string;
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

// Use mock data only in development
const USE_MOCK_DATA = import.meta.env.DEV || import.meta.env.VITE_USE_MOCK_DATA === 'true';

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
  }
];

// Helper function to create a success response
function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    ok: true,
    success: true,
    status: '200',
    statusText: 'OK',
    data
  };
}

// Helper function to create an error response
function createErrorResponse(error: string): ApiError {
  return {
    ok: false,
    success: false,
    status: '400',
    statusText: 'Bad Request',
    error
  };
}

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    return createErrorResponse(errorData.error || response.statusText);
  }

  try {
    const data = await response.json();
    return createSuccessResponse(data);
  } catch (error) {
    return createErrorResponse('Failed to parse response');
  }
}

// Helper function to make API requests
async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return handleResponse<T>(response);
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : 'Network error');
  }
}

// API Service class
class ApiService {
  private static instance: ApiService;
  private constructor() {}

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  // Scan emails for subscriptions
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
        
        // Create new URL to get clean origin
        const currentOrigin = new URL(window.location.href).origin;
        console.log('Current origin:', currentOrigin);
        
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'X-Gmail-Token': gmailToken,
          'X-User-ID': session.user.id,
          'Origin': currentOrigin
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

  // Get all subscriptions
  async getSubscriptions(): Promise<ApiResponse<SubscriptionData[]>> {
    if (USE_MOCK_DATA) {
      return createSuccessResponse(MOCK_SUBSCRIPTIONS);
    }

    return makeRequest<SubscriptionData[]>('/api/subscriptions');
  }

  // Get a single subscription
  async getSubscription(id: string): Promise<ApiResponse<SubscriptionData>> {
    if (USE_MOCK_DATA) {
      const subscription = MOCK_SUBSCRIPTIONS.find(s => s.id === id);
      if (!subscription) {
        return createErrorResponse('Subscription not found');
      }
      return createSuccessResponse(subscription);
    }

    return makeRequest<SubscriptionData>(`/api/subscriptions/${id}`);
  }

  // Create a new subscription
  async createSubscription(subscription: Omit<SubscriptionData, 'id'>): Promise<ApiResponse<SubscriptionData>> {
    if (USE_MOCK_DATA) {
      const newSubscription = {
        ...subscription,
        id: `mock-${Date.now()}`,
      };
      return createSuccessResponse(newSubscription);
    }

    return makeRequest<SubscriptionData>('/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify(subscription)
    });
  }

  // Update a subscription
  async updateSubscription(id: string, updates: Partial<SubscriptionData>): Promise<ApiResponse<SubscriptionData>> {
    if (USE_MOCK_DATA) {
      const subscription = MOCK_SUBSCRIPTIONS.find(s => s.id === id);
      if (!subscription) {
        return createErrorResponse('Subscription not found');
      }
      const updatedSubscription = { ...subscription, ...updates };
      return createSuccessResponse(updatedSubscription);
    }

    return makeRequest<SubscriptionData>(`/api/subscriptions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  // Delete a subscription
  async deleteSubscription(id: string): Promise<ApiResponse<void>> {
    if (USE_MOCK_DATA) {
      const index = MOCK_SUBSCRIPTIONS.findIndex(s => s.id === id);
      if (index === -1) {
        return createErrorResponse('Subscription not found');
      }
      return createSuccessResponse(undefined);
    }

    return makeRequest<void>(`/api/subscriptions/${id}`, {
      method: 'DELETE'
    });
  }

  // Get notifications
  async getNotifications(): Promise<ApiResponse<any[]>> {
    if (USE_MOCK_DATA) {
      return createSuccessResponse([]);
    }

    return makeRequest<any[]>('/api/notifications');
  }

  // Mark notification as read
  async markNotificationAsRead(id: string): Promise<ApiResponse<void>> {
    if (USE_MOCK_DATA) {
      return createSuccessResponse(undefined);
    }

    return makeRequest<void>(`/api/notifications/${id}/read`, {
      method: 'POST'
    });
  }

  // Get notification settings
  async getNotificationSettings(): Promise<ApiResponse<any>> {
    if (USE_MOCK_DATA) {
      return createSuccessResponse({
        email: true,
        push: true
      });
    }

    return makeRequest<any>('/api/notification-settings');
  }

  // Update notification settings
  async updateNotificationSettings(settings: any): Promise<ApiResponse<any>> {
    if (USE_MOCK_DATA) {
      return createSuccessResponse(settings);
    }

    return makeRequest<any>('/api/notification-settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
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

// Export a singleton instance
export const apiService = ApiService.getInstance();
