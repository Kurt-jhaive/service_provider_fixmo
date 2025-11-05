## 12. Service Provider App Implementation Guide

This section provides step-by-step instructions for implementing the Fix-Score system in the **Service Provider mobile app**, based on the customer app implementation.

### 12.1 Prerequisites

**Required Files to Copy from Customer App**:
1. `utils/penaltyService.ts` - API integration
2. `utils/penaltyHelpers.ts` - Business logic functions
3. `components/AnimatedScoreCircle.tsx` - Score visualization
4. `components/FixScoreCard.tsx` - Compact score display
5. `app/penalty-score-details.tsx` - Full details page

**Dependencies**:
```json
{
  "dependencies": {
    "react-native-reanimated": "^3.x.x",  // For animations
    "react-native-svg": "^13.x.x",         // For circular progress
    "@react-native-async-storage/async-storage": "^1.x.x"
  }
}
```

### 12.2 Step-by-Step Implementation

#### **Step 1: Copy Core Utility Files**

1. **Copy `penaltyService.ts`** to `serviceprovider-app/utils/`
   - Update API endpoints if needed (should use same backend)
   - Ensure `BACKEND_URL` environment variable is set
   - Test API calls with service provider token

2. **Copy `penaltyHelpers.ts`** to `serviceprovider-app/utils/`
   - **UPDATE**: Modify `getBookingLimit()` function for providers:
   ```typescript
   export const getBookingLimit = (points: number, userType: 'customer' | 'provider'): number | null => {
     if (points >= 81) return null;  // Unlimited
     if (points >= 71) return null;  // Warning, but no limit
     if (points >= 61) return 3;     // PROVIDER: 3 slots per day (LIMITED)
     if (points >= 51) return 2;     // PROVIDER: 2 slots per day (RESTRICTED)
     return 0;                       // DEACTIVATED
   };
   ```

3. **Copy `AnimatedScoreCircle.tsx`** to `serviceprovider-app/components/`
   - No changes needed
   - Ensure react-native-reanimated is configured

#### **Step 2: Add Fix-Score to Provider Profile**

**File**: `serviceprovider-app/app/(tabs)/profile.tsx`

**Add Imports**:
```typescript
import FixScoreCard from '../components/FixScoreCard';
import { getPenaltyInfo } from '../../utils/penaltyService';
```

**Add State Variables**:
```typescript
const [penaltyScore, setPenaltyScore] = useState<number>(100);
const [isSuspended, setIsSuspended] = useState<boolean>(false);
const [scoreLastUpdated, setScoreLastUpdated] = useState<string>('');
```

**Add Data Loading Function**:
```typescript
const loadPenaltyScore = async () => {
  try {
    const response = await getPenaltyInfo();
    
    if (response.success && response.data) {
      setPenaltyScore(response.data.current_score || 100);
      setIsSuspended(response.data.is_suspended || false);
      
      // Format last updated time
      if (response.data.last_updated) {
        const lastUpdate = new Date(response.data.last_updated);
        const now = new Date();
        const diffHours = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60));
        
        if (diffHours < 1) {
          setScoreLastUpdated('just now');
        } else if (diffHours < 24) {
          setScoreLastUpdated(`${diffHours}h ago`);
        } else {
          const diffDays = Math.floor(diffHours / 24);
          setScoreLastUpdated(`${diffDays}d ago`);
        }
      }
    }
  } catch (error) {
    console.error('Error loading penalty score:', error);
  }
};
```

**Call in useEffect**:
```typescript
useEffect(() => {
  loadProviderData();
  loadPenaltyScore();  // Add this line
}, []);

// Also refresh on screen focus
useFocusEffect(
  useCallback(() => {
    loadPenaltyScore();
  }, [])
);
```

**Add FixScoreCard Component** (below provider info, above menu items):
```tsx
<ScrollView>
  {/* Provider Profile Header */}
  <View style={styles.profileHeader}>
    {/* ... existing profile photo and name ... */}
  </View>

  {/* ADD FIX-SCORE CARD HERE */}
  <FixScoreCard
    score={penaltyScore}
    isSuspended={isSuspended}
    lastUpdated={scoreLastUpdated}
  />

  {/* Menu Items */}
  <ProfileCard
    label="Edit Profile"
    iconName="create-outline"
    onPress={() => router.push("/editprofile")}
  />
  
  <ProfileCard
    label="Fix-Score Details"
    iconName="speedometer-outline"
    onPress={() => router.push("/penalty-score-details")}
  />
  
  {/* ... other menu items ... */}
</ScrollView>
```

#### **Step 3: Create Penalty Details Page**

**File**: `serviceprovider-app/app/penalty-score-details.tsx`

1. **Copy entire file** from customer app
2. **Update userType**:
   ```typescript
   const userType = 'provider'; // Changed from 'customer'
   ```

3. **Update Status Messages** (optional customization):
   ```typescript
   const getStatusDescription = (tier: number) => {
     if (tier === 5) {
       return "Your account is deactivated. You cannot create service slots or receive bookings.";
     }
     if (tier === 4) {
       return "Your account is restricted. You can only create up to 2 time slots per day.";
     }
     if (tier === 3) {
       return "Your account is limited. You can create up to 3 time slots per day.";
     }
     if (tier === 2) {
       return "Your account is at risk. Continue maintaining good service to avoid restrictions.";
     }
     return "Your account is in good standing. Keep up the excellent service!";
   };
   ```

#### **Step 4: Integrate Booking Restrictions**

**File**: `serviceprovider-app/app/(tabs)/availability.tsx` (or wherever slots are created)

**Add Imports**:
```typescript
import { getPenaltyInfo } from '../../utils/penaltyService';
import { canCreateBooking, getBookingLimit } from '../../utils/penaltyHelpers';
```

**Check Before Creating Slot**:
```typescript
const handleCreateSlot = async () => {
  try {
    // Check penalty score first
    const penaltyResponse = await getPenaltyInfo();
    
    if (!penaltyResponse.success) {
      Alert.alert('Error', 'Could not verify your account status');
      return;
    }
    
    const penaltyInfo = penaltyResponse.data;
    
    // Check if deactivated
    if (penaltyInfo.is_suspended || penaltyInfo.current_score <= 50) {
      Alert.alert(
        'Account Deactivated',
        'Your account is deactivated due to low Fix-Score. Please check your Fix-Score page for more information.',
        [
          { text: 'View Fix-Score', onPress: () => router.push('/penalty-score-details') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }
    
    // Count existing slots for today
    const today = new Date().toISOString().split('T')[0];
    const todaySlots = slots.filter(slot => slot.date === today);
    
    // Check booking limit
    const bookingCheck = canCreateBooking(
      penaltyInfo.current_score,
      'provider',
      todaySlots.length
    );
    
    if (!bookingCheck.allowed) {
      const limit = getBookingLimit(penaltyInfo.current_score, 'provider');
      Alert.alert(
        'Slot Limit Reached',
        `Your Fix-Score (${penaltyInfo.current_score}) restricts you to ${limit} slots per day. Current slots today: ${todaySlots.length}`,
        [
          { text: 'View Fix-Score', onPress: () => router.push('/penalty-score-details') },
          { text: 'OK', style: 'cancel' }
        ]
      );
      return;
    }
    
    // Proceed with slot creation
    // ... existing slot creation code ...
    
  } catch (error) {
    console.error('Error creating slot:', error);
    Alert.alert('Error', 'Failed to create slot');
  }
};
```

**Add Warning Badge** (if approaching limit):
```tsx
{penaltyScore < 81 && penaltyScore > 50 && (
  <View style={styles.warningBanner}>
    <Ionicons name="warning" size={20} color="#F59E0B" />
    <Text style={styles.warningText}>
      Your Fix-Score ({penaltyScore}) is {penaltyScore >= 71 ? 'at risk' : 'limited'}. 
      {penaltyScore < 71 && ` You can create up to ${getBookingLimit(penaltyScore, 'provider')} slots per day.`}
    </Text>
  </View>
)}
```

#### **Step 5: Add Deactivation Modal**

**File**: `serviceprovider-app/app/(tabs)/profile.tsx`

**Add State**:
```typescript
const [showDeactivatedModal, setShowDeactivatedModal] = useState(false);
```

**Add Background Check** (similar to customer app):
```typescript
useFocusEffect(
  useCallback(() => {
    let isActive = true;

    const checkActivationStatus = async () => {
      try {
        const penaltyResponse = await getPenaltyInfo();
        
        if (penaltyResponse.success && penaltyResponse.data) {
          const isDeactivated = 
            penaltyResponse.data.is_suspended || 
            penaltyResponse.data.current_score <= 50;
          
          if (isDeactivated && !showDeactivatedModal && isActive) {
            setShowDeactivatedModal(true);
          }
        }
      } catch (error) {
        console.error('Activation status check error:', error);
      }
    };

    checkActivationStatus();
    const interval = setInterval(checkActivationStatus, 30000); // Every 30s

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [showDeactivatedModal])
);
```

**Add Modal Component**:
```tsx
<Modal
  visible={showDeactivatedModal}
  transparent={true}
  animationType="fade"
  onRequestClose={() => {}}
>
  <View style={{
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  }}>
    <View style={{
      backgroundColor: 'white',
      borderRadius: 20,
      padding: 30,
      width: '90%',
      maxWidth: 400,
    }}>
      {/* Icon */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <View style={{
          backgroundColor: '#fee2e2',
          borderRadius: 50,
          width: 80,
          height: 80,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name="lock-closed" size={40} color="#DC2626" />
        </View>
      </View>

      {/* Title */}
      <Text style={{
        fontSize: 24,
        fontWeight: 'bold',
        color: '#DC2626',
        textAlign: 'center',
        marginBottom: 15,
      }}>
        Account Deactivated
      </Text>

      {/* Message */}
      <Text style={{
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 25,
      }}>
        Your account has been deactivated due to low Fix-Score. You cannot create service slots or receive bookings until your score is restored.
      </Text>

      {/* Fix-Score Info */}
      <View style={{
        backgroundColor: '#fef3c7',
        padding: 15,
        borderRadius: 10,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
      }}>
        <Text style={{ fontSize: 14, color: '#92400e', lineHeight: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>Fix-Score:</Text> {penaltyScore}/100
          {'\n\n'}
          To reactivate your account, your Fix-Score must be above 50 points. You can appeal violations or contact admin for assistance.
        </Text>
      </View>

      {/* Actions */}
      <TouchableOpacity
        onPress={() => {
          setShowDeactivatedModal(false);
          router.push('/penalty-score-details');
        }}
        style={{
          backgroundColor: '#DC2626',
          paddingVertical: 15,
          borderRadius: 25,
          marginBottom: 12,
        }}
      >
        <Text style={{
          color: 'white',
          fontSize: 16,
          fontWeight: '600',
          textAlign: 'center',
        }}>
          View Fix-Score & Appeal
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          setShowDeactivatedModal(false);
          router.push('/report'); // Or contact support page
        }}
        style={{
          backgroundColor: '#f3f4f6',
          paddingVertical: 15,
          borderRadius: 25,
        }}
      >
        <Text style={{
          color: '#374151',
          fontSize: 16,
          fontWeight: '600',
          textAlign: 'center',
        }}>
          Contact Support
        </Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
```

### 12.3 Service Provider Specific Violations

**Common Provider Violations**:

| Violation Type | Points Deducted | Description |
|----------------|-----------------|-------------|
| Provider No-Show | -20 | Did not arrive at scheduled appointment |
| Late Arrival (>30min) | -10 | Arrived significantly late |
| Poor Service Quality | -15 | Customer complaint verified by admin |
| Fake Credentials | -50 | Submitted false documents |
| Inappropriate Behavior | -25 | Unprofessional conduct |
| Incomplete Work | -15 | Left job unfinished |
| Safety Violation | -30 | Unsafe practices reported |

**Auto-Deduction Triggers**:
- Customer reports no-show (with evidence) → -20 points
- Multiple late arrivals in a week → -10 points per occurrence
- Verified complaint → Admin assigns appropriate penalty

### 12.4 Testing Checklist

After implementation, verify:

**Profile Page**:
- [ ] FixScoreCard displays current score
- [ ] Tapping card navigates to details page
- [ ] Score updates when violations change
- [ ] Last updated time shows correctly

**Penalty Details Page**:
- [ ] Score circle animates smoothly
- [ ] Violation history loads
- [ ] Date filtering works (7/30/90 days)
- [ ] Appeal button appears for active violations
- [ ] Status badges show correct colors

**Booking Restrictions**:
- [ ] Cannot create slots when deactivated (score ≤ 50)
- [ ] Slot creation limited at score 51-60 (2 slots/day)
- [ ] Slot creation limited at score 61-70 (3 slots/day)
- [ ] Warning shown at score 71-80
- [ ] No restrictions at score 81-100

**Deactivation Modal**:
- [ ] Shows when score ≤ 50
- [ ] Updates every 30 seconds
- [ ] "View Fix-Score" button works
- [ ] "Contact Support" button works
- [ ] Cannot be dismissed without action

**Appeal System**:
- [ ] Can submit appeal with reason
- [ ] Appeal status updates (pending/approved/rejected)
- [ ] Points restored when appeal approved
- [ ] Cannot appeal same violation twice

---

**End of Service Provider Implementation Guide**
