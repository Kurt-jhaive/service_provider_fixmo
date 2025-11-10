export interface Service {
  service_id: number;
  service_title: string;
  service_description: string;
  service_startingprice: number;
  warranty_days?: number;
  category_id?: number;
  certificate_id: number;
  servicelisting_isActive: boolean;
  service_photos?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ServiceCategory {
  category_id: number;
  category_name: string;
  min_price?: number;
  max_price?: number;
}

export interface CertificateWithServices {
  certificate_id: number;
  certificate_name: string;
  services: {
    service_title: string;
    min_price?: number;
    max_price?: number;
  }[];
}

export interface CreateServiceRequest {
  service_title: string;
  service_description: string;
  service_startingprice: number;
  warranty_days?: number;
  category_id?: number | string; // Can be number or string (from certificateservices.json)
  certificate_id: number;
  service_photos: {
    uri: string;
    name: string;
    type: string;
  }[];
}

/**
 * Update Service Request
 * NOTE: service_title should NOT be included in updates - titles cannot be changed
 * Only service_description and service_startingprice are editable
 * servicelisting_isActive is controlled by the toggle endpoint
 */
export interface UpdateServiceRequest {
  service_title?: string; // ⚠️ Do not use - titles cannot be changed
  service_description?: string; // Description can be updated
  service_startingprice?: number; // Price can be updated
  warranty_days?: number; // Warranty period can be updated
  servicelisting_isActive?: boolean; // Use toggle endpoint instead
  photosToRemove?: number[]; // Array of photo IDs to delete
  newPhotos?: {
    uri: string;
    name: string;
    type: string;
  }[]; // New photos to upload
}

export interface ServicesResponse {
  success: boolean;
  data: Service[];
  count?: number;
}

export interface ServiceResponse {
  success: boolean;
  data: Service;
  message?: string;
}
