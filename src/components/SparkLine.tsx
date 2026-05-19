import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../theme';

interface SparkLineProps {
  points?: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function SparkLine({
  points = [4, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16],
  color = Colors.gold,
  width = 80,
  height = 22,
}: SparkLineProps) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const barWidth = (width - (points.length - 1) * 2) / points.length;

  return (
    <View style={[styles.container, { width, height }]}>
      {points.map((p, i) => {
        const normalized = (p - min) / range;
        const barHeight = Math.max(2, normalized * height);
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                width: Math.max(2, barWidth),
                height: barHeight,
                backgroundColor: i === points.length - 1 ? color : color + '80',
                borderRadius: 1,
                marginLeft: i === 0 ? 0 : 2,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bar: {
    borderRadius: 1,
  },
});
