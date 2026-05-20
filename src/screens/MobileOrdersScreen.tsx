import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors, Radius, Typography } from '../theme';
import { TabBar } from '../components/TabBar';
import type { Screen, TableStatus } from '../types';

interface MobileOrdersScreenProps {
  onNavigate: (screen: Screen) => void;
}

const TABLE_ORDERS = [
  { table: 'T·12', name: 'Vasseur', cov: 4, course: 'Mains', time: '00:41', status: 'occupied' as TableStatus },
  { table: 'T·10', name: 'Park', cov: 2, course: 'Needs water', time: '00:26', status: 'attention' as TableStatus },
  { table: 'T·07', name: 'Walk-in', cov: 4, course: 'Mains', time: '00:38', status: 'occupied' as TableStatus },
  { table: 'T·02', name: 'Bernard', cov: 2, course: 'Paying', time: '01:11', status: 'paying' as TableStatus },
  { table: 'T·06', name: 'Park (20:30)', cov: 4, course: 'Reserved · in 12m', time: '—', status: 'reserved' as TableStatus },
  { table: 'T·04', name: 'Lévy', cov: 3, course: 'Order in', time: '00:09', status: 'occupied' as TableStatus },
];

const STATUS_DOT: Record<string, string> = {
  occupied: Colors.gold,
  paying: Colors.success,
  attention: Colors.danger,
  reserved: Colors.goldSoft,
};

const FILTERS = [
  { t: 'All', n: 6, active: true },
  { t: 'Attention', n: 1, tone: 'red' },
  { t: 'Mains', n: 3 },
  { t: 'Paying', n: 1 },
  { t: 'Reserved', n: 1 },
];

export function MobileOrdersScreen({ onNavigate }: MobileOrdersScreenProps) {
  const [activeFilter, setActiveFilter] = useState('All');

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Service · Dinner</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>My Tables</Text>
          <Text style={styles.countLabel}>6 active</Text>
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScroll}
        contentContainerStyle={styles.pillContent}
      >
        {FILTERS.map((f, i) => (
          <TouchableOpacity
            key={f.t}
            onPress={() => setActiveFilter(f.t)}
            style={[
              styles.pill,
              f.t === activeFilter && styles.pillActive,
              f.tone === 'red' && f.t !== activeFilter && styles.pillRed,
            ]}
          >
            <Text
              style={[
                styles.pillText,
                f.t === activeFilter && styles.pillTextActive,
                f.tone === 'red' && f.t !== activeFilter && styles.pillTextRed,
              ]}
            >
              {f.t}
            </Text>
            <Text
              style={[
                styles.pillCount,
                f.t === activeFilter && styles.pillCountActive,
              ]}
            >
              {f.n}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Table list */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {TABLE_ORDERS.map((o, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => onNavigate('mobileTableDetail')}
            activeOpacity={0.85}
            style={[
              styles.card,
              o.status === 'attention' && styles.cardAlert,
            ]}
          >
            <View style={styles.tableIcon}>
              <Text style={styles.tableIconText}>{o.table}</Text>
            </View>
            <View style={styles.cardInfo}>
              <View style={styles.cardNameRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: STATUS_DOT[o.status] ?? Colors.text3 },
                  ]}
                />
                <Text style={styles.cardName}>{o.name}</Text>
                <Text style={styles.cardCov}>· {o.cov} cov</Text>
              </View>
              <Text
                style={[
                  styles.cardCourse,
                  o.status === 'attention' && styles.cardCourseAlert,
                ]}
              >
                {o.status === 'attention' ? '⚠ ' : ''}{o.course}
              </Text>
            </View>
            <View style={styles.cardRight}>
              <Text
                style={[
                  styles.cardTime,
                  o.status === 'attention' && { color: Colors.danger },
                ]}
              >
                {o.time}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => onNavigate('mobileTableDetail')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <TabBar active="mobileOrders" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg0,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 14,
  },
  eyebrow: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: Typography.serif,
    fontSize: 28,
    color: Colors.text0,
    letterSpacing: -0.5,
  },
  countLabel: {
    fontFamily: Typography.mono,
    fontSize: 12,
    color: Colors.text2,
  },
  pillScroll: {
    flexGrow: 0,
    marginBottom: 12,
  },
  pillContent: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
  },
  pill: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
  },
  pillActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  pillRed: {
    borderColor: 'rgba(232,69,69,0.5)',
  },
  pillText: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: Colors.text1,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pillTextActive: {
    color: '#0A0A0F',
  },
  pillTextRed: {
    color: Colors.danger,
  },
  pillCount: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.text3,
  },
  pillCountActive: {
    color: 'rgba(7,6,15,0.65)',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    backgroundColor: Colors.bg1,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    borderRadius: 14,
    alignItems: 'center',
  },
  cardAlert: {
    borderColor: 'rgba(232,69,69,0.45)',
  },
  tableIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(139,92,246,0.06)',
    borderWidth: 0.5,
    borderColor: Colors.goldLine2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableIconText: {
    fontFamily: Typography.monoMedium,
    fontSize: 12,
    color: Colors.gold,
    letterSpacing: 0.4,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardName: {
    fontFamily: Typography.sansMedium,
    fontSize: 15,
    color: Colors.text0,
  },
  cardCov: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.text3,
  },
  cardCourse: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.text2,
  },
  cardCourseAlert: {
    color: Colors.danger,
    fontFamily: Typography.sansMedium,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  cardTime: {
    fontFamily: Typography.mono,
    fontSize: 13,
    color: Colors.gold,
    letterSpacing: 0.4,
  },
  chevron: {
    color: Colors.text3,
    fontSize: 18,
  },
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 18,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  fabIcon: {
    fontSize: 28,
    color: '#0A0A0F',
    lineHeight: 32,
    fontWeight: '400',
  },
});
