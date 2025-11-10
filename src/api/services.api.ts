import { API_CONFIG } from '../constants/config';
import type {
  CreateServiceRequest,
  Service,
  ServiceResponse,
  ServicesResponse,
  UpdateServiceRequest,
} from '../types/service';

/**
 * Get all services for the authenticated provider
 * @param token - JWT authentication token
 */
export const getProviderServices = async (token: string): Promise<Service[]> => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/services/services`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data: ServicesResponse = await response.json();

    if (!response.ok || !data.success) {
      throw new Error('Failed to fetch services');
    }

    // Log raw response to debug (only first service to avoid clutter)
    if (data.data && data.data.length > 0) {
      console.log('📋 Raw service from backend:', JSON.stringify(data.data[0], null, 2));
      console.log('📋 Certificate ID field check:', {
        certificate_id: data.data[0].certificate_id,
        certificateId: (data.data[0] as any).certificateId,
        allKeys: Object.keys(data.data[0])
      });
    }

    // Backend inconsistency: GET endpoint returns different field names than database schema
    // Database has: service_id, servicelisting_isActive
    // GET /services returns: id, isActive (camelCase, no prefix)
    // PATCH /toggle returns: service_id, servicelisting_isActive (correct)
    
    const services = (data.data || []).map(service => {
      // Map backend field names to frontend expected names
      const serviceId = (service as any).id || service.service_id;
      const serviceTitle = (service as any).title || service.service_title;
      
      // Check all possible variations for certificate_id
      const certificateId = service.certificate_id || 
                           (service as any).certificateId || 
                           (service as any).certificate_ids?.[0] ||
                           (service as any).certificates?.[0]?.certificate_id;
      
      // Check all possible variations for the active status field
      const isActive = service.servicelisting_isActive ?? 
                      (service as any).isActive ?? 
                      (service as any).is_active ?? 
                      false;
      
      const convertedService = {
        ...service,
        service_id: serviceId,
        service_title: serviceTitle,
        certificate_id: certificateId,
        servicelisting_isActive: Boolean(isActive)
      };
      
      console.log(`✅ Service ${serviceId} (${serviceTitle}): isActive=${isActive}, certificateId=${certificateId}`);
      
      return convertedService;
    });

    return services;
  } catch (error: any) {
    console.error('Get Services Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Create a new service
 * @param serviceData - Service data including photos
 * @param token - JWT authentication token
 */
export const createService = async (
  serviceData: CreateServiceRequest,
  token: string
): Promise<Service> => {
  try {
    const formData = new FormData();
    formData.append('service_title', serviceData.service_title);
    formData.append('service_description', serviceData.service_description);
    formData.append('service_startingprice', serviceData.service_startingprice.toString());
    formData.append('certificate_id', serviceData.certificate_id.toString());
    
    if (serviceData.warranty_days !== undefined) {
      formData.append('warranty_days', serviceData.warranty_days.toString());
    }
    
    if (serviceData.category_id) {
      formData.append('category_id', serviceData.category_id.toString());
    }

    // Append service photos (up to 5)
    serviceData.service_photos.forEach((photo, index) => {
      formData.append('service_photos', {
        uri: photo.uri,
        name: photo.name,
        type: photo.type,
      } as any);
    });

    console.log('Creating service:', serviceData.service_title);
    console.log('Warranty days being sent:', serviceData.warranty_days);
    console.log('📦 FormData includes warranty_days:', serviceData.warranty_days !== undefined);
    
    // Log all FormData entries for debugging
    console.log('📋 Complete service data being sent:', {
      service_title: serviceData.service_title,
      service_startingprice: serviceData.service_startingprice,
      warranty_days: serviceData.warranty_days,
      certificate_id: serviceData.certificate_id,
      category_id: serviceData.category_id,
      photos_count: serviceData.service_photos.length
    });

    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/services/services`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // Do NOT set Content-Type for FormData - let fetch set it automatically with boundary
        },
        body: formData,
      }
    );

    const data: ServiceResponse = await response.json();
    console.log('Create service response:', JSON.stringify(data));

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create service');
    }

    return data.data;
  } catch (error: any) {
    console.error('Create Service Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Update an existing service with photo management
 * @param serviceId - Service ID
 * @param updateData - Fields to update including photo changes
 * @param token - JWT authentication token
 */
export const updateService = async (
  serviceId: number,
  updateData: UpdateServiceRequest,
  token: string
): Promise<Service> => {
  try {
    // Check if we have photos to add or remove - use FormData
    const hasPhotoChanges = 
      (updateData.photosToRemove && updateData.photosToRemove.length > 0) ||
      (updateData.newPhotos && updateData.newPhotos.length > 0);

    if (hasPhotoChanges) {
      // Use FormData for multipart/form-data
      const formData = new FormData();
      
      formData.append('service_description', updateData.service_description || '');
      formData.append('service_startingprice', updateData.service_startingprice?.toString() || '0');
      
      if (updateData.warranty_days !== undefined) {
        formData.append('warranty_days', updateData.warranty_days.toString());
      }

      // Add photos to remove
      if (updateData.photosToRemove && updateData.photosToRemove.length > 0) {
        formData.append('photos_to_remove', JSON.stringify(updateData.photosToRemove));
      }

      // Add new photos
      if (updateData.newPhotos && updateData.newPhotos.length > 0) {
        updateData.newPhotos.forEach((photo) => {
          formData.append('service_photos', {
            uri: photo.uri,
            name: photo.name,
            type: photo.type,
          } as any);
        });
      }

      console.log('Updating service with photos:', {
        serviceId,
        photosToRemove: updateData.photosToRemove?.length || 0,
        newPhotos: updateData.newPhotos?.length || 0,
      });

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/services/services/${serviceId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            // Do NOT set Content-Type for FormData - let fetch set it automatically with boundary
          },
          body: formData,
        }
      );

      const data: ServiceResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update service');
      }

      return data.data;
    } else {
      // No photo changes - use JSON
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/services/services/${serviceId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        }
      );

      const data: ServiceResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update service');
      }

      return data.data;
    }
  } catch (error: any) {
    console.error('Update Service Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Delete a service
 * @param serviceId - Service ID
 * @param token - JWT authentication token
 */
export const deleteService = async (
  serviceId: number,
  token: string
): Promise<void> => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/services/services/${serviceId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete service');
    }
  } catch (error: any) {
    console.error('Delete Service Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};

/**
 * Toggle service availability
 * @param serviceId - Service ID
 * @param token - JWT authentication token
 */
export const toggleServiceAvailability = async (
  serviceId: number,
  token: string
): Promise<{ service_id: number; servicelisting_isActive: boolean }> => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/services/services/${serviceId}/toggle`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const responseData = await response.json();
    
    console.log('Toggle API raw response:', responseData);

    if (!response.ok) {
      throw new Error(responseData.message || 'Failed to toggle service availability');
    }

    // Backend returns data wrapped in a 'data' property
    const serviceData = responseData.data || responseData;
    
    // Convert servicelisting_isActive to proper boolean (backend might return 0/1)
    return {
      service_id: serviceData.service_id,
      servicelisting_isActive: Boolean(serviceData.servicelisting_isActive)
    };
  } catch (error: any) {
    console.error('Toggle Service Availability Error:', error);
    throw new Error(error.message || 'Network error. Please try again.');
  }
};
