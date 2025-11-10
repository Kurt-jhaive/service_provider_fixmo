import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../constants/config';
import { ApiErrorHandler } from './apiErrorHandler';
import { getFromCache, saveToCache } from './penaltyCache';

// Get backend URL from centralized config
const BACKEND_URL = API_CONFIG.BASE_URL;

/**
 * Get authentication token from AsyncStorage
 * Checks for both 'providerToken' (service provider app) and 'token' (customer app)
 */
const getAuthToken = async (): Promise<string | null> => {
  // Try provider token first
  let token = await AsyncStorage.getItem('providerToken');
  
  if (token) {
    console.log('🔑 Using providerToken');
  } else {
    // If no provider token, try customer token
    token = await AsyncStorage.getItem('token');
    if (token) {
      console.log('🔑 Using customer token');
    } else {
      console.log('❌ No token found in AsyncStorage');
    }
  }
  
  return token;
};

/**
 * Get current penalty info for the logged-in user
 */
export const getPenaltyInfo = async () => {
  try {
    const token = await getAuthToken();
    if (!token) {
      console.error('❌ getPenaltyInfo: No authentication token found');
      return {
        success: false,
        error: 'No authentication token found',
      };
    }

    console.log('📡 Fetching penalty info from:', `${BACKEND_URL}/api/penalty/my-info`);
    console.log('📡 Using token (first 30 chars):', token.substring(0, 30));
    
    const response = await fetch(`${BACKEND_URL}/api/penalty/my-info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

    console.log('📡 getPenaltyInfo Response Status:', response.status);

    // Check for 401 - token expired
    if (response.status === 401) {
      console.log('🔐 Token expired in getPenaltyInfo');
      await ApiErrorHandler.handleTokenExpiration();
      return {
        success: false,
        error: 'Session expired',
      };
    }

    const data = await response.json();
    console.log('📡 getPenaltyInfo Response Data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      // If backend returns success but no data, it means provider has no penalty record yet
      // Return default penalty info (perfect score)
      if (!data.data) {
        console.log('ℹ️ No penalty record found, returning default (100 points)');
        return {
          success: true,
          data: {
            current_score: 100,
            penalty_points: 100, // Backward compatibility
            tier: 1,
            is_suspended: false,
            last_updated: new Date().toISOString(),
            status: 'Good Standing',
          },
        };
      }
      
      // Normalize response to support both current_score and penalty_points
      const normalizedData = {
        ...data.data,
        current_score: data.data.current_score || data.data.penalty_points || 100,
        penalty_points: data.data.penalty_points || data.data.current_score || 100,
        tier: data.data.tier || 1,
        is_suspended: data.data.is_suspended || false,
        last_updated: data.data.last_updated || new Date().toISOString(),
      };
      
      console.log('✅ Normalized penalty data:', normalizedData);
      
      return {
        success: true,
        data: normalizedData,
      };
    } else {
      console.error('❌ getPenaltyInfo Error:', data.message || data.error);
      return {
        success: false,
        error: data.message || 'Failed to fetch penalty info',
      };
    }
  } catch (error: any) {
    console.error('❌ getPenaltyInfo Network Error:', error);
    return {
      success: false,
      error: error.message || 'Network error while fetching penalty info',
    };
  }
};

/**
 * Get violation history
 */
export const getViolationHistory = async (status: string | null = null, limit = 20, offset = 0) => {
  try {
    const token = await getAuthToken();
    if (!token) {
      console.error('❌ No token found for getViolationHistory');
      return {
        success: false,
        error: 'No authentication token found',
      };
    }

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (status) params.append('status', status);

    const url = `${BACKEND_URL}/api/penalty/my-violations?${params.toString()}`;
    console.log('🔍 Fetching violations from:', url);
    console.log('🔍 Using token (first 30 chars):', token.substring(0, 30));

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

    console.log('🔍 Violations API response status:', response.status);
    
    // Check for 401 - token expired
    if (response.status === 401) {
      console.log('🔐 Token expired in getViolationHistory');
      await ApiErrorHandler.handleTokenExpiration();
      return {
        success: false,
        error: 'Session expired',
      };
    }
    
    const data = await response.json();
    console.log('🔍 Violations API response data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      // Handle different response structures from documentation
      let violationsList = [];
      
      if (data.data && data.data.violations && Array.isArray(data.data.violations)) {
        // Standard structure: { data: { violations: [], total, page, limit } }
        violationsList = data.data.violations;
        console.log('✅ Found violations in data.data.violations:', violationsList.length);
      } else if (data.violations && Array.isArray(data.violations)) {
        // Flat structure: { violations: [], total, page, limit }
        violationsList = data.violations;
        console.log('✅ Found violations in data.violations:', violationsList.length);
      } else if (data.data && Array.isArray(data.data)) {
        // Array directly: { data: [...] }
        violationsList = data.data;
        console.log('✅ Found violations as data.data array:', violationsList.length);
      } else if (Array.isArray(data)) {
        // Direct array: [...]
        violationsList = data;
        console.log('✅ Found violations as direct array:', violationsList.length);
      }
      
      return {
        success: true,
        data: {
          violations: violationsList,
          total: data.total || data.data?.total || violationsList.length,
          page: data.page || data.data?.page || 1,
          limit: data.limit || data.data?.limit || limit,
        },
      };
    } else {
      console.error('❌ Violations API error:', data.message || data.error);
      return {
        success: false,
        error: data.message || 'Failed to fetch violations',
      };
    }
  } catch (error: any) {
    console.error('❌ Network error fetching violations:', error);
    return {
      success: false,
      error: error.message || 'Network error while fetching violations',
    };
  }
};

/**
 * Submit an appeal for a violation with optional evidence files
 */
export const submitAppeal = async (
  violationId: number, 
  appealReason: string, 
  evidenceFiles?: Array<{ uri: string; type: string; name: string }>
) => {
  try {
    const token = await getAuthToken();
    if (!token) {
      return {
        success: false,
        error: 'No authentication token found',
      };
    }

    console.log('🔍 Submitting appeal for violation:', violationId);
    console.log('🔍 Appeal URL:', `${BACKEND_URL}/api/penalty/appeal/${violationId}`);

    // Create FormData for multipart/form-data submission
    const formData = new FormData();
    formData.append('appealReason', appealReason);

    // Add evidence files if provided
    if (evidenceFiles && evidenceFiles.length > 0) {
      console.log('🔍 Appeal includes', evidenceFiles.length, 'evidence file(s)');
      evidenceFiles.forEach((file, index) => {
        console.log(`� Evidence ${index + 1}:`, file.name);
        // @ts-ignore - React Native FormData accepts this format
        formData.append('evidence', {
          uri: file.uri,
          type: file.type,
          name: file.name,
        });
      });
    }

    const response = await fetch(`${BACKEND_URL}/api/penalty/appeal/${violationId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type - let the browser/fetch set it with boundary
      },
      body: formData,
    });

    console.log('🔍 Appeal Response Status:', response.status);
    
    // Check for 401 - token expired
    if (response.status === 401) {
      console.log('🔐 Token expired in submitAppeal');
      await ApiErrorHandler.handleTokenExpiration();
      return {
        success: false,
        error: 'Session expired',
      };
    }
    
    const data = await response.json();
    console.log('🔍 Appeal Response Data:', data);

    if (response.ok) {
      return {
        success: true,
        data: data.data,
        message: data.message,
      };
    } else {
      return {
        success: false,
        error: data.message || data.error || 'Failed to submit appeal',
      };
    }
  } catch (error: any) {
    console.error('❌ Appeal submission error:', error);
    return {
      success: false,
      error: error.message || 'Network error while submitting appeal',
    };
  }
};

/**
 * Get reward statistics
 */
export const getRewardStats = async () => {
  try {
    const token = await getAuthToken();
    if (!token) {
      return {
        success: false,
        error: 'No authentication token found',
      };
    }

    const response = await fetch(`${BACKEND_URL}/api/penalty/my-rewards`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Check for 401 - token expired
    if (response.status === 401) {
      console.log('🔐 Token expired in getRewardStats');
      await ApiErrorHandler.handleTokenExpiration();
      return {
        success: false,
        error: 'Session expired',
      };
    }

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        data: data.data,
      };
    } else {
      return {
        success: false,
        error: data.message || 'Failed to fetch reward stats',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error while fetching reward stats',
    };
  }
};

/**
 * Get restoration history (points added back) from PenaltyAdjustment table
 */
export const getRestorationHistory = async (limit = 50, offset = 0) => {
  try {
    const token = await getAuthToken();
    if (!token) {
      return {
        success: false,
        error: 'No authentication token found',
      };
    }

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    console.log('🔍 Fetching adjustments from:', `${BACKEND_URL}/api/penalty/my-adjustments`);
    console.log('🔍 Using token (first 30 chars):', token.substring(0, 30));

    // Fetch penalty adjustments (points restoration records)
    const response = await fetch(`${BACKEND_URL}/api/penalty/my-adjustments?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

    console.log('🔍 Adjustments API Response Status:', response.status);
    
    // Check for 401 - token expired
    if (response.status === 401) {
      console.log('🔐 Token expired in getRestorationHistory');
      await ApiErrorHandler.handleTokenExpiration();
      return {
        success: false,
        error: 'Session expired',
      };
    }
    
    const data = await response.json();
    console.log('🔍 Adjustments API Response Data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('🔍 Raw data object:', data);
      console.log('🔍 data.adjustments exists?', !!data.adjustments);
      console.log('🔍 data.data exists?', !!data.data);
      console.log('🔍 data.data.adjustments exists?', !!(data.data && data.data.adjustments));
      
      // Get adjustments array - check nested structure first
      let adjustmentsList = [];
      if (data.data && data.data.adjustments && Array.isArray(data.data.adjustments)) {
        // Standard API response: data.data.adjustments
        adjustmentsList = data.data.adjustments;
      } else if (data.adjustments && Array.isArray(data.adjustments)) {
        // Flat structure: data.adjustments
        adjustmentsList = data.adjustments;
      } else if (data.data && Array.isArray(data.data)) {
        // Array directly in data: data.data
        adjustmentsList = data.data;
      } else if (Array.isArray(data)) {
        // Direct array: data
        adjustmentsList = data;
      }
      
      console.log('🔍 Adjustments list length:', adjustmentsList.length);
      console.log('🔍 First adjustment sample:', adjustmentsList.length > 0 ? adjustmentsList[0] : 'none');
      
      // Filter for positive adjustments only (restorations)
      const restorations = adjustmentsList.filter((adj: any) => {
        return adj.points_adjusted > 0;
      });
      
      console.log('🔍 Filtered restorations count:', restorations.length);
      
      return {
        success: true,
        data: restorations,
      };
    } else {
      console.log('❌ Adjustments API failed:', response.status, data);
      return {
        success: false,
        error: data.message || 'Failed to fetch restoration history',
        data: [], // Return empty array if endpoint doesn't exist
      };
    }
  } catch (error: any) {
    console.log('❌ Adjustments API error:', error);
    return {
      success: false,
      error: error.message || 'Network error while fetching restoration history',
      data: [], // Return empty array on error
    };
  }
};

/**
 * Get penalty info with caching support
 * @param forceRefresh - If true, bypass cache and fetch fresh data
 */
export const getPenaltyInfoCached = async (forceRefresh = false) => {
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await getFromCache('penalty_info');
    if (cached) {
      return { success: true, data: cached, cached: true };
    }
  }

  // Fetch from API
  const result = await getPenaltyInfo();

  // Save to cache on success
  if (result.success && result.data) {
    await saveToCache('penalty_info', result.data);
  }

  return { ...result, cached: false };
};

/**
 * Get violation history with caching support
 * @param status - Filter by status
 * @param limit - Number of records to fetch
 * @param offset - Pagination offset
 * @param forceRefresh - If true, bypass cache and fetch fresh data
 */
export const getViolationHistoryCached = async (
  status: string | null = null,
  limit = 20,
  offset = 0,
  forceRefresh = false
) => {
  const cacheKey = `violations_${status}_${limit}_${offset}`;

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await getFromCache(cacheKey);
    if (cached) {
      return { success: true, data: cached, cached: true };
    }
  }

  // Fetch from API
  const result = await getViolationHistory(status, limit, offset);

  // Save to cache on success
  if (result.success && result.data) {
    await saveToCache(cacheKey, result.data);
  }

  return { ...result, cached: false };
};

/**
 * Get restoration history with caching support
 * @param limit - Number of records to fetch
 * @param offset - Pagination offset
 * @param forceRefresh - If true, bypass cache and fetch fresh data
 */
export const getRestorationHistoryCached = async (
  limit = 50,
  offset = 0,
  forceRefresh = false
) => {
  const cacheKey = `restorations_${limit}_${offset}`;

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await getFromCache(cacheKey);
    if (cached) {
      return { success: true, data: cached, cached: true };
    }
  }

  // Fetch from API
  const result = await getRestorationHistory(limit, offset);

  // Save to cache on success
  if (result.success) {
    await saveToCache(cacheKey, result.data);
  }

  return { ...result, cached: false };
};
