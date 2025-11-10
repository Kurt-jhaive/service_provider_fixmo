# Provider Verification Resubmission Guide

## Overview
Service providers can resubmit their verification documents after rejection or if they need to update their information before approval.

## API Endpoint

```
POST /api/verification/provider/resubmit
```

**Authentication Required:** Yes (Provider JWT token)

---

## Request Format

### Headers
```
Authorization: Bearer <provider_jwt_token>
Content-Type: multipart/form-data
```

### Body Parameters

#### Files (Optional - Upload via Multipart)
- `valid_id` - Valid Government ID photo
- `profile_photo` - Profile photo
- `certificates[]` - Multiple certificate images (array)

#### Form Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `valid_id_url` | String | Yes* | Cloudinary URL of valid ID (if not uploading file) |
| `profile_photo_url` | String | No | Cloudinary URL of profile photo |
| `certificate_urls` | Array | No | Array of certificate Cloudinary URLs |
| `provider_first_name` | String | No | First name |
| `provider_last_name` | String | No | Last name |
| `provider_uli` | String | No | Unified License Identifier |
| `provider_birthday` | Date | No | Birthdate (ISO format) |
| `provider_location` | String | No | General location/city |
| `exact_location` | String | No | Detailed address |

\* Either `valid_id_url` OR `valid_id` file must be provided

---

## What Gets Updated in Database

### Verification Status Reset
```javascript
verification_status: 'pending'
verification_submitted_at: new Date()
rejection_reason: null
verified_by_admin_id: null
verification_reviewed_at: null
```

### Updated Provider Information
- `provider_valid_id` - Valid ID photo URL
- `provider_profile_photo` - Profile photo URL (if provided)
- `provider_first_name` - First name (if provided)
- `provider_last_name` - Last name (if provided)
- `provider_uli` - ULI number (if provided)
- `provider_birthday` - Birthdate (if provided)
- `provider_location` - Location (if provided)
- `provider_exact_location` - Exact address (if provided)

### Certificates
If new certificates are uploaded:
1. All existing certificates are deleted
2. New certificates are created with `certificate_status: 'Pending'`

---

## Response Format

### Success (200)
```json
{
  "success": true,
  "message": "Verification documents re-submitted successfully. Our team will review within 24-48 hours.",
  "data": {
    "provider_id": 123,
    "verification_status": "pending",
    "verification_submitted_at": "2025-11-09T10:30:00.000Z",
    "uploaded_via": "file_upload",
    "certificates_count": 2
  }
}
```

### Error Responses

**400 - Missing Valid ID**
```json
{
  "success": false,
  "message": "Valid ID image is required (either file or URL)"
}
```

**400 - Already Verified**
```json
{
  "success": false,
  "message": "Your account is already verified"
}
```

**404 - Provider Not Found**
```json
{
  "success": false,
  "message": "Provider not found"
}
```

**500 - Upload Error**
```json
{
  "success": false,
  "message": "Failed to upload valid ID image"
}
```

---

## Implementation Examples

### Example 1: Resubmit with File Uploads (React Native)

```javascript
const resubmitVerification = async (providerId) => {
  const formData = new FormData();
  
  // Add files
  formData.append('valid_id', {
    uri: validIdUri,
    type: 'image/jpeg',
    name: 'valid_id.jpg'
  });
  
  formData.append('profile_photo', {
    uri: profilePhotoUri,
    type: 'image/jpeg',
    name: 'profile.jpg'
  });
  
  // Add certificates (multiple)
  certificateUris.forEach((uri, index) => {
    formData.append('certificates', {
      uri: uri,
      type: 'image/jpeg',
      name: `certificate_${index}.jpg`
    });
  });
  
  // Add text fields
  formData.append('provider_first_name', firstName);
  formData.append('provider_last_name', lastName);
  formData.append('provider_uli', uli);
  formData.append('provider_birthday', birthday);
  formData.append('provider_location', location);
  formData.append('exact_location', exactLocation);
  
  try {
    const response = await fetch(
      'https://api.fixmo.com/api/verification/provider/resubmit',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${providerToken}`,
        },
        body: formData
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      Alert.alert('Success', result.message);
      // Navigate to pending verification screen
    } else {
      Alert.alert('Error', result.message);
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to resubmit verification');
  }
};
```

### Example 2: Resubmit with Cloudinary URLs

```javascript
const resubmitWithUrls = async () => {
  const formData = new FormData();
  
  // Use pre-uploaded Cloudinary URLs
  formData.append('valid_id_url', 'https://res.cloudinary.com/.../id.jpg');
  formData.append('profile_photo_url', 'https://res.cloudinary.com/.../profile.jpg');
  
  // Add certificate URLs as JSON array string
  formData.append('certificate_urls', JSON.stringify([
    'https://res.cloudinary.com/.../cert1.jpg',
    'https://res.cloudinary.com/.../cert2.jpg'
  ]));
  
  formData.append('provider_uli', '123456789');
  
  const response = await fetch(
    'https://api.fixmo.com/api/verification/provider/resubmit',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData
    }
  );
  
  return await response.json();
};
```

### Example 3: Axios Implementation

```javascript
import axios from 'axios';

const resubmitVerification = async (files, data) => {
  const formData = new FormData();
  
  // Add files
  if (files.validId) {
    formData.append('valid_id', files.validId);
  }
  
  if (files.profilePhoto) {
    formData.append('profile_photo', files.profilePhoto);
  }
  
  if (files.certificates?.length > 0) {
    files.certificates.forEach(cert => {
      formData.append('certificates', cert);
    });
  }
  
  // Add provider data
  Object.keys(data).forEach(key => {
    if (data[key]) {
      formData.append(key, data[key]);
    }
  });
  
  try {
    const response = await axios.post(
      '/api/verification/provider/resubmit',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

---

## UI/UX Flow Recommendations

### 1. **Check Verification Status**
```javascript
// Before showing resubmit form, check if provider can resubmit
if (provider.verification_status === 'approved') {
  // Show "Already Verified" message
  // Disable resubmission
}

if (provider.verification_status === 'rejected') {
  // Show rejection reason
  // Enable resubmit button
}
```

### 2. **Display Rejection Reason**
```javascript
if (provider.rejection_reason) {
  Alert.alert(
    'Verification Rejected',
    `Reason: ${provider.rejection_reason}\n\nPlease correct the issues and resubmit.`,
    [{ text: 'Resubmit', onPress: () => navigateToResubmit() }]
  );
}
```

### 3. **Form Validation**
```javascript
const validateResubmit = () => {
  if (!validIdFile && !validIdUrl) {
    Alert.alert('Error', 'Valid ID is required');
    return false;
  }
  
  if (provider_uli && !isValidULI(provider_uli)) {
    Alert.alert('Error', 'Invalid ULI format');
    return false;
  }
  
  return true;
};
```

### 4. **Progress Indicator**
```javascript
const [uploading, setUploading] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);

// Show progress during upload
{uploading && (
  <View>
    <ActivityIndicator size="large" />
    <Text>Uploading documents... {uploadProgress}%</Text>
  </View>
)}
```

---

## Testing Checklist

- [ ] Can resubmit after rejection
- [ ] Valid ID is required (file or URL)
- [ ] Profile photo updates correctly
- [ ] ULI updates in database
- [ ] All provider fields update properly
- [ ] Certificates are replaced correctly
- [ ] Verification status resets to 'pending'
- [ ] Previous admin/review data is cleared
- [ ] Cannot resubmit if already approved
- [ ] File uploads work with multipart/form-data
- [ ] URL-only submissions work
- [ ] Mixed file + URL submissions work
- [ ] Error handling for failed uploads
- [ ] Success message displays correctly

---

## Important Notes

1. **File Size Limits**: Ensure images are optimized before upload (recommended < 5MB per file)

2. **Image Formats**: Supported formats: JPG, JPEG, PNG, WebP

3. **ULI Validation**: ULI must be unique - backend will reject if duplicate

4. **Certificates**: Maximum 10 certificates recommended per provider

5. **Cloudinary Folders**: 
   - Valid IDs: `fixmo/verification/providers`
   - Certificates: `fixmo/certificates`

6. **Status Flow**:
   ```
   rejected → resubmit → pending → admin review → approved/rejected
   ```

7. **Admin Notification**: Admins are automatically notified of new resubmissions

---

## Related Endpoints

- `GET /api/verification/provider/status` - Check current verification status
- `POST /api/verification/provider/submit` - Initial verification submission
- `GET /api/provider/profile` - Get provider details including verification status

---

## Support

For implementation questions or issues:
- Backend Developer: Check `src/controller/verificationController.js`
- API Route: `src/route/verificationRoutes.js`
- Schema: `prisma/schema.prisma` (ServiceProviderDetails model)
