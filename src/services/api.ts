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
const API_URL = process.env.VITE_API_URL || 'https://api.quits.cc';
console.log('API Service initialized with API_URL:', API_URL);

// Explicitly disable mock data
const USE_MOCK_DATA = true;

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
  async scanEmails(): Promise<ApiResponse<ScanEmailsApiResponse>> {
    if (USE_MOCK_DATA) {
      return createSuccessResponse({
        subscriptions: MOCK_SUBSCRIPTIONS,
        count: MOCK_SUBSCRIPTIONS.length,
        priceChanges: MOCK_PRICE_CHANGES
      });
    }

    const gmailToken = sessionStorage.getItem('gmail_access_token');
    if (!gmailToken) {
      return createErrorResponse('Gmail token not found');
    }

    return makeRequest<ScanEmailsApiResponse>('/api/scan-emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gmailToken}`
      }
    });
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
}

// Export a singleton instance
export const apiService = ApiService.getInstance();
