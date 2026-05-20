import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Colors, Radius, Typography } from '../theme';
import type { Screen } from '../types';

interface KDSScreenProps {
  onNavigate: (screen: Screen) => void;
}

interface OrderItem {
  qty: number;
  name: string;
  mods?: string[];
  station: string;
  done?: boolean;
  alert?: boolean;
}

interface KDSOrder {
  no: string;
  table: string;
  cover: string;
  server: string;
  elapsed: number; // minutes
  priority?: boolean;
  items: OrderItem[];
}

const NEW_ORDERS: KDSOrder[] = [
  {
    no: '#A-0428',
    table: 'T·17',
    cover: '6 cov',
    server: 'Léo D.',
    elapsed: 0.5,
    priority: true,
    items: [
      { qty: 2, name: 'Black Cod Miso', mods: ['No ginger ×1'], station: 'POISSON' },
      { qty: 1, name: 'Côte de Bœuf', mods: ['MR · 500g'], station: 'GRILL' },
      { qty: 3, name: 'Tuna Crudo', mods: [], station: 'GARDE' },
    ],
  },
  {
    no: '#A-0427',
    table: 'T·12',
    cover: '4 cov',
    server: 'Jules R.',
    elapsed: 3.2,
    items: [
      { qty: 1, name: 'Beef Tartare', mods: [], station: 'GARDE' },
      { qty: 2, name: 'Lobster Linguine', mods: ['Spice ×2', 'No tarragon'], alert: true, station: 'PASTA' },
      { qty: 1, name: 'Risotto Milanese', mods: [], station: 'PASTA' },
    ],
  },
];

const PREP_ORDERS: KDSOrder[] = [
  {
    no: '#A-0425',
    table: 'BAR',
    cover: '2 cov',
    server: 'Tomás L.',
    elapsed: 6.8,
    items: [
      { qty: 1, name: "Duck à l'Orange", mods: ['Confit leg only'], station: 'GRILL' },
      { qty: 1, name: 'Burrata di Andria', mods: [], done: true, station: 'GARDE' },
    ],
  },
  {
    no: '#A-0424',
    table: 'T·04',
    cover: '3 cov',
    server: 'Inès M.',
    elapsed: 9.5,
    items: [
      { qty: 3, name: 'Wagyu A5 Sando', mods: ['No wasabi ×2'], station: 'GRILL' },
      { qty: 2, name: 'Black Cod Miso', mods: [], done: true, station: 'POISSON' },
      { qty: 1, name: 'Tuna Crudo', mods: ['Allergy: shellfish'], alert: true, station: 'GARDE' },
    ],
  },
  {
    no: '#A-0421',
    table: 'T·09',
    cover: '2 cov',
    server: 'Jules R.',
    elapsed: 16.4,
    items: [
      { qty: 2, name: 'Côte de Bœuf', mods: ['Both MR', '+ marrow'], station: 'GRILL' },
      { qty: 1, name: 'Risotto Milanese', mods: [], done: true, station: 'PASTA' },
    ],
  },
];

const READY_ORDERS: KDSOrder[] = [
  {
    no: '#A-0420',
    table: 'T·02',
    cover: '2 cov',
    server: 'Tomás L.',
    elapsed: 11.2,
    items: [
      { qty: 2, name: 'Soufflé Grand Marnier', mods: ['Together'], done: true, station: 'PÂTIS' },
    ],
  },
  {
    no: '#A-0419',
    table: 'T·15',
    cover: '4 cov',
    server: 'Léo D.',
    elapsed: 13.0,
    items: [
      { qty: 4, name: 'Île Flottante', mods: [], done: true, station: 'PÂTIS' },
      { qty: 2, name: 'Tarte Tatin', mods: [], done: true, station: 'PÂTIS' },
    ],
  },
];

const STATIONS = ['All', 'Grill', 'Poisson', 'Pasta', 'Garde', 'Pâtisserie'];

function formatTimer(minutes: number): string {
  const m = Math.floor(minutes);
  const s = Math.floor((minutes % 1) * 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function KDSCard({
  order,
  status,
  onAction,
}: {
  order: KDSOrder;
  status: 'new' | 'prep' | 'ready';
  onAction: () => void;
}) {
  const isAmber = order.elapsed >= 8 && order.elapsed < 15;
  const isRed = order.elapsed >= 15;
  const isReady = status === 'ready';
  const isNew = status === 'new';

  const timerColor = isReady
    ? Colors.success
    : isRed
    ? Colors.danger
    : isAmber
    ? Colors.warning
    : Colors.gold;

  const borderColor = isReady
    ? 'rgba(46,204,138,0.4)'
    : isRed
    ? 'rgba(232,69,69,0.5)'
    : Colors.goldLine2;

  const timerState = isReady
    ? 'Ready'
    : isRed
    ? 'Overdue'
    : isAmber
    ? 'Push'
    : 'On Time';

  return (
    <View
      style={[
        kds.card,
        { borderColor },
        isReady && kds.cardReady,
        isRed && kds.cardRed,
      ]}
    >
      {/* Top glow on new */}
      {isNew && <View style={kds.topGlow} />}

      {/* Header */}
      <View style={kds.cardHeader}>
        <View>
          <View style={kds.cardTitle}>
            <Text style={kds.orderNo}>{order.no}</Text>
            {order.priority && (
              <View style={kds.vipBadge}>
                <Text style={kds.vipText}>★ VIP</Text>
              </View>
            )}
          </View>
          <Text style={kds.cardMeta}>
            {order.table} · {order.cover} · {order.server}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[kds.timer, { color: timerColor }]}>
            {formatTimer(order.elapsed)}
          </Text>
          <Text style={kds.timerState}>{timerState}</Text>
        </View>
      </View>

      {/* Items */}
      <View style={kds.items}>
        {order.items.map((it, i) => (
          <View
            key={i}
            style={[
              kds.itemRow,
              i < order.items.length - 1 && kds.itemRowBorder,
              it.done && kds.itemRowDone,
            ]}
          >
            <Text style={kds.itemQty}>{it.qty}</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={[kds.itemName, it.done && kds.itemNameDone]}
              >
                {it.name}
              </Text>
              {it.mods && it.mods.length > 0 && (
                <View>
                  {it.mods.map((m, j) => (
                    <Text
                      key={j}
                      style={[
                        kds.itemMod,
                        it.alert && j === 0 && { color: Colors.warning },
                      ]}
                    >
                      {it.alert && j === 0 ? '⚠ ' : '· '}{m}
                    </Text>
                  ))}
                </View>
              )}
            </View>
            <Text style={kds.station}>{it.station}</Text>
          </View>
        ))}
      </View>

      {/* Action button */}
      <View style={kds.cardFooter}>
        {isReady ? (
          <TouchableOpacity
            style={[kds.actionBtn, kds.actionBtnDelivered]}
            activeOpacity={0.8}
            onPress={onAction}
          >
            <Text style={[kds.actionBtnText, { color: Colors.success }]}>
              ✓ Delivered
            </Text>
          </TouchableOpacity>
        ) : status === 'prep' ? (
          <TouchableOpacity
            style={[kds.actionBtn, kds.actionBtnReady]}
            activeOpacity={0.8}
            onPress={onAction}
          >
            <Text style={[kds.actionBtnText, { color: '#0A0A0F' }]}>
              ✓ Mark Ready
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[kds.actionBtn, kds.actionBtnFire]}
            activeOpacity={0.8}
            onPress={onAction}
          >
            <Text style={[kds.actionBtnText, { color: '#0A0A0F' }]}>
              🔥 Fire Order
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Column({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <View style={kds.column}>
      <View style={kds.columnHeader}>
        <View style={kds.columnHeaderLeft}>
          <View style={[kds.columnDot, { backgroundColor: accent }]} />
          <Text style={kds.columnTitle}>{title}</Text>
          <Text style={kds.columnCount}>{count}</Text>
        </View>
        <Text style={kds.moreIcon}>⋯</Text>
      </View>
      <ScrollView style={kds.columnScroll} contentContainerStyle={kds.columnContent}>
        {children}
      </ScrollView>
    </View>
  );
}

export function KDSScreen({ onNavigate }: KDSScreenProps) {
  const { width } = useWindowDimensions();
  const [activeStation, setActiveStation] = useState('All');
  const [newOrders, setNewOrders] = useState(NEW_ORDERS);
  const [prepOrders, setPrepOrders] = useState(PREP_ORDERS);
  const [readyOrders, setReadyOrders] = useState(READY_ORDERS);

  const fireOrder = (orderNo: string) => {
    const order = newOrders.find(o => o.no === orderNo);
    if (!order) return;
    setNewOrders(prev => prev.filter(o => o.no !== orderNo));
    setPrepOrders(prev => [...prev, order]);
  };

  const markReady = (orderNo: string) => {
    const order = prepOrders.find(o => o.no === orderNo);
    if (!order) return;
    setPrepOrders(prev => prev.filter(o => o.no !== orderNo));
    setReadyOrders(prev => [...prev, order]);
  };

  const markDelivered = (orderNo: string) => {
    setReadyOrders(prev => prev.filter(o => o.no !== orderNo));
  };

  return (
    <View style={kds.root}>
      {/* Header bar */}
      <View style={kds.header}>
        <View style={kds.headerLeft}>
          <View style={kds.logo}>
            <Text style={kds.logoText}>C</Text>
          </View>
          <View>
            <Text style={kds.eyebrow}>Kitchen Display · Pass</Text>
            <Text style={kds.chefName}>Chef de Cuisine · Henri Lecomte</Text>
          </View>
          <View style={kds.dividerV} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={kds.stationsScroll}>
            <View style={kds.stations}>
              {STATIONS.map((s, i) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setActiveStation(s)}
                  style={[
                    kds.stationBtn,
                    s === activeStation && kds.stationBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      kds.stationText,
                      s === activeStation && kds.stationTextActive,
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
        <View style={kds.headerRight}>
          <KPI label="Open" value="11" />
          <View style={kds.dividerV} />
          <KPI label="Avg ticket" value="8:42" tone="amber" />
          <View style={kds.dividerV} />
          <KPI label="Overdue" value="1" tone="red" />
          <View style={kds.dividerV} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={kds.clockText}>19:42:08</Text>
            <Text style={kds.clockSub}>Service · Dinner</Text>
          </View>
        </View>
      </View>

      {/* Kanban columns */}
      <View style={kds.kanban}>
        <Column title="Incoming" count={newOrders.length} accent={Colors.gold}>
          {newOrders.map(o => (
            <KDSCard
              key={o.no}
              order={o}
              status="new"
              onAction={() => fireOrder(o.no)}
            />
          ))}
        </Column>
        <Column title="Preparing" count={prepOrders.length} accent={Colors.warning}>
          {prepOrders.map(o => (
            <KDSCard
              key={o.no}
              order={o}
              status="prep"
              onAction={() => markReady(o.no)}
            />
          ))}
        </Column>
        <Column title="Ready · Pass" count={readyOrders.length} accent={Colors.success}>
          {readyOrders.map(o => (
            <KDSCard
              key={o.no}
              order={o}
              status="ready"
              onAction={() => markDelivered(o.no)}
            />
          ))}
        </Column>
      </View>

      {/* Back button (mobile-friendly) */}
      <TouchableOpacity
        style={kds.backBtn}
        onPress={() => onNavigate('manager')}
        activeOpacity={0.7}
      >
        <Text style={kds.backBtnText}>← Exit KDS</Text>
      </TouchableOpacity>
    </View>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: 'amber' | 'red' }) {
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text
        style={[
          kds.kpiValue,
          tone === 'red' && { color: Colors.danger },
          tone === 'amber' && { color: Colors.warning },
        ]}
      >
        {value}
      </Text>
      <Text style={kds.kpiLabel}>{label}</Text>
    </View>
  );
}

const kds = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#07060F',
    flexDirection: 'column',
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
    backgroundColor: 'rgba(7,6,15,0.7)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: Typography.serif,
    fontSize: 20,
    color: '#0A0A0F',
    fontWeight: '700',
  },
  eyebrow: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  chefName: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.text2,
    marginTop: 2,
  },
  dividerV: {
    width: 1,
    height: 32,
    backgroundColor: Colors.goldLine,
    marginHorizontal: 4,
  },
  stationsScroll: {
    flexShrink: 1,
  },
  stations: {
    flexDirection: 'row',
    gap: 4,
  },
  stationBtn: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationBtnActive: {
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderWidth: 0.5,
    borderColor: Colors.goldLine2,
  },
  stationText: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  stationTextActive: {
    color: Colors.gold,
  },
  kpiValue: {
    fontFamily: Typography.monoMedium,
    fontSize: 22,
    color: Colors.text0,
    lineHeight: 26,
  },
  kpiLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: Colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 3,
  },
  clockText: {
    fontFamily: Typography.mono,
    fontSize: 20,
    color: Colors.gold,
    letterSpacing: 0.5,
    lineHeight: 24,
  },
  clockSub: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: Colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 3,
  },
  kanban: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  column: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    backgroundColor: 'rgba(255,255,255,0.01)',
    overflow: 'hidden',
    flexDirection: 'column',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
  },
  columnHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  columnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  columnTitle: {
    fontFamily: Typography.serif,
    fontSize: 18,
    color: Colors.text0,
  },
  columnCount: {
    fontFamily: Typography.mono,
    fontSize: 12,
    color: Colors.text2,
  },
  moreIcon: {
    color: Colors.text3,
    fontSize: 18,
  },
  columnScroll: {
    flex: 1,
  },
  columnContent: {
    padding: 12,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.bg1,
    borderWidth: 0.5,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardReady: {
    backgroundColor: 'rgba(46,204,138,0.06)',
  },
  cardRed: {
    borderColor: 'rgba(232,69,69,0.5)',
  },
  topGlow: {
    height: 2,
    backgroundColor: Colors.gold,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
  },
  cardTitle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 4,
  },
  orderNo: {
    fontFamily: Typography.monoMedium,
    fontSize: 20,
    color: Colors.gold,
    letterSpacing: 0.4,
  },
  vipBadge: {
    backgroundColor: Colors.danger,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  vipText: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardMeta: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.text2,
  },
  timer: {
    fontFamily: Typography.monoMedium,
    fontSize: 20,
    letterSpacing: 0.8,
    lineHeight: 24,
  },
  timerState: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: Colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 3,
    textAlign: 'right',
  },
  items: {
    padding: 8,
    paddingHorizontal: 14,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  itemRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.line,
  },
  itemRowDone: {
    opacity: 0.4,
  },
  itemQty: {
    fontFamily: Typography.monoMedium,
    fontSize: 14,
    color: Colors.gold,
    width: 16,
    textAlign: 'right',
    flexShrink: 0,
    marginTop: 2,
  },
  itemName: {
    fontFamily: Typography.sansMedium,
    fontSize: 15,
    color: Colors.text0,
  },
  itemNameDone: {
    textDecorationLine: 'line-through',
  },
  itemMod: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.text2,
    lineHeight: 18,
    marginTop: 2,
  },
  station: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.text3,
    flexShrink: 0,
    marginTop: 3,
  },
  cardFooter: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  actionBtn: {
    width: '100%',
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
  },
  actionBtnDelivered: {
    borderColor: 'rgba(46,204,138,0.4)',
    backgroundColor: 'transparent',
  },
  actionBtnReady: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  actionBtnFire: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  actionBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  backBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(14,11,28,0.9)',
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.text1,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});
