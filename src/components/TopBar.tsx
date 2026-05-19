import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Radius, Typography } from '../theme';

interface TopBarProps {
  crumb: [string, string];
  clock?: string;
  cover?: string;
  rightContent?: React.ReactNode;
}

export function TopBar({ crumb, clock = '19:42', cover = 'Service · Dinner', rightContent }: TopBarProps) {
  return (
    <View style={styles.bar}>
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Text style={styles.crumbParent}>{crumb[0]}</Text>
        <Text style={styles.crumbSep}>›</Text>
        <Text style={styles.crumbCurrent}>{crumb[1]}</Text>
      </View>

      {/* Center pill */}
      <View style={styles.centerPill}>
        <View style={styles.statusDot} />
        <Text style={styles.coverText}>{cover}</Text>
        <Text style={styles.sep}>·</Text>
        <Text style={styles.clockText}>{clock}</Text>
      </View>

      {/* Right actions */}
      <View style={styles.actions}>
        {rightContent}
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
          <Text style={styles.bellText}>🔔</Text>
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
    backgroundColor: 'rgba(10,10,15,0.6)',
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  crumbParent: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  crumbSep: {
    color: Colors.text3,
    fontSize: 12,
  },
  crumbCurrent: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.text0,
    letterSpacing: 0.1,
  },
  centerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    backgroundColor: 'rgba(201,168,76,0.04)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  coverText: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.text1,
  },
  sep: {
    color: Colors.text3,
  },
  clockText: {
    fontFamily: Typography.mono,
    fontSize: 12,
    color: Colors.gold,
  },
  actions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellText: {
    fontSize: 14,
  },
  notifDot: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.danger,
  },
});
