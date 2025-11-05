# Provider No-Show Implementation Guide

## Overview
This document describes the implementation of the provider no-show system for overdue appointments in FixMo. When a provider attempts to start an appointment past its scheduled end time, the appointment is automatically marked as a no-show with a "provider-no-show" label, which may affect the provider's Fix-Score.

## Implementation Date
November 5, 2025

## Features Implemented

### 1. **Late Start Warning**
- **When**: Provider starts appointment after scheduled start time but before end time
- **Example**: Appointment scheduled for 8:00-10:30, provider starts at 9:15
- **Behavior**: Shows warning modal: "This appointment was scheduled to start at {startTime}. Starting late may affect your Fix-Score. Do you want to continue?"
- **Action**: Provider can choose to continue or cancel

### 2. **Overdue Appointment Prevention**
- **When**: Provider attempts to start appointment after scheduled end time
- **Example**: Appointment scheduled for 8:00-10:30, provider tries to start at 10:45
- **Behavior**: Shows error modal: "This appointment was scheduled for {startTime} - {endTime}. The appointment is now overdue and cannot be started. It will be marked as a no-show."
- **Action**: Appointment automatically cancelled with "provider-no-show" label

### 3. **Provider No-Show Badge Display**
- **Location**: Cancelled appointments in FixMo Today
- **Visual**: Red badge with alert icon
- **Text**: "Provider No-Show (Overdue)"
- **Styling**: Red background (#FFEBEE), red border (#D32F2F)

## Files Modified

### 1. **src/types/appointment.d.ts**
Added availability information to Appointment interface:
```typescript
availability?: {
  availability_id: number;
  startTime: string;  // Format: "HH:mm" (e.g., "08:00")
  endTime: string;    // Format: "HH:mm" (e.g., "10:30")
  dayOfWeek?: string;
};
```

### 2. **src/api/booking.api.ts**
- Updated `getAppointmentsByProviderId` to include availability data in API call
- Added new function `markAsProviderNoShow`:
  ```typescript
  export const markAsProviderNoShow = async (
    appointmentId: number,
    token: string
  ): Promise<{ success: boolean; message: string; data?: any }>
  ```

**API Endpoint**: `POST /api/appointments/{appointmentId}/provider-no-show`

**Request Body**:
```json
{
  "cancellation_reason": "provider-no-show"
}
```

### 3. **app/provider/integration/enroutescreen.tsx**
Added timing validation logic:

**New State & Params**:
```typescript
const startTime = params.startTime as string; // e.g., "08:00"
const endTime = params.endTime as string; // e.g., "10:30"
```

**New Functions**:
- `checkAppointmentTimingStatus()`: Returns 'on-time' | 'late' | 'overdue'
- `proceedWithArrival()`: Extracted arrival logic to separate function
- Modified `handleArrived()`: Added timing validation before allowing arrival

**Timing Logic**:
```typescript
const now = new Date();
const startDateTime = new Date(appointmentDate);
startDateTime.setHours(startHour, startMinute, 0, 0);

const endDateTime = new Date(appointmentDate);
endDateTime.setHours(endHour, endMinute, 0, 0);

if (now < startDateTime) return 'on-time';
if (now >= startDateTime && now <= endDateTime) return 'late';
return 'overdue';
```

### 4. **app/provider/integration/fixmoto.tsx**
- Updated `handleEnRoute` navigation to include time slot data
- Updated confirmed status "View En Route" navigation to include time slot data
- Added provider-no-show badge display in cancelled appointments

**New JSX**:
```jsx
{item.appointment_status === 'cancelled' && 
 item.cancellation_reason === 'provider-no-show' && (
  <View style={styles.noShowBadge}>
    <Ionicons name="alert-circle" size={16} color="#D32F2F" />
    <Text style={styles.noShowText}>Provider No-Show (Overdue)</Text>
  </View>
)}
```

**New Styles**:
```typescript
noShowBadge: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#FFEBEE",
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 8,
  marginBottom: 8,
  borderWidth: 1,
  borderColor: "#D32F2F",
},
noShowText: {
  fontSize: 12,
  fontFamily: "PoppinsSemiBold",
  color: "#D32F2F",
  marginLeft: 6,
}
```

## User Flow

### Scenario 1: On-Time Start (Before scheduled start time)
1. Provider clicks "En Route to Fix" → Status changes to "On the Way"
2. Provider navigates to customer location using map
3. Provider clicks "I've Arrived"
4. ✅ Confirmation modal shown → Status changes to "In Progress"

### Scenario 2: Late Start (After start, before end)
1. Provider clicks "En Route to Fix" → Status changes to "On the Way"
2. Provider navigates to customer location
3. Provider clicks "I've Arrived"
4. ⚠️ **Warning Modal**: "This appointment was scheduled to start at 08:00. Starting late may affect your Fix-Score. Do you want to continue?"
5. Provider chooses:
   - **Continue Anyway** → Status changes to "In Progress"
   - **Cancel** → Returns to en route screen

### Scenario 3: Overdue Start (After scheduled end time)
1. Provider clicks "En Route to Fix" → Status changes to "On the Way"
2. Provider navigates to customer location
3. Provider clicks "I've Arrived"
4. ❌ **Error Modal**: "This appointment was scheduled for 08:00 - 10:30. The appointment is now overdue and cannot be started. It will be marked as a no-show."
5. Automatic Actions:
   - Appointment status → "cancelled"
   - Cancellation reason → "provider-no-show"
   - Provider redirected to FixMo Today
   - Fix-Score penalty applied (backend)
6. Appointment appears in Cancelled tab with "Provider No-Show (Overdue)" badge

## Backend Requirements

The backend needs to implement the following endpoint:

**Endpoint**: `POST /api/appointments/:appointmentId/provider-no-show`

**Headers**:
```
Authorization: Bearer {providerToken}
Content-Type: application/json
```

**Request Body**:
```json
{
  "cancellation_reason": "provider-no-show"
}
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Appointment marked as provider no-show",
  "data": {
    "appointment_id": 123,
    "appointment_status": "cancelled",
    "cancellation_reason": "provider-no-show",
    "updated_at": "2025-11-05T10:45:00Z"
  }
}
```

**Backend Actions**:
1. Update appointment status to "cancelled"
2. Set cancellation_reason to "provider-no-show"
3. Apply Fix-Score penalty (e.g., -20 points for PROVIDER_NO_SHOW)
4. Send notification to customer
5. Log violation in penalty system
6. Update provider's penalty score history

**Response (Error - 400/500)**:
```json
{
  "success": false,
  "message": "Failed to mark as no-show",
  "error": "Detailed error message"
}
```

## Testing Checklist

### Manual Testing
- [ ] **Test On-Time Start**:
  - Schedule appointment for future time slot (e.g., 14:00-16:00)
  - Start en route before 14:00
  - Click "I've Arrived" → Should proceed normally

- [ ] **Test Late Start**:
  - Use appointment scheduled for 08:00-10:30
  - Wait until after 09:00 but before 10:30
  - Click "I've Arrived" → Should show warning modal
  - Choose "Continue Anyway" → Should proceed to In Progress

- [ ] **Test Overdue Start**:
  - Use appointment scheduled for 08:00-10:30
  - Wait until after 10:30
  - Click "I've Arrived" → Should show overdue modal
  - Click OK → Should mark as no-show and redirect

- [ ] **Test Provider No-Show Display**:
  - Create overdue appointment
  - Navigate to Cancelled tab in FixMo Today
  - Verify red "Provider No-Show (Overdue)" badge appears

### Backend Integration Testing
- [ ] Verify `/api/appointments/provider/:providerId?include=availability` returns time slot data
- [ ] Test `/api/appointments/:id/provider-no-show` endpoint
- [ ] Verify Fix-Score penalty is applied
- [ ] Verify customer receives notification
- [ ] Check violation appears in penalty history

## UI/UX Details

### Warning Modal (Late Start)
- **Title**: "Late Start Warning"
- **Message**: "This appointment was scheduled to start at {startTime}. Starting late may affect your Fix-Score. Do you want to continue?"
- **Buttons**: 
  - "Cancel" (secondary)
  - "Continue Anyway" (primary)

### Error Modal (Overdue)
- **Title**: "Appointment Overdue"
- **Message**: "This appointment was scheduled for {startTime} - {endTime}. The appointment is now overdue and cannot be started. It will be marked as a no-show."
- **Button**: "OK" (single button)

### Success Modal (After No-Show)
- **Title**: "Appointment Cancelled"
- **Message**: "The appointment has been marked as a no-show and cancelled. This may affect your Fix-Score."
- **Button**: "OK" → Navigates to FixMo Today

### No-Show Badge
- **Background**: #FFEBEE (light red)
- **Border**: 1px solid #D32F2F (red)
- **Icon**: alert-circle (red)
- **Text**: "Provider No-Show (Overdue)" (red, bold)

## Related Systems

### Fix-Score Integration
The provider no-show triggers a Fix-Score penalty:
- **Violation Type**: PROVIDER_NO_SHOW
- **Penalty Points**: -20 points (configurable in backend)
- **Impact**: May lower provider tier, reduce booking slots, or suspend account

### Notification System
When a provider no-show is recorded:
- Customer receives notification: "Your provider failed to arrive on time. The appointment has been cancelled. You can rebook with another provider."
- Provider receives notification: "Appointment marked as no-show. This may affect your Fix-Score and future bookings."

## Future Enhancements

1. **Grace Period**: Add 15-minute grace period after end time before marking as overdue
2. **Provider Excuse**: Allow provider to provide reason for lateness
3. **Auto-Reschedule**: Offer customer option to auto-reschedule with same or different provider
4. **Analytics Dashboard**: Track provider punctuality metrics
5. **Early Arrival Bonus**: Reward providers who arrive early with Fix-Score boost

## Notes

- Time validation uses local device time; ensure customer and provider devices have accurate time
- Timezone handling should be implemented in backend for multi-region support
- The system assumes appointment time slots are in 24-hour format (e.g., "08:00", "10:30")
- Availability data must be included in appointment fetch API calls

## Support & Troubleshooting

### Common Issues

**Issue**: Timing validation always shows "on-time"
- **Cause**: Missing availability data in appointment object
- **Solution**: Verify API includes `?include=availability` parameter

**Issue**: Backend returns 404 for no-show endpoint
- **Cause**: Endpoint not implemented in backend
- **Solution**: Implement POST `/api/appointments/:id/provider-no-show` endpoint

**Issue**: No-show badge not appearing
- **Cause**: Cancellation reason not exactly "provider-no-show"
- **Solution**: Ensure backend sets exact string "provider-no-show" (case-sensitive)

## Related Documentation
- `FIXSCORE_DATA_FETCHING_GUIDE.md` - Fix-Score system
- `PENALTY_SYSTEM_GUIDE.md` - Penalty violation types
- `PROVIDER_CANCEL_APPOINTMENT.md` - Appointment cancellation
- `EN_ROUTE_BUTTON_FIX.md` - En route functionality

---

**Document Version**: 1.0  
**Last Updated**: November 5, 2025  
**Maintained By**: Development Team
