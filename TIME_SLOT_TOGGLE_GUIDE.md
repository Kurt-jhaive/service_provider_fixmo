# Time Slot Toggle Feature - Complete Guide

## Overview
The Time Slot Toggle feature allows service providers to have **granular control** over their availability by enabling/disabling individual time slots without deleting them. This provides operational flexibility while maintaining booking history integrity.

## Two-Level Toggle System

### 1. Day-Level Toggle (`availability_isActive`)
- **Purpose**: Enable/disable entire day
- **Scope**: Affects all time slots for that day
- **Use Case**: Provider wants to take a full day off
- **Endpoint**: `POST /api/availability/toggle-day`

### 2. Slot-Level Toggle (`slot_isActive`) - NEW!
- **Purpose**: Enable/disable specific time slots
- **Scope**: Affects only that individual slot
- **Use Case**: Provider wants to disable specific hours (e.g., lunch break)
- **Endpoint**: `PUT /api/availability/toggle-slot/:availabilityId`

### Combined Logic
A slot is **bookable** ONLY when:
- ✅ `availability_isActive = true` (Day is active)
- ✅ `slot_isActive = true` (Slot is active)

If either is `false`, the slot is **not bookable**.

---

## Database Schema

### Availability Model
```prisma
model Availability {
  availability_id       Int      @id @default(autoincrement())
  provider_id          Int
  dayOfWeek            String   // "Monday", "Tuesday", etc.
  startTime            String   // "09:00"
  endTime              String   // "10:00"
  availability_isActive Boolean  @default(true)  // Day-level toggle
  slot_isActive        Boolean  @default(true)   // Slot-level toggle (NEW!)
  
  provider             ServiceProviderDetails @relation(...)
  appointments         Appointment[]
}
```

### Migration Applied
```
Migration: 20251031112925_add_slot_is_active_toggle
Status: ✅ Applied successfully
```

---

## API Endpoints

### 1. Toggle Individual Time Slot (NEW!)

**Endpoint**: `PUT /api/availability/toggle-slot/:availabilityId`

**Authentication**: Required (Provider JWT)

**Request**:
```json
PUT /api/availability/toggle-slot/45
Authorization: Bearer <provider_jwt_token>
Content-Type: application/json

{
  "slot_isActive": false
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Time slot deactivated successfully",
  "data": {
    "availability_id": 45,
    "dayOfWeek": "Monday",
    "startTime": "14:00",
    "endTime": "15:00",
    "slot_isActive": false,
    "availability_isActive": true,
    "status": "Not bookable",
    "note": null
  }
}
```

**Conflict Response** (409 Conflict) - Has Active Appointments:
```json
{
  "success": false,
  "message": "Cannot deactivate time slot. There are 2 active appointment(s) scheduled for this slot.",
  "conflictingAppointments": [
    {
      "appointment_id": 123,
      "scheduled_date": "2025-11-05T14:00:00.000Z",
      "status": "confirmed",
      "customer_name": "John Doe"
    }
  ],
  "suggestion": "Please cancel or complete these appointments before deactivating the slot"
}
```

**Error Responses**:
- `400 Bad Request`: Missing or invalid parameters
- `401 Unauthorized`: No authentication token
- `404 Not Found`: Slot not found or doesn't belong to provider
- `500 Internal Server Error`: Server error

---

### 2. Get Provider Availability (Updated)

**Endpoint**: `GET /api/availability`

**Query Parameters**:
- `includeInactive` (optional): Set to `"true"` to include inactive slots

**Default Behavior** (without query param):
- Returns only slots where BOTH `availability_isActive=true` AND `slot_isActive=true`

**Request Examples**:

```bash
# Get only bookable slots (default)
GET /api/availability
Authorization: Bearer <provider_jwt_token>

# Get ALL slots including inactive ones
GET /api/availability?includeInactive=true
Authorization: Bearer <provider_jwt_token>
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "availability_id": 45,
      "provider_id": 10,
      "dayOfWeek": "Monday",
      "startTime": "09:00",
      "endTime": "10:00",
      "availability_isActive": true,
      "slot_isActive": true,
      "isBookable": true,
      "statusReason": "Available for booking"
    },
    {
      "availability_id": 46,
      "provider_id": 10,
      "dayOfWeek": "Monday",
      "startTime": "14:00",
      "endTime": "15:00",
      "availability_isActive": true,
      "slot_isActive": false,
      "isBookable": false,
      "statusReason": "Time slot is deactivated"
    }
  ],
  "meta": {
    "total": 2,
    "bookableSlots": 1,
    "showingInactive": true
  }
}
```

---

### 3. Get Day Availability Status (Enhanced)

**Endpoint**: `GET /api/availability/day-status`

**Enhancement**: Now includes slot-level toggle information

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "dayOfWeek": "Monday",
      "hasSlots": true,
      "totalSlots": 8,
      "dayActiveSlots": 8,       // Slots with day toggle ON
      "slotActiveSlots": 6,       // Slots with slot toggle ON
      "bookableSlots": 6,         // Both toggles ON
      "inactiveSlots": 2,
      "isFullyActive": false,
      "isFullyInactive": false,
      "status": "Partially available",
      "slots": [
        {
          "availability_id": 45,
          "startTime": "09:00",
          "endTime": "10:00",
          "dayIsActive": true,
          "slotIsActive": true,
          "isBookable": true,
          "statusReason": "Available"
        },
        {
          "availability_id": 46,
          "startTime": "12:00",
          "endTime": "13:00",
          "dayIsActive": true,
          "slotIsActive": false,
          "isBookable": false,
          "statusReason": "Slot deactivated"
        }
      ]
    }
  ]
}
```

---

### 4. Toggle Day Availability (Existing)

**Endpoint**: `POST /api/availability/toggle-day`

**Purpose**: Toggle entire day on/off

**Request**:
```json
POST /api/availability/toggle-day
Authorization: Bearer <provider_jwt_token>

{
  "dayOfWeek": "Monday",
  "isActive": false
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Monday availability deactivated successfully",
  "data": {
    "dayOfWeek": "Monday",
    "isActive": false,
    "updatedSlots": 8,
    "status": "Not bookable"
  }
}
```

---

## Use Cases & Scenarios

### Scenario 1: Lunch Break
**Problem**: Provider wants to disable 12:00-13:00 slot for lunch
**Solution**: Use slot-level toggle

```bash
PUT /api/availability/toggle-slot/46
{
  "slot_isActive": false
}
```

**Result**: Only 12:00-13:00 disabled, other Monday slots remain bookable

---

### Scenario 2: Day Off
**Problem**: Provider taking entire Monday off
**Solution**: Use day-level toggle

```bash
POST /api/availability/toggle-day
{
  "dayOfWeek": "Monday",
  "isActive": false
}
```

**Result**: All Monday slots become unbookable

---

### Scenario 3: Selective Availability
**Problem**: Provider only available 9-12 on Fridays (not afternoon)
**Solution**: Disable afternoon slots individually

```bash
# Disable 14:00 slot
PUT /api/availability/toggle-slot/78
{ "slot_isActive": false }

# Disable 15:00 slot
PUT /api/availability/toggle-slot/79
{ "slot_isActive": false }

# Morning slots remain active
```

---

### Scenario 4: Re-enable Slots
**Problem**: Provider wants to re-activate a previously disabled slot
**Solution**: Toggle it back on

```bash
PUT /api/availability/toggle-slot/46
{
  "slot_isActive": true
}
```

---

## Business Logic & Validations

### ✅ Allowed Actions

1. **Disable empty slots**: Can toggle off slots with no appointments
2. **Disable slots with past appointments**: Safe to toggle off
3. **Re-enable any slot**: Always allowed

### ❌ Prevented Actions

1. **Cannot disable slot with active appointments**
   - **Active statuses**: `scheduled`, `confirmed`, `in-progress`
   - **Error**: 409 Conflict with appointment details
   - **Suggestion**: Cancel/complete appointments first

2. **Cannot delete slots with any appointments**
   - **Recommendation**: Use toggle instead of delete
   - **Reason**: Preserves booking history

---

## Frontend Integration Guide

### Display Availability with Toggle Status

```javascript
// Fetch provider availability
const response = await fetch('/api/availability?includeInactive=true', {
  headers: {
    'Authorization': `Bearer ${providerToken}`
  }
});

const { data: slots } = await response.json();

// Display slots with status indicators
slots.forEach(slot => {
  console.log(`${slot.dayOfWeek} ${slot.startTime}-${slot.endTime}`);
  console.log(`Status: ${slot.isBookable ? '✅ Bookable' : '❌ Not Bookable'}`);
  console.log(`Reason: ${slot.statusReason}`);
});
```

### Toggle Slot UI Component

```javascript
const toggleSlot = async (availabilityId, currentState) => {
  try {
    const response = await fetch(`/api/availability/toggle-slot/${availabilityId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${providerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        slot_isActive: !currentState // Toggle opposite
      })
    });

    const result = await response.json();

    if (result.success) {
      // Update UI
      alert(`Slot ${result.data.slot_isActive ? 'activated' : 'deactivated'}`);
      // Refresh availability list
    } else if (response.status === 409) {
      // Has active appointments
      alert(`Cannot deactivate: ${result.message}`);
      console.log('Conflicting appointments:', result.conflictingAppointments);
    }
  } catch (error) {
    console.error('Error toggling slot:', error);
  }
};
```

### React Native Example

```jsx
import React, { useState } from 'react';
import { View, Text, Switch, Alert } from 'react-native';

const TimeSlotItem = ({ slot, onToggle }) => {
  const [isActive, setIsActive] = useState(slot.slot_isActive);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (value) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/availability/toggle-slot/${slot.availability_id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ slot_isActive: value })
        }
      );

      const result = await response.json();

      if (result.success) {
        setIsActive(value);
        onToggle?.();
      } else if (response.status === 409) {
        Alert.alert(
          'Cannot Deactivate',
          result.message,
          [{ text: 'OK' }]
        );
        // Revert switch
        setIsActive(!value);
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to toggle slot');
      setIsActive(!value);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.slotRow}>
      <Text>{slot.startTime} - {slot.endTime}</Text>
      <Switch
        value={isActive}
        onValueChange={handleToggle}
        disabled={loading || !slot.availability_isActive}
      />
      {!slot.isBookable && (
        <Text style={styles.warning}>{slot.statusReason}</Text>
      )}
    </View>
  );
};
```

---

## Testing Guide

### Test Case 1: Toggle Slot On/Off

```bash
# 1. Get provider slots
GET /api/availability
Authorization: Bearer <provider_token>

# 2. Toggle a slot off
PUT /api/availability/toggle-slot/45
Authorization: Bearer <provider_token>
{
  "slot_isActive": false
}

# Expected: Success response with slot_isActive=false

# 3. Verify slot status
GET /api/availability/day-status
Authorization: Bearer <provider_token>

# Expected: Slot 45 shows slotIsActive=false, isBookable=false

# 4. Toggle slot back on
PUT /api/availability/toggle-slot/45
{
  "slot_isActive": true
}

# Expected: Success response with slot_isActive=true
```

### Test Case 2: Prevent Disabling Slot with Appointments

```bash
# 1. Create appointment for slot 45
POST /api/appointments
{
  "provider_id": 10,
  "availability_id": 45,
  "scheduled_date": "2025-11-05",
  "appointment_status": "confirmed"
}

# 2. Try to disable that slot
PUT /api/availability/toggle-slot/45
{
  "slot_isActive": false
}

# Expected: 409 Conflict with appointment details
```

### Test Case 3: Filter Inactive Slots

```bash
# 1. Toggle some slots off
PUT /api/availability/toggle-slot/46
{ "slot_isActive": false }

# 2. Get availability (default - only bookable)
GET /api/availability

# Expected: Slot 46 NOT in results

# 3. Get availability (include inactive)
GET /api/availability?includeInactive=true

# Expected: Slot 46 IS in results with isBookable=false
```

---

## Database Queries

### Find All Bookable Slots
```sql
SELECT * FROM "Availability"
WHERE availability_isActive = true
  AND slot_isActive = true
ORDER BY "dayOfWeek", "startTime";
```

### Find Provider's Inactive Slots
```sql
SELECT * FROM "Availability"
WHERE provider_id = 10
  AND (availability_isActive = false OR slot_isActive = false);
```

### Count Slots by Status
```sql
SELECT 
  "dayOfWeek",
  COUNT(*) as total_slots,
  COUNT(*) FILTER (WHERE availability_isActive = true AND slot_isActive = true) as bookable_slots,
  COUNT(*) FILTER (WHERE availability_isActive = false OR slot_isActive = false) as inactive_slots
FROM "Availability"
WHERE provider_id = 10
GROUP BY "dayOfWeek"
ORDER BY 
  CASE "dayOfWeek"
    WHEN 'Monday' THEN 1
    WHEN 'Tuesday' THEN 2
    WHEN 'Wednesday' THEN 3
    WHEN 'Thursday' THEN 4
    WHEN 'Friday' THEN 5
    WHEN 'Saturday' THEN 6
    WHEN 'Sunday' THEN 7
  END;
```

---

## Benefits

### For Providers
✅ **Flexibility**: Disable specific hours without losing slot configuration
✅ **Reversible**: Easily re-enable slots when needed
✅ **History**: Keeps all slots for record-keeping
✅ **Granular Control**: Two-level system (day + slot)

### For Customers
✅ **Clarity**: See only truly available slots
✅ **Reliability**: Can't book unavailable times
✅ **Transparency**: Clear status indicators

### For System
✅ **Data Integrity**: No slot deletion with appointments
✅ **Audit Trail**: Complete availability history
✅ **Performance**: Efficient filtering with boolean flags
✅ **Scalability**: Simple toggle operations

---

## Migration from Old System

If providers were manually deleting/recreating slots:

### Old Workflow (Problematic)
```
1. Delete slot → ❌ Loses appointment history
2. Recreate later → ❌ New ID, breaks references
```

### New Workflow (Recommended)
```
1. Toggle slot off → ✅ Preserves history
2. Toggle slot on → ✅ Same ID, intact references
```

### Converting Existing Slots
All existing slots automatically get:
- `availability_isActive = true` (existing field)
- `slot_isActive = true` (NEW field, default)

No manual data migration needed!

---

## Quick Reference

| Action | Endpoint | Method | Body |
|--------|----------|--------|------|
| Toggle individual slot | `/api/availability/toggle-slot/:id` | PUT | `{"slot_isActive": boolean}` |
| Toggle entire day | `/api/availability/toggle-day` | POST | `{"dayOfWeek": string, "isActive": boolean}` |
| Get bookable slots | `/api/availability` | GET | - |
| Get all slots | `/api/availability?includeInactive=true` | GET | - |
| Get day status | `/api/availability/day-status` | GET | - |

---

## Support

For issues or questions:
1. Check this guide first
2. Verify authentication token is valid
3. Ensure slot belongs to authenticated provider
4. Check for active appointments before disabling
5. Review server logs for detailed error messages

---

## Changelog

### v1.0 (2025-10-31)
- ✅ Added `slot_isActive` field to Availability model
- ✅ Implemented `toggleTimeSlot` controller method
- ✅ Added `PUT /api/availability/toggle-slot/:id` endpoint
- ✅ Enhanced `getProviderAvailability` with filtering
- ✅ Updated `getDayAvailabilityStatus` with slot-level info
- ✅ Added appointment conflict prevention
- ✅ Created comprehensive documentation

---

**Status**: ✅ Production Ready
**Migration**: ✅ Applied
**Testing**: Ready for QA
**Documentation**: ✅ Complete
