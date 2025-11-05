import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

interface AnimatedScoreCircleProps {
  score: number;
  maxScore?: number;
  size?: number;
  strokeWidth?: number;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const AnimatedScoreCircle: React.FC<AnimatedScoreCircleProps> = ({
  score,
  maxScore = 100,
  size = 160,
  strokeWidth = 14,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const circleRef = useRef<any>(null);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = (score / maxScore) * 100;

  useEffect(() => {
    // Animate the circle
    Animated.timing(animatedValue, {
      toValue: percentage,
      duration: 1500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [percentage]);

  useEffect(() => {
    animatedValue.addListener((v) => {
      const strokeDashoffset = circumference - (circumference * v.value) / 100;
      if (circleRef?.current) {
        circleRef.current.setNativeProps({
          strokeDashoffset,
        });
      }
    });

    return () => {
      animatedValue.removeAllListeners();
    };
  }, []);

  // Determine color based on score
  const getColor = () => {
    if (score <= 50) return '#DC2626'; // Red - Deactivated
    if (score >= 81) return '#10B981'; // Green - Good
    if (score >= 71) return '#F59E0B'; // Yellow - At Risk
    if (score >= 61) return '#FB923C'; // Orange - Limited
    return '#EF4444'; // Red - Restricted
  };

  const color = getColor();

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {/* Background Circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#F3F4F6"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress Circle */}
          <AnimatedCircle
            ref={circleRef}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={styles.textContainer}>
        <Text style={styles.scoreText}>{Math.round(score)}</Text>
        <Text style={styles.maxScoreText}>/ {maxScore}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 52,
    fontWeight: '800',
    color: '#1A1D1F',
    letterSpacing: -1,
  },
  maxScoreText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: -4,
    letterSpacing: 0.5,
  },
});

export default AnimatedScoreCircle;
