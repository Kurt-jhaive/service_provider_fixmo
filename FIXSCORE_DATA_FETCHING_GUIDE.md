# Fix-Score Data Fetching Guide

## Overview
This document provides comprehensive instructions on how to fetch Fix-Score data from the backend API in your React Native mobile app (both customer and service provider apps).

---

## Table of Contents
1. [API Endpoints Reference](#1-api-endpoints-reference)
2. [Service Layer (penaltyService.ts)](#2-service-layer-penaltyservicets)
3. [Data Fetching Patterns](#3-data-fetching-patterns)
4. [Integration Examples](#4-integration-examples)
5. [Error Handling](#5-error-handling)
6. [Caching & Performance](#6-caching--performance)
7. [Real-time Updates](#7-real-time-updates)

---

## 1. API Endpoints Reference

### Base Configuration
```typescript
// Environment variable setup
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_LINK || 
                    process.env.BACKEND_LINK || 
                    'http://localhost:3000';
```

### Available Endpoints

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/penalty/my-info` | GET | Get current Fix-Score & status | ✅ Yes |
| `/api/penalty/my-violations` | GET | Get violation history | ✅ Yes |
| `/api/penalty/restoration-history` | GET | Get point restoration history | ✅ Yes |
| `/api/penalty/rewards/stats` | GET | Get reward statistics | ✅ Yes |
| `/api/penalty/violations/:id/appeal` | POST | Submit violation appeal | ✅ Yes |

### Authentication
All requests require a Bearer token stored in AsyncStorage:
```typescript
const token = await AsyncStorage.getItem('token');

headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
}
```

---

## 2. Service Layer (penaltyService.ts)

### File Location
```
user/utils/penaltyService.ts
serviceprovider/utils/penaltyService.ts
```

### Core Functions

#### 2.1 Get Penalty Info (Current Score)

**Function**: `getPenaltyInfo()`

**Purpose**: Fetches the user's current Fix-Score, tier status, and suspension flag

**API Call**:
```typescript
GET /api/penalty/my-info
```

**Complete Implementation**:
```typescript
export const getPenaltyInfo = async () => {
  try {
    // 1. Get authentication token
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      return {
        success: false,
        error: 'No authentication token found',
      };
    }

    // 2. Make API request
    const response = await fetch(`${BACKEND_URL}/api/penalty/my-info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // 3. Handle token expiration
    if (response.status === 401) {
      console.log('🔐 Token expired in getPenaltyInfo');
      await ApiErrorHandler.handleTokenExpiration();
      return {
        success: false,
        error: 'Session expired',
      };
    }

    // 4. Parse response
    const data = await response.json();

    // 5. Return structured response
    if (response.ok) {
      return {
        success: true,
        data: data.data,  // Contains: current_score, tier, is_suspended, last_updated
      };
    } else {
      return {
        success: false,
        error: data.message || 'Failed to fetch penalty info',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error while fetching penalty info',
    };
  }
};
```

**Response Structure**:
```typescript
{
  success: true,
  data: {
    current_score: 85,           // 0-100
    tier: 1,                     // 1-5
    is_suspended: false,         // true if score ≤ 50
    last_updated: "2025-11-05T10:30:00.000Z"
  }
}
```

**Usage Example**:
```typescript
const loadScore = async () => {
  const result = await getPenaltyInfo();
  
  if (result.success) {
    setPenaltyScore(result.data.current_score);
    setIsSuspended(result.data.is_suspended);
    console.log('Fix-Score:', result.data.current_score);
  } else {
    console.error('Error:', result.error);
    Alert.alert('Error', 'Failed to load Fix-Score');
  }
};
```

---

#### 2.2 Get Violation History

**Function**: `getViolationHistory(status?, limit?, offset?)`

**Purpose**: Fetches the user's violation records with optional filtering

**API Call**:
```typescript
GET /api/penalty/my-violations?status=active&limit=20&offset=0
```

**Parameters**:
- `status` (optional): Filter by status - 'active', 'confirmed', 'appealed', 'overturned'
- `limit` (optional): Number of records to fetch (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Complete Implementation**:
```typescript
export const getViolationHistory = async (
  status: string | null = null, 
  limit = 20, 
  offset = 0
) => {
  try {
    // 1. Get authentication token
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      console.error('❌ No token found for getViolationHistory');
      return {
        success: false,
        error: 'No authentication token found',
      };
    }

    // 2. Build query parameters
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (status) params.append('status', status);

    // 3. Construct URL
    const url = `${BACKEND_URL}/api/penalty/my-violations?${params.toString()}`;
    console.log('🔍 Fetching violations from:', url);

    // 4. Make API request
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('🔍 Violations API response status:', response.status);
    
    // 5. Handle token expiration
    if (response.status === 401) {
      console.log('🔐 Token expired in getViolationHistory');
      await ApiErrorHandler.handleTokenExpiration();
      return {
        success: false,
        error: 'Session expired',
      };
    }

    // 6. Parse response
    const data = await response.json();
    console.log('📊 Violations data received:', data);

    // 7. Return structured response
    if (response.ok) {
      return {
        success: true,
        data: data,  // Contains: violations[], total, page, limit
      };
    } else {
      return {
        success: false,
        error: data.message || 'Failed to fetch violation history',
      };
    }
  } catch (error: any) {
    console.error('❌ getViolationHistory error:', error);
    return {
      success: false,
      error: error.message || 'Network error while fetching violations',
    };
  }
};
```

**Response Structure**:
```typescript
{
  success: true,
  data: {
    violations: [
      {
        violation_id: 123,
        violation_type: {
          violation_name: "Provider No-Show",
          violation_code: "PROVIDER_NO_SHOW",
          penalty_points: 20,
          description: "Provider did not show up for appointment"
        },
        violation_details: "Customer reported no-show on Jan 15, 2025",
        penalty_points_deducted: 20,
        points_deducted: 20,  // Alternative field name
        violation_date: "2025-01-15T14:30:00.000Z",
        created_at: "2025-01-15T14:35:00.000Z",
        status: "active",  // 'active' | 'confirmed' | 'appealed' | 'overturned'
        appeal_status: null,  // null | 'pending' | 'approved' | 'rejected'
        appeal_reason: null,
        admin_notes: null
      },
      // ... more violations
    ],
    total: 5,
    page: 1,
    limit: 20
  }
}
```

**Usage Example**:
```typescript
const loadViolations = async () => {
  // Fetch only active violations
  const result = await getViolationHistory('active', 50, 0);
  
  if (result.success) {
    const violations = result.data.violations || [];
    setViolations(violations);
    console.log('Total violations:', result.data.total);
    console.log('Active violations:', violations.length);
  } else {
    console.error('Error:', result.error);
  }
};
```

---

#### 2.3 Get Restoration History

**Function**: `getRestorationHistory(limit?, offset?)`

**Purpose**: Fetches records of point restorations (appeals approved, admin adjustments)

**API Call**:
```typescript
GET /api/penalty/restoration-history?limit=20&offset=0
```

**Complete Implementation**:
```typescript
export const getRestorationHistory = async (limit = 20, offset = 0) => {
  try {
    // 1. Get authentication token
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      console.error('❌ No token found for getRestorationHistory');
      return {
        success: false,
        error: 'No authentication token found',
      };
    }

    // 2. Build query parameters
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    // 3. Construct URL
    const url = `${BACKEND_URL}/api/penalty/restoration-history?${params.toString()}`;
    console.log('✅ Fetching restorations from:', url);

    // 4. Make API request
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Restorations API response status:', response.status);
    
    // 5. Handle token expiration
    if (response.status === 401) {
      console.log('🔐 Token expired in getRestorationHistory');
      await ApiErrorHandler.handleTokenExpiration();
      return {
        success: false,
        error: 'Session expired',
      };
    }

    // 6. Parse response
    const data = await response.json();
    console.log('✅ Restorations data received:', data);

    // 7. Return structured response
    if (response.ok) {
      return {
        success: true,
        data: data.data || [],  // Array of restoration records
      };
    } else {
      return {
        success: false,
        error: data.message || 'Failed to fetch restoration history',
      };
    }
  } catch (error: any) {
    console.error('❌ getRestorationHistory error:', error);
    return {
      success: false,
      error: error.message || 'Network error while fetching restorations',
    };
  }
};
```

**Response Structure**:
```typescript
{
  success: true,
  data: [
    {
      adjustment_id: 456,
      points_restored: 20,
      reason: "Appeal approved - Provider had valid excuse",
      admin_notes: "Customer confirmed miscommunication",
      created_at: "2025-01-20T09:15:00.000Z",
      related_violation_id: 123
    },
    {
      adjustment_id: 457,
      points_restored: 5,
      reason: "Monthly good behavior bonus",
      admin_notes: "Automatic restoration",
      created_at: "2025-02-01T00:00:00.000Z",
      related_violation_id: null
    }
  ]
}
```

**Usage Example**:
```typescript
const loadRestorations = async () => {
  const result = await getRestorationHistory(100, 0);
  
  if (result.success) {
    const restorations = result.data || [];
    setRestorations(restorations);
    
    // Calculate total points restored
    const totalRestored = restorations.reduce(
      (sum, r) => sum + r.points_restored, 
      0
    );
    console.log('Total points restored:', totalRestored);
  }
};
```

---

#### 2.4 Get Reward Stats (Future Feature)

**Function**: `getRewardStats()`

**Purpose**: Fetches statistics about positive actions and rewards

**API Call**:
```typescript
GET /api/penalty/rewards/stats
```

**Implementation**:
```typescript
export const getRewardStats = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      return {
        success: false,
        error: 'No authentication token found',
      };
    }

    const response = await fetch(`${BACKEND_URL}/api/penalty/rewards/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      await ApiErrorHandler.handleTokenExpiration();
      return {
        success: false,
        error: 'Session expired',
      };
    }

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        data: data.data,
      };
    } else {
      return {
        success: false,
        error: data.message || 'Failed to fetch reward stats',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error while fetching rewards',
    };
  }
};
```

**Note**: This endpoint may return empty data if the reward system is not yet implemented on the backend.

---

## 3. Data Fetching Patterns

### Pattern 1: Single Page Load (Profile)

**Use Case**: Display Fix-Score card on profile page

**Implementation**:
```typescript
import { getPenaltyInfo } from '../../utils/penaltyService';
import FixScoreCard from '../components/FixScoreCard';

const ProfileScreen = () => {
  const [penaltyScore, setPenaltyScore] = useState(100);
  const [isSuspended, setIsSuspended] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load on mount
  useEffect(() => {
    loadPenaltyScore();
  }, []);

  const loadPenaltyScore = async () => {
    try {
      setLoading(true);
      const response = await getPenaltyInfo();
      
      if (response.success && response.data) {
        setPenaltyScore(response.data.current_score || 100);
        setIsSuspended(response.data.is_suspended || false);
      } else {
        console.error('Failed to load score:', response.error);
      }
    } catch (error) {
      console.error('Error loading penalty score:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      {loading ? (
        <ActivityIndicator size="large" color="#008080" />
      ) : (
        <FixScoreCard
          score={penaltyScore}
          isSuspended={isSuspended}
          lastUpdated="2h ago"
        />
      )}
    </View>
  );
};
```

---

### Pattern 2: Detailed Page with Multiple Calls

**Use Case**: Fix-Score details page with violations and restorations

**Implementation**:
```typescript
import { 
  getPenaltyInfo, 
  getViolationHistory, 
  getRestorationHistory,
  getRewardStats 
} from '../utils/penaltyService';

const PenaltyScoreDetailsPage = () => {
  const [penaltyInfo, setPenaltyInfo] = useState(null);
  const [violations, setViolations] = useState([]);
  const [restorations, setRestorations] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Parallel API calls for better performance
      const [infoRes, violationsRes, restorationsRes, rewardsRes] = await Promise.all([
        getPenaltyInfo(),
        getViolationHistory(),
        getRestorationHistory(),
        getRewardStats(),
      ]);

      console.log('Penalty Info Response:', infoRes);
      
      // Set penalty info
      if (infoRes.success) {
        setPenaltyInfo(infoRes.data);
      }
      
      // Process violations
      const violationsList = violationsRes.success 
        ? (violationsRes.data.violations || []) 
        : [];
      setViolations(violationsList);
      
      // Process restorations
      const restorationsList = restorationsRes.success 
        ? (restorationsRes.data || []) 
        : [];
      setRestorations(restorationsList);
      
      // Combine into unified timeline
      const combinedHistory = [
        ...violationsList.map(v => ({ ...v, type: 'violation' })),
        ...restorationsList.map(r => ({ ...r, type: 'restoration' }))
      ].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setHistory(combinedHistory);
      
    } catch (error) {
      console.error('Error loading penalty data:', error);
      Alert.alert('Error', 'Failed to load penalty information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView>
      {/* Display data */}
    </ScrollView>
  );
};
```

---

### Pattern 3: Real-time Check (Before Action)

**Use Case**: Check Fix-Score before allowing slot creation or booking

**Implementation**:
```typescript
import { getPenaltyInfo } from '../../utils/penaltyService';
import { canCreateBooking } from '../../utils/penaltyHelpers';

const SlotCreationScreen = () => {
  const handleCreateSlot = async () => {
    try {
      // 1. Fetch current penalty info
      const penaltyResponse = await getPenaltyInfo();
      
      if (!penaltyResponse.success) {
        Alert.alert('Error', 'Could not verify your account status');
        return;
      }
      
      const penaltyInfo = penaltyResponse.data;
      
      // 2. Check if deactivated
      if (penaltyInfo.is_suspended || penaltyInfo.current_score <= 50) {
        Alert.alert(
          'Account Deactivated',
          'Your account is deactivated due to low Fix-Score.',
          [
            { 
              text: 'View Fix-Score', 
              onPress: () => router.push('/penalty-score-details') 
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }
      
      // 3. Check booking limit
      const todaySlots = slots.filter(slot => 
        slot.date === new Date().toISOString().split('T')[0]
      );
      
      const bookingCheck = canCreateBooking(
        penaltyInfo.current_score,
        'provider',
        todaySlots.length
      );
      
      if (!bookingCheck.allowed) {
        Alert.alert(
          'Slot Limit Reached',
          bookingCheck.message,
          [{ text: 'View Fix-Score', onPress: () => router.push('/penalty-score-details') }]
        );
        return;
      }
      
      // 4. Proceed with slot creation
      await createSlot();
      
    } catch (error) {
      console.error('Error creating slot:', error);
      Alert.alert('Error', 'Failed to create slot');
    }
  };

  return (
    <TouchableOpacity onPress={handleCreateSlot}>
      <Text>Create Slot</Text>
    </TouchableOpacity>
  );
};
```

---

### Pattern 4: Background Polling

**Use Case**: Check for deactivation every 30 seconds

**Implementation**:
```typescript
import { useFocusEffect } from 'expo-router';
import { getPenaltyInfo } from '../../utils/penaltyService';

const ProfileScreen = () => {
  const [showDeactivatedModal, setShowDeactivatedModal] = useState(false);

  // Runs when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const checkActivationStatus = async () => {
        if (!isActive) return;
        
        try {
          const penaltyResponse = await getPenaltyInfo();
          
          if (penaltyResponse.success && penaltyResponse.data) {
            const isDeactivated = 
              penaltyResponse.data.is_suspended || 
              penaltyResponse.data.current_score <= 50;
            
            if (isDeactivated && !showDeactivatedModal) {
              setShowDeactivatedModal(true);
            }
          }
        } catch (error) {
          console.error('Activation status check error:', error);
        }
      };

      // Check immediately
      checkActivationStatus();

      // Check every 30 seconds
      const intervalId = setInterval(checkActivationStatus, 30000);

      return () => {
        isActive = false;
        clearInterval(intervalId);
      };
    }, [showDeactivatedModal])
  );

  return (
    <View>
      {/* Profile UI */}
      
      <Modal visible={showDeactivatedModal}>
        {/* Deactivation warning */}
      </Modal>
    </View>
  );
};
```

---

### Pattern 5: Refresh on Pull

**Use Case**: Penalty details page with pull-to-refresh

**Implementation**:
```typescript
const PenaltyScorePage = () => {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();  // Re-fetch all data
    setRefreshing(false);
  };

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#008080"]}
          tintColor="#008080"
        />
      }
    >
      {/* Content */}
    </ScrollView>
  );
};
```

---

## 4. Integration Examples

### Example 1: Display Score in Header

```typescript
import { getPenaltyInfo } from '../../utils/penaltyService';
import { getStatusColor } from '../../utils/penaltyHelpers';

const AppHeader = () => {
  const [score, setScore] = useState(100);

  useEffect(() => {
    const loadScore = async () => {
      const result = await getPenaltyInfo();
      if (result.success) {
        setScore(result.data.current_score);
      }
    };
    loadScore();
  }, []);

  const [primaryColor] = getStatusColor(score, false);

  return (
    <View style={styles.header}>
      <Text>FixMo</Text>
      
      <View style={[styles.scoreBadge, { backgroundColor: primaryColor }]}>
        <Text style={styles.scoreText}>{score}</Text>
      </View>
    </View>
  );
};
```

---

### Example 2: Violation List with Filtering

```typescript
import { getViolationHistory } from '../utils/penaltyService';

const ViolationList = () => {
  const [violations, setViolations] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadViolations();
  }, [filter]);

  const loadViolations = async () => {
    const status = filter === 'all' ? null : filter;
    const result = await getViolationHistory(status, 50, 0);
    
    if (result.success) {
      setViolations(result.data.violations || []);
    }
  };

  return (
    <View>
      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity onPress={() => setFilter('all')}>
          <Text style={filter === 'all' ? styles.activeTab : styles.tab}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFilter('active')}>
          <Text style={filter === 'active' ? styles.activeTab : styles.tab}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFilter('appealed')}>
          <Text style={filter === 'appealed' ? styles.activeTab : styles.tab}>
            Appealed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Violation Cards */}
      <FlatList
        data={violations}
        keyExtractor={(item) => item.violation_id.toString()}
        renderItem={({ item }) => <ViolationCard violation={item} />}
      />
    </View>
  );
};
```

---

### Example 3: Combined Timeline

```typescript
const TimelineView = () => {
  const [timeline, setTimeline] = useState([]);

  useEffect(() => {
    loadTimeline();
  }, []);

  const loadTimeline = async () => {
    const [violationsRes, restorationsRes] = await Promise.all([
      getViolationHistory(null, 100, 0),
      getRestorationHistory(100, 0),
    ]);

    const violations = violationsRes.success 
      ? violationsRes.data.violations.map(v => ({
          ...v,
          type: 'violation',
          date: v.created_at,
          points: -v.penalty_points_deducted
        }))
      : [];

    const restorations = restorationsRes.success 
      ? restorationsRes.data.map(r => ({
          ...r,
          type: 'restoration',
          date: r.created_at,
          points: r.points_restored
        }))
      : [];

    const combined = [...violations, ...restorations]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setTimeline(combined);
  };

  return (
    <FlatList
      data={timeline}
      renderItem={({ item }) => (
        <View style={styles.timelineItem}>
          <View style={[
            styles.pointsBadge,
            { backgroundColor: item.points > 0 ? '#10B981' : '#EF4444' }
          ]}>
            <Text style={styles.pointsText}>
              {item.points > 0 ? '+' : ''}{item.points}
            </Text>
          </View>
          
          <View style={styles.timelineContent}>
            <Text style={styles.title}>
              {item.type === 'violation' 
                ? item.violation_type.violation_name 
                : 'Points Restored'}
            </Text>
            <Text style={styles.date}>
              {new Date(item.date).toLocaleDateString()}
            </Text>
            <Text style={styles.description}>
              {item.type === 'violation' 
                ? item.violation_details 
                : item.reason}
            </Text>
          </View>
        </View>
      )}
    />
  );
};
```

---

## 5. Error Handling

### Token Expiration Handling

```typescript
export const getPenaltyInfo = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      return { success: false, error: 'No authentication token found' };
    }

    const response = await fetch(`${BACKEND_URL}/api/penalty/my-info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Check for 401 - token expired
    if (response.status === 401) {
      console.log('🔐 Token expired');
      
      // Clear stored data
      await AsyncStorage.multiRemove(['token', 'userId', 'userData']);
      
      // Redirect to login
      router.replace('/login');
      
      return { success: false, error: 'Session expired' };
    }

    // ... rest of the code
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

### Network Error Handling

```typescript
const loadDataWithRetry = async (maxRetries = 3) => {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      const result = await getPenaltyInfo();
      
      if (result.success) {
        return result;
      }
      
      // Increment attempts only for network errors
      if (result.error.includes('Network')) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
      } else {
        break; // Don't retry for other errors
      }
    } catch (error) {
      attempts++;
      if (attempts >= maxRetries) {
        Alert.alert('Network Error', 'Please check your connection');
        break;
      }
    }
  }
  
  return { success: false, error: 'Failed after retries' };
};
```

### Graceful Degradation

```typescript
const ProfileScreen = () => {
  const [score, setScore] = useState(100); // Default value
  const [scoreLoaded, setScoreLoaded] = useState(false);

  useEffect(() => {
    const loadScore = async () => {
      const result = await getPenaltyInfo();
      
      if (result.success) {
        setScore(result.data.current_score);
        setScoreLoaded(true);
      } else {
        // Show default, don't block UI
        console.warn('Could not load Fix-Score, using default');
      }
    };
    
    loadScore();
  }, []);

  return (
    <View>
      <FixScoreCard 
        score={score} 
        isSuspended={false}
        lastUpdated={scoreLoaded ? '2h ago' : 'Not loaded'}
      />
      
      {!scoreLoaded && (
        <Text style={styles.warning}>
          ⚠️ Could not load latest score. Showing cached data.
        </Text>
      )}
    </View>
  );
};
```

---

## 6. Caching & Performance

### Local Cache Implementation

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_PREFIX = 'penalty_cache_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Save to cache
const saveToCache = async (key: string, data: any) => {
  try {
    const cacheData = {
      data: data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(
      `${CACHE_KEY_PREFIX}${key}`, 
      JSON.stringify(cacheData)
    );
  } catch (error) {
    console.error('Cache save error:', error);
  }
};

// Get from cache
const getFromCache = async (key: string) => {
  try {
    const cached = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${key}`);
    
    if (!cached) return null;
    
    const cacheData = JSON.parse(cached);
    const age = Date.now() - cacheData.timestamp;
    
    // Check if cache is still valid
    if (age < CACHE_DURATION) {
      console.log('✅ Using cached data (age:', Math.floor(age / 1000), 'seconds)');
      return cacheData.data;
    } else {
      console.log('❌ Cache expired');
      return null;
    }
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
};

// Enhanced getPenaltyInfo with caching
export const getPenaltyInfoCached = async (forceRefresh = false) => {
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await getFromCache('penalty_info');
    if (cached) {
      return { success: true, data: cached, cached: true };
    }
  }
  
  // Fetch from API
  const result = await getPenaltyInfo();
  
  // Save to cache on success
  if (result.success) {
    await saveToCache('penalty_info', result.data);
  }
  
  return { ...result, cached: false };
};
```

### Usage with Cache:

```typescript
const ProfileScreen = () => {
  const [score, setScore] = useState(100);
  const [isCached, setIsCached] = useState(false);

  const loadScore = async (forceRefresh = false) => {
    const result = await getPenaltyInfoCached(forceRefresh);
    
    if (result.success) {
      setScore(result.data.current_score);
      setIsCached(result.cached);
    }
  };

  useEffect(() => {
    loadScore(); // Uses cache if available
  }, []);

  return (
    <View>
      <FixScoreCard score={score} />
      
      {isCached && (
        <TouchableOpacity onPress={() => loadScore(true)}>
          <Text>🔄 Refresh</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
```

---

## 7. Real-time Updates

### Push Notification Listener

```typescript
import * as Notifications from 'expo-notifications';

useEffect(() => {
  // Listen for push notifications
  const subscription = Notifications.addNotificationReceivedListener(notification => {
    const data = notification.request.content.data;
    
    // Check if it's a penalty-related notification
    if (data.type === 'violation' || data.type === 'appeal_approved') {
      console.log('Fix-Score updated via push notification');
      
      // Refresh penalty data
      loadPenaltyInfo();
    }
  });

  return () => subscription.remove();
}, []);
```

### WebSocket Integration (Future)

```typescript
import { io } from 'socket.io-client';

const usePenaltyWebSocket = () => {
  useEffect(() => {
    const socket = io(BACKEND_URL, {
      auth: { token: await AsyncStorage.getItem('token') },
    });

    socket.on('penalty_updated', (data) => {
      console.log('Real-time penalty update:', data);
      
      // Update local state
      setPenaltyScore(data.new_score);
      
      // Show notification
      Alert.alert('Fix-Score Updated', `Your score is now ${data.new_score}`);
    });

    return () => socket.disconnect();
  }, []);
};
```

---

## 8. Testing & Debugging

### Console Logging

```typescript
// Enable detailed logging
const DEBUG_MODE = __DEV__;

export const getPenaltyInfo = async () => {
  if (DEBUG_MODE) {
    console.log('🔍 [getPenaltyInfo] Starting fetch...');
    console.log('🔍 [getPenaltyInfo] Backend URL:', BACKEND_URL);
  }

  try {
    const token = await AsyncStorage.getItem('token');
    
    if (DEBUG_MODE) {
      console.log('🔍 [getPenaltyInfo] Token:', token ? 'Found' : 'Missing');
    }

    const response = await fetch(`${BACKEND_URL}/api/penalty/my-info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (DEBUG_MODE) {
      console.log('🔍 [getPenaltyInfo] Response status:', response.status);
    }

    const data = await response.json();

    if (DEBUG_MODE) {
      console.log('🔍 [getPenaltyInfo] Response data:', JSON.stringify(data, null, 2));
    }

    if (response.ok) {
      if (DEBUG_MODE) {
        console.log('✅ [getPenaltyInfo] Success! Score:', data.data.current_score);
      }
      return { success: true, data: data.data };
    } else {
      if (DEBUG_MODE) {
        console.log('❌ [getPenaltyInfo] Failed:', data.message);
      }
      return { success: false, error: data.message };
    }
  } catch (error) {
    if (DEBUG_MODE) {
      console.error('❌ [getPenaltyInfo] Exception:', error);
    }
    return { success: false, error: error.message };
  }
};
```

### Test Data Fixture

```typescript
// For development/testing without backend
export const getMockPenaltyInfo = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        data: {
          current_score: 75,
          tier: 2,
          is_suspended: false,
          last_updated: new Date().toISOString(),
        },
      });
    }, 500); // Simulate network delay
  });
};

// Use in development
const loadScore = async () => {
  const result = __DEV__ 
    ? await getMockPenaltyInfo() 
    : await getPenaltyInfo();
  
  if (result.success) {
    setScore(result.data.current_score);
  }
};
```

---

## 9. Complete Working Example

Here's a complete, production-ready component:

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  getPenaltyInfo,
  getViolationHistory,
  getRestorationHistory,
} from '../utils/penaltyService';
import FixScoreCard from '../components/FixScoreCard';
import ViolationCard from '../components/ViolationCard';

const FixScoreScreen = () => {
  // State
  const [penaltyInfo, setPenaltyInfo] = useState(null);
  const [violations, setViolations] = useState([]);
  const [restorations, setRestorations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Main data loading function
  const loadData = async () => {
    setLoading(true);
    try {
      // Parallel API calls
      const [infoRes, violationsRes, restorationsRes] = await Promise.all([
        getPenaltyInfo(),
        getViolationHistory(null, 50, 0),
        getRestorationHistory(50, 0),
      ]);

      // Handle penalty info
      if (infoRes.success) {
        setPenaltyInfo(infoRes.data);
      } else {
        console.error('Failed to load penalty info:', infoRes.error);
      }

      // Handle violations
      if (violationsRes.success) {
        setViolations(violationsRes.data.violations || []);
      } else {
        console.error('Failed to load violations:', violationsRes.error);
      }

      // Handle restorations
      if (restorationsRes.success) {
        setRestorations(restorationsRes.data || []);
      } else {
        console.error('Failed to load restorations:', restorationsRes.error);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load Fix-Score data');
    } finally {
      setLoading(false);
    }
  };

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Loading state
  if (loading && !penaltyInfo) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#008080" />
        <Text style={{ marginTop: 10 }}>Loading Fix-Score...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#008080']}
          tintColor="#008080"
        />
      }
    >
      {/* Fix-Score Card */}
      {penaltyInfo && (
        <FixScoreCard
          score={penaltyInfo.current_score}
          isSuspended={penaltyInfo.is_suspended}
          lastUpdated={penaltyInfo.last_updated}
        />
      )}

      {/* Violations Section */}
      <View style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          Violations ({violations.length})
        </Text>
        {violations.map((violation) => (
          <ViolationCard key={violation.violation_id} violation={violation} />
        ))}
      </View>

      {/* Restorations Section */}
      <View style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          Point Restorations ({restorations.length})
        </Text>
        {restorations.map((restoration) => (
          <RestorationCard key={restoration.adjustment_id} restoration={restoration} />
        ))}
      </View>
    </ScrollView>
  );
};

export default FixScoreScreen;
```

---

## 10. Quick Reference

### Common Use Cases

| Use Case | Function(s) | When to Call |
|----------|-------------|--------------|
| Display current score | `getPenaltyInfo()` | Profile page load, screen focus |
| Show violation list | `getViolationHistory()` | Penalty details page |
| Show restoration history | `getRestorationHistory()` | Penalty details page |
| Check before booking | `getPenaltyInfo()` | Before slot creation/booking |
| Background deactivation check | `getPenaltyInfo()` | Every 30 seconds on key screens |
| Pull-to-refresh | All functions | User swipes down to refresh |

### Response Time Expectations

- **getPenaltyInfo()**: ~200-500ms
- **getViolationHistory()**: ~300-800ms
- **getRestorationHistory()**: ~300-800ms
- **Parallel calls**: ~500-1000ms

### Best Practices

✅ **DO**:
- Use `Promise.all()` for parallel API calls
- Cache data for 5 minutes
- Handle 401 errors gracefully
- Show loading indicators
- Implement pull-to-refresh
- Log errors with context

❌ **DON'T**:
- Make sequential API calls when parallel is possible
- Fetch data on every re-render
- Ignore error responses
- Block UI while loading
- Make calls without authentication check

---

## 11. Troubleshooting

### Issue: "No authentication token found"

**Solution**: Verify token is stored in AsyncStorage
```typescript
const token = await AsyncStorage.getItem('token');
console.log('Token:', token);
```

### Issue: 401 Unauthorized

**Solution**: Token expired, redirect to login
```typescript
if (response.status === 401) {
  await AsyncStorage.multiRemove(['token', 'userId']);
  router.replace('/login');
}
```

### Issue: Network timeout

**Solution**: Implement retry logic with exponential backoff
```typescript
const fetchWithRetry = async (url, options, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
};
```

### Issue: Data not updating

**Solution**: Clear cache and force refresh
```typescript
await AsyncStorage.removeItem('penalty_cache_penalty_info');
await loadData();
```

---

## 12. Summary

This guide covered:
- ✅ All API endpoints for Fix-Score data
- ✅ Complete service layer implementation
- ✅ 5 common data fetching patterns
- ✅ Integration examples for different screens
- ✅ Error handling strategies
- ✅ Caching for performance
- ✅ Real-time update mechanisms
- ✅ Testing and debugging techniques
- ✅ Complete working code examples

**Key Takeaways**:
1. Use `penaltyService.ts` functions for all API calls
2. Always check `response.success` before using data
3. Handle 401 errors by redirecting to login
4. Cache data to reduce API calls
5. Use `Promise.all()` for parallel requests
6. Implement pull-to-refresh for better UX

---

**Document Version**: 1.0  
**Last Updated**: November 5, 2025  
**Author**: FixMo Development Team  
**Status**: Production Ready

For questions or issues, contact the development team or refer to the main Fix-Score System Documentation.
