# Fix-Score Tier System - Complete Implementation

## Overview
The Fix-Score system has been updated with precise tier restrictions based on provider performance. This document outlines the exact rules and consequences at each score level.

---

## 📊 Fix-Score Tiers

### 🟢 **100-81 Points: Good Standing**
**Status:** Fully Active

**Restrictions:**
- ✅ No booking limits
- ✅ Full platform access
- ✅ Normal profile visibility
- ✅ Full scheduling capacity

**Description:**
Your account is in excellent condition. You have full access to all booking features without any restrictions. Keep up the good work!

---

### 🟡 **80-71 Points: At Risk**
**Status:** Active with Warning

**Restrictions:**
- ✅ No restrictions yet
- ⚠️ Marked as "At Risk" for admin monitoring
- ✅ Normal profile visibility
- ✅ Full scheduling capacity

**Description:**
Your account has entered the warning level. You'll receive notifications reminding you to avoid late cancellations or no-shows. Maintain good behavior to stay in good standing.

---

### 🟠 **70 Points: Limited Scheduling**
**Status:** Active with Capacity Limits

**Restrictions:**
- ⚠️ **Maximum 2 time slots per day**
- ✅ Service listing remains normal
- ✅ Full profile visibility in search
- ⚠️ Scheduling capacity limited

**Description:**
Your account remains active, but scheduling capacity is now limited. You can only open up to **two time slots per day**, regardless of your usual availability. This limitation is intended to encourage reliable attendance and discourage repeated late actions or cancellations. Service listing and visibility in the platform remain normal at this stage.

**Impact on Operations:**
- Can still accept bookings normally
- Profile appears in search results without penalty
- Restricted to creating only 2 appointment slots per day
- Designed to promote accountability

---

### 🔴 **60 Points: Severe Restriction**
**Status:** Active with Major Penalties

**Restrictions:**
- 🚫 **Only 2 service slots per day** (stricter enforcement)
- 📉 **Profile deprioritized in search results**
- ⚠️ Lower visibility than high-rated providers
- 🔴 Warning phase before deactivation

**Description:**
A stricter restriction is now applied. The provider can only offer **two service slots per day**. In addition, the provider's profile visibility in search results may be deprioritized, meaning their listing appears lower than high-rated providers. This state serves as a **warning phase**, signaling that continued unreliable performance may result in account deactivation.

**Impact on Operations:**
- Same slot limit as 70 points but with visibility penalty
- Listings appear lower in customer search results
- Reduced discoverability on the platform
- Final warning before deactivation
- Strong encouragement to improve behavior

---

### ⛔ **≤50 Points: Account Deactivated**
**Status:** Deactivated - Manual Review Required

**Restrictions:**
- ❌ **Cannot accept new bookings**
- ❌ **Profile hidden from marketplace**
- ⚠️ **Manual admin review required**
- 🔄 **Score may be restored after review**

**Description:**
The provider's account has been **automatically deactivated**. At this level, the provider loses the ability to accept new bookings and their profile will no longer appear in the service marketplace.

**Reactivation Process:**
To reactivate the account, the provider must undergo **manual review by the admin team**, which may include:
1. **Verification of behavior** - Review of recent activity and patterns
2. **Review of no-show or misconduct logs** - Assessment of violation history
3. **Potential reorientation** - Education on service expectations and platform policies
4. **Score restoration** - Upon successful review, account reinstated with restored Fix-Score value determined during admin evaluation

**No Self-Service Recovery:** Providers cannot reactivate their accounts independently at this level.

---

## 🔧 Technical Implementation

### Files Updated:

1. **`app/provider/integration/penalty-score-details.tsx`**
   - Updated tier cards in info modal with exact restrictions
   - Modified StatusDescription component to show accurate messages
   - Enhanced UI with modern design language

2. **`src/utils/penaltyHelpers.ts`**
   - `getBookingLimit()` - Returns slot limits based on exact score
   - `canCreateBooking()` - Validates if provider can create new slots with detailed messages
   - `getTierInfo()` - Provides tier metadata for UI display
   - `getStatusText()` - Returns status labels
   - `getStatusMessage()` - Returns user-friendly status descriptions

3. **`src/components/AnimatedScoreCircle.tsx`**
   - Enhanced visual design
   - Better size and typography
   - Added "/100" indicator

---

## 📱 User Experience Updates

### Visual Indicators:
- **Green (✅)**: Good Standing (81-100)
- **Yellow (⚠️)**: At Risk (71-80)
- **Orange (🔶)**: Limited Scheduling (61-70, with 70 as trigger)
- **Red (🚫)**: Severe Restriction (51-60, with 60 as trigger)
- **Dark Red (❌)**: Deactivated (≤50)

### Status Messages:
Each tier now displays clear, actionable information:
- Current restrictions
- Impact on visibility
- Steps needed for improvement
- Consequences of further decline

### Info Modal:
Providers can tap the info icon to see:
- Complete tier breakdown
- Exact point thresholds
- Specific restrictions per tier
- Tips for improving score
- Reactivation process details

---

## 🎯 Key Changes from Previous Version

### Slot Limits:
- **OLD:** 70-61 points = 3 slots/day, 60-51 points = 2 slots/day
- **NEW:** 70 points = 2 slots/day (normal visibility), 60 points = 2 slots/day (deprioritized visibility)

### Visibility Impact:
- **NEW:** At 60 points, profile is deprioritized in search results
- This provides differentiation between 70-point and 60-point tiers

### Deactivation:
- **Threshold:** ≤50 points (unchanged)
- **NEW:** Explicit manual admin review requirement
- **NEW:** Details about review process included in UI

### Messaging:
- More specific and actionable status descriptions
- Clear differentiation between warning phases
- Emphasis on reactivation process

---

## 🚀 Benefits

1. **Clear Accountability:** Providers understand exactly what happens at each score level
2. **Progressive Penalties:** Gradual increase in restrictions encourages improvement
3. **Visibility Control:** Search deprioritization at 60 points creates meaningful tier difference
4. **Admin Oversight:** Manual review at ≤50 ensures quality control
5. **Transparent Process:** Providers know what to expect and how to recover

---

## 📝 Testing Recommendations

### Test Cases:
1. ✅ Provider at 100 points - full access
2. ✅ Provider drops to 75 points - "At Risk" warning shown
3. ✅ Provider reaches 70 points - 2 slots/day limit enforced
4. ✅ Provider drops to 60 points - deprioritization + 2 slots/day
5. ✅ Provider reaches 50 points - account deactivated
6. ✅ Deactivated provider attempts booking - clear error message
7. ✅ Info modal displays all tiers correctly

### Backend Requirements:
- Slot creation validation at 70 and 60 points
- Search result ordering logic for 60-point providers
- Admin review workflow for ≤50 point reactivation
- Proper score restoration after admin approval

---

## 📞 Support Considerations

### Common Provider Questions:

**Q: Why can I only create 2 slots at 70 points?**
A: Limited scheduling encourages reliable attendance and helps you rebuild your Fix-Score through consistent performance.

**Q: What's the difference between 70 and 60 points?**
A: At 70 points, you have the same slot limit but normal visibility. At 60 points, your profile is deprioritized in search results, reducing discoverability.

**Q: How do I reactivate after deactivation?**
A: Contact admin support. You'll need to undergo a review process that includes behavior verification and possible reorientation. Your score will be restored upon successful review.

**Q: Can I appeal my score?**
A: Yes, use the "Report or Appeal" button on your Fix-Score page to submit an appeal with details.

---

## 🔄 Future Enhancements

Potential improvements for future versions:
- Automated restoration bonuses for consistent good performance
- Grace periods before tier downgrade
- Performance analytics dashboard
- Predictive warnings before tier changes
- Customer-visible reliability badges

---

**Last Updated:** November 5, 2025  
**Version:** 2.0  
**Status:** ✅ Implemented and Active
