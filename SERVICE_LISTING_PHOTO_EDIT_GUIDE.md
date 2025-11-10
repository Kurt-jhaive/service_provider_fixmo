# Service Listing Photo Edit - Complete Guide

## Overview

Service providers can now add and remove photos when editing their service listings. The system supports up to 5 photos per service, with automatic Cloudinary storage management.

---

## API Endpoint

### Update Service with Photo Management

**Endpoint**: `PUT /api/services/services/:serviceId`  
**Authentication**: Provider JWT token required  
**Content-Type**: `multipart/form-data`

---

## Request Parameters

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serviceId` | integer | Yes | The ID of the service to update |

### Form Data Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `service_description` | string | Yes | Updated service description |
| `service_startingprice` | number | Yes | Updated starting price |
| `warranty` or `warranty_days` | integer | No | Warranty period in days |
| `certificate_ids` | array | No | Array of certificate IDs |
| `photos_to_remove` | array/JSON | No | Array of photo IDs to delete |
| `service_photos` | file[] | No | New photos to upload (max 5 total) |

---

## Request Examples

### Example 1: Remove Old Photos and Add New Ones

**Scenario**: Service has 4 photos. Remove 2, add 1 new photo.

```bash
curl -X PUT https://your-api.com/api/services/services/123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "service_description=Professional aircon repair and maintenance" \
  -F "service_startingprice=1500" \
  -F "warranty_days=30" \
  -F "photos_to_remove=[5, 7]" \
  -F "service_photos=@/path/to/new-photo1.jpg"
```

**Result**: Service now has 3 photos (4 - 2 + 1)

---

### Example 2: Add Photos Only

**Scenario**: Service has 2 photos. Add 3 new photos.

```bash
curl -X PUT https://your-api.com/api/services/services/123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "service_description=Complete plumbing services" \
  -F "service_startingprice=2000" \
  -F "warranty_days=60" \
  -F "service_photos=@/path/to/photo1.jpg" \
  -F "service_photos=@/path/to/photo2.jpg" \
  -F "service_photos=@/path/to/photo3.jpg"
```

**Result**: Service now has 5 photos (2 + 3)

---

### Example 3: Remove Photos Only

**Scenario**: Service has 5 photos. Remove 2 photos.

```bash
curl -X PUT https://your-api.com/api/services/services/123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "service_description=Electrical wiring and repair" \
  -F "service_startingprice=1800" \
  -F "photos_to_remove=[3, 8]"
```

**Result**: Service now has 3 photos (5 - 2)

---

### Example 4: Update Service Without Photo Changes

**Scenario**: Update description and price only.

```bash
curl -X PUT https://your-api.com/api/services/services/123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "service_description=Updated description" \
  -F "service_startingprice=1600" \
  -F "warranty_days=45"
```

**Result**: Photos remain unchanged

---

## Response Format

### Success Response

**Status Code**: `200 OK`

```json
{
  "success": true,
  "message": "Service updated successfully",
  "data": {
    "service_id": 123,
    "service_title": "Aircon Repair",
    "service_description": "Professional aircon repair and maintenance",
    "service_startingprice": 1500,
    "warranty": 30,
    "provider_id": 45,
    "servicelisting_isActive": true,
    "service_photos": [
      {
        "id": 1,
        "imageUrl": "https://res.cloudinary.com/dcx1glkit/image/upload/v1234567890/fixmo/service-photos/service_45_1704447600000_0.jpg",
        "service_id": 123,
        "uploadedAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "id": 2,
        "imageUrl": "https://res.cloudinary.com/dcx1glkit/image/upload/v1234567891/fixmo/service-photos/service_45_1704447600001_1.jpg",
        "service_id": 123,
        "uploadedAt": "2024-01-15T10:31:00.000Z"
      }
    ],
    "specific_services": [...],
    "serviceProvider": {...}
  }
}
```

---

### Error Responses

#### 400 Bad Request - Exceeds Photo Limit

```json
{
  "success": false,
  "message": "Maximum 5 photos allowed. You currently have 3 photo(s) and are trying to add 3 more."
}
```

#### 404 Not Found - Service Not Found

```json
{
  "success": false,
  "message": "Service not found or access denied"
}
```

#### 500 Internal Server Error - Upload Failed

```json
{
  "success": false,
  "message": "Error uploading service photos. Please try again."
}
```

---

## Validation Rules

### Photo Count Validation

- **Maximum 5 photos per service**
- **Calculation**: `(existing_photos - removed_photos + new_photos) <= 5`
- **Error if exceeded**: Returns 400 error with details

### Photo Removal Validation

- **Photo IDs must exist**: Backend verifies photo IDs belong to the service
- **Owner validation**: Only the service owner can remove photos
- **Cloudinary cleanup**: Automatically deletes removed photos from cloud storage

### Photo Upload Validation

- **File types**: Images only (JPEG, PNG, GIF, WebP)
- **File size**: Max 10MB per photo
- **Upload limit**: Max 5 photos per request

---

## Mobile App Implementation

### React Native / TypeScript Example

```typescript
import * as ImagePicker from 'expo-image-picker';

// Pick new photos
const pickPhotos = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    quality: 0.8,
  });

  if (!result.canceled) {
    return result.assets;
  }
  return [];
};

// Update service with photo changes
const updateServiceWithPhotos = async (
  serviceId: number,
  data: {
    service_description: string;
    service_startingprice: number;
    warranty_days?: number;
    photosToRemove?: number[]; // IDs of photos to delete
    newPhotos?: any[]; // New photos to upload
  }
) => {
  const formData = new FormData();

  // Add text fields
  formData.append('service_description', data.service_description);
  formData.append('service_startingprice', data.service_startingprice.toString());
  
  if (data.warranty_days) {
    formData.append('warranty_days', data.warranty_days.toString());
  }

  // Add photos to remove
  if (data.photosToRemove && data.photosToRemove.length > 0) {
    formData.append('photos_to_remove', JSON.stringify(data.photosToRemove));
  }

  // Add new photos
  if (data.newPhotos && data.newPhotos.length > 0) {
    data.newPhotos.forEach((photo, index) => {
      const fileUri = photo.uri;
      const fileName = fileUri.split('/').pop() || `photo_${index}.jpg`;
      const fileType = `image/${fileName.split('.').pop()}`;

      formData.append('service_photos', {
        uri: fileUri,
        name: fileName,
        type: fileType,
      } as any);
    });
  }

  // Send request
  const response = await fetch(
    `https://your-api.com/api/services/services/${serviceId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${yourJwtToken}`,
      },
      body: formData,
    }
  );

  return response.json();
};

// Usage example
const handleUpdateService = async () => {
  try {
    const newPhotos = await pickPhotos();
    
    const result = await updateServiceWithPhotos(123, {
      service_description: 'Updated description',
      service_startingprice: 1500,
      warranty_days: 30,
      photosToRemove: [5, 7], // Remove photos with IDs 5 and 7
      newPhotos: newPhotos,
    });

    console.log('Service updated:', result);
  } catch (error) {
    console.error('Update failed:', error);
  }
};
```

---

### Flutter / Dart Example

```dart
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

Future<void> updateServiceWithPhotos({
  required int serviceId,
  required String description,
  required double startingPrice,
  int? warrantyDays,
  List<int>? photosToRemove,
  List<XFile>? newPhotos,
}) async {
  var uri = Uri.parse('https://your-api.com/api/services/services/$serviceId');
  var request = http.MultipartRequest('PUT', uri);

  // Add headers
  request.headers['Authorization'] = 'Bearer $yourJwtToken';

  // Add text fields
  request.fields['service_description'] = description;
  request.fields['service_startingprice'] = startingPrice.toString();
  
  if (warrantyDays != null) {
    request.fields['warranty_days'] = warrantyDays.toString();
  }

  // Add photos to remove
  if (photosToRemove != null && photosToRemove.isNotEmpty) {
    request.fields['photos_to_remove'] = jsonEncode(photosToRemove);
  }

  // Add new photos
  if (newPhotos != null && newPhotos.isNotEmpty) {
    for (var photo in newPhotos) {
      var multipartFile = await http.MultipartFile.fromPath(
        'service_photos',
        photo.path,
      );
      request.files.add(multipartFile);
    }
  }

  // Send request
  var response = await request.send();
  var responseData = await response.stream.bytesToString();
  
  print('Response: $responseData');
}
```

---

## UI/UX Recommendations

### Photo Gallery Management

1. **Display Current Photos**:
   - Show all existing photos in a grid
   - Add delete icon/button on each photo
   - Show photo count (e.g., "3 of 5 photos")

2. **Add Photos Button**:
   - Disable if already at 5 photos
   - Show remaining slots (e.g., "Add up to 2 more photos")

3. **Photo Selection States**:
   - **Selected for removal**: Show red overlay or checkmark
   - **Newly added**: Show green border or "New" badge
   - **Existing**: Normal display

4. **Validation Messages**:
   - "You can add up to 5 photos total"
   - "Remove 2 photos to add 3 new ones"
   - "Photo limit reached (5/5)"

5. **Confirmation Dialog**:
   - "Are you sure you want to remove X photo(s)?"
   - Show preview of photos being removed

### Example UI Flow

```
[Service Edit Screen]

┌─────────────────────────────────────┐
│ Service Description                 │
│ [Text Input]                        │
├─────────────────────────────────────┤
│ Starting Price: 1500                │
├─────────────────────────────────────┤
│ Warranty Days: 30                   │
├─────────────────────────────────────┤
│ Photos (3 of 5)                     │
│ ┌───┐ ┌───┐ ┌───┐                  │
│ │ 📷│ │ 📷│ │ 📷│  [+ Add]         │
│ │ ❌│ │ ❌│ │ ❌│                   │
│ └───┘ └───┘ └───┘                  │
├─────────────────────────────────────┤
│        [Update Service]             │
└─────────────────────────────────────┘
```

---

## Backend Flow

### Photo Update Process

```
1. Receive Update Request
   ├── Parse FormData
   ├── Extract photos_to_remove array
   └── Extract new service_photos files

2. Validation
   ├── Verify service exists
   ├── Verify provider owns service
   ├── Calculate: existing - removed + new <= 5
   └── Return error if validation fails

3. Transaction Start
   ├── Update service listing (description, price, warranty)
   ├── Update specific service (description)
   │
   ├── Remove Photos (if any)
   │   ├── Query photos from database
   │   ├── Delete from Cloudinary
   │   └── Delete from database
   │
   ├── Add Photos (if any)
   │   ├── Upload to Cloudinary
   │   └── Save URLs to database
   │
   └── Update certificates (if provided)

4. Transaction Commit
   └── Return updated service with all photos

5. Error Handling
   ├── Rollback transaction on failure
   └── Return error response
```

---

## Database Schema

### ServicePhoto Table

```prisma
model ServicePhoto {
  id            Int            @id @default(autoincrement())
  imageUrl      String         // Cloudinary URL
  service       ServiceListing @relation(fields: [service_id], references: [service_id])
  service_id    Int
  uploadedAt    DateTime       @default(now())
}
```

### Relationships

- **ServiceListing** → has many → **ServicePhoto**
- **ServicePhoto** → belongs to → **ServiceListing**

---

## Cloudinary Integration

### Upload Configuration

- **Folder**: `fixmo/service-photos`
- **Naming**: `service_{providerId}_{timestamp}_{index}`
- **Quality**: Auto
- **Format**: Auto
- **Resource Type**: Auto (supports images and videos)

### Delete Process

1. Extract public ID from Cloudinary URL
2. Call Cloudinary destroy API
3. Remove database record
4. Continue even if Cloudinary delete fails (graceful degradation)

### Example Cloudinary URLs

```
https://res.cloudinary.com/dcx1glkit/image/upload/v1234567890/fixmo/service-photos/service_45_1704447600000_0.jpg
https://res.cloudinary.com/dcx1glkit/image/upload/v1234567891/fixmo/service-photos/service_45_1704447600001_1.jpg
```

---

## Testing Guide

### Test Case 1: Add Photos to Empty Service

**Setup**: Service has 0 photos

**Action**: Upload 5 photos

**Expected Result**:
- ✅ All 5 photos uploaded successfully
- ✅ Photos saved to Cloudinary
- ✅ Photo URLs saved to database
- ✅ Response includes all 5 photos

---

### Test Case 2: Replace All Photos

**Setup**: Service has 3 photos (IDs: 1, 2, 3)

**Action**: Remove all 3, upload 5 new photos

**Expected Result**:
- ✅ Old photos deleted from Cloudinary
- ✅ Old photos removed from database
- ✅ New 5 photos uploaded
- ✅ Service now has 5 photos

---

### Test Case 3: Exceed Photo Limit

**Setup**: Service has 4 photos

**Action**: Upload 2 new photos without removing any

**Expected Result**:
- ❌ Returns 400 error
- ❌ Message: "Maximum 5 photos allowed. You currently have 4 photo(s) and are trying to add 2 more."
- ❌ No changes made

---

### Test Case 4: Remove Non-Existent Photo

**Setup**: Service has photos with IDs 1, 2, 3

**Action**: Try to remove photo ID 999

**Expected Result**:
- ✅ No error (graceful handling)
- ✅ Only existing photos are processed
- ✅ Service photos remain unchanged

---

### Test Case 5: Update Without Photo Changes

**Setup**: Service has 3 photos

**Action**: Update description and price only

**Expected Result**:
- ✅ Service details updated
- ✅ Photos remain unchanged (3 photos)
- ✅ No Cloudinary operations

---

## Error Handling

### Common Errors

| Error | Status | Description | Solution |
|-------|--------|-------------|----------|
| Photo limit exceeded | 400 | Trying to add more than 5 photos total | Remove photos or reduce new uploads |
| Service not found | 404 | Invalid serviceId or not owned by provider | Verify serviceId and ownership |
| Upload failed | 500 | Cloudinary upload error | Check internet connection, retry |
| Invalid photo format | 400 | Unsupported file type | Use JPEG, PNG, GIF, or WebP |
| File too large | 400 | Photo exceeds 10MB | Compress image before upload |

---

## Security Considerations

1. **Authentication**: JWT token required for all updates
2. **Authorization**: Provider can only update their own services
3. **Photo Ownership**: Can only remove photos belonging to their service
4. **File Type Validation**: Server validates image formats
5. **File Size Limits**: Max 10MB per photo to prevent abuse
6. **Cloudinary Security**: Uses secure URLs with authentication

---

## Performance Optimization

### Best Practices

1. **Image Compression**: Compress images on client side before upload
2. **Batch Operations**: Upload multiple photos in single request
3. **Lazy Loading**: Load photos progressively in UI
4. **Caching**: Cache photo URLs to reduce API calls
5. **Thumbnail Generation**: Use Cloudinary transformations for thumbnails

### Cloudinary Transformations

```
// Thumbnail (200x200)
https://res.cloudinary.com/.../w_200,h_200,c_fill/service_photo.jpg

// Medium (800x600)
https://res.cloudinary.com/.../w_800,h_600,c_fit/service_photo.jpg

// Optimized for web
https://res.cloudinary.com/.../q_auto,f_auto/service_photo.jpg
```

---

## Related Endpoints

### Get Service by ID

**Endpoint**: `GET /api/services/services/:serviceId`

Returns service with all photos:

```json
{
  "service_id": 123,
  "service_photos": [...]
}
```

### Create Service

**Endpoint**: `POST /api/services/services`

Supports photo upload on creation (max 5 photos).

### Delete Service

**Endpoint**: `DELETE /api/services/services/:serviceId`

Automatically deletes all associated photos from Cloudinary and database.

---

## Changelog

### Version 1.0.0 (Current)

- ✅ Add new photos to existing service
- ✅ Remove photos by ID
- ✅ Maximum 5 photos validation
- ✅ Cloudinary integration
- ✅ Automatic cleanup on removal
- ✅ Transaction support for data integrity

---

## Support

For issues or questions about the service photo editing system:
1. Check validation rules and photo limits
2. Verify JWT token is valid and not expired
3. Ensure photo IDs are correct
4. Check Cloudinary configuration
5. Review server logs for detailed error messages

---

**Last Updated**: January 2024  
**Version**: 1.0.0  
**Maintained by**: Fixmo Backend Team
