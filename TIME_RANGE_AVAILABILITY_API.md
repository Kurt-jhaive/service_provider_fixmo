# ⏰ Time-Range Based Availability API

## Overview
This API allows service providers to add availability with specific time ranges within a day, and prevents double-booking by checking for existing appointments in the requested time slot.

---

## 🆕 New Endpoints

### 1. Add Time-Range Availability

**Endpoint:** `POST /api/availability/time-range`

**Authentication:** Required (Service Provider)

**Description:** Add a new availability slot with a specific time range for a day. The system will prevent overlapping bookings.

#### Request Body

```json
{
  "dayOfWeek": "Monday",
  "startTime": "09:00",
  "endTime": "17:00"
}
```

#### Parameters

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `dayOfWeek` | string | Yes | Day of the week | "Monday", "Tuesday", etc. |
| `startTime` | string | Yes | Start time in HH:MM format (24-hour) | "09:00", "14:30" |
| `endTime` | string | Yes | End time in HH:MM format (24-hour) | "17:00", "18:00" |

#### Valid Days
- Monday
- Tuesday
- Wednesday
- Thursday
- Friday
- Saturday
- Sunday

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Time-range availability added successfully",
  "data": {
    "availability_id": 123,
    "provider_id": 1,
    "dayOfWeek": "Monday",
    "startTime": "09:00",
    "endTime": "17:00",
    "availability_isActive": true
  }
}
```

#### Error Responses

**400 Bad Request - Missing Fields**
```json
{
  "success": false,
  "message": "dayOfWeek, startTime, and endTime are required"
}
```

**400 Bad Request - Invalid Day**
```json
{
  "success": false,
  "message": "Invalid dayOfWeek. Must be one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday"
}
```

**400 Bad Request - Invalid Time Format**
```json
{
  "success": false,
  "message": "Invalid time format. Use HH:MM format (e.g., 09:00, 14:30)"
}
```

**400 Bad Request - Invalid Time Range**
```json
{
  "success": false,
  "message": "End time must be after start time"
}
```

**409 Conflict - Booking Exists**
```json
{
  "success": false,
  "message": "Time conflict: You have existing bookings between 10:00 - 12:00 on Monday",
  "conflictingSlot": {
    "availability_id": 45,
    "startTime": "10:00",
    "endTime": "12:00",
    "bookingCount": 2
  }
}
```

---

### 2. Check Time-Range Availability

**Endpoint:** `GET /api/availability/check/:providerId`

**Authentication:** Not required (Public)

**Description:** Check if a specific time range is available for booking. This prevents customers from booking already occupied time slots.

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `providerId` | integer | Yes | Service provider ID |

#### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `dayOfWeek` | string | Yes | Day of the week | "Monday" |
| `startTime` | string | Yes | Start time in HH:MM format | "14:00" |
| `endTime` | string | Yes | End time in HH:MM format | "15:00" |
| `date` | string | No | Specific date to check (YYYY-MM-DD) | "2025-10-25" |

#### Example Request

```
GET /api/availability/check/1?dayOfWeek=Monday&startTime=14:00&endTime=15:00&date=2025-10-25
```

#### Success Response - Available

```json
{
  "success": true,
  "data": {
    "isAvailable": true,
    "requestedTimeRange": {
      "dayOfWeek": "Monday",
      "startTime": "14:00",
      "endTime": "15:00",
      "date": "2025-10-25"
    },
    "matchingSlot": {
      "availability_id": 123,
      "startTime": "09:00",
      "endTime": "17:00"
    },
    "conflictingAppointments": [],
    "message": "Time range is available for booking"
  }
}
```

#### Success Response - Not Available (Conflict)

```json
{
  "success": true,
  "data": {
    "isAvailable": false,
    "requestedTimeRange": {
      "dayOfWeek": "Monday",
      "startTime": "14:00",
      "endTime": "15:00",
      "date": "2025-10-25"
    },
    "matchingSlot": {
      "availability_id": 123,
      "startTime": "09:00",
      "endTime": "17:00"
    },
    "conflictingAppointments": [
      {
        "appointment_id": 456,
        "scheduled_date": "2025-10-25T14:00:00.000Z",
        "status": "scheduled"
      }
    ],
    "message": "Time range conflicts with 1 existing appointment(s)"
  }
}
```

#### Success Response - No Slot Found

```json
{
  "success": true,
  "data": {
    "isAvailable": false,
    "requestedTimeRange": {
      "dayOfWeek": "Monday",
      "startTime": "20:00",
      "endTime": "21:00",
      "date": "2025-10-25"
    },
    "matchingSlot": null,
    "conflictingAppointments": [],
    "message": "No availability slot found for the requested time range"
  }
}
```

---

## 📱 React Native Implementation

### 1. Add Time-Range Availability

```javascript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const addTimeRangeAvailability = async (dayOfWeek, startTime, endTime) => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    
    const response = await axios.post(
      'https://your-backend-url.com/api/availability/time-range',
      {
        dayOfWeek,
        startTime,
        endTime
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Availability added:', response.data);
    return response.data;
  } catch (error) {
    if (error.response?.status === 409) {
      // Booking conflict
      console.error('❌ Booking conflict:', error.response.data.message);
      alert(error.response.data.message);
    } else {
      console.error('❌ Error adding availability:', error.response?.data || error.message);
    }
    throw error;
  }
};

// Usage
await addTimeRangeAvailability('Monday', '09:00', '17:00');
```

### 2. Check Availability Before Booking

```javascript
const checkTimeRangeAvailability = async (providerId, dayOfWeek, startTime, endTime, date) => {
  try {
    const params = new URLSearchParams({
      dayOfWeek,
      startTime,
      endTime
    });
    
    if (date) {
      params.append('date', date);
    }
    
    const response = await axios.get(
      `https://your-backend-url.com/api/availability/check/${providerId}?${params}`,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const { isAvailable, message, conflictingAppointments } = response.data.data;
    
    if (isAvailable) {
      console.log('✅ Time slot is available!');
      return true;
    } else {
      console.log('❌ Time slot not available:', message);
      if (conflictingAppointments.length > 0) {
        console.log('Conflicts:', conflictingAppointments);
      }
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking availability:', error.response?.data || error.message);
    throw error;
  }
};

// Usage
const date = '2025-10-25'; // Monday
const isAvailable = await checkTimeRangeAvailability(
  1, // provider ID
  'Monday',
  '14:00',
  '15:00',
  date
);

if (isAvailable) {
  // Proceed with booking
} else {
  // Show error message to user
  alert('This time slot is not available. Please select a different time.');
}
```

### 3. Complete Component Example

```javascript
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AddAvailabilityScreen = () => {
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const formatTime = (date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleAddAvailability = async () => {
    const startTimeStr = formatTime(startTime);
    const endTimeStr = formatTime(endTime);

    // Validation
    if (startTimeStr >= endTimeStr) {
      Alert.alert('Invalid Time Range', 'End time must be after start time');
      return;
    }

    setLoading(true);

    try {
      const token = await AsyncStorage.getItem('authToken');
      
      const response = await axios.post(
        'https://your-backend-url.com/api/availability/time-range',
        {
          dayOfWeek: selectedDay,
          startTime: startTimeStr,
          endTime: endTimeStr
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      Alert.alert(
        'Success',
        `Availability added for ${selectedDay} from ${startTimeStr} to ${endTimeStr}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back or refresh
            }
          }
        ]
      );
    } catch (error) {
      if (error.response?.status === 409) {
        // Booking conflict
        Alert.alert(
          'Booking Conflict',
          error.response.data.message,
          [
            { text: 'OK' }
          ]
        );
      } else {
        Alert.alert(
          'Error',
          error.response?.data?.message || 'Failed to add availability'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Add Availability
      </Text>

      {/* Day Selection */}
      <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
        Select Day
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {days.map((day) => (
          <TouchableOpacity
            key={day}
            onPress={() => setSelectedDay(day)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              marginRight: 8,
              borderRadius: 8,
              backgroundColor: selectedDay === day ? '#007AFF' : '#f0f0f0'
            }}
          >
            <Text style={{ color: selectedDay === day ? '#fff' : '#333' }}>
              {day.substring(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Start Time */}
      <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 24, marginBottom: 8 }}>
        Start Time
      </Text>
      <TouchableOpacity
        onPress={() => setShowStartPicker(true)}
        style={{
          padding: 16,
          borderWidth: 1,
          borderColor: '#ddd',
          borderRadius: 8,
          backgroundColor: '#f9f9f9'
        }}
      >
        <Text style={{ fontSize: 16 }}>{formatTime(startTime)}</Text>
      </TouchableOpacity>

      {showStartPicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          is24Hour={true}
          onChange={(event, selectedTime) => {
            setShowStartPicker(false);
            if (selectedTime) {
              setStartTime(selectedTime);
            }
          }}
        />
      )}

      {/* End Time */}
      <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 24, marginBottom: 8 }}>
        End Time
      </Text>
      <TouchableOpacity
        onPress={() => setShowEndPicker(true)}
        style={{
          padding: 16,
          borderWidth: 1,
          borderColor: '#ddd',
          borderRadius: 8,
          backgroundColor: '#f9f9f9'
        }}
      >
        <Text style={{ fontSize: 16 }}>{formatTime(endTime)}</Text>
      </TouchableOpacity>

      {showEndPicker && (
        <DateTimePicker
          value={endTime}
          mode="time"
          is24Hour={true}
          onChange={(event, selectedTime) => {
            setShowEndPicker(false);
            if (selectedTime) {
              setEndTime(selectedTime);
            }
          }}
        />
      )}

      {/* Summary */}
      <View style={{
        marginTop: 24,
        padding: 16,
        backgroundColor: '#f0f8ff',
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#007AFF'
      }}>
        <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>
          You will be available:
        </Text>
        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>
          Every {selectedDay}
        </Text>
        <Text style={{ fontSize: 16 }}>
          From {formatTime(startTime)} to {formatTime(endTime)}
        </Text>
      </View>

      {/* Add Button */}
      <TouchableOpacity
        onPress={handleAddAvailability}
        disabled={loading}
        style={{
          marginTop: 32,
          marginBottom: 40,
          padding: 16,
          borderRadius: 8,
          backgroundColor: loading ? '#ccc' : '#007AFF',
          alignItems: 'center'
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
            Add Availability
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

export default AddAvailabilityScreen;
```

---

## 🔄 How It Works

### Conflict Detection Logic

1. **Provider adds availability:**
   - System checks for existing availability slots on the same day
   - If overlapping time ranges are found, system checks for active bookings
   - If bookings exist in the overlapping time, request is rejected with 409 error
   - If no bookings exist, new availability slot is created

2. **Customer books appointment:**
   - Customer checks availability using `/check/:providerId` endpoint
   - System finds matching availability slot that covers the requested time
   - System checks if any appointments already exist in that time range
   - Returns `isAvailable: true` only if no conflicts found

### Example Scenario

**Provider Availability:**
- Monday: 09:00 - 17:00

**Existing Bookings:**
- Monday 10:00 (Customer A)
- Monday 14:00 (Customer B)

**Availability Check Results:**
- ✅ Monday 11:00-12:00: Available
- ❌ Monday 10:00-11:00: Not available (conflicts with Customer A)
- ❌ Monday 13:30-14:30: Not available (conflicts with Customer B)
- ✅ Monday 15:00-16:00: Available

---

## ⚠️ Important Notes

1. **Time Format**: Always use 24-hour format (HH:MM)
   - ✅ Correct: "09:00", "14:30", "17:00"
   - ❌ Wrong: "9:00 AM", "2:30 PM", "5 PM"

2. **Time Range Validation**: End time must be after start time
   - ✅ Valid: startTime="09:00", endTime="17:00"
   - ❌ Invalid: startTime="17:00", endTime="09:00"

3. **Conflict Detection**: Only checks appointments with status:
   - `scheduled`
   - `confirmed`
   - `in-progress`
   
   Cancelled and completed appointments don't block availability.

4. **Date Parameter**: Optional in check endpoint
   - With date: Checks specific date
   - Without date: Checks general availability pattern

5. **Authentication**: 
   - Adding availability requires provider authentication
   - Checking availability is public (no auth needed)

---

## 🧪 Testing

### Using cURL

**Add Availability:**
```bash
curl -X POST https://your-backend-url.com/api/availability/time-range \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dayOfWeek": "Monday",
    "startTime": "09:00",
    "endTime": "17:00"
  }'
```

**Check Availability:**
```bash
curl "https://your-backend-url.com/api/availability/check/1?dayOfWeek=Monday&startTime=14:00&endTime=15:00&date=2025-10-25"
```

### Using Postman

1. **Add Availability:**
   - Method: POST
   - URL: `/api/availability/time-range`
   - Headers: Authorization: Bearer {token}
   - Body (JSON):
     ```json
     {
       "dayOfWeek": "Monday",
       "startTime": "09:00",
       "endTime": "17:00"
     }
     ```

2. **Check Availability:**
   - Method: GET
   - URL: `/api/availability/check/1`
   - Query Params:
     - dayOfWeek: Monday
     - startTime: 14:00
     - endTime: 15:00
     - date: 2025-10-25 (optional)

---

## 🚀 Benefits

1. **Prevents Double-Booking**: Automatically checks for conflicts
2. **Flexible Scheduling**: Providers can set different hours for different days
3. **Real-time Validation**: Customers see availability before booking
4. **Clear Conflict Messages**: Shows exactly why a time slot is unavailable
5. **Easy Integration**: Simple API with clear responses

---

## 📞 Support

For issues or questions:
1. Check error messages for specific validation failures
2. Verify time format (HH:MM, 24-hour)
3. Ensure provider authentication is working
4. Check backend logs for detailed error information
