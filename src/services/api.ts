import { supabase } from '../supabase';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

// Types for subscription data
export interface SubscriptionData {
  provider: string;
  price: number | null;
  frequency: 'monthly' | 'yearly';
  renewal_date: string | null;
  term_months: number | null;
  is_price_increase: boolean;
  lastDetectedDate: string;
}

// Types for API response
interface ScanEmailsResponse {
  success: boolean;
  message: string;
  count: number;
  subscriptions: SubscriptionData[];
  priceChanges: PriceChange[] | null;
}

export interface PriceChange {
  oldPrice: number;
  newPrice: number;
  change: number;
  percentageChange: number;
  term_months: number | null;
  renewal_date: string | null;
  provider: string;
}

// Update the API URL configuration
const API_URL = import.meta.env.VITE_ENV === 'development' ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:5000');

// Add mock data handling at the top of the file
const MOCK_DATA: { [key: string]: any } = {
  '/api/scan-emails': {
    success: true,
    message: "Email scan completed successfully",
    data: {
      subscriptionsFound: 5,
      details: [
        {
          provider: "Netflix",
    price: 15.99,
          frequency: "monthly",
          lastPayment: "2023-05-15",
          nextPayment: "2023-06-15"
        },
        {
          provider: "Spotify",
    price: 9.99,
          frequency: "monthly",
          lastPayment: "2023-05-10",
          nextPayment: "2023-06-10"
        },
        {
          provider: "Amazon Prime",
          price: 12.99,
          frequency: "monthly",
          lastPayment: "2023-05-05",
          nextPayment: "2023-06-05"
        },
        {
          provider: "Disney+",
    price: 7.99,
          frequency: "monthly",
          lastPayment: "2023-05-20",
          nextPayment: "2023-06-20"
        },
        {
          provider: "Adobe Creative Cloud",
          price: 52.99,
          frequency: "monthly",
          lastPayment: "2023-05-02",
          nextPayment: "2023-06-02"
        }
      ]
    }
  },
  '/api/subscription-analytics': {
    success: true,
    data: {
      totalSubscriptions: 5,
      totalMonthlyCost: 99.95,
      averagePriceChange: 4.2,
      upcomingRenewals: 3,
      priceChanges: [
        {
          provider: "Netflix",
    oldPrice: 13.99,
    newPrice: 15.99,
          change: 2.0,
    percentageChange: 14.3,
          firstDetected: "2023-03-15",
          lastUpdated: "2023-04-15"
        },
        {
          provider: "Spotify",
          oldPrice: 9.99,
          newPrice: 10.99,
          change: 1.0,
          percentageChange: 10.0,
          firstDetected: "2023-02-10",
          lastUpdated: "2023-03-10"
        }
      ],
      upcomingRenewalsList: [
        {
          provider: "Netflix",
          renewal_date: "2023-06-15",
          daysUntilRenewal: 7,
          price: 15.99,
          frequency: "monthly"
        },
        {
          provider: "Spotify",
          renewal_date: "2023-06-10",
          daysUntilRenewal: 2,
          price: 10.99,
          frequency: "monthly"
        },
        {
          provider: "Amazon Prime",
          renewal_date: "2023-06-05",
          daysUntilRenewal: 15,
          price: 12.99,
          frequency: "monthly"
        }
      ]
    }
  },
  '/api/notification-settings': {
    success: true,
    data: {
      email_notifications: true,
      price_change_threshold: 5,
      renewal_reminder_days: 7
    }
  },
  '/api/notifications': {
    success: true,
    data: [
      {
        id: "1",
        type: "price_change",
        title: "Price Change Alert",
        message: "Netflix subscription price has increased from $13.99 to $15.99 (14.3%)",
        created_at: "2023-05-15T14:30:00Z",
    read: false
  },
  {
        id: "2",
        type: "renewal",
        title: "Upcoming Renewal",
        message: "Your Spotify subscription will renew in 2 days at $10.99",
        created_at: "2023-05-08T09:15:00Z",
        read: true
      },
      {
        id: "3",
        type: "system",
        title: "Welcome to Quits",
        message: "Thank you for signing up! Start scanning your emails to find subscriptions.",
        created_at: "2023-05-01T10:00:00Z",
        read: true
      }
    ]
  }
};

class ApiService {
  private static instance: ApiService;
  private retryCount: number = 0;
  private readonly MAX_RETRIES = 2;
  private originVariations: string[] = [];
  
  private constructor() {}

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
      console.log('Created new ApiService instance');
    }
    return ApiService.instance;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const isLocalDev = localStorage.getItem('isLocalDev') === 'true';
    
    // In development mode, use mock headers
    if (isLocalDev) {
      return {
        'Authorization': 'Bearer dev-token',
        'X-User-ID': 'dev-user-id',
        'X-Gmail-Token': 'dev-gmail-token',
        'Content-Type': 'application/json'
      };
    }
    
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    const userId = session?.data?.session?.user?.id;
      const gmailToken = sessionStorage.getItem('gmail_access_token');

      return {
      'Authorization': token ? `Bearer ${token}` : '',
      'X-User-ID': userId || '',
      'X-Gmail-Token': gmailToken || '',
    };
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const isLocalDev = localStorage.getItem('isLocalDev') === 'true';
    
    // Check if in development mode and we have mock data for this endpoint
    if (isLocalDev) {
      const path = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
      const mockEndpoint = Object.keys(MOCK_DATA).find(key => path.startsWith(key));
      
      if (mockEndpoint) {
        console.log(`[DEV] Using mock data for ${path}`);
        // Return mock data with a slight delay to simulate network
        await new Promise(resolve => setTimeout(resolve, 300));
        return { success: true, data: MOCK_DATA[mockEndpoint] as unknown as T };
      }
    }
    
    try {
      const headers = await this.getAuthHeaders();
      
      // Ensure endpoint starts with /api
      const path = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
      const url = import.meta.env.VITE_ENV === 'development' ? path : `${API_URL}${path}`;
      
      console.log('Making API request:', {
        url,
        method: options.method || 'GET',
        hasAuthToken: !!headers['Authorization'],
        hasGmailToken: !!headers['X-Gmail-Token'],
        hasUserId: !!headers['X-User-ID'],
        environment: import.meta.env.VITE_ENV
      });

      if (!headers['Authorization']) {
        throw new Error('No authentication token available. Please sign in again.');
      }

      if (!headers['X-Gmail-Token']) {
        throw new Error('No Gmail token available. Please sign in with Google again.');
      }

      if (!headers['X-User-ID']) {
        throw new Error('No user ID available. Please sign in again.');
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
          ...options.headers
        },
        credentials: 'include'
      });

      // Log detailed response information
      console.log('API Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url,
        type: response.type,
        ok: response.ok,
        redirected: response.redirected,
        redirectType: response.type,
        finalUrl: response.url
      });

      // Try to get the response text first
      const responseText = await response.text();
      console.log('Raw response text:', responseText);

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { error: responseText };
        }
        
        if (response.status === 401) {
          if (errorData?.error === 'Gmail token expired or invalid') {
            sessionStorage.removeItem('gmail_access_token');
            window.location.href = '/auth/google';
            return { success: false, error: 'Gmail token expired. Redirecting to Google auth...' };
          } else {
            await supabase.auth.signOut();
            window.location.href = '/login';
            return { success: false, error: 'Session expired. Please sign in again.' };
          }
        }

        throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
      }

      // Try to parse the response as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        throw new Error('Invalid JSON response from API');
      }
      
      return { success: true, data };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Request timed out. Please try again.' };
      }

      console.error('API request error:', {
        message: error.message,
        type: error.name,
        stack: error.stack,
        url: endpoint,
        environment: import.meta.env.VITE_ENV
      });

      return { 
        success: false, 
        error: error.message || 'Failed to make API request',
        details: import.meta.env.VITE_ENV === 'development' ? error.stack : undefined
      };
    }
  }

  public async scanEmails(): Promise<ApiResponse<any>> {
    console.log('Starting scanEmails request...');
    return this.makeRequest('/api/scan-emails', {
      method: 'POST',
      body: JSON.stringify({})
    });
  }

  public async getNotifications(): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/notifications');
  }

  public async markNotificationAsRead(notificationId: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/api/notifications/${notificationId}/read`, {
      method: 'POST'
    });
  }

  public async getNotificationSettings(): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/notification-settings');
  }

  public async updateNotificationSettings(settings: any): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/notification-settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  public async getSubscriptionAnalytics(): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/subscription-analytics');
  }

  public async testCors(): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/test-cors');
  }
}

// Transform raw subscription data to frontend format
const transformSubscriptionData = (data: SubscriptionData): SubscriptionData => {
  // Process the provider name to make it more readable
  let providerName = data.provider || '';
  
  // Clean up the provider name
  if (providerName) {
    // Extract company name from email domain if it looks like an email address
    if (providerName.includes('@')) {
      // Extract the domain part
      const domainPart = providerName.split('@')[1];
      if (domainPart) {
        // Remove domain suffix and convert to proper name format
        providerName = domainPart
          .split('.')[0] // Take the first part before any dots
          .replace(/-/g, ' ') // Replace hyphens with spaces
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize words
          .join(' ');
      }
    }
    
    // Clean up common prefixes and codes
    providerName = providerName
      .replace(/^no-?reply/i, '')
      .replace(/^notifications?/i, '')
      .replace(/^info/i, '')
      .replace(/^support/i, '')
      .replace(/^team/i, '')
      .replace(/^customer/i, '')
      .replace(/^service/i, '')
      .trim();
    
    // If empty after cleanup, set to "Unknown Service"
    if (!providerName) {
      providerName = "Unknown Service";
    }
  } else {
    providerName = "Unknown Service";
  }
  
  return {
    ...data,
    // Update the provider name
    provider: providerName,
    // Ensure price is a number or null
    price: data.price ? Number(data.price) : null,
    // Ensure renewal_date is in ISO format or null
    renewal_date: data.renewal_date ? new Date(data.renewal_date).toISOString() : null,
    // Default to monthly if frequency is not specified
    frequency: data.frequency || 'monthly',
    // Ensure term_months is a number or null
    term_months: data.term_months ? Number(data.term_months) : null
  };
};

// Transform raw price change data to frontend format
const transformPriceChange = (change: PriceChange): PriceChange => {
  return {
    ...change,
    oldPrice: Number(change.oldPrice),
    newPrice: Number(change.newPrice),
    change: Number(change.change),
    percentageChange: Number(change.percentageChange),
    term_months: change.term_months ? Number(change.term_months) : null,
    renewal_date: change.renewal_date ? new Date(change.renewal_date).toISOString() : null
  };
};

// Export convenience functions for common API calls
export const scanEmails = async () => {
  const response = await apiService.scanEmails();
  if (!response.success) {
    throw new Error(response.error || 'Failed to scan emails');
  }
  return response.data;
};

export const apiService = ApiService.getInstance(); 