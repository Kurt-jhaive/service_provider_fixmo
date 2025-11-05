# Service Provider Profile Edit API - Implementation Guide

## 📋 Overview

The service provider profile editing feature uses a **two-step OTP verification process** to securely update provider information including email, phone number, location, and exact location.

## 🔐 Authentication Required

All endpoints require JWT authentication token in the Authorization header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## 📡 API Endpoints

### Step 1: Request OTP for Profile Update

**Endpoint:** `POST /api/serviceProvider/profile/request-otp`

**Description:** Sends an OTP to the provider's registered email to initiate profile update.

**Headers:**
```json
{
  "Authorization": "Bearer <JWT_TOKEN>",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{}
```
> Note: No body required. The provider's email is extracted from the JWT token.

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "OTP sent to your email successfully",
  "email": "provider@example.com"
}
```

**Error Responses:**

- **401 Unauthorized** - Invalid or missing JWT token
  ```json
  {
    "success": false,
    "message": "Unauthorized"
  }
  ```

- **404 Not Found** - Provider not found
  ```json
  {
    "success": false,
    "message": "Provider not found"
  }
  ```

- **500 Internal Server Error** - Failed to send OTP
  ```json
  {
    "success": false,
    "message": "Failed to send OTP"
  }
  ```

---

### Step 2: Verify OTP and Update Profile

**Endpoint:** `PUT /api/serviceProvider/profile`

**Description:** Verifies the OTP and updates provider profile information.

**Headers:**
```json
{
  "Authorization": "Bearer <JWT_TOKEN>",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "otp": "123456",
  "provider_phone_number": "+1234567890",
  "provider_email": "newemail@example.com",
  "provider_location": "New York, USA",
  "exact_location": "40.7128,-74.0060"
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `otp` | string | **Yes** | 6-digit OTP code sent to email |
| `provider_phone_number` | string | No | New phone number (must be unique) |
| `provider_email` | string | No | New email address (must be unique) |
| `provider_location` | string | No | Human-readable location (e.g., "New York, USA") |
| `exact_location` | string | No | Latitude and longitude (e.g., "40.7128,-74.0060") |

> **Note:** At least one field (besides OTP) must be provided for update.

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Provider profile updated successfully",
  "data": {
    "provider_id": 123,
    "provider_first_name": "John",
    "provider_last_name": "Doe",
    "provider_userName": "john_doe_provider",
    "provider_email": "newemail@example.com",
    "provider_phone_number": "+1234567890",
    "provider_location": "New York, USA",
    "exact_location": "40.7128,-74.0060",
    "provider_profile_photo": "/uploads/profiles/photo.jpg"
  }
}
```

**Error Responses:**

- **400 Bad Request** - Invalid OTP
  ```json
  {
    "success": false,
    "message": "Invalid or expired OTP"
  }
  ```

- **400 Bad Request** - No fields to update
  ```json
  {
    "success": false,
    "message": "At least one field (provider_phone_number, provider_email, provider_location, or exact_location) is required"
  }
  ```

- **400 Bad Request** - Email already exists
  ```json
  {
    "success": false,
    "message": "Email is already registered to another provider"
  }
  ```

- **400 Bad Request** - Phone already exists
  ```json
  {
    "success": false,
    "message": "Phone number is already registered to another provider"
  }
  ```

- **401 Unauthorized** - Invalid or missing JWT token
  ```json
  {
    "success": false,
    "message": "Unauthorized"
  }
  ```

- **404 Not Found** - Provider not found
  ```json
  {
    "success": false,
    "message": "Provider not found"
  }
  ```

---

## 🔄 Complete Flow Example

### Using cURL:

#### Step 1: Request OTP
```bash
curl -X POST "http://localhost:8080/api/serviceProvider/profile/request-otp" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### Step 2: Verify OTP and Update Profile
```bash
curl -X PUT "http://localhost:8080/api/serviceProvider/profile" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "otp": "123456",
    "provider_phone_number": "+1234567890",
    "provider_location": "New York, USA",
    "exact_location": "40.7128,-74.0060"
  }'
```

---

## 📱 Frontend Implementation Examples

### React/React Native Example

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api/serviceProvider';

// Step 1: Request OTP
const requestProfileUpdateOTP = async (token) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/profile/request-otp`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('OTP sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to send OTP:', error.response?.data);
    throw error;
  }
};

// Step 2: Verify OTP and Update Profile
const updateProviderProfile = async (token, profileData) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/profile`,
      profileData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Profile updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to update profile:', error.response?.data);
    throw error;
  }
};

// Complete flow usage
const handleProfileUpdate = async (token, newProfileData) => {
  try {
    // Step 1: Request OTP
    await requestProfileUpdateOTP(token);
    alert('OTP sent to your email. Please check your inbox.');
    
    // Wait for user to enter OTP (you'd get this from a form input)
    const otpCode = prompt('Enter the OTP code:');
    
    // Step 2: Update profile with OTP
    const updatedProfile = await updateProviderProfile(token, {
      otp: otpCode,
      ...newProfileData
    });
    
    alert('Profile updated successfully!');
    return updatedProfile;
  } catch (error) {
    alert('Failed to update profile: ' + error.message);
  }
};

// Example usage
const token = 'your_jwt_token_here';
const newData = {
  provider_phone_number: '+1234567890',
  provider_location: 'New York, USA',
  exact_location: '40.7128,-74.0060'
};

handleProfileUpdate(token, newData);
```

---

### JavaScript/Fetch API Example

```javascript
// Step 1: Request OTP
async function requestOTP(jwtToken) {
  const response = await fetch('http://localhost:8080/api/serviceProvider/profile/request-otp', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Failed to send OTP');
  }
  
  return data;
}

// Step 2: Update Profile
async function updateProfile(jwtToken, otp, updates) {
  const response = await fetch('http://localhost:8080/api/serviceProvider/profile', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      otp: otp,
      ...updates
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Failed to update profile');
  }
  
  return data;
}

// Usage
(async () => {
  try {
    const token = 'your_jwt_token';
    
    // Request OTP
    await requestOTP(token);
    console.log('OTP sent to email');
    
    // Get OTP from user input
    const otp = '123456'; // Get this from user input
    
    // Update profile
    const result = await updateProfile(token, otp, {
      provider_phone_number: '+1234567890',
      provider_location: 'New York, USA'
    });
    
    console.log('Profile updated:', result.data);
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
```

---

## 🔒 Security Features

### 1. OTP Verification
- OTP is sent to the provider's registered email
- OTP expires after a certain time (configured in backend)
- OTP is single-use and deleted after successful verification

### 2. Uniqueness Validation
- **Email uniqueness:** Checks both provider and customer tables
- **Phone uniqueness:** Checks both provider and customer tables
- Prevents duplicate registrations across the system

### 3. JWT Authentication
- All endpoints require valid JWT token
- Provider ID is extracted from token to ensure users can only update their own profile

### 4. Cross-Account Prevention
- System checks if email/phone exists in customer accounts
- Prevents service providers from using credentials already registered as customers

---

## ⚠️ Important Notes

### OTP Expiration
- OTPs typically expire after 10 minutes (configurable)
- Users must complete Step 2 before OTP expires
- If expired, users must request a new OTP (repeat Step 1)

### Rate Limiting
- Consider implementing rate limiting on OTP requests to prevent abuse
- Typical limit: 3-5 OTP requests per hour per provider

### Email Delivery
- OTPs are sent via email
- Check spam/junk folder if not received
- Ensure email service is properly configured in backend

### Partial Updates
- You can update one or multiple fields at once
- Only include fields you want to update in the request
- Unchanged fields will retain their current values

### Testing OTP in Development
- Check backend console logs for OTP codes during development
- In production, OTPs are only sent via email (not logged)

---

## 🧪 Testing Scenarios

### Test Case 1: Update Phone Number Only
```json
{
  "otp": "123456",
  "provider_phone_number": "+9876543210"
}
```

### Test Case 2: Update Email Only
```json
{
  "otp": "123456",
  "provider_email": "newemail@example.com"
}
```

### Test Case 3: Update Location Only
```json
{
  "otp": "123456",
  "provider_location": "Los Angeles, CA",
  "exact_location": "34.0522,-118.2437"
}
```

### Test Case 4: Update All Fields
```json
{
  "otp": "123456",
  "provider_phone_number": "+1234567890",
  "provider_email": "newemail@example.com",
  "provider_location": "Miami, FL",
  "exact_location": "25.7617,-80.1918"
}
```

### Test Case 5: Invalid OTP (Should Fail)
```json
{
  "otp": "000000",
  "provider_phone_number": "+1234567890"
}
```
**Expected:** 400 Bad Request - "Invalid or expired OTP"

### Test Case 6: Duplicate Email (Should Fail)
```json
{
  "otp": "123456",
  "provider_email": "existing@example.com"
}
```
**Expected:** 400 Bad Request - "Email is already registered"

---

## 📊 Database Impact

### Fields Updated in `ServiceProviderDetails` Table:

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `provider_email` | String | No | Provider's email address |
| `provider_phone_number` | String | No | Provider's phone number |
| `provider_location` | String | Yes | Human-readable location |
| `exact_location` | String | Yes | GPS coordinates (latitude,longitude) |

### Related Tables:
- **OTP Storage:** Temporary OTP codes stored and deleted after use
- **Uniqueness Checks:** Cross-references with `User` table for customer accounts

---

## 🐛 Troubleshooting

### Problem: "OTP not received"
**Solutions:**
- Check email spam/junk folder
- Verify email service is running on backend
- Check backend logs for email sending errors
- Ensure provider's email in database is correct

### Problem: "Invalid or expired OTP"
**Solutions:**
- Request a new OTP (OTP may have expired)
- Ensure OTP is entered correctly (6 digits)
- Check if OTP was already used (single-use)

### Problem: "Email already registered"
**Solutions:**
- Choose a different email address
- Check if email is registered as customer or another provider
- Contact admin if you believe this is an error

### Problem: "Phone number already registered"
**Solutions:**
- Choose a different phone number
- Check if phone is registered as customer or another provider
- Contact admin if you believe this is an error

### Problem: "Unauthorized"
**Solutions:**
- Ensure JWT token is valid and not expired
- Login again to get a fresh token
- Check Authorization header format: `Bearer <token>`

---

## 📞 Support

For additional help or questions:
- Check backend logs for detailed error messages
- Review JWT token expiration settings
- Ensure all required environment variables are configured
- Verify database connectivity

---

## 🔄 Version History

- **v1.0** - Initial implementation with two-step OTP verification
- **Current** - Supports email, phone, location, and exact location updates

---

## 🎯 Next Steps

After successful profile update:
1. Frontend should update local state with new profile data
2. Consider refreshing JWT token if email changed
3. Display success message to user
4. Redirect to profile view page

---

**✅ Implementation Complete!**

This endpoint is fully functional and ready to use. Follow the examples above to integrate it into your mobile app or web application.
