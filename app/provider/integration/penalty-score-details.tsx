import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Modal,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedScoreCircle from 'src/components/AnimatedScoreCircle';
import { getStatusColor, getStatusText } from 'src/utils/penaltyHelpers';
import {
    getPenaltyInfo,
    getRestorationHistory,
    getRewardStats,
    getViolationHistory,
} from 'src/utils/penaltyService';

const PenaltyScorePage = () => {
  const router = useRouter();
  const [penaltyInfo, setPenaltyInfo] = useState<any>(null);
  const [violations, setViolations] = useState<any[]>([]);
  const [filteredViolations, setFilteredViolations] = useState<any[]>([]);
  const [rewardStats, setRewardStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]); // Combined violations and restorations
  const [filteredHistory, setFilteredHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | '90days'>('all');
  const [currentProviderId, setCurrentProviderId] = useState<string | null>(null);

  const userType = 'provider'; // Service Provider App

  // Use useFocusEffect to reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Prevent back to OTP screen - navigate to profile instead
      const onBackPress = () => {
        router.replace('/provider/onboarding/providerprofile');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      const checkAndLoadData = async () => {
        console.log('🔄 Screen focused, checking provider...');
        
        // Get current provider ID - check multiple sources
        let providerId = null;
        
        // Method 1: Check AsyncStorage providerId (most reliable for provider app)
        const storedProviderId = await AsyncStorage.getItem('providerId');
        if (storedProviderId) {
          providerId = storedProviderId;
          console.log('👤 Provider ID from AsyncStorage:', providerId);
        } else {
          // Method 2: Check userData object
          const userDataStr = await AsyncStorage.getItem('userData');
          if (userDataStr) {
            try {
              const userData = JSON.parse(userDataStr);
              providerId = userData.provider?.provider_id?.toString() || null;
              console.log('👤 Provider ID from userData:', providerId);
            } catch (e) {
              console.error('Error parsing userData:', e);
            }
          }
        }

        // Always clear and reload on focus to prevent stale data
        console.log('🔄 Provider ID - Current:', currentProviderId, '| New:', providerId);
        
        if (providerId !== currentProviderId) {
          console.log('🔄 Provider changed! Clearing all data...');
          setCurrentProviderId(providerId);
          
          // Force clear all state immediately
          setPenaltyInfo(null);
          setViolations([]);
          setFilteredViolations([]);
          setRewardStats(null);
          setHistory([]);
          setFilteredHistory([]);
          setDateFilter('all');
        }
        
        // Always load fresh data (prevents stale data issues)
        if (providerId) {
          console.log('♻️ Loading fresh data for provider:', providerId);
          await loadData();
        } else {
          console.warn('⚠️ No provider ID found, skipping data load');
        }
      };

      checkAndLoadData();

      // Cleanup when screen loses focus
      return () => {
        console.log('🧹 Screen unfocused, ready for next provider');
        subscription.remove();
      };
    }, [currentProviderId])
  );

  useEffect(() => {
    filterViolationsByDate();
  }, [history, dateFilter]);

  const filterViolationsByDate = () => {
    if (dateFilter === 'all') {
      setFilteredHistory(history);
      return;
    }

    const now = new Date();
    let daysAgo = 0;

    switch (dateFilter) {
      case '7days':
        daysAgo = 7;
        break;
      case '30days':
        daysAgo = 30;
        break;
      case '90days':
        daysAgo = 90;
        break;
    }

    const cutoffDate = new Date(now.setDate(now.getDate() - daysAgo));
    const filtered = history.filter(item => new Date(item.created_at) >= cutoffDate);
    setFilteredHistory(filtered);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Debug: Check token availability
      const providerToken = await AsyncStorage.getItem('providerToken');
      const customerToken = await AsyncStorage.getItem('token');
      const userDataStr = await AsyncStorage.getItem('userData');
      
      console.log('🔑 Provider Token exists:', !!providerToken);
      console.log('🔑 Customer Token exists:', !!customerToken);
      console.log('🔑 Provider Token (first 20 chars):', providerToken?.substring(0, 20));
      
      // Get current provider ID for additional filtering
      // Try multiple sources to find the provider ID
      let currentProviderIdForFilter = null;
      
      // Method 1: Check AsyncStorage providerId directly (most reliable)
      const storedProviderId = await AsyncStorage.getItem('providerId');
      if (storedProviderId) {
        currentProviderIdForFilter = parseInt(storedProviderId, 10);
        console.log('👤 Current Provider ID from AsyncStorage:', currentProviderIdForFilter);
      } else if (userDataStr) {
        // Method 2: Try to get from userData object
        try {
          const userData = JSON.parse(userDataStr);
          currentProviderIdForFilter = userData.provider?.provider_id || userData.provider_id;
          console.log('👤 Current Provider ID from userData:', currentProviderIdForFilter);
        } catch (e) {
          console.error('Error parsing userData for filtering:', e);
        }
      }
      
      // CRITICAL: If we can't determine the provider ID, don't load any data
      if (!currentProviderIdForFilter) {
        console.error('❌ Cannot determine current provider ID - aborting data load');
        console.error('Debug info:', {
          storedProviderId,
          userDataStr: userDataStr?.substring(0, 100),
        });
        Alert.alert(
          'Error',
          'Cannot determine your provider account. Please try logging out and back in.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }
      
      console.log('✅ Loading data for provider ID:', currentProviderIdForFilter);
      
      const [infoRes, violationsRes, rewardsRes, restorationsRes] = await Promise.all([
        getPenaltyInfo(),
        getViolationHistory(),
        getRewardStats(),
        getRestorationHistory(),
      ]);

      console.log('📊 Penalty Info Response:', infoRes);
      console.log('📊 Penalty Info Response Data:', JSON.stringify(infoRes.data, null, 2));
      
      if (infoRes.success && infoRes.data) {
        // Support both current_score (from documentation) and penalty_points (from current backend)
        const currentScore = infoRes.data.current_score || infoRes.data.penalty_points || 100;
        const isSuspended = infoRes.data.is_suspended || false;
        const tier = infoRes.data.tier || 1;
        
        console.log('✅ Current Score from backend:', currentScore);
        console.log('✅ Is Suspended:', isSuspended);
        console.log('✅ Tier:', tier);
        
        setPenaltyInfo({
          ...infoRes.data,
          current_score: currentScore,
          penalty_points: currentScore, // Keep both for backward compatibility
          is_suspended: isSuspended,
          tier: tier,
        });
        console.log('✅ Penalty Info Set with normalized fields');
      } else {
        console.error('❌ Penalty Info Error:', infoRes.error || 'No data returned');
        // Set default penalty info if none exists
        setPenaltyInfo({
          current_score: 100,
          penalty_points: 100,
          tier: 1,
          is_suspended: false,
          last_updated: new Date().toISOString(),
          status: 'Good Standing',
        });
        console.log('ℹ️ Using default penalty info (100 points, Good Standing)');
      }
      
      // Process violations with safe access to data
      const violationsList = violationsRes.success && violationsRes.data 
        ? (violationsRes.data.violations || []) 
        : [];
      
      console.log('📊 Raw violations count:', violationsList.length);
      console.log('📊 Sample raw violation:', violationsList[0]);
      
      // Filter to only show PROVIDER violations (where provider_id is not null and user_id is null)
      // Optional: Also filter by specific provider_id if available
      const providerViolations = violationsList.filter((v: any) => {
        const isProviderViolation = v.provider_id !== null && v.user_id === null;
        
        // CRITICAL: If we have a specific provider ID, ONLY show that provider's data
        if (currentProviderIdForFilter) {
          const matchesCurrentProvider = v.provider_id === currentProviderIdForFilter;
          if (!matchesCurrentProvider) {
            console.log('🚫 Rejecting violation from provider:', v.provider_id, '(current:', currentProviderIdForFilter, ')');
          }
          return isProviderViolation && matchesCurrentProvider;
        }
        
        return isProviderViolation;
      });
      
      setViolations(providerViolations);
      console.log('📊 Total violations returned:', violationsList.length);
      console.log('📊 Provider violations filtered:', providerViolations.length);
      console.log('📊 Sample provider violation:', providerViolations[0]);
      
      // Check if violations list includes any restorations (points with positive values)
      // Some backends might return restorations as part of violations with different status
      const actualViolations = providerViolations.filter((v: any) => {
        const points = v.penalty_points_deducted || v.points_deducted || v.penalty_points || v.points_deducted || 0;
        return points > 0; // Only keep actual violations (deductions)
      });
      
      const inlineRestorations = providerViolations.filter((v: any) => {
        const points = v.penalty_points_deducted || v.points_deducted || v.penalty_points || v.points_deducted || 0;
        return points < 0; // Negative points might indicate restoration
      }).map((v: any) => ({
        ...v,
        type: 'restoration',
        points_restored: Math.abs(v.penalty_points_deducted || v.points_deducted || v.penalty_points || v.points_deducted || 0)
      }));
      
      console.log('📊 Actual violations:', actualViolations.length);
      console.log('📊 Inline restorations found:', inlineRestorations.length);
      
      // Process restorations
      console.log('✅ Restorations Response Full:', JSON.stringify(restorationsRes, null, 2));
      console.log('✅ Restorations success flag:', restorationsRes.success);
      console.log('✅ Restorations error:', restorationsRes.error);
      
      const restorationsList = restorationsRes.success ? (restorationsRes.data || []) : [];
      console.log('✅ Restorations list before filtering:', restorationsList.length);
      console.log('✅ Sample raw restoration:', restorationsList[0]);
      
      // Filter to only show PROVIDER restorations (where provider_id is not null and user_id is null)
      // Optional: Also filter by specific provider_id if available
      const providerRestorations = restorationsList.filter((r: any) => {
        const isProviderRestoration = r.provider_id !== null && r.user_id === null;
        
        // CRITICAL: If we have a specific provider ID, ONLY show that provider's data
        if (currentProviderIdForFilter) {
          const matchesCurrentProvider = r.provider_id === currentProviderIdForFilter;
          if (!matchesCurrentProvider) {
            console.log('🚫 Rejecting restoration from provider:', r.provider_id, '(current:', currentProviderIdForFilter, ')');
          }
          return isProviderRestoration && matchesCurrentProvider;
        }
        
        return isProviderRestoration;
      });
      
      console.log('✅ Total restorations returned:', restorationsList.length);
      console.log('✅ Provider restorations filtered:', providerRestorations.length);
      console.log('✅ Sample provider restoration:', providerRestorations[0]);
      
      console.log('🧪 Using real backend data with provider filtering');
      
      // Combine and mark the type for each record
      const combinedHistory = [
        ...actualViolations.map((v: any) => ({ ...v, type: 'violation' })),
        ...inlineRestorations,
        ...providerRestorations.map((r: any) => ({ ...r, type: 'restoration' }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      console.log('📋 Combined history count:', combinedHistory.length);
      console.log('📋 Combined history sample:', combinedHistory.slice(0, 3));
      
      setHistory(combinedHistory);
      
      // Filter reward stats to only show provider rewards
      if (rewardsRes.success && rewardsRes.data) {
        const rewardData = rewardsRes.data;
        
        // Filter recent_rewards to only include provider rewards
        if (rewardData.recent_rewards && Array.isArray(rewardData.recent_rewards)) {
          const providerRewards = rewardData.recent_rewards.filter((r: any) => {
            const isProviderReward = r.provider_id !== null && r.user_id === null;
            
            // CRITICAL: If we have a specific provider ID, ONLY show that provider's data
            if (currentProviderIdForFilter) {
              const matchesCurrentProvider = r.provider_id === currentProviderIdForFilter;
              if (!matchesCurrentProvider) {
                console.log('🚫 Rejecting reward from provider:', r.provider_id, '(current:', currentProviderIdForFilter, ')');
              }
              return isProviderReward && matchesCurrentProvider;
            }
            
            return isProviderReward;
          });
          
          // Recalculate stats based on filtered provider rewards
          const providerRewardStats = {
            ...rewardData,
            recent_rewards: providerRewards,
            total_rewards: providerRewards.length,
            rewards_this_month: providerRewards.filter((r: any) => {
              const rewardDate = new Date(r.created_at);
              const now = new Date();
              return rewardDate.getMonth() === now.getMonth() && 
                     rewardDate.getFullYear() === now.getFullYear();
            }).length,
            total_points_earned: providerRewards.reduce((sum: number, r: any) => sum + (r.points_adjusted || 0), 0),
            points_earned_this_month: providerRewards
              .filter((r: any) => {
                const rewardDate = new Date(r.created_at);
                const now = new Date();
                return rewardDate.getMonth() === now.getMonth() && 
                       rewardDate.getFullYear() === now.getFullYear();
              })
              .reduce((sum: number, r: any) => sum + (r.points_adjusted || 0), 0)
          };
          
          setRewardStats(providerRewardStats);
          console.log('🎁 Filtered Provider Rewards:', providerRewardStats);
        } else {
          setRewardStats(rewardData);
          console.log('🎁 Rewards data (no recent_rewards to filter):', rewardData);
        }
      }
    } catch (error) {
      console.error('Error loading penalty data:', error);
      Alert.alert('Error', 'Failed to load penalty information');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Test function to manually check adjustments endpoint
  const testAdjustmentsEndpoint = async () => {
    console.log('🧪 Testing adjustments endpoint manually...');
    const result = await getRestorationHistory();
    console.log('🧪 Test result:', result);
    Alert.alert('Test Result', `Success: ${result.success}\nData count: ${result.data?.length || 0}\n\nCheck console for details`);
  };

  const handleContactAdmin = () => {
    Alert.alert(
      'Contact Admin',
      'Please contact our support team for account reactivation.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to Support', onPress: () => router.push('/provider/integration/report') }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#399d9d" />
        <Text style={styles.loadingText}>Loading penalty information...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#e7ecec" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => {
              // Always go back to provider profile for service provider app
              router.push('/provider/onboarding/providerprofile');
            }} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#399d9d" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fix-Score</Text>
          <TouchableOpacity onPress={() => setInfoModalVisible(true)} style={styles.infoButton}>
            <Ionicons name="information-circle-outline" size={24} color="#399d9d" />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Animated Score Circle Section */}
          <View style={styles.scoreSection}>
            <View style={styles.circleContainer}>
              <AnimatedScoreCircle score={penaltyInfo?.penalty_points || 100} />
            </View>
            <Text style={styles.scoreLabel}>Your Fix-Score</Text>
            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>Status: </Text>
              <Text style={[styles.statusValue, { color: getStatusColor(penaltyInfo?.penalty_points || 100, penaltyInfo?.is_suspended || false)[0] }]}>
                {getStatusText(penaltyInfo?.penalty_points || 100, penaltyInfo?.is_suspended || false)}
              </Text>
            </View>
            
            {/* Status Description */}
            <StatusDescription 
              points={penaltyInfo?.penalty_points || 100} 
              isSuspended={penaltyInfo?.is_suspended || false}
              userType={userType}
            />
            
            {penaltyInfo?.last_updated && (
              <Text style={styles.lastUpdated}>
                Last updated: {new Date(penaltyInfo.last_updated).toLocaleDateString()}
              </Text>
            )}
            {penaltyInfo?.is_suspended && (
              <View style={styles.suspendedBannerContainer}>
                <View style={styles.suspendedBanner}>
                  <Ionicons name="warning" size={20} color="#DC2626" />
                  <Text style={styles.suspendedText}>Account Deactivated</Text>
                </View>
                <TouchableOpacity 
                  style={styles.reportButton}
                  onPress={() => router.push('/provider/integration/report')}
                >
                  <Ionicons name="document-text-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.reportButtonText}>Report or Appeal</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Points History Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Points History</Text>
            
            {/* Date Filter Buttons */}
            <View style={styles.filterContainer}>
              <TouchableOpacity 
                style={[styles.filterButton, dateFilter === 'all' && styles.filterButtonActive]}
                onPress={() => setDateFilter('all')}
              >
                <Text style={[styles.filterButtonText, dateFilter === 'all' && styles.filterButtonTextActive]}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterButton, dateFilter === '7days' && styles.filterButtonActive]}
                onPress={() => setDateFilter('7days')}
              >
                <Text style={[styles.filterButtonText, dateFilter === '7days' && styles.filterButtonTextActive]}>7 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterButton, dateFilter === '30days' && styles.filterButtonActive]}
                onPress={() => setDateFilter('30days')}
              >
                <Text style={[styles.filterButtonText, dateFilter === '30days' && styles.filterButtonTextActive]}>30 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterButton, dateFilter === '90days' && styles.filterButtonActive]}
                onPress={() => setDateFilter('90days')}
              >
                <Text style={[styles.filterButtonText, dateFilter === '90days' && styles.filterButtonTextActive]}>90 Days</Text>
              </TouchableOpacity>
            </View>

            {filteredHistory.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>✨ No history found</Text>
                <Text style={styles.emptyStateSubtext}>
                  {dateFilter === 'all' ? 'Keep up the good work!' : 'No records in this period'}
                </Text>
              </View>
            ) : (
              filteredHistory.map((item, index) => (
                item.type === 'restoration' ? (
                  <RestorationCard
                    key={`restoration-${item.adjustment_id || index}`}
                    restoration={item}
                  />
                ) : (
                  <ViolationCard
                    key={`violation-${item.violation_id || index}`}
                    violation={item}
                  />
                )
              ))
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Fix-Score Info Modal */}
        <Modal
          visible={infoModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setInfoModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.infoModalContent}>
              <View style={styles.infoModalHeader}>
                <Text style={styles.infoModalTitle}>How Fix-Score Works</Text>
                <TouchableOpacity onPress={() => setInfoModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Good Standing Tier */}
                <View style={styles.tierCard}>
                  <View style={[styles.tierBadge, { backgroundColor: '#D1FAE5' }]}>
                    <Text style={[styles.tierBadgeText, { color: '#065F46' }]}>100-81 Points</Text>
                  </View>
                  <Text style={styles.tierTitle}>Good Standing</Text>
                  <Text style={styles.tierDescription}>
                    Your account is in excellent condition. You have full access to all booking features without any restrictions. Keep up the good work!
                  </Text>
                  <Text style={styles.tierRestriction}>• No booking limits</Text>
                  <Text style={styles.tierRestriction}>• Full platform access</Text>
                </View>

                {/* At Risk Tier */}
                <View style={styles.tierCard}>
                  <View style={[styles.tierBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.tierBadgeText, { color: '#92400E' }]}>80-71 Points</Text>
                  </View>
                  <Text style={styles.tierTitle}>At Risk</Text>
                  <Text style={styles.tierDescription}>
                    Your account has entered the warning level. You'll receive notifications reminding you to avoid late cancellations or no-shows.
                  </Text>
                  <Text style={styles.tierRestriction}>• No restrictions yet</Text>
                  <Text style={styles.tierRestriction}>• Marked as "At Risk" for admin</Text>
                </View>

                {/* Limited Access - 70 Points */}
                <View style={styles.tierCard}>
                  <View style={[styles.tierBadge, { backgroundColor: '#FED7AA' }]}>
                    <Text style={[styles.tierBadgeText, { color: '#9A3412' }]}>70 Points</Text>
                  </View>
                  <Text style={styles.tierTitle}>Limited Scheduling</Text>
                  <Text style={styles.tierDescription}>
                    Your account remains active, but scheduling capacity is now limited. You can only open up to two time slots per day, regardless of your usual availability. This is to encourage reliable attendance and discourage repeated late actions or cancellations.
                  </Text>
                  <Text style={styles.tierRestriction}>• Maximum 2 time slots per day</Text>
                  <Text style={styles.tierRestriction}>• Service listing remains normal</Text>
                  <Text style={styles.tierRestriction}>• Full profile visibility</Text>
                </View>

                {/* Restricted - 60 Points */}
                <View style={styles.tierCard}>
                  <View style={[styles.tierBadge, { backgroundColor: '#FECACA' }]}>
                    <Text style={[styles.tierBadgeText, { color: '#991B1B' }]}>60 Points</Text>
                  </View>
                  <Text style={styles.tierTitle}>Severe Restriction</Text>
                  <Text style={styles.tierDescription}>
                    Stricter limitations are now in effect. You can only offer two service slots per day. Your profile visibility in search results may be deprioritized, appearing lower than high-rated providers. This serves as a warning that continued unreliable performance may result in deactivation.
                  </Text>
                  <Text style={styles.tierRestriction}>• Only 2 service slots per day</Text>
                  <Text style={styles.tierRestriction}>• Deprioritized in search results</Text>
                  <Text style={styles.tierRestriction}>• Warning phase - improve to avoid deactivation</Text>
                </View>

                {/* Deactivated - 50 or Below */}
                <View style={styles.tierCard}>
                  <View style={[styles.tierBadge, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={[styles.tierBadgeText, { color: '#7F1D1D' }]}>≤50 Points</Text>
                  </View>
                  <Text style={styles.tierTitle}>Account Deactivated</Text>
                  <Text style={styles.tierDescription}>
                    Your account has been automatically deactivated. You have lost the ability to accept new bookings and your profile no longer appears in the service marketplace. To reactivate, you must undergo manual review by the admin team, which may include verification of behavior, review of no-show or misconduct logs, and potential reorientation on service expectations.
                  </Text>
                  <Text style={styles.tierRestriction}>• Cannot accept new bookings</Text>
                  <Text style={styles.tierRestriction}>• Profile hidden from marketplace</Text>
                  <Text style={styles.tierRestriction}>• Manual admin review required</Text>
                  <Text style={styles.tierRestriction}>• Score may be restored after review</Text>
                </View>

                <View style={styles.infoTipsBox}>
                  <Text style={styles.infoTipsTitle}>How to Improve Your Score:</Text>
                  <Text style={styles.infoTip}>• Complete bookings on time (+5 points each)</Text>
                  <Text style={styles.infoTip}>• Receive good ratings (+5 points per 5-star)</Text>
                  <Text style={styles.infoTip}>• Avoid late cancellations (&lt; 24 hours)</Text>
                  <Text style={styles.infoTip}>• Show up to scheduled appointments</Text>
                </View>
              </ScrollView>

              <TouchableOpacity
                style={styles.infoModalCloseButton}
                onPress={() => setInfoModalVisible(false)}
              >
                <Text style={styles.infoModalCloseButtonText}>Got it!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

// Helper Components
const StatusDescription = ({ points, isSuspended, userType }: { points: number; isSuspended: boolean; userType: 'customer' | 'provider' }) => {
  const getDescription = () => {
    if (isSuspended || points <= 50) {
      return {
        text: 'Account deactivated. Cannot accept new bookings. Manual admin review required for reactivation.',
        bgColor: '#FEE2E2',
        textColor: '#991B1B',
      };
    }
    if (points >= 81) {
      return {
        text: 'No restrictions. Full access to all booking features and normal visibility.',
        bgColor: '#D1FAE5',
        textColor: '#065F46',
      };
    }
    if (points >= 71) {
      return {
        text: 'No restrictions yet, but maintain good behavior to avoid penalties.',
        bgColor: '#FEF3C7',
        textColor: '#92400E',
      };
    }
    if (points === 70) {
      return {
        text: 'Limited scheduling: Maximum 2 time slots per day. Account remains active with normal visibility.',
        bgColor: '#FED7AA',
        textColor: '#9A3412',
      };
    }
    if (points === 60) {
      return {
        text: 'Severe restriction: Only 2 service slots per day.',
        bgColor: '#FECACA',
        textColor: '#991B1B',
      };
    }
    // Between 51-59 or 61-69
    if (points >= 61 && points <= 69) {
      return {
        text: 'Limited scheduling: Maximum 2 time slots per day.',
        bgColor: '#FED7AA',
        textColor: '#9A3412',
      };
    }
    return {
      text: 'Severe restriction: Only 2 service slots per day. Profile deprioritized in search results.',
      bgColor: '#FECACA',
      textColor: '#991B1B',
    };
  };

  const description = getDescription();

  return (
    <View style={[styles.statusDescriptionBox, { backgroundColor: description.bgColor }]}>
      <Text style={styles.statusDescriptionIcon}></Text>
      <Text style={[styles.statusDescriptionText, { color: description.textColor }]}>
        {description.text}
      </Text>
    </View>
  );
};

const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <View style={styles.statCard}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const RewardItem = ({ icon, label, value, points }: any) => (
  <View style={styles.rewardItem}>
    <Text style={styles.rewardIcon}>{icon}</Text>
    <View style={styles.rewardItemContent}>
      <Text style={styles.rewardItemLabel}>{label}</Text>
      <Text style={styles.rewardItemValue}>{value}</Text>
    </View>
    <Text style={styles.rewardItemPoints}>+{points}</Text>
  </View>
);

const ViolationCard = ({ violation }: any) => {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active':
        return { color: '#DC2626' };
      case 'reversed':
        return { color: '#10B981' };
      case 'expired':
        return { color: '#6B7280' };
      default:
        return { color: '#3B82F6' };
    }
  };

  // Get points deducted - try multiple possible field names
  const pointsDeducted = violation.penalty_points_deducted || 
                        violation.points_deducted || 
                        violation.penalty_points || 
                        violation.points || 0;

  return (
    <View style={styles.violationCard}>
      <View style={styles.violationHeader}>
        <View style={styles.violationTitleRow}>
          <Text style={styles.violationName}>
            {violation.violation_type?.violation_name || violation.violation_name || 'Violation'}
          </Text>
          <View style={styles.badgeContainer}>
            {violation.status === 'confirmed' && (
              <View style={styles.confirmedBadge}>
                <Text style={styles.confirmedBadgeText}>Confirmed</Text>
              </View>
            )}
            {violation.status === 'reversed' && (
              <View style={styles.reversedBadge}>
                <Text style={styles.reversedBadgeText}>Reversed</Text>
              </View>
            )}
            {violation.status === 'expired' && (
              <View style={styles.expiredBadge}>
                <Text style={styles.expiredBadgeText}>Expired</Text>
              </View>
            )}
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsBadgeText}>
                -{pointsDeducted} pts
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.violationDate}>
          {new Date(violation.created_at).toLocaleDateString()}
        </Text>
      </View>

      {violation.violation_details && (
        <Text style={styles.violationDetails}>{violation.violation_details}</Text>
      )}

      <View style={styles.violationFooter}>
        {violation.appeal_status && (
          <View style={styles.appealStatusContainer}>
            <Ionicons 
              name={
                violation.appeal_status === 'pending' ? 'time-outline' :
                violation.appeal_status === 'approved' ? 'checkmark-circle' :
                violation.appeal_status === 'rejected' ? 'close-circle' :
                'document-text-outline'
              } 
              size={16} 
              color={
                violation.appeal_status === 'pending' ? '#F59E0B' :
                violation.appeal_status === 'approved' ? '#10B981' :
                violation.appeal_status === 'rejected' ? '#DC2626' :
                '#6B7280'
              }
              style={{ marginRight: 6 }}
            />
            <Text style={styles.appealStatus}>
              Appeal: {violation.appeal_status.charAt(0).toUpperCase() + violation.appeal_status.slice(1)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const RestorationCard = ({ restoration }: { restoration: any }) => {
  // Get points restored - matching PenaltyAdjustment table fields
  const pointsRestored = restoration.points_adjusted || 
                         restoration.points_restored || 
                         restoration.points_added || 
                         restoration.points || 5; // Default to 5 if not specified

  const reason = restoration.reason || 
                 restoration.adjustment_type || 
                 restoration.restoration_reason || 
                 restoration.description || 
                 'Points Restored';

  const adjustmentType = restoration.adjustment_type || 'restore';
  const adjustmentLabel = adjustmentType === 'restore' ? 'Restored' : 
                         adjustmentType === 'bonus' ? 'Bonus' : 
                         adjustmentType === 'adjustment' ? 'Adjusted' : 'Restored';

  return (
    <View style={styles.restorationCard}>
      <View style={styles.violationHeader}>
        <View style={styles.violationTitleRow}>
          <Text style={styles.restorationName}>
            {reason}
          </Text>
          <View style={styles.badgeContainer}>
            <View style={styles.restoredBadge}>
              <Text style={styles.restoredBadgeText}>
                {adjustmentLabel}
              </Text>
            </View>
            <View style={styles.pointsRestoredBadge}>
              <Text style={styles.pointsRestoredBadgeText}>
                +{pointsRestored} pts
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.violationDate}>
          {new Date(restoration.created_at).toLocaleDateString()}
        </Text>
      </View>

      {(restoration.details || restoration.previous_points) && (
        <View style={styles.restorationDetailsContainer}>
          {restoration.details && (
            <Text style={styles.restorationDetails}>{restoration.details}</Text>
          )}
          {restoration.previous_points !== undefined && restoration.new_points !== undefined && (
            <Text style={styles.restorationPointsInfo}>
              Points: {restoration.previous_points} → {restoration.new_points}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const TipItem = ({ text }: { text: string }) => (
  <View style={styles.tipItem}>
    <Text style={styles.tipBullet}>•</Text>
    <Text style={styles.tipText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EBED',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  backButton: {
    padding: 4,
    width: 40,
  },
  infoButton: {
    padding: 4,
    width: 40,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1D1F',
    letterSpacing: 0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFB',
  },
  loadingText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '500',
  },
  scoreSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#008080',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  circleContainer: {
    marginBottom: 24,
  },
  scoreLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1D1F',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFB',
    borderRadius: 20,
  },
  statusLabel: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusDescriptionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    width: '100%',
  },
  statusDescriptionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  statusDescriptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  lastUpdated: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 8,
    fontWeight: '500',
  },
  suspendedBannerContainer: {
    marginTop: 20,
    width: '100%',
  },
  suspendedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  suspendedText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
    marginLeft: 12,
    letterSpacing: 0.3,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#008080',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 12,
    elevation: 3,
    shadowColor: '#008080',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  reportButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  section: {
    marginTop: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1D1F',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E8EBED',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  filterButtonActive: {
    backgroundColor: '#008080',
    borderColor: '#008080',
    elevation: 2,
    shadowColor: '#008080',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  rewardCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    elevation: 2,
  },
  rewardPoints: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#10B981',
    textAlign: 'center',
  },
  rewardLabel: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  rewardBreakdown: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    gap: 12,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rewardIcon: {
    fontSize: 24,
  },
  rewardItemContent: {
    flex: 1,
  },
  rewardItemLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  rewardItemValue: {
    fontSize: 12,
    color: '#6B7280',
  },
  rewardItemPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  rewardTip: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    fontSize: 13,
    color: '#92400E',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    padding: 48,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  emptyStateSubtext: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  violationCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  restorationCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  restorationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1D1F',
    flex: 1,
    letterSpacing: 0.2,
  },
  restorationDetailsContainer: {
    marginBottom: 8,
  },
  restorationDetails: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
    lineHeight: 22,
    fontWeight: '500',
  },
  restorationPointsInfo: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  restoredBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  restoredBadgeText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pointsRestoredBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pointsRestoredBadgeText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  violationHeader: {
    marginBottom: 12,
  },
  violationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  violationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1D1F',
    flex: 1,
    letterSpacing: 0.2,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  confirmedBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  confirmedBadgeText: {
    color: '#1E40AF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  reversedBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  reversedBadgeText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  expiredBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  expiredBadgeText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pointsBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pointsBadgeText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  violationDate: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  violationDetails: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
    lineHeight: 22,
    fontWeight: '500',
  },
  violationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
    marginTop: 4,
  },
  violationStatus: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  appealStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appealStatus: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  appealButton: {
    backgroundColor: '#008080',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#008080',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    flexDirection: 'row',
    alignItems: 'center',
  },
  appealButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tipsCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  tipBullet: {
    fontSize: 20,
    color: '#008080',
    marginRight: 12,
    marginTop: -2,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1D1F',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 20,
    fontWeight: '500',
    lineHeight: 22,
  },
  appealInput: {
    borderWidth: 1.5,
    borderColor: '#E8EBED',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 120,
    marginBottom: 20,
    backgroundColor: '#F8FAFB',
    textAlignVertical: 'top',
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E8EBED',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#008080',
    elevation: 2,
    shadowColor: '#008080',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Info Modal Styles
  infoModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 0,
    width: '90%',
    maxHeight: '85%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  infoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1D1F',
    letterSpacing: 0.3,
  },
  tierCard: {
    backgroundColor: '#F8FAFB',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginTop: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tierBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 12,
  },
  tierBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tierTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1A1D1F',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  tierDescription: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 16,
    fontWeight: '500',
  },
  tierRestriction: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  infoTipsBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoTipsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  infoTip: {
    fontSize: 15,
    color: '#1E40AF',
    marginTop: 8,
    fontWeight: '600',
    lineHeight: 22,
  },
  infoModalCloseButton: {
    backgroundColor: '#008080',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 14,
    alignItems: 'center',
    margin: 24,
    marginTop: 0,
    elevation: 3,
    shadowColor: '#008080',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  infoModalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default PenaltyScorePage;
