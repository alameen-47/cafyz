import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  padding?: number;
}

export function Card({ children, style, elevated = false, padding = 20 }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        { padding },
        elevated && styles.elevated,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.bg1,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
  },
  elevated: {
    borderTopWidth: 1,
    borderTopColor: Colors.goldLine2,
  },
});
