import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Typography } from '../theme';
import type { Screen } from '../types';

interface Tab {
  id: Screen;
  label: string;
  emoji: string;
}

const TABS: Tab[] = [
  { id: 'waiter', label: 'Floor', emoji: '🪑' },
  { id: 'mobileOrders', label: 'Orders', emoji: '🧾' },
  { id: 'pos', label: 'Menu', emoji: '☰' },
  { id: 'manager', label: 'Tips', emoji: '⭐' },
  { id: 'kds', label: 'Me', emoji: '👤' },
];

interface TabBarProps {
  active: Screen;
  onNavigate: (screen: Screen) => void;
}

export function TabBar({ active, onNavigate }: TabBarProps) {
  return (
    <View style={styles.bar}>
      {TABS.map(tab => {
        const isActive = tab.id === active || (active === 'mobileTableDetail' && tab.id === 'mobileOrders');
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onNavigate(tab.id)}
            style={styles.tab}
            activeOpacity={0.7}
          >
            {isActive && <View style={styles.activeBar} />}
            <Text style={styles.emoji}>{tab.emoji}</Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 76,
    borderTopWidth: 0.5,
    borderTopColor: Colors.goldLine,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 20,
    paddingTop: 6,
    backgroundColor: 'rgba(10,10,15,0.92)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
    position: 'relative',
  },
  activeBar: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: 20,
    height: 2,
    borderRadius: 2,
    backgroundColor: Colors.gold,
  },
  emoji: {
    fontSize: 18,
  },
  label: {
    fontFamily: Typography.sans,
    fontSize: 10,
    color: Colors.text2,
    letterSpacing: 0.4,
  },
  labelActive: {
    color: Colors.gold,
    fontFamily: Typography.sansMedium,
  },
});
