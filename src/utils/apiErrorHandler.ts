// Centralized API Error Handler
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { Router } from 'expo-router';

export interface ApiError {
  message: string;
  statusCode?: number;
  isNetworkError?: boolean;
  isTokenExpired?: boolean;
  shouldLogout?: boolean;
}

export class ApiErrorHandler {
  private static router: Router | null = null;

  // Initialize with router for navigation
  static initialize(router: Router) {
    this.router = router;
  }

  // Check if user has internet connection
  static async checkInternetConnection(): Promise<boolean> {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return networkState.isConnected === true && networkState.isInternetReachable !== false;
    } catch (error) {
      console.error('Error checking internet connection:', error);
      // If we can't check, assume we're connected to avoid false positives
      return true;
    }
  }

  // Handle token expiration - force logout and redirect to login
  static async handleTokenExpiration() {
    try {
      console.log('🔐 Token expired - starting logout process...');
      
      // Clear all auth data
      await AsyncStorage.multiRemove(['token', 'userData', 'userId']);
      console.log('✅ Cleared AsyncStorage');
      
      // Navigate immediately without alert to ensure smooth transition
      if (this.router) {
        console.log('🔄 Navigating to login page...');
        this.router.replace('/provider/onboarding/signin');
      } else {
        console.error('❌ Router not initialized!');
      }
      
      // Show alert after navigation is triggered
      setTimeout(() => {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please login again.',
          [{ text: 'OK' }],
          { cancelable: false }
        );
      }, 100);
      
    } catch (error) {
      console.error('Error handling token expiration:', error);
      // Still try to navigate even if clearing storage fails
      if (this.router) {
        this.router.replace('/provider/onboarding/signin');
      }
    }
  }

  // Handle network connectivity error
  static handleNoInternet() {
    Alert.alert(
      'No Internet Connection',
      'Please check your connection and try again.',
      [{ text: 'OK' }]
    );
  }

  // Handle general API failure
  static handleApiFailure(error?: string) {
    Alert.alert(
      'Service Unavailable',
      error || 'Unable to reach the server. Please try again later.',
      [{ text: 'OK' }]
    );
  }

  // Main error handler - processes errors and takes appropriate action
  static async handleError(error: any, context?: string): Promise<ApiError> {
    const apiError: ApiError = {
      message: 'An unexpected error occurred',
    };

    // Check if it's a Response object (fetch error)
    if (error instanceof Response) {
      apiError.statusCode = error.status;

      // Handle 401 Unauthorized - Token expired or invalid
      if (error.status === 401) {
        apiError.isTokenExpired = true;
        apiError.shouldLogout = true;
        apiError.message = 'Session expired';
        await this.handleTokenExpiration();
        return apiError;
      }

      // Handle 403 Forbidden
      if (error.status === 403) {
        apiError.message = 'Access denied';
        Alert.alert('Access Denied', 'You do not have permission to perform this action.');
        return apiError;
      }

      // Handle 404 Not Found
      if (error.status === 404) {
        apiError.message = 'Resource not found';
        return apiError;
      }

      // Handle 500+ Server errors
      if (error.status >= 500) {
        apiError.message = 'Server error occurred';
        this.handleApiFailure('Server is experiencing issues. Please try again later.');
        return apiError;
      }

      // Other HTTP errors
      try {
        const errorData = await error.json();
        apiError.message = errorData.message || `HTTP ${error.status} error`;
      } catch {
        apiError.message = `HTTP ${error.status} error`;
      }

      return apiError;
    }

    // Handle Error objects
    if (error instanceof Error) {
      // Check for network errors
      if (
        error.message.includes('Network request failed') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('Network Error')
      ) {
        apiError.isNetworkError = true;
        
        // Check if it's actually no internet or server down
        const hasInternet = await this.checkInternetConnection();
        
        if (!hasInternet) {
          apiError.message = 'No internet connection';
          this.handleNoInternet();
        } else {
          apiError.message = 'Cannot reach server';
          this.handleApiFailure('Cannot connect to the server. Please try again later.');
        }
        
        return apiError;
      }

      // Handle timeout errors
      if (error.message.includes('timeout') || error.name === 'AbortError') {
        apiError.message = 'Request timeout';
        this.handleApiFailure('Request timed out. Please try again.');
        return apiError;
      }

      apiError.message = error.message;
    }

    // Handle string errors
    if (typeof error === 'string') {
      apiError.message = error;
    }

    // Log error for debugging
    console.error(`API Error ${context ? `in ${context}` : ''}:`, error);

    return apiError;
  }

  // Enhanced fetch wrapper with automatic error handling
  static async fetchWithErrorHandling(
    url: string,
    options: RequestInit = {},
    context?: string
  ): Promise<Response> {
    // Check internet connection first
    const hasInternet = await this.checkInternetConnection();
    if (!hasInternet) {
      this.handleNoInternet();
      throw new Error('No internet connection');
    }

    try {
      // Add timeout to fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        await this.handleError(response, context);
        throw response;
      }

      return response;
    } catch (error) {
      // If error wasn't already handled (like timeouts, network errors)
      if (!(error instanceof Response)) {
        await this.handleError(error, context);
      }
      throw error;
    }
  }

  // Check if token is valid (not expired)
  static async isTokenValid(token: string, backendUrl: string): Promise<boolean> {
    try {
      // Check internet first
      const hasInternet = await this.checkInternetConnection();
      if (!hasInternet) {
        // Can't verify if offline, assume valid to avoid false positives
        return true;
      }

      const response = await fetch(`${backendUrl}/auth/validate-token`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        await this.handleTokenExpiration();
        return false;
      }

      return response.ok;
    } catch (error) {
      console.error('Token validation failed:', error);
      // If we can't reach server, assume token is valid to avoid false logouts
      return true;
    }
  }

  // Validate response and handle errors
  static async validateResponse<T>(
    response: Response,
    context?: string
  ): Promise<T> {
    if (!response.ok) {
      await this.handleError(response, context);
      throw new Error(`API request failed: ${response.status}`);
    }

    try {
      return await response.json();
    } catch (error) {
      console.error('Error parsing response JSON:', error);
      throw new Error('Invalid response format');
    }
  }
}

export default ApiErrorHandler;
