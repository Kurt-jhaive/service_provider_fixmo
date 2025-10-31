import { API_CONFIG } from '../constants/config';
import type {
  AvailabilitiesListResponse,
  Availability,
  AvailabilityResponse,
  CreateAvailabilityRequest,
  DayOfWeek,
  UpdateAvailabilityRequest,
} from '../types/availability';

/**
 * Get all availability slots for a provider
 * @param providerId - The ID of the provider
 * @param token - JWT authentication token
 */
export const getProviderAvailability = async (
  providerId: number,
  token: string
): Promise<Availability[]> => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/availability?provider_id=${providerId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data: AvailabilitiesListResponse = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to fetch availability');
    }

    return data.data || [];
  } catch (error: any) {
    console.error('Get Availability Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Create or update availability for a specific day
 * @param availabilityData - The availability data
 * @param token - JWT authentication token
 */
export const setAvailability = async (
  availabilityData: CreateAvailabilityRequest[],
  token: string
): Promise<Availability> => {
  try {
    const requestBody = { availabilityData };
    console.log('Setting availability with data:', JSON.stringify(requestBody));
    
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/availability`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data: AvailabilityResponse = await response.json();
    console.log('Set availability response:', JSON.stringify(data));

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to set availability');
    }

    if (!data.data) {
      throw new Error('No availability data received');
    }

    return data.data;
  } catch (error: any) {
    console.error('Set Availability Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Update availability slot
 * @param availabilityId - The ID of the availability slot
 * @param updateData - The fields to update
 * @param token - JWT authentication token
 */
export const updateAvailability = async (
  availabilityId: number,
  updateData: UpdateAvailabilityRequest,
  token: string
): Promise<Availability> => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/availability/${availabilityId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      }
    );

    const data: AvailabilityResponse = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to update availability');
    }

    if (!data.data) {
      throw new Error('No availability data received');
    }

    return data.data;
  } catch (error: any) {
    console.error('Update Availability Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Toggle availability for an entire day (enable/disable all time slots)
 * @param dayOfWeek - The day of the week to toggle
 * @param isActive - Whether to enable (true) or disable (false) the day
 * @param token - JWT authentication token
 */
export const toggleDayAvailability = async (
  dayOfWeek: DayOfWeek,
  isActive: boolean,
  token: string
): Promise<void> => {
  try {
    console.log(`Toggling ${dayOfWeek} availability to: ${isActive}`);
    
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/availability/toggle-day`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dayOfWeek,
          isActive,
        }),
      }
    );

    const data = await response.json();
    console.log('Toggle day availability response:', JSON.stringify(data));

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to toggle day availability');
    }
  } catch (error: any) {
    console.error('Toggle Day Availability Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Update availability for a specific date
 * @param date - The date in YYYY-MM-DD format
 * @param isActive - Whether to enable or disable availability
 * @param token - JWT authentication token
 */
export const updateAvailabilityByDate = async (
  date: string,
  isActive: boolean,
  token: string
): Promise<any> => {
  try {
    console.log(`Updating availability for date: ${date}, isActive: ${isActive}`);
    
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/availability/date`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date,
          isActive,
        }),
      }
    );

    const data = await response.json();
    console.log('Update availability by date response:', JSON.stringify(data));

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update availability');
    }

    return data;
  } catch (error: any) {
    console.error('Update Availability By Date Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Add a time-range availability slot for a specific day
 * @param dayOfWeek - The day of the week
 * @param startTime - Start time in HH:MM format
 * @param endTime - End time in HH:MM format
 * @param token - JWT authentication token
 */
export const addTimeRangeAvailability = async (
  dayOfWeek: DayOfWeek,
  startTime: string,
  endTime: string,
  token: string
): Promise<Availability> => {
  try {
    console.log(`Adding time-range availability: ${dayOfWeek} ${startTime}-${endTime}`);
    
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/availability/time-range`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dayOfWeek,
          startTime,
          endTime,
        }),
      }
    );

    const data: AvailabilityResponse = await response.json();
    console.log('Add time-range availability response:', JSON.stringify(data));

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to add time-range availability');
    }

    if (!data.data) {
      throw new Error('No availability data received');
    }

    return data.data;
  } catch (error: any) {
    console.error('Add Time-Range Availability Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Delete a specific availability slot
 * @param availabilityId - The ID of the availability slot to delete
 * @param token - JWT authentication token
 */
export const deleteAvailability = async (
  availabilityId: number,
  token: string
): Promise<void> => {
  try {
    console.log(`Deleting availability slot: ${availabilityId}`);
    
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/availability/${availabilityId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    console.log('Delete availability response:', JSON.stringify(data));

    if (!response.ok || !data.success) {
      // Check for foreign key constraint error
      if (data.message && (
        data.message.includes('foreign key') || 
        data.message.includes('constraint') ||
        data.message.includes('referenced') ||
        data.message.includes('appointments')
      )) {
        throw new Error('Cannot delete this time slot because it has scheduled appointments. Please complete or cancel those appointments first.');
      }
      throw new Error(data.message || 'Failed to delete availability');
    }
  } catch (error: any) {
    console.error('Delete Availability Error:', error);
    // Re-throw with the original message if it's already a user-friendly message
    if (error.message.includes('Cannot delete this time slot')) {
      throw error;
    }
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Toggle individual time slot availability (enable/disable)
 * @param availabilityId - The ID of the availability slot to toggle
 * @param slotIsActive - Whether to enable or disable the slot
 * @param token - JWT authentication token
 */
export const toggleTimeSlot = async (
  availabilityId: number,
  slotIsActive: boolean,
  token: string
): Promise<Availability> => {
  try {
    console.log(`Toggling time slot ${availabilityId} to ${slotIsActive ? 'active' : 'inactive'}`);
    
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/availability/toggle-slot/${availabilityId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slot_isActive: slotIsActive,
        }),
      }
    );

    const data: AvailabilityResponse = await response.json();
    console.log('Toggle time slot response:', JSON.stringify(data));

    if (!response.ok || !data.success) {
      // Handle 409 Conflict (has active appointments)
      if (response.status === 409) {
        const conflictMessage = data.message || 'Cannot deactivate time slot with active appointments';
        throw new Error(conflictMessage);
      }
      throw new Error(data.message || 'Failed to toggle time slot');
    }

    if (!data.data) {
      throw new Error('No availability data received');
    }

    return data.data;
  } catch (error: any) {
    console.error('Toggle Time Slot Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};
