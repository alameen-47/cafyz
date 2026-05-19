import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { Colors, Radius, Typography } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, { bg: string; border: string; color: string }> = {
  primary: { bg: Colors.gold, border: Colors.gold, color: '#0A0A0F' },
  secondary: { bg: 'transparent', border: Colors.gold, color: Colors.gold },
  ghost: { bg: 'transparent', border: Colors.line2, color: Colors.text1 },
  danger: { bg: Colors.danger, border: Colors.danger, color: '#fff' },
  success: { bg: Colors.success, border: Colors.success, color: '#0A0A0F' },
};

const sizeStyles: Record<Size, { height: number; paddingH: number; fontSize: number }> = {
  sm: { height: 34, paddingH: 12, fontSize: 11 },
  md: { height: 44, paddingH: 18, fontSize: 12 },
  lg: { height: 56, paddingH: 24, fontSize: 13 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  style,
  textStyle,
  disabled,
  loading,
  fullWidth,
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.paddingH,
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled ? 0.5 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.color} size="small" />
      ) : (
        <Text
          style={[
            styles.label,
            { color: v.color, fontSize: s.fontSize },
            textStyle,
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 0.5,
    gap: 8,
  },
  label: {
    fontFamily: Typography.sansMedium,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});
