import { API_CONFIG } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for reports
export interface ReportSubmission {
  reporter_name: string;
  reporter_email: string;
  reporter_phone?: string;
  reporter_type: 'customer' | 'provider';
  report_type: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  appointment_id?: string;
  customer_id?: string;
  provider_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  violation_id?: string; // For penalty/violation reports
  images?: Array<{
    uri: string;
    type: string;
    name: string;
  }>;
}

export interface ReportResponse {
  success: boolean;
  message: string;
  data?: {
    report_id: number;
    has_attachments: boolean;
  };
}

/**
 * Submit a report from a provider
 * Endpoint: POST /api/reports/provider
 */
export const submitProviderReport = async (
  reportData: ReportSubmission
): Promise<ReportResponse> => {
  try {
    const token = await AsyncStorage.getItem('providerToken');
    
    // Create FormData for multipart/form-data submission
    const formData = new FormData();
    
    // Required fields
    formData.append('reporter_name', reportData.reporter_name);
    formData.append('reporter_email', reportData.reporter_email);
    formData.append('report_type', reportData.report_type);
    formData.append('subject', reportData.subject);
    formData.append('description', reportData.description);
    formData.append('priority', reportData.priority);
    formData.append('reporter_type', 'provider');
    
    // Optional fields
    if (reportData.reporter_phone) {
      formData.append('reporter_phone', reportData.reporter_phone);
    }
    if (reportData.appointment_id) {
      formData.append('appointment_id', reportData.appointment_id);
    }
    if (reportData.customer_id) {
      formData.append('customer_id', reportData.customer_id);
    }
    if (reportData.customer_name) {
      formData.append('customer_name', reportData.customer_name);
    }
    if (reportData.customer_email) {
      formData.append('customer_email', reportData.customer_email);
    }
    if (reportData.customer_phone) {
      formData.append('customer_phone', reportData.customer_phone);
    }
    if (reportData.violation_id) {
      formData.append('violation_id', reportData.violation_id);
    }
    
    // Add images if provided
    if (reportData.images && reportData.images.length > 0) {
      console.log('[Reports API] Processing images for upload...');
      reportData.images.forEach((image, index) => {
        // React Native requires specific format for image upload
        const imageData = {
          uri: image.uri,
          type: image.type || 'image/jpeg',
          name: image.name || `image_${index}.jpg`,
        };
        
        console.log(`[Reports API] Image ${index + 1}:`, {
          uri: imageData.uri.substring(0, 50) + '...',
          type: imageData.type,
          name: imageData.name
        });
        
        // @ts-ignore - React Native FormData accepts this format
        formData.append('images', imageData);
      });
    }

    console.log('[Reports API] Sending request to:', `${API_CONFIG.BASE_URL}/api/reports`);

    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/reports`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          // Don't set Content-Type for FormData - it will be set automatically with boundary
        },
      }
    );

    const responseText = await response.text();
    console.log('[Reports API] Response:', responseText);

    let result: ReportResponse;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('[Reports API] Failed to parse response:', responseText);
      throw new Error('Invalid response from server');
    }

    if (!response.ok) {
      throw new Error(result.message || 'Failed to submit report');
    }

    return result;
  } catch (error) {
    console.error('[Reports API] Error submitting provider report:', error);
    throw error;
  }
};

/**
 * Submit a report from a customer
 * Endpoint: POST /api/reports/customer
 */
export const submitCustomerReport = async (
  reportData: ReportSubmission
): Promise<ReportResponse> => {
  try {
    const token = await AsyncStorage.getItem('token');
    
    // Create FormData for multipart/form-data submission
    const formData = new FormData();
    
    // Required fields
    formData.append('reporter_name', reportData.reporter_name);
    formData.append('reporter_email', reportData.reporter_email);
    formData.append('report_type', reportData.report_type);
    formData.append('subject', reportData.subject);
    formData.append('description', reportData.description);
    formData.append('priority', reportData.priority);
    formData.append('reporter_type', 'customer');
    
    // Optional fields
    if (reportData.reporter_phone) {
      formData.append('reporter_phone', reportData.reporter_phone);
    }
    if (reportData.appointment_id) {
      formData.append('appointment_id', reportData.appointment_id);
    }
    if (reportData.provider_id) {
      formData.append('provider_id', reportData.provider_id);
    }
    
    // Add images if provided
    if (reportData.images && reportData.images.length > 0) {
      console.log('[Reports API - Customer] Processing images for upload...');
      reportData.images.forEach((image, index) => {
        // React Native requires specific format for image upload
        const imageData = {
          uri: image.uri,
          type: image.type || 'image/jpeg',
          name: image.name || `image_${index}.jpg`,
        };
        
        // @ts-ignore - React Native FormData accepts this format
        formData.append('images', imageData);
      });
    }

    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/reports`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          // Don't set Content-Type for FormData - fetch sets it automatically with boundary
        },
      }
    );

    const responseText = await response.text();
    console.log('[Reports API] Response:', responseText);

    let result: ReportResponse;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('[Reports API] Failed to parse response:', responseText);
      throw new Error('Invalid response from server');
    }

    if (!response.ok) {
      throw new Error(result.message || 'Failed to submit report');
    }

    return result;
  } catch (error) {
    console.error('[Reports API] Error submitting customer report:', error);
    throw error;
  }
};
