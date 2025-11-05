# 🚫 Customer No-Show Reporting API - Complete Documentation

## 📋 Overview

The Customer No-Show Reporting feature allows service providers to report when a customer fails to show up for a scheduled appointment. This system includes:

- **45-minute grace period** after appointment start time
- **Photo evidence requirement** for proof
- **Description requirement** for context
- **Automatic penalty detection** for repeat offenders
- **Appointment status update** to `user_no_show`

---

## 🔐 Authentication Required

**JWT Token:** Provider authentication token required in Authorization header

```
Authorization: Bearer <JWT_TOKEN>
```

---

## 📡 API Endpoint

### Report Customer No-Show

**Endpoint:** `POST /api/serviceProvider/appointments/:appointmentId/report-no-show`

**Method:** `POST`

**Content-Type:** `multipart/form-data` (for file upload)

**Description:** Allows a service provider to report a customer no-show with photo evidence.

---

## 📥 Request Parameters

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `appointmentId` | integer | **Yes** | The ID of the appointment to report |

### Headers

| Header | Value | Required | Description |
|--------|-------|----------|-------------|
| `Authorization` | `Bearer <JWT_TOKEN>` | **Yes** | Provider authentication token |
| `Content-Type` | `multipart/form-data` | **Yes** | Required for file upload |

### Form Data Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `evidence_photo` | file | **Yes** | Photo evidence of the no-show (JPG, PNG) |
| `description` | string | **Yes** | Detailed description of the situation |

---

## ✅ Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Customer no-show reported successfully",
  "data": {
    "appointment": {
      "appointment_id": 123,
      "status": "user_no_show",
      "customer_name": "John Doe",
      "service": "Plumbing Service",
      "scheduled_date": "2025-01-05T10:00:00.000Z"
    },
    "report": {
      "appointment_id": 123,
      "reported_by": "provider",
      "reporter_id": 456,
      "evidence_photo": "https://res.cloudinary.com/your-cloud/image/upload/v123/no-show-evidence/photo.jpg",
      "description": "Customer did not answer door or phone calls after waiting 45 minutes",
      "reported_at": "2025-01-05T10:50:00.000Z",
      "time_elapsed_minutes": 50
    }
  }
}
```

---

## ❌ Error Responses

### 400 Bad Request - Missing Required Fields

```json
{
  "success": false,
  "message": "Photo evidence and description are required to report a no-show"
}
```

### 400 Bad Request - Invalid Appointment Status

```json
{
  "success": false,
  "message": "Cannot report no-show. Appointment must be in \"On the Way\" status. Current status: scheduled"
}
```

**Note:** Appointment must be in `"On the Way"` status to report no-show.

### 400 Bad Request - Grace Period Not Met

```json
{
  "success": false,
  "message": "Grace period not met. You can report a no-show after 45 minutes. Time elapsed: 30 minutes",
  "timeElapsed": 30,
  "gracePeriod": 45,
  "canReportAt": "2025-01-05T10:45:00.000Z"
}
```

**Grace Period Rule:** Must wait 45 minutes after the scheduled appointment time before reporting.

### 404 Not Found - Appointment Not Found

```json
{
  "success": false,
  "message": "Appointment not found or does not belong to this provider"
}
```

### 401 Unauthorized - Invalid Token

```json
{
  "success": false,
  "message": "Unauthorized"
}
```

### 500 Internal Server Error - Upload Failed

```json
{
  "success": false,
  "message": "Failed to upload evidence photo"
}
```

### 500 Internal Server Error - Server Error

```json
{
  "success": false,
  "message": "Failed to report no-show",
  "error": "Error details here"
}
```

---

## 🔄 Complete Workflow

### Step-by-Step Process

```
1. Provider marks appointment as "On the Way"
   ↓
2. Provider arrives at customer location
   ↓
3. Customer is not present/doesn't answer
   ↓
4. Provider waits 45 minutes (grace period)
   ↓
5. Provider takes photo evidence
   ↓
6. Provider calls API with photo + description
   ↓
7. System validates:
   - Appointment belongs to provider ✅
   - Appointment status is "On the Way" ✅
   - 45 minutes have passed ✅
   - Photo and description provided ✅
   ↓
8. System uploads photo to Cloudinary
   ↓
9. System updates appointment status to "user_no_show"
   ↓
10. System records penalty violation
   ↓
11. System checks for repeat offenses
   ↓
12. Response sent to provider
```

---

## 📱 Frontend Implementation Examples

### React Native Example

```javascript
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';

const reportCustomerNoShow = async (appointmentId, description, photoUri) => {
  try {
    // Create FormData
    const formData = new FormData();
    
    // Add description
    formData.append('description', description);
    
    // Add photo
    formData.append('evidence_photo', {
      uri: photoUri,
      type: 'image/jpeg',
      name: 'evidence.jpg',
    });

    // Get JWT token from storage
    const token = await AsyncStorage.getItem('providerToken');

    // Make API call
    const response = await axios.post(
      `https://your-api.com/api/serviceProvider/appointments/${appointmentId}/report-no-show`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    console.log('No-show reported:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('Failed to report no-show:', error.response?.data);
    throw error;
  }
};

// Usage in component
const handleReportNoShow = async () => {
  try {
    // Pick image
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.cancelled) {
      // Get description from user input
      const description = descriptionInput.current.value;
      
      // Report no-show
      await reportCustomerNoShow(appointmentId, description, result.uri);
      
      Alert.alert('Success', 'No-show reported successfully');
      navigation.goBack();
    }
  } catch (error) {
    if (error.response?.status === 400) {
      Alert.alert('Error', error.response.data.message);
    } else {
      Alert.alert('Error', 'Failed to report no-show');
    }
  }
};
```

### JavaScript/Fetch API Example

```javascript
async function reportNoShow(appointmentId, description, photoFile) {
  const formData = new FormData();
  formData.append('description', description);
  formData.append('evidence_photo', photoFile);

  const token = localStorage.getItem('providerToken');

  const response = await fetch(
    `https://your-api.com/api/serviceProvider/appointments/${appointmentId}/report-no-show`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to report no-show');
  }

  return data;
}

// Usage with HTML file input
document.getElementById('reportForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const appointmentId = document.getElementById('appointmentId').value;
  const description = document.getElementById('description').value;
  const photoFile = document.getElementById('photoInput').files[0];

  try {
    const result = await reportNoShow(appointmentId, description, photoFile);
    alert('No-show reported successfully!');
    console.log(result);
  } catch (error) {
    alert('Error: ' + error.message);
  }
});
```

---

## 🧪 Testing with cURL

### Basic cURL Example

```bash
curl -X POST "http://localhost:8080/api/serviceProvider/appointments/123/report-no-show" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "description=Customer did not answer door or phone calls after 45 minutes" \
  -F "evidence_photo=@/path/to/photo.jpg"
```

### With Verbose Output

```bash
curl -X POST "http://localhost:8080/api/serviceProvider/appointments/123/report-no-show" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "description=Customer not present at location. Waited 50 minutes." \
  -F "evidence_photo=@/path/to/evidence.jpg" \
  -v
```

---

## 🧪 Testing with Postman

### Setup

1. **Method:** POST
2. **URL:** `{{base_url}}/api/serviceProvider/appointments/{{appointmentId}}/report-no-show`
3. **Headers:**
   - `Authorization`: `Bearer {{provider_token}}`
4. **Body:** form-data
   - Key: `evidence_photo`, Type: File, Value: [Select Image]
   - Key: `description`, Type: Text, Value: "Customer did not show up..."

### Test Scenarios

#### Scenario 1: Successful Report (Happy Path)

**Pre-conditions:**
- Appointment exists
- Appointment status is "On the Way"
- 45+ minutes have passed since scheduled time
- Provider owns the appointment

**Request:**
```
POST /api/serviceProvider/appointments/123/report-no-show
Authorization: Bearer valid_token

Form Data:
- evidence_photo: photo.jpg
- description: "Customer not at location after waiting 50 minutes"
```

**Expected Response:** 200 OK with success data

#### Scenario 2: Grace Period Not Met (Should Fail)

**Pre-conditions:**
- Less than 45 minutes since scheduled time

**Expected Response:** 400 Bad Request
```json
{
  "success": false,
  "message": "Grace period not met...",
  "timeElapsed": 30,
  "gracePeriod": 45
}
```

#### Scenario 3: Wrong Appointment Status (Should Fail)

**Pre-conditions:**
- Appointment status is "scheduled" or "completed" (not "On the Way")

**Expected Response:** 400 Bad Request
```json
{
  "success": false,
  "message": "Cannot report no-show. Appointment must be in \"On the Way\" status..."
}
```

#### Scenario 4: Missing Photo Evidence (Should Fail)

**Request:**
```
POST /api/serviceProvider/appointments/123/report-no-show
Authorization: Bearer valid_token

Form Data:
- description: "Customer not present"
(No evidence_photo)
```

**Expected Response:** 400 Bad Request
```json
{
  "success": false,
  "message": "Photo evidence and description are required to report a no-show"
}
```

---

## 🔒 Business Rules & Validation

### 1. Grace Period Rule
- **Duration:** 45 minutes
- **Starts from:** Scheduled appointment time
- **Purpose:** Allows customer reasonable time for delays
- **Calculation:** `current_time - scheduled_time >= 45 minutes`

### 2. Appointment Status Rule
- **Required Status:** `"On the Way"`
- **Why:** Ensures provider actually attempted to fulfill appointment
- **Invalid Statuses:** scheduled, confirmed, in-progress, completed, cancelled

### 3. Evidence Requirements
- **Photo:** Required - Must be uploaded
- **Description:** Required - Must be non-empty string
- **Purpose:** Provides verifiable proof for customer penalties

### 4. Ownership Validation
- Appointment must belong to the authenticated provider
- Extracted from JWT token: `req.userId`

### 5. Automatic Actions
- Appointment status updated to `"user_no_show"`
- Penalty violation recorded for customer
- System checks for repeat offenses
- Customer may receive penalty points

---

## 📊 Database Impact

### Appointment Table Update

| Field | Before | After |
|-------|--------|-------|
| `appointment_status` | `"On the Way"` | `"user_no_show"` |
| `cancellation_reason` | `null` | `"Provider reported customer no-show: [description]"` |

### Penalty System Triggered

1. **No-Show Violation Recorded**
   - Type: `USER_NO_SHOW`
   - Customer ID recorded
   - Appointment ID linked
   - Timestamp recorded

2. **Repeat Offense Check**
   - System counts no-shows in time window
   - If threshold exceeded, additional penalties applied

---

## ⚠️ Important Notes

### For Service Providers

1. **Wait Full 45 Minutes:** Do not report early or request will be rejected
2. **Take Clear Photo:** Photo should show:
   - Timestamp/clock if possible
   - Location/address
   - Your presence at location (optional)
3. **Write Clear Description:** Include:
   - What you did (knocked, called, waited)
   - How long you waited
   - Any attempts to contact customer
4. **One Report Per Appointment:** Cannot report same appointment twice

### For Customers

1. **No-Show Consequences:**
   - Penalty points added
   - May affect future booking ability
   - Repeat offenses lead to suspension
2. **Dispute Process:** (If implemented)
   - Customer can view evidence
   - Can submit counter-evidence
   - Admin reviews and makes final decision

---

## 🐛 Troubleshooting

### Problem: "Grace period not met"

**Solution:**
- Check scheduled appointment time
- Calculate exact time elapsed
- Wait until 45 minutes have passed
- Response includes `canReportAt` timestamp

### Problem: "Photo upload failed"

**Solution:**
- Check image file size (should be < 5MB)
- Ensure image format is JPG or PNG
- Check network connection
- Verify Cloudinary configuration on backend

### Problem: "Appointment must be in On the Way status"

**Solution:**
- Update appointment status to "On the Way" first
- Then wait grace period
- Then report no-show
- Status flow: scheduled → confirmed → On the Way → (report no-show)

### Problem: "Appointment not found"

**Solution:**
- Verify appointmentId is correct
- Ensure appointment belongs to your provider account
- Check if appointment was already cancelled/completed

### Problem: "Unauthorized"

**Solution:**
- Check JWT token is valid
- Ensure token hasn't expired
- Login again to get fresh token
- Verify Authorization header format: `Bearer <token>`

---

## 📈 Penalty System Integration

### What Happens After Reporting

1. **Immediate:**
   - Appointment marked as `user_no_show`
   - No-show violation recorded

2. **Penalty Detection:**
   - System checks customer's no-show history
   - Counts no-shows in last 90 days
   - Applies penalty points based on frequency

3. **Thresholds (Example):**
   - 1st no-show: Warning (5 points)
   - 2nd no-show: Minor penalty (10 points)
   - 3rd no-show: Major penalty (20 points)
   - 4+ no-shows: Account suspension

4. **Customer Notification:**
   - Email sent about no-show report
   - Penalty points deducted
   - Booking restrictions may apply

---

## 🎯 Best Practices

### For Providers

1. **Document Everything:**
   - Take multiple photos if needed
   - Include timestamps
   - Note exact actions taken

2. **Attempt Contact:**
   - Call customer phone
   - Knock on door multiple times
   - Send message if possible
   - Document all attempts

3. **Be Professional:**
   - Write factual descriptions
   - Avoid emotional language
   - Stick to facts: times, actions, outcomes

4. **Follow Process:**
   - Always change status to "On the Way" first
   - Wait full 45 minutes
   - Gather evidence
   - Submit report

### For System Administrators

1. **Monitor Reports:**
   - Review no-show patterns
   - Check for abuse
   - Validate evidence quality

2. **Handle Disputes:**
   - Review evidence
   - Listen to both sides
   - Make fair decisions

3. **Adjust Thresholds:**
   - Monitor penalty effectiveness
   - Adjust grace period if needed
   - Update point values based on data

---

## 📞 Support & Additional Resources

### Related Endpoints

- `GET /api/serviceProvider/appointments` - List all appointments
- `PUT /api/serviceProvider/appointments/:id/status` - Update appointment status
- `GET /api/serviceProvider/penalty-info` - View customer penalty info

### Related Documentation

- `PENALTY_SYSTEM_GUIDE.md` - Complete penalty system documentation
- `APPOINTMENT_FINISH_UPDATE.md` - Appointment completion documentation
- `NO_SHOW_SYSTEM_UPDATE.md` - No-show system overview

---

## 🔄 API Version

- **Current Version:** v1.0
- **Last Updated:** January 2025
- **Status:** Production Ready ✅

---

## ✅ Implementation Checklist

### Backend (Already Complete)
- [x] Report no-show endpoint
- [x] 45-minute grace period validation
- [x] Photo upload to Cloudinary
- [x] Penalty system integration
- [x] Repeat offense detection
- [x] Error handling

### Mobile App (To Implement)
- [ ] "Report No-Show" button in appointment details
- [ ] Photo capture/upload functionality
- [ ] Description input form
- [ ] Grace period timer display
- [ ] Success/error message handling
- [ ] Evidence photo preview
- [ ] Confirmation dialog

### Testing
- [ ] Test grace period validation
- [ ] Test photo upload
- [ ] Test penalty system trigger
- [ ] Test error scenarios
- [ ] Test with different appointment statuses

---

**🎉 Ready to Implement!**

This endpoint is fully functional and ready to use. Follow the examples above to integrate customer no-show reporting into your service provider mobile application.

For questions or issues, refer to the troubleshooting section or check backend logs for detailed error messages.
