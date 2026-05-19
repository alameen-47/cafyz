import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BadgeVariants, Typography } from '../theme';
import type { BadgeVariant } from '../types';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  customBg?: string;
  customColor?: string;
}

export function Badge({ label, variant = 'new', customBg, customColor }: BadgeProps) {
  const v = BadgeVariants[variant];
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: customBg ?? v.bg },
      ]}
    >
      <Text style={[styles.label, { color: customColor ?? v.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
