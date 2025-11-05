// Appointment Types

export type AppointmentStatus = 
  | 'pending'
  | 'approved'
  | 'confirmed'  // On the way
  | 'in-progress'  // Ongoing/Working
  | 'finished' 
  | 'in-warranty' // After service is completed, within warranty period
  | 'backjob'  // Customer applied for backjob, warranty work required
  | 'completed'
  | 'cancelled'
  | 'no-show'
  | 'user_no_show'  // Customer no-show reported by provider
  // Legacy support
  | 'scheduled'  // Maps to approved
  | 'ongoing'  // Maps to in-progress
  | 'On the Way';  // Alternative format for confirmed status

export type BackjobStatus = 
  | 'pending'
  | 'approved'
  | 'disputed'
  | 'rescheduled'
  | 'cancelled-by-admin'
  | 'cancelled-by-customer'
  | 'cancelled-by-user';

export interface BackjobEvidence {
  description?: string;
  files?: string[];
  notes?: string;
}

export interface Backjob {
  backjob_id: number;
  appointment_id: number;
  customer_id: number;
  provider_id: number;
  reason: string;
  status: BackjobStatus;
  evidence?: BackjobEvidence;
  provider_dispute_reason?: string;
  provider_dispute_evidence?: BackjobEvidence;
  admin_notes?: string;
  customer_cancellation_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  appointment_id: number;
  customer_id: number;
  provider_id: number;
  appointment_status: AppointmentStatus;
  scheduled_date: string;
  repairDescription: string;
  created_at: string;
  starting_price: number;
  final_price: number;
  availability_id: number;
  service_id: number;
  cancellation_reason?: string | null;
  warranty_days?: number | null;
  finished_at?: string | null;
  completed_at?: string | null;
  warranty_expires_at?: string | null;
  warranty_paused_at?: string | null;  // When backjob was applied
  warranty_remaining_days?: number | null;  // Days left when paused
  days_left?: number | null;  // Alias for warranty_remaining_days
  
  // Backjob data (populated when appointment has backjob)
  current_backjob?: Backjob;
  
  // Related data (populated by backend)
  customer?: {
    customer_id?: number;
    user_id?: number;  // Alias for customer_id
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
    user_location?: string;  // General location
    exact_location?: string; // Format: "lat,lng"
    latitude?: number;
    longitude?: number;
  };
  provider?: {
    provider_id: number;
    provider_first_name?: string;  // Backend might use this format
    provider_last_name?: string;
    first_name?: string;  // Or this format
    last_name?: string;
    provider_email?: string;
    email?: string;
    provider_phone_number?: string;
    phone_number?: string;
    provider_exact_location?: string; // Format: "lat,lng"
  };
  serviceProvider?: {  // Alias for provider
    provider_id: number;
    provider_first_name: string;
    provider_last_name: string;
    provider_email: string;
    provider_phone_number?: string;
    provider_profile_photo?: string;
  };
  service?: {
    service_id: number;
    service_title: string;
    service_description?: string;
    service_startingprice?: number;
  };
  availability?: {
    availability_id: number;
    startTime: string;  // Format: "HH:mm" (e.g., "08:00")
    endTime: string;    // Format: "HH:mm" (e.g., "10:30")
    dayOfWeek?: string;
  };
}

export interface AppointmentResponse {
  success: boolean;
  data?: Appointment;
  message?: string;
}

export interface AppointmentsListResponse {
  success: boolean;
  data?: Appointment[];
  message?: string;
}

export interface UpdateAppointmentRequest {
  scheduled_date?: string;
  appointment_status?: AppointmentStatus;
  final_price?: number;
  repairDescription?: string;
}

export interface UpdateAppointmentResponse {
  success: boolean;
  message?: string;
  data?: Appointment;
}
