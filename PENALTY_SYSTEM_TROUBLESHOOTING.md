# Penalty System Troubleshooting Guide

## Issue: Fix-Score Not Loading Properly in Provider App

### Problem Description
The Fix-Score system is showing user app violations/restorations instead of provider-specific data in the service provider app.

---

## ✅ FIXES APPLIED

### 1. Fixed User Type Configuration
**File**: `app/provider/integration/penalty-score-details.tsx` (Line 41)

**Changed from:**
```typescript
const userType = 'customer'; // This could come from user context/profile
```

**Changed to:**
```typescript
const userType = 'provider'; // Service Provider App
```

**Impact**: This ensures the UI displays provider-specific messages and restrictions instead of customer messages.

---

## 🔍 VERIFICATION CHECKLIST

### Backend Requirements
The backend MUST return provider-specific data when authenticated with a provider token. Verify:

1. **Token Detection** (Already Implemented ✅)
   - File: `src/utils/penaltyService.ts`
   - Function: `getAuthToken()`
   - Checks for `providerToken` first, then falls back to `token`

2. **API Endpoints Match Documentation** (Verified ✅)
   - `/api/penalty/my-info` - Get penalty info
   - `/api/penalty/my-violations` - Get violations
   - `/api/penalty/my-adjustments` - Get restorations
   - `/api/penalty/my-rewards` - Get rewards
   - `/api/penalty/appeal/{violationId}` - Submit appeal

3. **Backend Must Filter by Provider**
   The backend should:
   - Detect if the token is for a provider
   - Return only violations where `provider_id IS NOT NULL` and `user_id IS NULL`
   - Return only adjustments for the authenticated provider

### Frontend Filtering (Already Implemented ✅)
**File**: `app/provider/integration/penalty-score-details.tsx` (Lines 163-166)

```typescript
// Filter to only show PROVIDER violations
const providerViolations = violationsList.filter((v: any) => {
  return v.provider_id !== null && v.user_id === null;
});
```

---

## 🧪 TESTING STEPS

### Step 1: Check Token Storage
1. Open the provider app
2. Log in as a service provider
3. Check AsyncStorage for `providerToken`

**Test Command** (React Native Debugger):
```javascript
AsyncStorage.getItem('providerToken').then(token => {
  console.log('Provider Token:', token ? 'EXISTS' : 'MISSING');
});
```

### Step 2: Verify API Calls
Check the console logs when viewing the Fix-Score page:

**Expected Logs:**
```
🔑 Using providerToken
📡 Fetching penalty info from: [BACKEND_URL]/api/penalty/my-info
📡 getPenaltyInfo Response Status: 200
✅ Penalty Info Set: { penalty_points: 100, ... }
📊 Total violations returned: X
📊 Provider violations filtered: Y
```

**Red Flags:**
- ❌ `No token found in AsyncStorage`
- ❌ `Using customer token` (when in provider app)
- ❌ Response Status: 401 or 403
- ❌ Provider violations filtered: 0 (when violations exist)

### Step 3: Test Backend Response
Use a tool like Postman or curl to test the backend directly:

```bash
# Get provider token from AsyncStorage
curl -X GET "http://[BACKEND_URL]/api/penalty/my-info" \
  -H "Authorization: Bearer [PROVIDER_TOKEN]" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "penalty_points": 100,
    "is_suspended": false,
    "last_updated": "2025-11-05T...",
    "provider_id": 123
  }
}
```

### Step 4: Check Violation Data Structure
In the penalty details page, check console logs:

```
📊 Sample provider violation: {
  "violation_id": 1,
  "provider_id": 123,
  "user_id": null,
  "points_deducted": 15,
  "violation_type": {
    "violation_name": "Provider No-Show",
    "violation_code": "PROVIDER_NO_SHOW"
  }
}
```

**Red Flags:**
- ❌ `provider_id: null` and `user_id: [number]` - These are USER violations
- ❌ Violation codes starting with `USER_` instead of `PROVIDER_`

---

## 🐛 COMMON ISSUES & SOLUTIONS

### Issue 1: Shows User Data Instead of Provider Data

**Symptoms:**
- Violations show user-related codes (USER_LATE_CANCEL, USER_NO_SHOW)
- Wrong user appears in violation details

**Root Causes:**
1. **Wrong token being used**
   - Check: `AsyncStorage.getItem('providerToken')`
   - Solution: Ensure provider login saves to `providerToken` key

2. **Backend not filtering by provider**
   - Backend must check token type and filter accordingly
   - Solution: Update backend to detect provider token and filter by `provider_id`

3. **Frontend filtering disabled**
   - Solution: Already fixed in `penalty-score-details.tsx`

**Fix Backend (Example - Adjust based on your backend):**
```javascript
// Backend: /api/penalty/my-violations
router.get('/my-violations', authenticate, async (req, res) => {
  const { userId, providerId, userType } = req.user; // From JWT token
  
  let whereClause = {};
  
  if (userType === 'provider' || providerId) {
    // Provider query
    whereClause = {
      provider_id: providerId,
      user_id: null
    };
  } else {
    // User query
    whereClause = {
      user_id: userId,
      provider_id: null
    };
  }
  
  const violations = await prisma.penaltyViolation.findMany({
    where: whereClause,
    include: { violation_type: true }
  });
  
  res.json({ success: true, data: { violations } });
});
```

### Issue 2: Empty Violations List

**Symptoms:**
- "No violations recorded" message
- Total violations: 0

**Possible Causes:**
1. **No violations exist yet** (Normal)
2. **Wrong filtering** (Check backend)
3. **Token expired** (Check 401 responses)

**Solution:**
- Create test violation via admin panel
- Check backend logs
- Verify token is valid

### Issue 3: Restorations Not Showing

**Symptoms:**
- Violations appear but restorations don't
- Console shows: `Restorations count: 0`

**Possible Causes:**
1. **Backend endpoint missing** `/api/penalty/my-adjustments`
2. **Wrong data structure returned**
3. **No restorations exist yet**

**Solution:**
Check if endpoint exists:
```bash
curl -X GET "http://[BACKEND_URL]/api/penalty/my-adjustments" \
  -H "Authorization: Bearer [PROVIDER_TOKEN]"
```

Expected response structure (multiple possible formats):
```json
// Option 1: Nested
{
  "success": true,
  "data": {
    "adjustments": [
      { "points_adjusted": 10, "adjustment_type": "restore", ... }
    ]
  }
}

// Option 2: Flat
{
  "success": true,
  "adjustments": [...]
}

// Option 3: Direct array
{
  "success": true,
  "data": [...]
}
```

The frontend handles all three formats automatically.

### Issue 4: Score Not Updating

**Symptoms:**
- Score stuck at 100
- Changes don't reflect

**Solutions:**
1. **Clear app cache**
   ```bash
   npx expo start -c
   ```

2. **Check backend penalty_points field**
   - Verify database has correct values
   - Check if using `penalty_points` vs `current_score` vs `points`

3. **Force reload**
   - Pull to refresh on the page
   - Logout and login again

---

## 📋 PROVIDER-SPECIFIC FEATURES

### Booking Restrictions Based on Score

**File**: `app/provider/calendar/availability.tsx` (or similar)

**Implementation:**
```typescript
import { getBookingLimit } from 'src/utils/penaltyHelpers';

const BookingRestrictionCheck = ({ penaltyScore }: { penaltyScore: number }) => {
  const limit = getBookingLimit(penaltyScore, 'provider');
  
  if (penaltyScore <= 50) {
    return (
      <View style={styles.warningBox}>
        <Text>Account Deactivated - Cannot create slots</Text>
      </View>
    );
  }
  
  if (limit !== null) {
    return (
      <View style={styles.warningBox}>
        <Text>Limited to {limit} slots per day</Text>
      </View>
    );
  }
  
  return null;
};
```

**Slot Creation Limits:**
- Score 81-100: Unlimited slots ✅
- Score 71-80: Unlimited slots (warning shown) ⚠️
- Score 61-70: Maximum 3 slots per day 🔶
- Score 51-60: Maximum 2 slots per day 🔴
- Score ≤50: Cannot create slots ❌

---

## 🎯 VALIDATION CHECKLIST

Before considering the integration complete:

- [ ] Provider can view their Fix-Score on profile
- [ ] Tapping Fix-Score card navigates to details page
- [ ] Details page shows provider-specific violations (PROVIDER_*)
- [ ] Details page shows restorations/adjustments
- [ ] Status badge shows correct color (Red/Orange/Yellow/Green)
- [ ] Appeal button appears on active violations
- [ ] Date filters work (7/30/90 days, All)
- [ ] Pull-to-refresh updates the data
- [ ] Score updates when violations are added/removed
- [ ] Booking restrictions apply at correct score thresholds
- [ ] No USER_ violations appear in provider app
- [ ] Console shows "Using providerToken" not "Using customer token"

---

## 🔧 BACKEND VERIFICATION

### Required Database Fields

**User Table:**
```sql
penalty_points INT DEFAULT 100
is_suspended BOOLEAN DEFAULT false
suspended_at TIMESTAMP NULL
suspended_until TIMESTAMP NULL
```

**ServiceProviderDetails Table:**
```sql
penalty_points INT DEFAULT 100
is_suspended BOOLEAN DEFAULT false
suspended_at TIMESTAMP NULL
suspended_until TIMESTAMP NULL
```

**PenaltyViolation Table:**
```sql
violation_id INT PRIMARY KEY AUTO_INCREMENT
user_id INT NULL
provider_id INT NULL
violation_type_id INT
points_deducted INT
violation_details TEXT
status ENUM('active', 'appealed', 'reversed', 'expired')
appeal_reason TEXT NULL
appeal_status ENUM('pending', 'approved', 'rejected') NULL
created_at TIMESTAMP
```

**PenaltyAdjustment Table:**
```sql
adjustment_id INT PRIMARY KEY AUTO_INCREMENT
user_id INT NULL
provider_id INT NULL
adjustment_type ENUM('penalty', 'restore', 'bonus', 'reset')
points_adjusted INT
previous_points INT
new_points INT
reason TEXT
admin_id INT NULL
created_at TIMESTAMP
```

### Required Backend Endpoints

1. ✅ `GET /api/penalty/my-info` - Get current penalty points
2. ✅ `GET /api/penalty/my-violations` - Get violation history
3. ✅ `GET /api/penalty/my-adjustments` - Get restoration history
4. ✅ `POST /api/penalty/appeal/{id}` - Submit appeal
5. ⚠️ `GET /api/penalty/my-rewards` - Get reward stats (optional)

---

## 📞 SUPPORT

If issues persist after following this guide:

1. **Check Backend Logs**
   - Look for authentication errors
   - Verify database queries
   - Check JWT token decoding

2. **Check Frontend Console**
   - Look for failed API calls
   - Verify token exists in AsyncStorage
   - Check for JavaScript errors

3. **Test with Postman**
   - Verify endpoints work independently
   - Check response data structure
   - Validate token authentication

4. **Database Check**
   - Verify provider record exists
   - Check penalty_points field has correct value
   - Verify violation records have provider_id populated

---

**Last Updated:** November 5, 2025
**Status:** Integration in Progress
**Next Steps:** Backend endpoint verification and testing
