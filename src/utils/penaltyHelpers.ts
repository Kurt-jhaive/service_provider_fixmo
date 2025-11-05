/**
 * Get booking/slot limits based on penalty points
 */
export const getBookingLimit = (points: number, userType: 'customer' | 'provider'): number | null => {
  if (points <= 50) return 0; // Deactivated
  if (points >= 71) return null; // No limit
  if (points === 70 || (points >= 61 && points <= 69)) {
    // At 70 points: Maximum 2 time slots per day
    return userType === 'provider' ? 2 : 2;
  }
  if (points === 60 || (points >= 51 && points <= 59)) {
    // At 60 points: Only 2 service slots per day (stricter enforcement + deprioritized visibility)
    return userType === 'provider' ? 2 : 2;
  }
  return userType === 'customer' ? 1 : 2; // Fallback for any edge case
};

/**
 * Check if user can create a new booking/slot
 */
export const canCreateBooking = (
  points: number,
  userType: 'customer' | 'provider',
  currentCount: number
): {
  allowed: boolean;
  reason?: string;
  message?: string;
  limit?: number;
  currentCount?: number;
} => {
  const limit = getBookingLimit(points, userType);
  
  if (limit === 0) {
    return {
      allowed: false,
      reason: 'deactivated',
      message: 'Your account is deactivated. Manual admin review required for reactivation.',
    };
  }
  
  if (limit === null) {
    return { allowed: true };
  }
  
  if (currentCount >= limit) {
    const isLimitedScheduling = points === 70 || (points >= 61 && points <= 69);
    const isSevereRestriction = points === 60 || (points >= 51 && points <= 59);
    
    let message = '';
    if (userType === 'provider') {
      if (isLimitedScheduling) {
        message = `Limited scheduling: You can only open up to ${limit} time slots per day with your current Fix-Score (${points}).`;
      } else if (isSevereRestriction) {
        message = `Severe restriction: You can only offer ${limit} service slots per day with your current Fix-Score (${points})`;
      } else {
        message = `You can only create ${limit} slot${limit > 1 ? 's' : ''} per day with your current score.`;
      }
    } else {
      message = `You can only book ${limit} appointment${limit > 1 ? 's' : ''} at a time with your current score.`;
    }
    
    return {
      allowed: false,
      reason: 'limit_reached',
      message,
      limit,
      currentCount,
    };
  }
  
  return { allowed: true, limit, currentCount };
};

/**
 * Get tier info based on points
 */
export const getTierInfo = (points: number) => {
  if (points <= 50) {
    return {
      tier: 5,
      name: 'Deactivated',
      color: '#DC2626',
      description: 'Account deactivated. Manual admin review required.',
    };
  }
  if (points >= 81) {
    return {
      tier: 1,
      name: 'Good Standing',
      color: '#10B981',
      description: 'No restrictions. Full access.',
    };
  }
  if (points >= 71) {
    return {
      tier: 2,
      name: 'At Risk',
      color: '#F59E0B',
      description: 'Warning issued. No restrictions yet.',
    };
  }
  if (points === 70 || (points >= 61 && points <= 69)) {
    return {
      tier: 3,
      name: 'Limited Scheduling',
      color: '#FB923C',
      description: 'Maximum 2 time slots per day',
    };
  }
  return {
    tier: 4,
    name: 'Severe Restriction',
    color: '#EF4444',
    description: 'Only 2 slots per day. Deprioritized visibility.',
  };
};

/**
 * Get status color for UI display
 */
export const getStatusColor = (points: number, isSuspended: boolean): [string, string] => {
  if (isSuspended || points <= 50) return ['#DC2626', '#991B1B']; // Dark Red - Deactivated
  if (points >= 81) return ['#10B981', '#059669']; // Green - Good Standing
  if (points >= 71) return ['#F59E0B', '#D97706']; // Yellow - At Risk
  if (points >= 61) return ['#FB923C', '#EA580C']; // Orange - Limited
  return ['#EF4444', '#DC2626']; // Red - Restricted
};

/**
 * Get status text
 */
export const getStatusText = (points: number, isSuspended: boolean): string => {
  if (isSuspended || points <= 50) return 'DEACTIVATED';
  if (points >= 81) return 'GOOD STANDING';
  if (points >= 71) return 'AT RISK';
  if (points === 70 || (points >= 61 && points <= 69)) return 'LIMITED SCHEDULING';
  return 'SEVERE RESTRICTION';
};

/**
 * Get status message
 */
export const getStatusMessage = (points: number, isSuspended: boolean, userType: 'customer' | 'provider'): string => {
  if (isSuspended || points <= 50) {
    return 'Your account is deactivated. Manual admin review required for reactivation.';
  }
  if (points >= 81) {
    return 'Keep up the good work! Full access to all features.';
  }
  if (points >= 71) {
    return 'Your score is dropping. Maintain good behavior to avoid restrictions.';
  }
  if (points === 70 || (points >= 61 && points <= 69)) {
    return userType === 'provider'
      ? 'Limited scheduling: Maximum 2 time slots per day. Account remains active with normal visibility.'
      : 'Limited access. Maximum 2 bookings slots at a time.';
  }
  return userType === 'provider'
    ? 'Severe restriction: Only 2 service slots per day..'
    : 'Heavily restricted. Only 1 service slots  per day.';
};
