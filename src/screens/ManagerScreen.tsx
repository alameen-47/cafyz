import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Colors, Radius, Typography, Spacing } from '../theme';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { SparkLine } from '../components/SparkLine';
import { TabBar } from '../components/TabBar';
import type { Screen } from '../types';

interface ManagerScreenProps {
  onNavigate: (screen: Screen) => void;
  sidebarActive?: Screen;
}

const METRICS = [
  {
    label: 'Revenue · Today',
    value: '$18,624',
    sub: 'vs. yesterday',
    delta: '↑ 12.4%',
    positive: true,
    emoji: '💰',
    spark: [4, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16],
    sparkColor: Colors.gold,
  },
  {
    label: 'Orders',
    value: '142',
    sub: '84 covers',
    delta: '↑ 6.1%',
    positive: true,
    emoji: '🧾',
    spark: [3, 4, 5, 4, 6, 7, 8, 7, 9, 10, 11, 13],
    sparkColor: Colors.success,
  },
  {
    label: 'Avg. Table Time',
    value: '58m',
    sub: '↓ 4m vs. last week',
    delta: '↓ 3.2%',
    positive: false,
    emoji: '⏱',
    spark: [12, 11, 10, 11, 10, 9, 8, 9, 8, 7, 8, 7],
    sparkColor: Colors.warning,
  },
  {
    label: 'Staff On',
    value: '14',
    sub: '2 on break',
    delta: '—',
    positive: true,
    emoji: '👥',
    spark: [8, 9, 10, 12, 14, 14, 14, 14, 14, 14, 12, 14],
    sparkColor: Colors.goldSoft,
  },
];

const TOP_PERFORMERS = [
  { name: 'Black Cod Miso', pct: 92, n: 28 },
  { name: 'Côte de Bœuf', pct: 78, n: 19 },
  { name: 'Lobster Linguine', pct: 64, n: 16 },
  { name: 'Tarte Tatin', pct: 52, n: 22 },
];

const RESERVATIONS = [
  { t: '20:15', name: 'Bernard, J.', cover: 2, note: 'Anniversary' },
  { t: '20:30', name: 'Park, S.', cover: 4, note: 'VIP · No nuts' },
  { t: '21:00', name: 'Wei, L.', cover: 6, note: 'Private corner' },
];

const ORDERS = [
  { no: '#A-0427', table: 'T·12', server: 'Jules Renaud', items: 11, total: '184.50', status: 'Open', time: '00:41' },
  { no: '#A-0426', table: 'T·08', server: 'Inès Marchal', items: 6, total: '92.00', status: 'Paid', time: '00:18' },
  { no: '#A-0425', table: 'BAR', server: 'Tomás Lévy', items: 3, total: '54.00', status: 'Paid', time: '00:14' },
  { no: '#A-0424', table: 'T·04', server: 'Inès Marchal', items: 8, total: '142.50', status: 'New', time: '00:09' },
  { no: '#A-0423', table: 'T·17', server: 'Léo Dauphin', items: 9, total: '218.00', status: 'Open', time: '00:06' },
  { no: '#A-0422', table: 'T·02', server: 'Jules Renaud', items: 5, total: '78.50', status: 'Voided', time: '00:03' },
];

const REVENUE_BARS = [18, 22, 24, 28, 32, 38, 44, 43, 48, 54, 58, 64, 70, 76, 72, 80, 84, 88, 92, 96, 94, 92, 96, 100, 102, 106, 102, 98];

export function ManagerScreen({
  onNavigate,
  sidebarActive = 'manager',
}: ManagerScreenProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [activeRange, setActiveRange] = useState('1D');

  const statusVariantMap: Record<string, any> = {
    Paid: 'paid',
    Open: 'pending',
    New: 'new',
    Voided: 'cancel',
  };

  const content = (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {/* Title */}
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Wednesday · 19 May 2026</Text>
          <Text style={styles.pageTitle}>Good evening, Mireille.</Text>
          <Text style={styles.pageSub}>
            Service is at{' '}
            <Text style={{ color: Colors.text0 }}>84% capacity</Text>. Three
            reservations expected after 21:00.
          </Text>
        </View>
        <View style={styles.titleActions}>
          <TouchableOpacity style={styles.ghostBtn}>
            <Text style={styles.ghostBtnText}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Daily Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => onNavigate('pos')}
          >
            <Text style={styles.primaryBtnText}>+ New Order</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Metrics grid */}
      <View style={[styles.metricsGrid, !isTablet && styles.metricsGridMobile]}>
        {METRICS.map((m, i) => (
          <Card key={i} style={styles.metricCard} elevated>
            <View style={styles.metricTop}>
              <View style={styles.metricIcon}>
                <Text style={styles.metricEmoji}>{m.emoji}</Text>
              </View>
              <View
                style={[
                  styles.deltaBadge,
                  {
                    backgroundColor: m.positive
                      ? 'rgba(46,204,138,0.14)'
                      : 'rgba(232,69,69,0.14)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.deltaText,
                    { color: m.positive ? Colors.success : Colors.danger },
                  ]}
                >
                  {m.delta}
                </Text>
              </View>
            </View>
            <Text style={styles.metricLabel}>{m.label}</Text>
            <Text style={styles.metricValue}>{m.value}</Text>
            <View style={styles.metricBottom}>
              <Text style={styles.metricSub}>{m.sub}</Text>
              <SparkLine
                points={m.spark}
                color={m.sparkColor}
                width={70}
                height={20}
              />
            </View>
          </Card>
        ))}
      </View>

      {/* Chart + side */}
      <View style={[styles.chartRow, !isTablet && styles.chartRowMobile]}>
        <Card style={isTablet ? styles.revenueCard : styles.revenueCardMobile} elevated>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartSubLabel}>Revenue Cadence</Text>
              <Text style={styles.chartTitle}>Today's service · hourly</Text>
            </View>
            <View style={styles.rangeButtons}>
              {['1D', '1W', '1M', 'YTD'].map(r => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setActiveRange(r)}
                  style={[
                    styles.rangeBtn,
                    r === activeRange && styles.rangeBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.rangeBtnText,
                      r === activeRange && styles.rangeBtnTextActive,
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {/* Revenue bar chart */}
          <View style={styles.revenueChart}>
            <View style={styles.chartBars}>
              {REVENUE_BARS.map((v, i) => (
                <View
                  key={i}
                  style={[
                    styles.revBar,
                    {
                      height: (v / 106) * 160,
                      backgroundColor:
                        i === 18
                          ? Colors.gold
                          : 'rgba(201,168,76,0.25)',
                    },
                  ]}
                />
              ))}
            </View>
            {/* X labels */}
            <View style={styles.chartXLabels}>
              {['11A', '1P', '3P', '5P', '7P', '9P', '11P'].map(l => (
                <Text key={l} style={styles.chartXLabel}>{l}</Text>
              ))}
            </View>
          </View>
        </Card>

        {isTablet && (
          <View style={styles.sideCards}>
            {/* Top performers */}
            <Card style={{ flex: 1 }} elevated>
              <Text style={styles.sideLabel}>Top performers</Text>
              {TOP_PERFORMERS.map((d, i) => (
                <View
                  key={i}
                  style={[
                    styles.performerRow,
                    i < 3 && styles.performerRowBorder,
                  ]}
                >
                  <View style={styles.performerInfo}>
                    <Text style={styles.performerName}>{d.name}</Text>
                    <Text style={styles.performerCount}>{d.n}×</Text>
                  </View>
                  <View style={styles.performerBar}>
                    <View
                      style={[styles.performerFill, { width: `${d.pct}%` }]}
                    />
                  </View>
                </View>
              ))}
            </Card>

            {/* Reservations */}
            <Card style={{ flex: 1 }} elevated>
              <View style={styles.resHeader}>
                <Text style={styles.sideLabel}>Reservations · Tonight</Text>
                <Text style={styles.resCount}>18 / 22</Text>
              </View>
              {RESERVATIONS.map((r, i) => (
                <View
                  key={i}
                  style={[
                    styles.resRow,
                    i < 2 && styles.resRowBorder,
                  ]}
                >
                  <Text style={styles.resTime}>{r.t}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resName}>
                      {r.name} · {r.cover} cov
                    </Text>
                    <Text style={styles.resNote}>{r.note}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              ))}
            </Card>
          </View>
        )}
      </View>

      {/* Orders table */}
      <Card style={styles.ordersCard} elevated padding={0}>
        <View style={styles.ordersHeader}>
          <View>
            <Text style={styles.ordersSubLabel}>Recent Orders</Text>
            <Text style={styles.ordersTitle}>Last 60 minutes · 18 tickets</Text>
          </View>
          <View style={styles.ordersActions}>
            <TouchableOpacity style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>Filter</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>View all</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Column headers */}
        <View style={styles.tableHeader}>
          <Text style={[styles.thCell, { flex: 1.2 }]}>Ticket</Text>
          <Text style={[styles.thCell, { flex: 0.8 }]}>Table</Text>
          {isTablet && <Text style={[styles.thCell, { flex: 1.5 }]}>Server</Text>}
          <Text style={[styles.thCell, { flex: 0.6 }]}>Items</Text>
          {isTablet && <Text style={[styles.thCell, { flex: 0.7 }]}>Opened</Text>}
          <Text style={[styles.thCell, { flex: 1 }]}>Total</Text>
          <Text style={[styles.thCell, { flex: 1 }]}>Status</Text>
        </View>
        {ORDERS.map((o, i) => (
          <View
            key={o.no}
            style={[
              styles.orderRow,
              i % 2 === 0 && styles.orderRowAlt,
              i < ORDERS.length - 1 && styles.orderRowBorder,
            ]}
          >
            <Text style={[styles.orderNo, { flex: 1.2 }]}>{o.no}</Text>
            <Text style={[styles.orderCell, { flex: 0.8, color: Colors.text1 }]}>{o.table}</Text>
            {isTablet && <Text style={[styles.orderCell, { flex: 1.5 }]}>{o.server}</Text>}
            <Text style={[styles.orderCell, { flex: 0.6, color: Colors.text2 }]}>{o.items}</Text>
            {isTablet && <Text style={[styles.orderCellMono, { flex: 0.7 }]}>{o.time}</Text>}
            <Text style={[styles.orderCellMono, { flex: 1, color: Colors.text0, fontFamily: Typography.monoMedium }]}>${o.total}</Text>
            <View style={{ flex: 1 }}>
              <Badge label={o.status} variant={statusVariantMap[o.status]} />
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );

  if (isTablet) {
    return (
      <View style={styles.root}>
        <Sidebar active={sidebarActive} onNavigate={onNavigate} />
        <View style={{ flex: 1 }}>
          <TopBar crumb={['Operations', 'Overview']} clock="19:42" cover="Saint · Paris 6e" />
          {content}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TopBar crumb={['Operations', 'Overview']} clock="19:42" cover="Saint · Paris 6e" />
      {content}
      <TabBar active="manager" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.bg0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    gap: 20,
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
    flexWrap: 'wrap',
  },
  eyebrow: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 6,
  },
  pageTitle: {
    fontFamily: Typography.serif,
    fontSize: 36,
    color: Colors.text0,
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  pageSub: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.text2,
  },
  titleActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  ghostBtn: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: Colors.text1,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  secondaryBtn: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  primaryBtn: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: '#0A0A0F',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  metricsGridMobile: {
    flexDirection: 'column',
  },
  metricCard: {
    flex: 1,
    minWidth: 180,
    padding: 20,
  },
  metricTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.goldBg,
    borderWidth: 0.5,
    borderColor: Colors.goldLine2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricEmoji: {
    fontSize: 18,
  },
  deltaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deltaText: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  metricValue: {
    fontFamily: Typography.serif,
    fontSize: 36,
    color: Colors.text0,
    letterSpacing: -0.8,
    lineHeight: 42,
    marginBottom: 14,
  },
  metricBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricSub: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.text2,
  },
  chartRow: {
    flexDirection: 'row',
    gap: 16,
  },
  chartRowMobile: {
    flexDirection: 'column',
  },
  revenueCard: {
    flex: 1,
    padding: 22,
  },
  revenueCardMobile: {
    padding: 22,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartSubLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  chartTitle: {
    fontFamily: Typography.serif,
    fontSize: 20,
    color: Colors.text0,
  },
  rangeButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  rangeBtn: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeBtnActive: {
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderWidth: 0.5,
    borderColor: Colors.goldLine2,
  },
  rangeBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: Colors.text2,
    letterSpacing: 0.8,
  },
  rangeBtnTextActive: {
    color: Colors.gold,
  },
  revenueChart: {
    marginTop: 8,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 160,
    gap: 3,
  },
  revBar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 6,
  },
  chartXLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  chartXLabel: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.text3,
  },
  sideCards: {
    width: 320,
    gap: 16,
  },
  sideLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  performerRow: {
    paddingVertical: 10,
  },
  performerRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
  },
  performerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  performerName: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.text0,
  },
  performerCount: {
    fontFamily: Typography.mono,
    fontSize: 12,
    color: Colors.text2,
  },
  performerBar: {
    height: 3,
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  performerFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
  resHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  resCount: {
    fontFamily: Typography.mono,
    fontSize: 12,
    color: Colors.text2,
  },
  resRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  resRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
  },
  resTime: {
    fontFamily: Typography.mono,
    fontSize: 12,
    color: Colors.gold,
    width: 40,
  },
  resName: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.text0,
  },
  resNote: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.text2,
    marginTop: 1,
  },
  chevron: {
    color: Colors.text3,
    fontSize: 16,
  },
  ordersCard: {
    overflow: 'hidden',
  },
  ordersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
  },
  ordersSubLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  ordersTitle: {
    fontFamily: Typography.serif,
    fontSize: 18,
    color: Colors.text0,
  },
  ordersActions: {
    flexDirection: 'row',
    gap: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
  },
  thCell: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  orderRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  orderRowAlt: {
    backgroundColor: 'rgba(201,168,76,0.02)',
  },
  orderRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
  },
  orderNo: {
    fontFamily: Typography.mono,
    fontSize: 13,
    color: Colors.gold,
  },
  orderCell: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.text0,
  },
  orderCellMono: {
    fontFamily: Typography.mono,
    fontSize: 12,
    color: Colors.text3,
  },
});
