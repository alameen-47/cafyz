import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Colors, Radius, Typography } from '../theme';
import { TabBar } from '../components/TabBar';
import { Badge } from '../components/Badge';
import type { Screen, TableStatus } from '../types';

interface WaiterScreenProps {
  onNavigate: (screen: Screen) => void;
}

interface TableDef {
  id: string;
  cov: number;
  status: TableStatus;
  minutes?: number;
  course?: string;
  round?: boolean;
}

const TABLES: TableDef[] = [
  { id: 'T·01', cov: 2, status: 'occupied', minutes: 22, course: 'Mains' },
  { id: 'T·02', cov: 2, status: 'paying', minutes: 71, course: 'Bill' },
  { id: 'T·03', cov: 2, status: 'occupied', minutes: 14, course: 'Starters' },
  { id: 'T·04', cov: 3, status: 'occupied', minutes: 9, course: 'Order in' },
  { id: 'T·05', cov: 4, status: 'empty' },
  { id: 'T·06', cov: 4, status: 'reserved', course: '20:30 Park' },
  { id: 'T·07', cov: 4, status: 'occupied', minutes: 38, course: 'Mains' },
  { id: 'T·08', cov: 4, status: 'occupied', minutes: 18, course: 'Drinks' },
  { id: 'T·09', cov: 2, status: 'occupied', minutes: 52, course: 'Dessert', round: true },
  { id: 'T·10', cov: 2, status: 'attention', minutes: 26, course: '!', round: true },
  { id: 'T·11', cov: 2, status: 'empty', round: true },
  { id: 'T·12', cov: 4, status: 'occupied', minutes: 41, course: 'Mains' },
  { id: 'T·13', cov: 6, status: 'occupied', minutes: 12, course: 'Bread' },
  { id: 'T·14', cov: 6, status: 'empty' },
  { id: 'T·15', cov: 4, status: 'occupied', minutes: 47, course: 'Pre-dessert' },
  { id: 'BAR', cov: 8, status: 'occupied', minutes: 0, course: 'Open' },
  { id: 'PDR', cov: 12, status: 'occupied', minutes: 64, course: 'Tasting · 5/7' },
  { id: 'T·17', cov: 6, status: 'occupied', minutes: 6, course: 'Order taken' },
  { id: 'T·18', cov: 4, status: 'empty' },
];

const TABLE_STYLE: Record<TableStatus, { bg: string; border: string; borderStyle: any; textColor: string }> = {
  empty: { bg: 'transparent', border: 'rgba(255,255,255,0.12)', borderStyle: 'dashed', textColor: Colors.text3 },
  reserved: { bg: 'rgba(232,213,163,0.06)', border: 'rgba(232,213,163,0.35)', borderStyle: 'solid', textColor: Colors.goldSoft },
  occupied: { bg: 'rgba(201,168,76,0.06)', border: 'rgba(201,168,76,0.55)', borderStyle: 'solid', textColor: Colors.gold },
  paying: { bg: 'rgba(46,204,138,0.08)', border: 'rgba(46,204,138,0.55)', borderStyle: 'solid', textColor: Colors.success },
  attention: { bg: 'rgba(232,69,69,0.08)', border: 'rgba(232,69,69,0.7)', borderStyle: 'solid', textColor: Colors.danger },
};

type OrderSheetItem = {
  name: string;
  qty: number;
  price: number;
  sub: string;
  sent: boolean;
  alert?: boolean;
  wine?: boolean;
  held?: boolean;
};

const ORDER_SHEET_ITEMS: OrderSheetItem[] = [
  { name: 'Tuna Crudo', qty: 1, price: 24, sub: 'Citrus · radish · togarashi', sent: true },
  { name: 'Burrata di Andria', qty: 2, price: 18, sub: 'No tomato · extra basil', sent: true, alert: true },
  { name: 'Black Cod Miso', qty: 2, price: 42, sub: 'No ginger · extra miso', sent: true },
  { name: 'Côte de Bœuf · 500g', qty: 1, price: 64, sub: 'Medium rare · marrow', sent: false },
  { name: 'Riesling, Trimbach', qty: 1, price: 78, sub: 'Bottle · 2019', sent: true, wine: true },
];

function TableCard({ table, selected, onPress }: { table: TableDef; selected: boolean; onPress: () => void }) {
  const ts = TABLE_STYLE[table.status];
  const isAttention = table.status === 'attention';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.tableCard,
        table.round && styles.tableCardRound,
        {
          backgroundColor: ts.bg,
          borderColor: selected ? Colors.gold : ts.border,
          borderStyle: ts.borderStyle,
          borderWidth: selected ? 1.5 : 1,
        },
      ]}
    >
      <Text style={[styles.tableId, { color: ts.textColor }]}>{table.id}</Text>
      {table.status !== 'empty' && table.course ? (
        <Text style={styles.tableCourse}>{table.course}</Text>
      ) : (
        <Text style={styles.tableCov}>{table.cov}-top</Text>
      )}
      {table.status === 'occupied' && table.minutes ? (
        <Text style={[styles.tableTime, { color: ts.textColor }]}>{table.minutes}m</Text>
      ) : null}
      {isAttention && (
        <View style={styles.alertDot}>
          <Text style={styles.alertDotText}>!</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function OrderSheet({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<OrderSheetItem[]>(ORDER_SHEET_ITEMS);
  const [splitMode, setSplitMode] = useState(false);
  const [kitchenSent, setKitchenSent] = useState(false);
  const [checkPrinted, setCheckPrinted] = useState(false);

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const hasUnsent = items.some(i => !i.sent && !i.held);

  const sendToKitchen = () => {
    setItems(prev =>
      prev.map(it => (it.sent || it.held ? it : { ...it, sent: true })),
    );
    setKitchenSent(true);
  };

  const toggleHold = () => {
    setItems(prev =>
      prev.map(it => (it.sent ? it : { ...it, held: !it.held })),
    );
  };

  const toggleSplit = () => setSplitMode(prev => !prev);

  const printCheck = () => setCheckPrinted(true);

  return (
    <View style={os.sheet}>
      <View style={os.handle} />
      <View style={os.header}>
        <View style={{ flex: 1 }}>
          <Text style={os.eyebrow}>Table 12 · Active</Text>
          <Text style={os.title}>Vasseur · 4 guests</Text>
          <View style={os.meta}>
            <Text style={os.metaText}>Server · Jules R.</Text>
            <Text style={os.metaDot}>·</Text>
            <Text style={os.metaTime}>Seated 19:01</Text>
            <Text style={os.metaDot}>·</Text>
            <Text style={os.metaText}>Course: <Text style={{ color: Colors.text0 }}>Mains</Text></Text>
          </View>
        </View>
        <View style={os.headerBtns}>
          <TouchableOpacity style={os.addBtn} onPress={onClose}>
            <Text style={os.addBtnText}>+ Add</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[os.sendBtn, kitchenSent && os.sendBtnDone]}
            onPress={sendToKitchen}
            disabled={!hasUnsent}
          >
            <Text style={[os.sendBtnText, kitchenSent && { color: Colors.success }]}>
              {kitchenSent && !hasUnsent ? '✓ Sent' : 'Send to Kitchen'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={os.itemsScroll} contentContainerStyle={os.itemsContent}>
        {items.map((it, i) => (
          <View key={i} style={[os.item, it.held && os.itemHeld]}>
            <View style={[os.itemQty, it.wine && os.itemQtyWine]}>
              <Text style={[os.itemQtyText, it.wine && { color: Colors.goldSoft }]}>{it.qty}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={os.itemNameRow}>
                <Text style={os.itemName}>{it.name}</Text>
                {it.wine && <Text style={os.wineTag}>Wine</Text>}
              </View>
              <Text style={[os.itemSub, it.alert && os.itemSubAlert]}>
                {it.alert ? '⚠ ' : ''}{it.sub}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={os.itemPrice}>${it.price * it.qty}</Text>
              <Text
                style={[
                  os.sentStatus,
                  {
                    color: it.sent
                      ? Colors.success
                      : it.held
                      ? Colors.warning
                      : Colors.gold,
                  },
                ]}
              >
                {it.sent ? '✓ Sent' : it.held ? 'On Hold' : 'Pending'}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={os.footer}>
        <View style={{ flex: 1 }}>
          <Text style={os.totalLabel}>Running total</Text>
          <Text style={os.totalAmount}>${subtotal.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[os.splitBtn, splitMode && os.splitBtnActive]}
          onPress={toggleSplit}
        >
          <Text style={os.splitBtnText}>{splitMode ? 'Split · 2' : 'Split'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={os.splitBtn} onPress={toggleHold}>
          <Text style={os.splitBtnText}>
            {items.some(i => i.held) ? 'Release' : 'Hold'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[os.printBtn, checkPrinted && os.printBtnDone]}
          onPress={printCheck}
        >
          <Text style={os.printBtnText}>
            {checkPrinted ? '✓  Printed' : '🧾  Print Check'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function WaiterScreen({ onNavigate }: WaiterScreenProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [selectedTable, setSelectedTable] = useState<string>('T·12');
  const [showSheet, setShowSheet] = useState(true);
  const [activeView, setActiveView] = useState('Floor');

  const VIEWS = ['Floor', 'Bar', 'Patio', 'PDR'];

  const STATS = [
    { l: 'Open', v: '11', tone: '' },
    { l: 'Seated', v: '14', tone: '' },
    { l: 'Available', v: '4', tone: '' },
    { l: 'Reserved', v: '3', tone: 'gold' },
    { l: 'Attention', v: '1', tone: 'red' },
    { l: 'Avg dwell', v: '52m', tone: '' },
  ];

  const floorPlan = (
    <View style={styles.floorContainer}>
      {/* Grid visual */}
      <ScrollView
        contentContainerStyle={styles.floorContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tables in rows */}
        <Text style={styles.zoneLabel}>Window Banquette</Text>
        <View style={styles.tableGroup}>
          {TABLES.filter(t => ['T·01','T·02','T·03','T·04'].includes(t.id)).map(t => (
            <TableCard
              key={t.id}
              table={t}
              selected={t.id === selectedTable}
              onPress={() => { setSelectedTable(t.id); setShowSheet(t.status !== 'empty'); }}
            />
          ))}
        </View>

        <Text style={styles.zoneLabel}>Central Salon</Text>
        <View style={styles.tableGroup}>
          {TABLES.filter(t => ['T·05','T·06','T·07','T·08'].includes(t.id)).map(t => (
            <TableCard
              key={t.id}
              table={t}
              selected={t.id === selectedTable}
              onPress={() => { setSelectedTable(t.id); setShowSheet(t.status !== 'empty'); }}
            />
          ))}
        </View>

        <Text style={styles.zoneLabel}>Round Tables</Text>
        <View style={styles.tableGroup}>
          {TABLES.filter(t => t.round).map(t => (
            <TableCard
              key={t.id}
              table={t}
              selected={t.id === selectedTable}
              onPress={() => { setSelectedTable(t.id); setShowSheet(t.status !== 'empty'); }}
            />
          ))}
        </View>

        <Text style={styles.zoneLabel}>6-Tops · Banquette</Text>
        <View style={styles.tableGroup}>
          {TABLES.filter(t => ['T·12','T·13','T·14','T·15'].includes(t.id)).map(t => (
            <TableCard
              key={t.id}
              table={t}
              selected={t.id === selectedTable}
              onPress={() => { setSelectedTable(t.id); setShowSheet(t.status !== 'empty'); }}
            />
          ))}
        </View>

        <Text style={styles.zoneLabel}>Bar · Private Dining</Text>
        <View style={styles.tableGroup}>
          {TABLES.filter(t => ['BAR','PDR','T·17','T·18'].includes(t.id)).map(t => (
            <TableCard
              key={t.id}
              table={t}
              selected={t.id === selectedTable}
              onPress={() => { setSelectedTable(t.id); setShowSheet(t.status !== 'empty'); }}
            />
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {[
            { label: 'Empty', color: 'rgba(255,255,255,0.12)', dashed: true },
            { label: 'Reserved', color: 'rgba(232,213,163,0.4)' },
            { label: 'Occupied', color: Colors.gold },
            { label: 'Paying', color: Colors.success },
            { label: 'Attention', color: Colors.danger },
          ].map(l => (
            <View key={l.label} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { borderColor: l.color }, l.dashed && { borderStyle: 'dashed' }]} />
              <Text style={styles.legendLabel}>{l.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Order sheet slide-up */}
      {showSheet && (
        <OrderSheet onClose={() => setShowSheet(false)} />
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.menuBtn}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.eyebrow}>Service · Dinner</Text>
            <Text style={styles.headerTitle}>Floor Plan</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.viewTabs}>
          <View style={styles.viewTabsInner}>
            {VIEWS.map((v, i) => (
              <TouchableOpacity
                key={v}
                onPress={() => setActiveView(v)}
                style={[styles.viewTab, v === activeView && styles.viewTabActive]}
              >
                <Text style={[styles.viewTabText, v === activeView && styles.viewTabTextActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <View style={styles.headerRight}>
          <View>
            <Text style={styles.serverName}>Jules Renaud</Text>
            <Text style={styles.serverInfo}>4 tables · 16 covers</Text>
          </View>
          <View style={styles.serverAvatar}>
            <Text style={styles.serverAvatarText}>JR</Text>
          </View>
        </View>
      </View>

      {/* Stats strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.statsStrip}>
          {STATS.map((s, i) => (
            <View key={s.l} style={[styles.statCell, i < STATS.length - 1 && styles.statCellBorder]}>
              <Text
                style={[
                  styles.statValue,
                  s.tone === 'red' && { color: Colors.danger },
                  s.tone === 'gold' && { color: Colors.gold },
                ]}
              >
                {s.v}
              </Text>
              <Text style={styles.statLabel}>{s.l}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Floor plan */}
      {floorPlan}

      {!isTablet && <TabBar active="waiter" onNavigate={onNavigate} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg0,
    flexDirection: 'column',
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
    gap: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.bg1,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 18,
    color: Colors.text1,
  },
  eyebrow: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  headerTitle: {
    fontFamily: Typography.serif,
    fontSize: 20,
    color: Colors.text0,
    lineHeight: 24,
    marginTop: 2,
  },
  viewTabs: {
    flex: 1,
  },
  viewTabsInner: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
  },
  viewTab: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewTabActive: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 0.5,
    borderColor: Colors.goldLine2,
  },
  viewTabText: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  viewTabTextActive: {
    color: Colors.gold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serverName: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.text1,
    textAlign: 'right',
  },
  serverInfo: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.text3,
    textAlign: 'right',
    marginTop: 1,
  },
  serverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#14141c',
    borderWidth: 0.5,
    borderColor: Colors.goldLine2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverAvatarText: {
    fontFamily: Typography.serif,
    fontSize: 14,
    color: Colors.gold,
  },
  statsStrip: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
  },
  statCell: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    minWidth: 100,
  },
  statCellBorder: {
    borderRightWidth: 0.5,
    borderRightColor: Colors.goldLine,
  },
  statValue: {
    fontFamily: Typography.monoMedium,
    fontSize: 20,
    color: Colors.text0,
  },
  statLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: Colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  floorContainer: {
    flex: 1,
    position: 'relative',
  },
  floorContent: {
    padding: 16,
    paddingBottom: 280,
    gap: 8,
  },
  zoneLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: Colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 12,
    marginBottom: 6,
    marginLeft: 4,
  },
  tableGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tableCard: {
    width: 90,
    height: 90,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    position: 'relative',
    gap: 2,
  },
  tableCardRound: {
    borderRadius: 45,
    width: 90,
    height: 90,
  },
  tableId: {
    fontFamily: Typography.monoMedium,
    fontSize: 13,
    color: Colors.text3,
    letterSpacing: 0.5,
  },
  tableCourse: {
    fontFamily: Typography.sans,
    fontSize: 10,
    color: Colors.text2,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  tableCov: {
    fontFamily: Typography.sans,
    fontSize: 10,
    color: Colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tableTime: {
    fontFamily: Typography.mono,
    fontSize: 10,
    opacity: 0.7,
  },
  alertDot: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertDotText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 20,
    padding: 12,
    backgroundColor: 'rgba(10,10,15,0.6)',
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    borderRadius: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.text3,
  },
  legendLabel: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.text2,
    letterSpacing: 0.4,
  },
});

const os = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '65%',
    minHeight: 300,
    backgroundColor: 'rgba(18,18,26,0.96)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 0.5,
    borderTopColor: Colors.goldLine2,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(201,168,76,0.4)',
    alignSelf: 'center',
    marginVertical: 12,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
  },
  eyebrow: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontFamily: Typography.serif,
    fontSize: 28,
    color: Colors.text0,
    letterSpacing: -0.5,
  },
  meta: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaText: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.text2,
  },
  metaDot: {
    color: Colors.text3,
  },
  metaTime: {
    fontFamily: Typography.mono,
    fontSize: 12,
    color: Colors.gold,
  },
  headerBtns: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
  },
  addBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.text1,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  sendBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  sendBtnDone: {
    borderColor: 'rgba(46,204,138,0.4)',
  },
  itemsScroll: {
    flex: 1,
  },
  itemsContent: {
    padding: 16,
    gap: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: Colors.bg2,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    borderRadius: 12,
  },
  itemHeld: {
    opacity: 0.65,
    borderColor: 'rgba(232,213,163,0.35)',
  },
  itemQty: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderWidth: 0.5,
    borderColor: Colors.goldLine2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemQtyWine: {
    backgroundColor: 'rgba(232,213,163,0.1)',
  },
  itemQtyText: {
    fontFamily: Typography.monoMedium,
    fontSize: 14,
    color: Colors.gold,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  itemName: {
    fontFamily: Typography.sansMedium,
    fontSize: 15,
    color: Colors.text0,
  },
  wineTag: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: Colors.goldSoft,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  itemSub: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.text2,
  },
  itemSubAlert: {
    color: Colors.warning,
  },
  itemPrice: {
    fontFamily: Typography.monoMedium,
    fontSize: 15,
    color: Colors.text0,
  },
  sentStatus: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 3,
  },
  footer: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.goldLine,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  totalLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  totalAmount: {
    fontFamily: Typography.serif,
    fontSize: 28,
    color: Colors.gold,
    letterSpacing: -0.5,
    lineHeight: 34,
    marginTop: 2,
  },
  splitBtn: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.text1,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  splitBtnActive: {
    borderColor: Colors.goldLine2,
    backgroundColor: 'rgba(201,168,76,0.1)',
  },
  printBtn: {
    height: 48,
    paddingHorizontal: 18,
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  printBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: '#0A0A0F',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  printBtnDone: {
    backgroundColor: Colors.success,
  },
});
