import { API_CONFIG } from '../constants/config';
import type {
  Appointment,
  AppointmentResponse,
  AppointmentsListResponse,
  UpdateAppointmentRequest,
  UpdateAppointmentResponse,
} from '../types/appointment';

/**
 * Get appointment by ID
 * @param appointmentId - The ID of the appointment
 * @param token - JWT authentication token
 */
export const getAppointmentById = async (
  appointmentId: number,
  token: string
): Promise<Appointment> => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/appointments/${appointmentId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data: AppointmentResponse = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to fetch appointment');
    }

    if (!data.data) {
      throw new Error('No appointment data received');
    }

    return data.data;
  } catch (error: any) {
    console.error('Get Appointment Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Get all appointments for a provider
 * @param providerId - The ID of the provider
 * @param token - JWT authentication token
 */
export const getAppointmentsByProviderId = async (
  providerId: number,
  token: string
): Promise<Appointment[]> => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/appointments/provider/${providerId}?include=appointment_id,customer,provider,service,availability`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data: AppointmentsListResponse = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to fetch appointments');
    }

    return data.data || [];
  } catch (error: any) {
    console.error('Get Appointments Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Update appointment details
 * @param appointmentId - The ID of the appointment to update
 * @param updateData - The fields to update
 * @param token - JWT authentication token
 */
export const updateAppointment = async (
  appointmentId: number,
  updateData: UpdateAppointmentRequest,
  token: string
): Promise<Appointment> => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/appointments/${appointmentId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      }
    );

    const data: UpdateAppointmentResponse = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to update appointment');
    }

    if (!data.data) {
      throw new Error('No appointment data received after update');
    }

    return data.data;
  } catch (error: any) {
    console.error('Update Appointment Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Start en route - change appointment status to 'On the Way'
 * @param appointmentId - The ID of the appointment
 * @param token - JWT authentication token
 */
export const startEnRoute = async (
  appointmentId: number,
  token: string
): Promise<Appointment> => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/auth/appointments/${appointmentId}/status`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'confirmed' }),
      }
    );

    const data: UpdateAppointmentResponse = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to update appointment status');
    }

    if (!data.data) {
      throw new Error('No appointment data received after update');
    }

    return data.data;
  } catch (error: any) {
    console.error('Start En Route Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Mark as arrived - change appointment status to 'in-progress'
 * @param appointmentId - The ID of the appointment
 * @param token - JWT authentication token
 */
export const markAsArrived = async (
  appointmentId: number,
  token: string
): Promise<Appointment> => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/auth/appointments/${appointmentId}/status`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'in-progress' }),
      }
    );

    const data: UpdateAppointmentResponse = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to update appointment status');
    }

    if (!data.data) {
      throw new Error('No appointment data received after update');
    }

    return data.data;
  } catch (error: any) {
    console.error('Mark As Arrived Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Mark appointment as finished with final price and description
 * @param appointmentId - The ID of the appointment
 * @param finalPrice - The final price (adjustment price)
 * @param repairDescription - Description of the repair work
 * @param token - JWT authentication token
 */
export const completeAppointment = async (
  appointmentId: number,
  finalPrice: number,
  repairDescription: string,
  token: string
): Promise<Appointment> => {
  return updateAppointment(
    appointmentId,
    {
      appointment_status: 'in-warranty',
      final_price: finalPrice,
      repairDescription: repairDescription,
    },
    token
  );
};

/**
 * Cancel appointment by provider
 * @param appointmentId - The ID of the appointment to cancel
 * @param cancellationReason - Reason for cancellation
 * @param token - Provider JWT authentication token
 */
export const cancelAppointmentByProvider = async (
  appointmentId: number,
  cancellationReason: string,
  token: string
): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    const url = `${API_CONFIG.BASE_URL}/api/appointments/${appointmentId}/provider-cancel`;
    
    console.log('📝 Cancelling appointment:', {
      appointmentId,
      hasReason: !!cancellationReason,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        cancellation_reason: cancellationReason,
      }),
    });

    console.log('📡 Response status:', response.status, response.statusText);

    const data = await response.json();
    console.log('📡 Response data:', data);

    if (!response.ok) {
      console.error('❌ Failed to cancel appointment. Status:', response.status);
      console.error('❌ Error data:', data);
      return {
        success: false,
        message: data.message || 'Failed to cancel appointment',
      };
    }

    console.log('✅ Appointment cancelled successfully');

    return {
      success: true,
      message: data.message || 'Appointment cancelled successfully',
      data: data.data,
    };
  } catch (error: any) {
    console.error('💥 Error cancelling appointment:', error);
    return {
      success: false,
      message: error.message || 'Network error. Please try again.',
    };
  }
};

/**
 * Mark appointment as provider no-show (overdue appointment)
 * @param appointmentId - The ID of the appointment
 * @param token - Provider JWT authentication token
 */
export const markAsProviderNoShow = async (
  appointmentId: number,
  token: string
): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    const url = `${API_CONFIG.BASE_URL}/api/appointments/${appointmentId}/provider-no-show`;
    
    console.log('⏰ Marking appointment as provider no-show:', appointmentId);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        cancellation_reason: 'provider-no-show',
      }),
    });

    console.log('📡 Response status:', response.status, response.statusText);

    const data = await response.json();
    console.log('📡 Response data:', data);

    if (!response.ok) {
      console.error('❌ Failed to mark as no-show. Status:', response.status);
      console.error('❌ Error data:', data);
      return {
        success: false,
        message: data.message || 'Failed to mark as no-show',
      };
    }

    console.log('✅ Appointment marked as provider no-show');

    return {
      success: true,
      message: data.message || 'Appointment marked as provider no-show',
      data: data.data,
    };
  } catch (error: any) {
    console.error('💥 Error marking as no-show:', error);
    return {
      success: false,
      message: error.message || 'Network error. Please try again.',
    };
  }
};

/**
 * Report customer no-show with photo evidence
 * @param appointmentId - The ID of the appointment
 * @param token - JWT authentication token
 * @param photoUri - Local URI of the evidence photo
 * @param description - Description/explanation of the no-show situation
 */
export const reportCustomerNoShow = async (
  appointmentId: number,
  token: string,
  photoUri: string,
  description: string
): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    console.log('🚫 Reporting customer no-show for appointment:', appointmentId);

    // Create FormData for multipart/form-data upload
    const formData = new FormData();
    
    // Add description
    formData.append('description', description);
    
    // Add photo - React Native FormData format
    const photoFile = {
      uri: photoUri,
      type: 'image/jpeg',
      name: 'evidence.jpg',
    } as any;
    formData.append('evidence_photo', photoFile);

    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/serviceProvider/appointments/${appointmentId}/report-no-show`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Note: Don't set Content-Type for FormData, browser/RN will set it with boundary
        },
        body: formData,
      }
    );

    console.log('📡 Response status:', response.status, response.statusText);

    const data = await response.json();
    console.log('📡 Response data:', data);

    if (!response.ok) {
      console.error('❌ Failed to report customer no-show. Status:', response.status);
      console.error('❌ Error data:', data);
      return {
        success: false,
        message: data.message || 'Failed to report customer no-show',
      };
    }

    console.log('✅ Customer no-show reported successfully');

    return {
      success: true,
      message: data.message || 'Customer no-show reported successfully',
      data: data.data,
    };
  } catch (error: any) {
    console.error('💥 Error reporting customer no-show:', error);
    return {
      success: false,
      message: error.message || 'Network error. Please try again.',
    };
  }
};
