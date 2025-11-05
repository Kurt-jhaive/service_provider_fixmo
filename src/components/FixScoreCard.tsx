import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getStatusText } from '../utils/penaltyHelpers';
import AnimatedScoreCircle from './AnimatedScoreCircle';

interface FixScoreCardProps {
  score: number;
  isSuspended: boolean;
  lastUpdated?: string;
}

const FixScoreCard: React.FC<FixScoreCardProps> = ({ score, isSuspended, lastUpdated }) => {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getStatusColor = () => {
    if (isSuspended || score <= 50) return '#DC2626';
    if (score >= 81) return '#10B981';
    if (score >= 71) return '#F59E0B';
    if (score >= 61) return '#FB923C';
    return '#EF4444';
  };

  const statusText = getStatusText(score, isSuspended);
  const statusColor = getStatusColor();

  return (
    <Animated.View 
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Fix-Score</Text>
        <TouchableOpacity onPress={() => router.push('/provider/integration/penalty-score-details')}>
          <Ionicons name="information-circle-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.circleContainer}>
          <AnimatedScoreCircle score={score} />
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.statusContainer}>
            <Text style={styles.updateText}>
              {lastUpdated ? `Updated ${lastUpdated}` : 'Updated recently'}
            </Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Your credit score is: </Text>
              <Text style={[styles.statusValue, { color: statusColor }]}>
                {statusText === 'GOOD STANDING' ? 'Good' : 
                 statusText === 'AT RISK' ? 'Fair' :
                 statusText === 'LIMITED' ? 'Poor' :
                 statusText === 'RESTRICTED' ? 'Very Poor' : 'Critical'}
              </Text>
            </View>
            <Text style={styles.compareText}>
              {score >= 70 
                ? 'Your score is higher than average of all users'
                : 'Your score needs improvement'}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  content: {
    alignItems: 'center',
  },
  circleContainer: {
    marginBottom: 20,
  },
  detailsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    width: '100%',
  },
  updateText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  compareText: {
    fontSize: 13,
    color: '#60A5FA',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default FixScoreCard;
