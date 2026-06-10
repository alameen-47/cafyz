import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Colors, Radius, Typography } from '../theme';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { TabBar } from '../components/TabBar';
import type { Screen } from '../types';

interface POSScreenProps {
  onNavigate: (screen: Screen) => void;
  sidebarActive?: Screen;
  restaurantName?: string;
}

const DISHES = [
  {
    id: 1,
    cat: 'starters',
    name: 'Burrata di Andria',
    price: 18,
    sub: 'Heirloom tomato · basil oil',
    sym: '◯',
  },
  {
    id: 2,
    cat: 'starters',
    name: 'Tuna Crudo',
    price: 24,
    sub: 'Citrus · radish · togarashi',
    sym: '~',
  },
  {
    id: 3,
    cat: 'starters',
    name: 'Beef Tartare',
    price: 22,
    sub: 'Cured yolk · cornichon',
    sym: '◐',
  },
  {
    id: 4,
    cat: 'mains',
    name: 'Côte de Bœuf',
    price: 64,
    sub: '500g · bone marrow butter',
    sym: '◐',
  },
  {
    id: 5,
    cat: 'mains',
    name: 'Black Cod Miso',
    price: 42,
    sub: 'Saikyo · pickled ginger',
    sym: '~',
    popular: true,
  },
  {
    id: 6,
    cat: 'mains',
    name: 'Risotto Milanese',
    price: 32,
    sub: 'Saffron · 24-month parmigiano',
    sym: '✦',
  },
  {
    id: 7,
    cat: 'mains',
    name: "Duck à l'Orange",
    price: 46,
    sub: 'Confit leg · gastrique',
    sym: '◐',
  },
  {
    id: 8,
    cat: 'mains',
    name: 'Lobster Linguine',
    price: 58,
    sub: 'Maine · bisque · tarragon',
    sym: '✦',
    popular: true,
  },
  {
    id: 9,
    cat: 'mains',
    name: 'Wagyu A5 Sando',
    price: 78,
    sub: 'Milk bread · katsu',
    sym: '◐',
  },
  {
    id: 10,
    cat: 'desserts',
    name: 'Soufflé Grand Marnier',
    price: 16,
    sub: 'Crème anglaise',
    sym: '◇',
  },
  {
    id: 11,
    cat: 'desserts',
    name: 'Île Flottante',
    price: 14,
    sub: 'Almond praline',
    sym: '◇',
  },
  {
    id: 12,
    cat: 'desserts',
    name: 'Tarte Tatin',
    price: 15,
    sub: 'Crème fraîche',
    sym: '◇',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All', count: 12 },
  { id: 'starters', label: 'Starters', count: 3 },
  { id: 'mains', label: 'Mains', count: 6 },
  { id: 'desserts', label: 'Desserts', count: 3 },
  { id: 'wine', label: 'Wine', count: 14 },
  { id: 'drinks', label: 'Drinks', count: 8 },
];

type OrderItem = { id: number; qty: number; mods: string[] };

const INITIAL_ORDER: OrderItem[] = [
  { id: 5, qty: 2, mods: ['No ginger', 'Extra miso'] },
  { id: 8, qty: 1, mods: ['Spice ×2'] },
  { id: 10, qty: 2, mods: [] },
  { id: 1, qty: 1, mods: [] },
];

export function POSScreen({
  onNavigate,
  sidebarActive = 'pos',
  restaurantName = 'Cafyz',
}: POSScreenProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [cat, setCat] = useState('mains');
  const [order, setOrder] = useState<OrderItem[]>(INITIAL_ORDER);
  const [searchFocused, setSearchFocused] = useState(false);
  const [tableNote, setTableNote] = useState<string | null>(null);
  const [compApplied, setCompApplied] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    'open' | 'card' | 'cash' | 'sent'
  >('open');

  const visible = DISHES.filter(d => cat === 'all' || d.cat === cat);
  const orderMap = Object.fromEntries(order.map(o => [o.id, o.qty]));

  const addDish = (dish: (typeof DISHES)[0]) => {
    setOrder(prev => {
      const i = prev.findIndex(o => o.id === dish.id);
      if (i >= 0) {
        const c = [...prev];
        c[i] = { ...c[i], qty: c[i].qty + 1 };
        return c;
      }
      return [...prev, { id: dish.id, qty: 1, mods: [] }];
    });
  };

  const changeQty = (id: number, delta: number) => {
    setOrder(prev =>
      prev
        .map(o => (o.id === id ? { ...o, qty: o.qty + delta } : o))
        .filter(o => o.qty > 0),
    );
  };

  const subtotal = order.reduce(
    (s, o) => s + (DISHES.find(d => d.id === o.id)?.price ?? 0) * o.qty,
    0,
  );
  const billableSubtotal = compApplied ? 0 : subtotal;
  const service = billableSubtotal * 0.18;
  const tax = billableSubtotal * 0.0875;
  const total = billableSubtotal + service + tax;

  const addTableNote = () =>
    setTableNote('Allergies: shellfish — anniversary dessert');
  const applyComp = () => setCompApplied(true);
  const applySplit = () => setSplitMode(true);

  const orderSummary = (
    <View style={[os.panel, !isTablet && os.panelMobile]}>
      {/* Header */}
      <View style={os.header}>
        <View style={{ flex: 1 }}>
          <Text style={os.subLabel}>Active Check</Text>
          <Text style={os.title}>Table 12 · Vasseur</Text>
          <View style={os.meta}>
            <Text style={os.metaText}>4 guests</Text>
            <Text style={os.metaDot}>·</Text>
            <Text style={os.metaText}>Jules R.</Text>
            <Text style={os.metaDot}>·</Text>
            <Text style={os.metaTime}>00:41</Text>
          </View>
        </View>
        <Badge
          label={
            paymentMethod === 'card'
              ? 'Paid · Card'
              : paymentMethod === 'cash'
              ? 'Paid · Cash'
              : paymentMethod === 'sent'
              ? 'Sent'
              : compApplied
              ? 'Comped'
              : splitMode
              ? 'Split'
              : 'Open'
          }
          variant={
            paymentMethod !== 'open' || compApplied
              ? 'paid'
              : splitMode
              ? 'pending'
              : 'pending'
          }
        />
      </View>
      {tableNote ? <Text style={os.tableNote}>Note · {tableNote}</Text> : null}

      {/* Items */}
      <ScrollView style={os.itemsScroll}>
        {order.map(o => {
          const d = DISHES.find(x => x.id === o.id);
          if (!d) return null;
          return (
            <View key={o.id} style={os.orderItem}>
              <View style={os.qtyBadge}>
                <Text style={os.qtyText}>{o.qty}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={os.itemRow}>
                  <Text style={os.itemName}>{d.name}</Text>
                  <Text style={os.itemPrice}>
                    ${(d.price * o.qty).toFixed(2)}
                  </Text>
                </View>
                {o.mods.length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    {o.mods.map((m, mi) => (
                      <Text key={mi} style={os.mod}>
                        · {m}
                      </Text>
                    ))}
                  </View>
                )}
                <View style={os.qtyBtns}>
                  <TouchableOpacity
                    style={os.qtyBtn}
                    onPress={() => changeQty(o.id, -1)}
                  >
                    <Text style={os.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={os.qtyBtn}
                    onPress={() => changeQty(o.id, 1)}
                  >
                    <Text style={os.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
        <View style={os.extraBtns}>
          <TouchableOpacity style={os.extraBtn} onPress={addTableNote}>
            <Text style={os.extraBtnText}>
              {tableNote ? 'Edit note' : 'Add note'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[os.extraBtn, compApplied && os.extraBtnActive]}
            onPress={applyComp}
            disabled={compApplied}
          >
            <Text style={os.extraBtnText}>
              {compApplied ? 'Comped' : 'Comp'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[os.extraBtn, splitMode && os.extraBtnActive]}
            onPress={applySplit}
          >
            <Text style={os.extraBtnText}>
              {splitMode ? 'Split · 2' : 'Split'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Totals */}
      <View style={os.totals}>
        <TotalRow label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
        <TotalRow label="Service · 18%" value={`$${service.toFixed(2)}`} />
        <TotalRow label="Tax · 8.75%" value={`$${tax.toFixed(2)}`} />
        <View style={os.divider} />
        <View style={os.totalFinal}>
          <Text style={os.totalLabel}>Total Due</Text>
          <Text style={os.totalAmount}>${total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[os.chargeBtn, paymentMethod === 'card' && os.chargeBtnDone]}
          activeOpacity={0.85}
          onPress={() => setPaymentMethod('card')}
          disabled={paymentMethod !== 'open' || order.length === 0}
        >
          <Text style={os.chargeIcon}>💳</Text>
          <Text style={os.chargeName}>
            {paymentMethod === 'card' ? 'Charged' : 'Charge'}
          </Text>
          <Text style={os.chargeSep}>·</Text>
          <Text style={os.chargeTotal}>${total.toFixed(2)}</Text>
        </TouchableOpacity>
        <View style={os.altPayBtns}>
          <TouchableOpacity
            style={[
              os.altPayBtn,
              paymentMethod === 'cash' && os.altPayBtnActive,
            ]}
            onPress={() => setPaymentMethod('cash')}
            disabled={paymentMethod !== 'open' || order.length === 0}
          >
            <Text style={os.altPayText}>💵 Cash</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              os.altPayBtn,
              paymentMethod === 'sent' && os.altPayBtnActive,
            ]}
            onPress={() => setPaymentMethod('sent')}
            disabled={paymentMethod !== 'open' || order.length === 0}
          >
            <Text style={os.altPayText}>🧾 Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const productGrid = (
    <View style={[styles.grid, !isTablet && styles.gridMobile]}>
      {/* Category pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScroll}
        contentContainerStyle={styles.pillContent}
      >
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c.id}
            onPress={() => setCat(c.id)}
            style={[styles.pill, cat === c.id && styles.pillActive]}
          >
            <Text
              style={[styles.pillText, cat === c.id && styles.pillTextActive]}
            >
              {c.label}
            </Text>
            <Text
              style={[styles.pillCount, cat === c.id && styles.pillCountActive]}
            >
              {c.count}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search the menu"
            placeholderTextColor={Colors.text3}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <Text style={styles.searchKbd}>⌘K</Text>
        </View>
      </ScrollView>

      {/* Dish grid */}
      <ScrollView contentContainerStyle={styles.dishGrid}>
        <View style={styles.dishRow}>
          {visible.map((d, i) => (
            <TouchableOpacity
              key={d.id}
              onPress={() => addDish(d)}
              activeOpacity={0.85}
              style={[
                styles.dishCard,
                orderMap[d.id] ? styles.dishCardActive : undefined,
              ]}
            >
              {/* Plate visual */}
              <View style={styles.plateArea}>
                <View style={styles.plate}>
                  <View style={styles.plateInner} />
                  <Text style={styles.plateSym}>{d.sym}</Text>
                </View>
                {d.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>★ Popular</Text>
                  </View>
                )}
                {orderMap[d.id] && (
                  <View style={styles.qtyOverlay}>
                    <Text style={styles.qtyOverlayText}>
                      × {orderMap[d.id]}
                    </Text>
                  </View>
                )}
              </View>
              {/* Info */}
              <View style={styles.dishInfo}>
                <Text style={styles.dishName} numberOfLines={1}>
                  {d.name}
                </Text>
                <Text style={styles.dishPrice}>${d.price}</Text>
                <Text style={styles.dishSub} numberOfLines={1}>
                  {d.sub}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  if (isTablet) {
    return (
      <View style={styles.root}>
        <Sidebar active={sidebarActive} onNavigate={onNavigate} />
        <View style={{ flex: 1, flexDirection: 'column' }}>
          <TopBar
            crumb={['Service', 'Point of Sale']}
            restaurantName={restaurantName}
          />
          <View style={styles.mainContent}>
            {productGrid}
            {orderSummary}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={{ flex: 1, flexDirection: 'column' }}>
        <TopBar crumb={['Service', 'POS']} restaurantName={restaurantName} />
        <View style={styles.mainContent}>{productGrid}</View>
        {/* Mobile: mini order summary */}
        <View style={styles.mobileSummaryBar}>
          <View>
            <Text style={styles.mobileSummaryLabel}>{order.length} items</Text>
            <Text style={styles.mobileSummaryTotal}>${total.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.mobileSummaryBtn}>
            <Text style={styles.mobileSummaryBtnText}>View Order →</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TabBar active="pos" onNavigate={onNavigate} />
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={os.totalRow}>
      <Text style={os.totalRowLabel}>{label}</Text>
      <Text style={os.totalRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.bg0,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  grid: {
    flex: 1,
    padding: 24,
    flexDirection: 'column',
  },
  gridMobile: {
    flex: 1,
  },
  pillScroll: {
    marginBottom: 18,
    flexGrow: 0,
  },
  pillContent: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingRight: 16,
  },
  pill: {
    height: 36,
    paddingHorizontal: 16,
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
  pillText: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.text1,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pillTextActive: {
    color: '#0A0A0F',
  },
  pillCount: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.text3,
  },
  pillCountActive: {
    color: 'rgba(7,6,15,0.6)',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    backgroundColor: Colors.bg2,
    minWidth: 180,
    gap: 8,
  },
  searchIcon: { fontSize: 12 },
  searchInput: {
    flex: 1,
    color: Colors.text0,
    fontFamily: Typography.sans,
    fontSize: 13,
  },
  searchKbd: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.text3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: Colors.line2,
    borderRadius: 4,
  },
  dishGrid: {
    paddingBottom: 20,
  },
  dishRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  dishCard: {
    width: '31%',
    minWidth: 140,
    backgroundColor: Colors.bg1,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    overflow: 'hidden',
  },
  dishCardActive: {
    borderColor: 'rgba(139,92,246,0.55)',
  },
  plateArea: {
    height: 120,
    backgroundColor: Colors.bg0,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
    position: 'relative',
  },
  plate: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#130F2A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  plateInner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 30,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
  },
  plateSym: {
    fontFamily: Typography.serif,
    fontSize: 24,
    color: 'rgba(196,181,253,0.8)',
  },
  popularBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(7,6,15,0.8)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: Colors.goldLine2,
  },
  popularText: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  qtyOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.gold,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  qtyOverlayText: {
    fontFamily: Typography.monoMedium,
    fontSize: 11,
    color: '#0A0A0F',
  },
  dishInfo: {
    padding: 14,
    gap: 4,
  },
  dishName: {
    fontFamily: Typography.serif,
    fontSize: 15,
    color: Colors.text0,
    lineHeight: 18,
  },
  dishPrice: {
    fontFamily: Typography.monoMedium,
    fontSize: 14,
    color: Colors.gold,
  },
  dishSub: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.text2,
  },
  mobileSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: Colors.goldLine,
    backgroundColor: Colors.bg1,
  },
  mobileSummaryLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  mobileSummaryTotal: {
    fontFamily: Typography.serif,
    fontSize: 22,
    color: Colors.gold,
    letterSpacing: -0.5,
  },
  mobileSummaryBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    height: 44,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileSummaryBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: '#0A0A0F',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});

const os = StyleSheet.create({
  panel: {
    width: 360,
    minWidth: 360,
    borderLeftWidth: 0.5,
    borderLeftColor: Colors.goldLine,
    backgroundColor: Colors.bg1,
    flexDirection: 'column',
  },
  panelMobile: {
    width: '100%',
    minWidth: undefined,
    borderLeftWidth: 0,
    borderTopWidth: 0.5,
    borderTopColor: Colors.goldLine,
  },
  header: {
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  subLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontFamily: Typography.serif,
    fontSize: 22,
    color: Colors.text0,
    letterSpacing: -0.3,
  },
  meta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  metaText: {
    fontFamily: Typography.sans,
    fontSize: 12,
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
  itemsScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  orderItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
  },
  qtyBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderWidth: 0.5,
    borderColor: Colors.goldLine2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  qtyText: {
    fontFamily: Typography.monoMedium,
    fontSize: 12,
    color: Colors.gold,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'baseline',
  },
  itemName: {
    flex: 1,
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: Colors.text0,
  },
  itemPrice: {
    fontFamily: Typography.mono,
    fontSize: 13,
    color: Colors.text0,
  },
  mod: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.text2,
    lineHeight: 18,
  },
  qtyBtns: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: Colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    color: Colors.text1,
    fontSize: 16,
    lineHeight: 20,
  },
  extraBtns: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 14,
  },
  extraBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: Colors.text1,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  extraBtnActive: {
    borderColor: Colors.goldLine2,
    backgroundColor: 'rgba(139,92,246,0.1)',
  },
  tableNote: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.goldSoft,
    paddingHorizontal: 20,
    paddingBottom: 10,
    lineHeight: 18,
  },
  totals: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.goldLine,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalRowLabel: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.text2,
  },
  totalRowValue: {
    fontFamily: Typography.mono,
    fontSize: 13,
    color: Colors.text1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.goldLine,
    marginVertical: 12,
  },
  totalFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  totalLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  totalAmount: {
    fontFamily: Typography.serif,
    fontSize: 34,
    color: Colors.gold,
    letterSpacing: -0.8,
  },
  chargeBtn: {
    height: 56,
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  chargeBtnDone: {
    backgroundColor: Colors.success,
  },
  chargeIcon: { fontSize: 16 },
  chargeName: {
    fontFamily: Typography.serif,
    fontSize: 17,
    color: '#0A0A0F',
    fontWeight: '600',
  },
  chargeSep: {
    color: 'rgba(7,6,15,0.55)',
    fontSize: 16,
  },
  chargeTotal: {
    fontFamily: Typography.monoMedium,
    fontSize: 15,
    color: '#0A0A0F',
  },
  altPayBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  altPayBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  altPayBtnActive: {
    borderColor: Colors.goldLine2,
    backgroundColor: 'rgba(139,92,246,0.1)',
  },
  altPayText: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.text1,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});
