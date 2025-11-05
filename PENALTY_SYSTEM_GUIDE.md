# Penalty System - Complete Guide

## Overview

The Fixmo Penalty System is designed to maintain platform quality and encourage responsible behavior from both users and service providers. Each account starts with **100 penalty points**, and various violations result in point deductions. When points reach 0, the account is automatically suspended.

---

## System Components

### 1. Database Models

#### User & ServiceProviderDetails
- `penalty_points` (default: 100) - Current penalty points
- `is_suspended` (default: false) - Suspension status
- `suspended_at` - Timestamp of suspension
- `suspended_until` - For temporary suspensions

#### ViolationType
Defines all violation rules:
- `violation_code` - Unique identifier (e.g., "USER_LATE_CANCEL")
- `violation_name` - Human-readable name
- `violation_category` - "user" or "provider"
- `penalty_points` - Points deducted
- `description` - Full description
- `requires_evidence` - Whether proof is needed
- `auto_detect` - Can be automatically detected

#### PenaltyViolation
Records individual violations:
- Links to user or provider
- Links to violation type
- Points deducted
- Evidence URLs
- Status (active, appealed, reversed)
- Appeal information

#### PenaltyAdjustment
Logs all point changes:
- Adjustment type (penalty, restore, bonus, reset)
- Points adjusted
- Previous and new points
- Reason for adjustment
- Admin who made the change

---

## Violation Types

### User Violations

| Code | Name | Points | Description | Auto-Detect |
|------|------|--------|-------------|-------------|
| USER_LATE_CANCEL | Late Cancellation | 10 | Cancelling <24hrs before schedule | ✓ |
| USER_NO_SHOW | No-Show | 15 | Failing to attend booked service | ✓ |
| USER_REPEATED_NO_SHOW | Repeated No-Shows | 25 | 3+ no-shows within 7 days | ✓ |
| USER_FAKE_COMPLAINT | Fake Complaint | 20 | False report against provider | ✗ |
| USER_RUDE_BEHAVIOR | Rude Behavior | 20 | Disrespectful toward provider | ✗ |
| USER_CHAT_SPAM | Chat Spam/Abuse | 30 | Spamming chat system | ✗ |
| USER_HARASSMENT | Harassment | 50 | Harassing/threatening provider | ✗ |
| USER_INAPPROPRIATE_CONTENT | Inappropriate Content | 25 | Offensive content to providers | ✗ |

### Provider Violations

| Code | Name | Points | Description | Auto-Detect |
|------|------|--------|-------------|-------------|
| PROVIDER_CANCEL_BOOKING | Booking Cancellation | 15 | Cancelling confirmed booking | ✓ |
| PROVIDER_NO_SHOW | No-Show | 20 | Failing to show for appointment | ✓ |
| PROVIDER_REPEATED_NO_SHOW | Repeated No-Shows | 30 | 2+ no-shows within 7 days | ✓ |
| PROVIDER_LATE_RESPONSE | Late Response | 5 | Response >24hrs to booking | ✓ |
| PROVIDER_POOR_COMMUNICATION | Poor Communication | 10 | 3+ complaints in a week | ✓ |
| PROVIDER_RUDE_BEHAVIOR | Unprofessional Behavior | 20 | Rude toward customers | ✗ |
| PROVIDER_SPAM | Spam/Promotional | 15 | Spam in chats | ✗ |
| PROVIDER_POOR_RATINGS | Consecutive Poor Ratings | 5 | 3 consecutive 1-star ratings | ✓ |
| PROVIDER_LATE_ARRIVAL | Late Arrival | 5 | >30 minutes late to service | ✗ |
| PROVIDER_HARASSMENT | Harassment | 50 | Harassing/threatening customer | ✗ |
| PROVIDER_INAPPROPRIATE_CONTENT | Inappropriate Content | 25 | Offensive content to customers | ✗ |
| PROVIDER_FRAUD | Fraudulent Activity | 100 | Fraudulent/deceptive practices | ✗ |

---

## API Endpoints

### User/Provider Endpoints

#### Get My Penalty Info
```
GET /api/penalty/my-info
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "penalty_points": 90,
    "is_suspended": false,
    "suspended_at": null,
    "suspended_until": null,
    "stats": {
      "currentPoints": 90,
      "totalViolations": 2,
      "activeViolations": 1,
      "recentViolations": 1,
      "status": "good"
    }
  }
}
```

#### Get My Violations
```
GET /api/penalty/my-violations?status=active&limit=50&offset=0
Authorization: Bearer {token}
```

**Query Parameters:**
- `status` - Filter by status (active, appealed, reversed, expired)
- `limit` - Records per page (default: 50)
- `offset` - Records to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "violations": [
      {
        "violation_id": 1,
        "points_deducted": 10,
        "violation_details": "Appointment cancelled 12 hours before scheduled time",
        "status": "active",
        "created_at": "2025-10-30T10:00:00Z",
        "violation_type": {
          "violation_name": "Late Cancellation",
          "description": "Cancelling an appointment less than 24 hours before the schedule"
        }
      }
    ],
    "total": 1
  }
}
```

#### Appeal a Violation
```
POST /api/penalty/appeal/{violationId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "appealReason": "I cancelled due to a medical emergency. I have documentation to prove this."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Appeal submitted successfully. An admin will review it shortly.",
  "data": {
    "success": true,
    "message": "Appeal submitted successfully"
  }
}
```

#### Get Violation Types
```
GET /api/penalty/violation-types?category=user
```

**Query Parameters:**
- `category` - Filter by user or provider (optional)

---

### Admin Endpoints

#### Record Manual Violation
```
POST /api/penalty/admin/record-violation
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "userId": 123,
  "violationCode": "USER_RUDE_BEHAVIOR",
  "appointmentId": 456,
  "violationDetails": "User was verbally abusive to provider during service",
  "evidenceUrls": ["https://example.com/screenshot1.jpg"]
}
```

#### Get All Violations
```
GET /api/penalty/admin/violations?userId=123&status=active&limit=100
Authorization: Bearer {admin_token}
```

#### Get Pending Appeals
```
GET /api/penalty/admin/pending-appeals
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "violation_id": 5,
      "appeal_reason": "I have proof of medical emergency",
      "appeal_status": "pending",
      "user": {
        "user_id": 123,
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com"
      },
      "violation_type": {
        "violation_name": "Late Cancellation",
        "penalty_points": 10
      }
    }
  ]
}
```

#### Review Appeal
```
POST /api/penalty/admin/review-appeal/{violationId}
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "approved": true,
  "reviewNotes": "Medical emergency verified with documentation. Appeal approved."
}
```

#### Manually Adjust Points
```
POST /api/penalty/admin/adjust-points
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "userId": 123,
  "points": 10,
  "adjustmentType": "add",
  "reason": "Compensation for system error that caused false violation"
}
```

**Adjustment Types:**
- `add` / `restore` - Add points back
- `deduct` - Remove points

#### Get Penalty Statistics
```
GET /api/penalty/admin/stats?userId=123
Authorization: Bearer {admin_token}
```

#### Initialize Violation Types
```
POST /api/penalty/admin/initialize-violation-types
Authorization: Bearer {admin_token}
```

#### Get Dashboard Statistics
```
GET /api/penalty/admin/dashboard
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalViolations": 150,
    "weeklyViolations": 12,
    "suspendedUsers": 3,
    "suspendedProviders": 1,
    "pendingAppeals": 5,
    "commonViolations": [
      {
        "violation_type_id": 1,
        "_count": 45,
        "violation_type": {
          "violation_name": "Late Cancellation",
          "penalty_points": 10
        }
      }
    ]
  }
}
```

---

## Setup Instructions

### 1. Database Migration

The migration has already been applied. If you need to rerun:

```bash
cd Fixmo-BACKEND
npx prisma migrate dev --name add_penalty_system
```

### 2. Seed Violation Types

Run the seeder to populate violation types:

```bash
node src/seeders/seed-violation-types.js
```

Or use the admin API endpoint:
```
POST /api/penalty/admin/initialize-violation-types
```

### 3. Update Existing Users/Providers

All existing users and providers will automatically get 100 penalty points due to the default value in the schema.

---

## Auto-Detection Integration

### Appointment Cancellation

When a user cancels an appointment, check if it's within 24 hours:

```javascript
import PenaltyService from './services/penaltyService.js';

// In your appointment cancellation logic
const appointment = await prisma.appointment.findUnique({
  where: { appointment_id: appointmentId }
});

const hoursDifference = 
  (new Date(appointment.scheduled_date) - new Date()) / (1000 * 60 * 60);

if (hoursDifference < 24) {
  await PenaltyService.recordViolation({
    userId: appointment.customer_id,
    violationCode: 'USER_LATE_CANCEL',
    appointmentId: appointment.appointment_id,
    violationDetails: `Appointment cancelled ${hoursDifference.toFixed(1)} hours before scheduled time`,
    detectedBy: 'system'
  });
}
```

### No-Show Detection

When marking an appointment as no-show:

```javascript
// For user no-show
await PenaltyService.detectUserNoShow(appointmentId);

// For provider no-show
await PenaltyService.detectProviderNoShow(appointmentId);
```

### Poor Ratings Detection

After a rating is submitted:

```javascript
// Check if provider has 3 consecutive 1-star ratings
await PenaltyService.detectConsecutivePoorRatings(providerId);
```

---

## Appeal Process

1. **User/Provider submits appeal** with reason
2. **Violation status** changes to "appealed"
3. **Appeal status** set to "pending"
4. **Admin reviews** the appeal
5. If **approved**:
   - Points are restored
   - Violation status changes to "reversed"
   - Suspension is lifted if applicable
6. If **rejected**:
   - Violation remains active
   - Appeal status set to "rejected"

---

## Point Restoration

Points can be restored through:

1. **Successful Appeal** - Automatic restoration when admin approves
2. **Manual Adjustment** - Admin can add points for various reasons
3. **Bonus Points** - For good behavior (future feature)

**Note:** Maximum penalty points is capped at 100.

---

## Suspension Logic

- Account is **automatically suspended** when `penalty_points` reaches 0
- `is_suspended` flag is set to `true`
- `suspended_at` timestamp is recorded
- `suspended_until` can be set for temporary suspensions (future feature)

### Lifting Suspension

When points are restored above 0:
- `is_suspended` is set to `false`
- `suspended_at` is cleared
- User/Provider can access the platform again

---

## Best Practices

### For Admins

1. **Always investigate** before manually recording violations
2. **Collect evidence** for violations requiring proof
3. **Review appeals promptly** to maintain user trust
4. **Document reasons** when adjusting points manually
5. **Monitor dashboard** for patterns and trends

### For Developers

1. **Use auto-detection** for violations that can be tracked
2. **Don't record duplicates** - check before creating violations
3. **Include context** in violation details
4. **Handle edge cases** (e.g., system errors)
5. **Test thoroughly** before deploying changes

---

## Testing

### Test Violation Recording

```bash
curl -X POST http://localhost:3000/api/penalty/admin/record-violation \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "violationCode": "USER_LATE_CANCEL",
    "violationDetails": "Test violation"
  }'
```

### Test Appeal Process

```bash
# Submit appeal
curl -X POST http://localhost:3000/api/penalty/appeal/1 \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "appealReason": "This was a false detection"
  }'

# Review appeal
curl -X POST http://localhost:3000/api/penalty/admin/review-appeal/1 \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "reviewNotes": "Appeal approved"
  }'
```

---

## Future Enhancements

1. **Point Recovery** - Gradual restoration over time for good behavior
2. **Warning System** - Warnings before point deduction
3. **Temporary Suspensions** - Time-based suspensions instead of permanent
4. **Strike System** - Multiple warnings before penalties
5. **Violation Categories** - More granular categorization
6. **Email Notifications** - Alert users of violations and suspensions
7. **Analytics Dashboard** - Detailed statistics and trends

---

## Troubleshooting

### Issue: Violation not recorded
- Check if violation type exists and is active
- Verify user/provider ID is correct
- Check for duplicate violations

### Issue: Points not updating
- Check database connection
- Verify transaction completed
- Check for race conditions

### Issue: Appeal not working
- Verify violation exists
- Check ownership (user/provider must own the violation)
- Ensure violation status allows appeals

---

## Support

For questions or issues with the penalty system:
1. Check this documentation
2. Review the code comments
3. Test with the provided API endpoints
4. Contact the development team

---

**Last Updated:** October 30, 2025
**Version:** 1.0.0
