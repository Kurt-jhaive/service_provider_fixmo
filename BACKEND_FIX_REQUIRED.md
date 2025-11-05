# Backend Fix Required - Provider Data Filtering

## 🔴 CRITICAL ISSUE

The backend penalty endpoints are **NOT filtering by provider_id**. They're returning ALL providers' data instead of just the authenticated provider's data.

---

## Problem

**Current Behavior:**
- Provider ID 1 logs in (has 80 points in database, no violations)
- Clicks Fix-Score
- Sees provider_id: 4's violations and restorations
- Score shows 100 instead of 80 from database

**Expected Behavior:**
- Provider ID 1 should ONLY see their own data
- Score should show 80 (from database)
- Should show "No violations recorded"

---

## Root Causes

### 1. `/api/penalty/my-info` Endpoint
**Issue:** Not returning database value OR not creating/updating penalty record for provider

**What happens:**
```json
// Current response
{
  "success": true
  // No data object!
}

// Should return
{
  "success": true,
  "data": {
    "penalty_points": 80,  // From database
    "is_suspended": false,
    "provider_id": 1,
    "last_updated": "2025-11-05T..."
  }
}
```

**Backend Fix Needed:**
```javascript
// In /api/penalty/my-info endpoint
router.get('/my-info', authenticate, async (req, res) => {
  try {
    const { providerId, userType } = req.user; // From JWT token
    
    // For PROVIDER requests
    if (userType === 'provider' || providerId) {
      // Query ServiceProviderDetails table
      let providerData = await prisma.serviceProviderDetails.findUnique({
        where: { provider_id: providerId },
        select: {
          penalty_points: true,
          is_suspended: true,
          suspended_at: true,
          suspended_until: true,
          updated_at: true,
        }
      });
      
      // If no penalty record exists, CREATE ONE with database defaults
      if (!providerData) {
        providerData = await prisma.serviceProviderDetails.update({
          where: { provider_id: providerId },
          data: {
            penalty_points: 100, // Or keep existing value
            is_suspended: false,
          },
          select: {
            penalty_points: true,
            is_suspended: true,
            suspended_at: true,
            suspended_until: true,
            updated_at: true,
          }
        });
      }
      
      return res.json({
        success: true,
        data: {
          penalty_points: providerData.penalty_points,
          is_suspended: providerData.is_suspended,
          suspended_at: providerData.suspended_at,
          suspended_until: providerData.suspended_until,
          last_updated: providerData.updated_at,
          provider_id: providerId, // Include for debugging
        }
      });
    }
    
    // For USER requests - similar logic for User table
    // ...
    
  } catch (error) {
    console.error('Error fetching penalty info:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch penalty info' });
  }
});
```

### 2. `/api/penalty/my-violations` Endpoint
**Issue:** Returns ALL providers' violations, not filtered by authenticated provider

**What happens:**
```javascript
// Current (WRONG) - Returns everything
SELECT * FROM PenaltyViolation WHERE provider_id IS NOT NULL;

// Should be (CORRECT) - Filter by authenticated provider
SELECT * FROM PenaltyViolation 
WHERE provider_id = [authenticated_provider_id] 
AND user_id IS NULL;
```

**Backend Fix Needed:**
```javascript
router.get('/my-violations', authenticate, async (req, res) => {
  try {
    const { userId, providerId, userType } = req.user; // From JWT token
    const { status, limit = 50, offset = 0 } = req.query;
    
    let whereClause = {};
    
    // CRITICAL: Filter by authenticated user/provider
    if (userType === 'provider' || providerId) {
      whereClause = {
        provider_id: parseInt(providerId), // MUST match authenticated provider
        user_id: null, // Ensure it's a provider violation
      };
    } else if (userId) {
      whereClause = {
        user_id: parseInt(userId), // MUST match authenticated user
        provider_id: null, // Ensure it's a user violation
      };
    }
    
    // Add status filter if provided
    if (status) {
      whereClause.status = status;
    }
    
    console.log('🔍 Fetching violations with filter:', whereClause);
    
    const violations = await prisma.penaltyViolation.findMany({
      where: whereClause,
      include: {
        violation_type: true,
      },
      orderBy: { created_at: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });
    
    console.log(`✅ Found ${violations.length} violations for provider ${providerId}`);
    
    res.json({
      success: true,
      data: {
        violations: violations,
        total: violations.length,
      }
    });
    
  } catch (error) {
    console.error('Error fetching violations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch violations' });
  }
});
```

### 3. `/api/penalty/my-adjustments` Endpoint
**Issue:** Returns ALL providers' restorations, not filtered by authenticated provider

**Backend Fix Needed:**
```javascript
router.get('/my-adjustments', authenticate, async (req, res) => {
  try {
    const { userId, providerId, userType } = req.user; // From JWT token
    const { limit = 50, offset = 0 } = req.query;
    
    let whereClause = {};
    
    // CRITICAL: Filter by authenticated user/provider
    if (userType === 'provider' || providerId) {
      whereClause = {
        provider_id: parseInt(providerId), // MUST match authenticated provider
        user_id: null, // Ensure it's for a provider
        points_adjusted: { gt: 0 }, // Only positive adjustments (restorations)
      };
    } else if (userId) {
      whereClause = {
        user_id: parseInt(userId), // MUST match authenticated user
        provider_id: null,
        points_adjusted: { gt: 0 },
      };
    }
    
    console.log('🔍 Fetching adjustments with filter:', whereClause);
    
    const adjustments = await prisma.penaltyAdjustment.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });
    
    console.log(`✅ Found ${adjustments.length} adjustments for provider ${providerId}`);
    
    res.json({
      success: true,
      data: adjustments, // or { adjustments: adjustments }
    });
    
  } catch (error) {
    console.error('Error fetching adjustments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch adjustments' });
  }
});
```

---

## JWT Token Structure Required

Your JWT token MUST contain provider/user identification:

```javascript
// When creating provider token (login/register)
const token = jwt.sign({
  providerId: provider.provider_id,
  userId: null,
  userType: 'provider',
  email: provider.email,
}, JWT_SECRET);

// When creating user token
const token = jwt.sign({
  userId: user.user_id,
  providerId: null,
  userType: 'customer',
  email: user.email,
}, JWT_SECRET);
```

---

## Middleware Fix

Your authenticate middleware must extract this information:

```javascript
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach to request
    req.user = {
      userId: decoded.userId,
      providerId: decoded.providerId,
      userType: decoded.userType, // 'customer' or 'provider'
      email: decoded.email,
    };
    
    console.log('🔐 Authenticated:', req.user);
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

---

## Testing Verification

After fixing the backend, test with curl:

### Test 1: Get Penalty Info
```bash
curl -X GET "http://localhost:3000/api/penalty/my-info" \
  -H "Authorization: Bearer [PROVIDER_TOKEN]"

# Should return:
{
  "success": true,
  "data": {
    "penalty_points": 80,  # Your database value
    "is_suspended": false,
    "provider_id": 1       # Your provider ID
  }
}
```

### Test 2: Get Violations
```bash
curl -X GET "http://localhost:3000/api/penalty/my-violations" \
  -H "Authorization: Bearer [PROVIDER_TOKEN]"

# Should return:
{
  "success": true,
  "data": {
    "violations": [],  # Empty for your provider
    "total": 0
  }
}
```

### Test 3: Get Adjustments
```bash
curl -X GET "http://localhost:3000/api/penalty/my-adjustments" \
  -H "Authorization: Bearer [PROVIDER_TOKEN]"

# Should return:
{
  "success": true,
  "data": []  # Empty for your provider
}
```

---

## Frontend Verification

After backend fix, check console logs in app:

**Expected logs for Provider ID 1:**
```
✅ Loading data for provider ID: 1
📊 Penalty Points from backend: 80  ← Should be 80, not 100!
📊 Raw violations count: 0           ← Should be 0 for you
📊 Provider violations filtered: 0
✅ Restorations list before filtering: 0  ← Should be 0 for you
✅ Provider restorations filtered: 0
📋 Combined history count: 0
```

**Fix-Score Page Should Show:**
- Animated circle: **80** (not 100)
- Status: Good Standing
- Violations: "No history found"
- Restorations: None

---

## Summary

✅ **Frontend is correct** - Properly filters by provider_id  
❌ **Backend is broken** - Returns all data instead of filtering

**Action Required:**
1. Fix JWT token to include `providerId` and `userType`
2. Fix `/api/penalty/my-info` to return database penalty_points
3. Fix `/api/penalty/my-violations` to filter by authenticated provider
4. Fix `/api/penalty/my-adjustments` to filter by authenticated provider
5. Add console.log in backend to verify filtering is working

**Priority:** 🔴 **CRITICAL** - Data leakage security issue

---

**Last Updated:** November 5, 2025  
**Status:** Backend fixes required  
**Affected:** All provider penalty endpoints
