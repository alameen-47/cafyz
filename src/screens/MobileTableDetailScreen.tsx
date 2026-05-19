import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
} from 'react-native';
import { Colors, Radius, Typography } from '../theme';
import { TabBar } from '../components/TabBar';
import type { Screen } from '../types';

interface MobileTableDetailScreenProps {
  onNavigate: (screen: Screen) => void;
  openAddItem?: boolean;
}

const ITEMS = [
  { name: 'Tuna Crudo', qty: 1, price: 24, sent: true },
  { name: 'Burrata di Andria', qty: 2, price: 18, sent: true, alert: 'No tomato' },
  { name: 'Black Cod Miso', qty: 2, price: 42, sent: true },
  { name: 'Côte de Bœuf · 500g', qty: 1, price: 64, sent: false },
  { name: 'Riesling Trimbach', qty: 1, price: 78, sent: true, wine: true },
];

const COURSES = [
  { t: 'Drinks', done: true },
  { t: 'Starters', done: true },
  { t: 'Mains', done: false, active: true },
  { t: 'Dessert', done: false },
  { t: 'Check', done: false },
];

const MENU_ITEMS = [
  { name: 'Burrata di Andria', sub: 'Heirloom tomato · basil', price: 18, sym: '◯', popular: true },
  { name: 'Tuna Crudo', sub: 'Citrus · radish', price: 24, sym: '~' },
  { name: 'Beef Tartare', sub: 'Cured yolk · cornichon', price: 22, sym: '◐' },
  { name: 'Oysters Belon', sub: '6 / 12 · mignonette', price: 32, sym: '◇' },
];

function AddItemModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [activeCategory, setActiveCategory] = useState('Starters');
  const [cartCount, setCartCount] = useState(3);
  const categories = ['Starters', 'Mains', 'Sides', 'Desserts', 'Wine'];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modal.overlay}>
        {/* Dimmed background */}
        <TouchableOpacity style={modal.backdrop} onPress={onClose} activeOpacity={1} />

        {/* Sheet */}
        <View style={modal.sheet}>
          <View style={modal.handle} />

          <View style={modal.header}>
            <View>
              <Text style={modal.eyebrow}>Adding to T·12</Text>
              <Text style={modal.title}>Menu</Text>
            </View>
            <TouchableOpacity style={modal.closeBtn} onPress={onClose}>
              <Text style={modal.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={modal.searchRow}>
            <View style={modal.searchBox}>
              <Text style={modal.searchIcon}>🔍</Text>
              <TextInput
                style={modal.searchInput}
                placeholder="Search the menu"
                placeholderTextColor={Colors.text3}
              />
            </View>
          </View>

          {/* Category pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={modal.pillScroll}
            contentContainerStyle={modal.pillContent}
          >
            {categories.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => setActiveCategory(c)}
                style={[modal.pill, c === activeCategory && modal.pillActive]}
              >
                <Text style={[modal.pillText, c === activeCategory && modal.pillTextActive]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Items */}
          <ScrollView style={modal.itemList} contentContainerStyle={modal.itemListContent}>
            {MENU_ITEMS.map((d, i) => (
              <View key={i} style={modal.menuItem}>
                <View style={modal.menuPlate}>
                  <Text style={modal.menuSym}>{d.sym}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={modal.menuNameRow}>
                    <Text style={modal.menuName}>{d.name}</Text>
                    {d.popular && (
                      <View style={modal.popularDot}>
                        <Text style={modal.popularText}>★</Text>
                      </View>
                    )}
                  </View>
                  <Text style={modal.menuSub}>{d.sub}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={modal.menuPrice}>${d.price}</Text>
                  <TouchableOpacity
                    style={modal.addBtn}
                    onPress={() => setCartCount(c => c + 1)}
                  >
                    <Text style={modal.addBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Cart bar */}
          <TouchableOpacity style={modal.cartBar} onPress={onClose} activeOpacity={0.9}>
            <View style={modal.cartCount}>
              <Text style={modal.cartCountText}>{cartCount}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={modal.cartItemsLabel}>{cartCount} items</Text>
              <Text style={modal.cartTotal}>${cartCount * 24}</Text>
            </View>
            <Text style={modal.cartReview}>Review</Text>
            <Text style={modal.cartArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function MobileTableDetailScreen({
  onNavigate,
  openAddItem = false,
}: MobileTableDetailScreenProps) {
  const [showAddModal, setShowAddModal] = useState(openAddItem);
  const subtotal = ITEMS.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => onNavigate('mobileOrders')}
          activeOpacity={0.7}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Table 12 · Active</Text>
          <Text style={styles.title}>Vasseur · 4 guests</Text>
        </View>
        <TouchableOpacity style={styles.moreBtn} activeOpacity={0.7}>
          <Text style={styles.moreIcon}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Course tracker */}
      <View style={styles.courseTracker}>
        {COURSES.map((c, i) => (
          <View key={i} style={styles.courseItem}>
            <View
              style={[
                styles.courseBar,
                c.done
                  ? styles.courseBarDone
                  : c.active
                  ? styles.courseBarActive
                  : styles.courseBarPending,
              ]}
            />
            <Text
              style={[
                styles.courseLabel,
                c.active && styles.courseLabelActive,
                c.done && styles.courseLabelDone,
              ]}
            >
              {c.t}
            </Text>
          </View>
        ))}
      </View>

      {/* Items */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {ITEMS.map((it, i) => (
          <View key={i} style={styles.item}>
            <View style={[styles.itemQty, it.wine && styles.itemQtyWine]}>
              <Text style={[styles.itemQtyText, it.wine && { color: Colors.goldSoft }]}>
                {it.qty}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{it.name}</Text>
              <Text
                style={[
                  styles.itemSub,
                  it.alert && styles.itemSubAlert,
                ]}
              >
                {it.alert
                  ? `⚠ ${it.alert}`
                  : it.sent
                  ? '✓ Sent to kitchen'
                  : 'Hold — not sent'}
              </Text>
            </View>
            <Text style={styles.itemPrice}>${it.price * it.qty}</Text>
          </View>
        ))}

        <TouchableOpacity
          style={styles.addItemBtn}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addItemBtnText}>+ Add item</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalAmount}>${subtotal.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.sendBtnText}>Send →</Text>
        </TouchableOpacity>
      </View>

      <TabBar active="mobileOrders" onNavigate={onNavigate} />

      <AddItemModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.bg1,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: Colors.text1,
    lineHeight: 26,
  },
  eyebrow: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontFamily: Typography.serif,
    fontSize: 22,
    color: Colors.text0,
    letterSpacing: -0.3,
  },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.bg1,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreIcon: {
    fontSize: 18,
    color: Colors.text1,
  },
  courseTracker: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 4,
  },
  courseItem: {
    flex: 1,
  },
  courseBar: {
    height: 2,
    borderRadius: 2,
    marginBottom: 6,
  },
  courseBarDone: {
    backgroundColor: Colors.gold,
  },
  courseBarActive: {
    backgroundColor: Colors.gold,
  },
  courseBarPending: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  courseLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: Colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  courseLabelActive: {
    color: Colors.gold,
  },
  courseLabelDone: {
    color: Colors.text1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: Colors.bg1,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    borderRadius: 12,
  },
  itemQty: {
    width: 30,
    height: 30,
    borderRadius: 7,
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
    fontSize: 12,
    color: Colors.gold,
  },
  itemName: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.text0,
    marginBottom: 2,
  },
  itemSub: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.text3,
  },
  itemSubAlert: {
    color: Colors.warning,
  },
  itemPrice: {
    fontFamily: Typography.monoMedium,
    fontSize: 13,
    color: Colors.text1,
    flexShrink: 0,
  },
  addItemBtn: {
    paddingVertical: 14,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: Colors.goldLine2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: Colors.goldLine,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  totalLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 9,
    color: Colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  totalAmount: {
    fontFamily: Typography.serif,
    fontSize: 24,
    color: Colors.gold,
    letterSpacing: -0.5,
    lineHeight: 30,
    marginTop: 2,
  },
  sendBtn: {
    height: 48,
    paddingHorizontal: 24,
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: '#0A0A0F',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10,10,15,0.55)',
  },
  sheet: {
    backgroundColor: 'rgba(18,18,26,0.98)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 0.5,
    borderTopColor: Colors.goldLine2,
    height: '85%',
    flexDirection: 'column',
    paddingBottom: 24,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 18,
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
    fontSize: 26,
    color: Colors.text0,
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.bg2,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: Colors.text1,
  },
  searchRow: {
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.bg2,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    gap: 10,
  },
  searchIcon: { fontSize: 14 },
  searchInput: {
    flex: 1,
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.text0,
  },
  pillScroll: {
    flexGrow: 0,
    marginBottom: 12,
  },
  pillContent: {
    paddingHorizontal: 24,
    gap: 6,
    flexDirection: 'row',
  },
  pill: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
  },
  pillActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
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
  itemList: {
    flex: 1,
  },
  itemListContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    backgroundColor: Colors.bg1,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    borderRadius: 12,
  },
  menuPlate: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#2a1f10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuSym: {
    fontFamily: Typography.serif,
    fontSize: 22,
    color: 'rgba(232,213,163,0.8)',
  },
  menuNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  menuName: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: Colors.text0,
  },
  popularDot: {
    backgroundColor: 'rgba(201,168,76,0.16)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  popularText: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.gold,
  },
  menuSub: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.text2,
  },
  menuPrice: {
    fontFamily: Typography.monoMedium,
    fontSize: 13,
    color: Colors.gold,
    marginBottom: 6,
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 18,
    color: '#0A0A0F',
    lineHeight: 22,
  },
  cartBar: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: Colors.gold,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartCount: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(10,10,15,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCountText: {
    fontFamily: Typography.monoMedium,
    fontSize: 13,
    color: Colors.gold,
  },
  cartItemsLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: '#0A0A0F',
    opacity: 0.75,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cartTotal: {
    fontFamily: Typography.serif,
    fontSize: 18,
    color: '#0A0A0F',
    fontWeight: '600',
    lineHeight: 22,
  },
  cartReview: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: '#0A0A0F',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  cartArrow: {
    fontSize: 16,
    color: '#0A0A0F',
  },
});
