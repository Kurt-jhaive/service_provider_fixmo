// Availability Types

export type DayOfWeek = 
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface Availability {
  availability_id?: number;
  provider_id: number;
  dayOfWeek: DayOfWeek;
  startTime: string;  // Format: "HH:mm" (e.g., "08:00")
  endTime: string;    // Format: "HH:mm" (e.g., "17:00")
  availability_isActive: boolean;  // Day-level toggle
  slot_isActive?: boolean;         // Slot-level toggle (NEW!)
  created_at?: string;
  updated_at?: string;
}

export interface CreateAvailabilityRequest {
  dayOfWeek: DayOfWeek;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
}

export interface SetAvailabilityRequest {
  availabilityData: CreateAvailabilityRequest[];
}

export interface UpdateAvailabilityRequest {
  availability_isActive?: boolean;
  startTime?: string;
  endTime?: string;
}

export interface AvailabilityResponse {
  success: boolean;
  data?: Availability;
  message?: string;
}

export interface AvailabilitiesListResponse {
  success: boolean;
  data?: Availability[];
  message?: string;
}
