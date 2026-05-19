import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Radius, Typography } from '../theme';
import type { Screen } from '../types';

interface SidebarItem {
  id: Screen;
  label: string;
  badge?: string;
}

const NAV_ITEMS: SidebarItem[] = [
  { id: 'manager', label: 'Overview' },
  { id: 'pos', label: 'Point of Sale' },
  { id: 'waiter', label: 'Tables' },
  { id: 'kds', label: 'Kitchen', badge: '14' },
  { id: 'menu', label: 'Menu' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'staff', label: 'Staff' },
  { id: 'reports', label: 'Reports' },
];

interface SidebarProps {
  active: Screen;
  onNavigate: (screen: Screen) => void;
  collapsed?: boolean;
}

export function Sidebar({ active, onNavigate, collapsed = false }: SidebarProps) {
  const w = collapsed ? 72 : 240;

  return (
    <View style={[styles.sidebar, { width: w, minWidth: w }]}>
      {/* Brand */}
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>C</Text>
        </View>
        {!collapsed && (
          <View>
            <Text style={styles.brandName}>Cafyz</Text>
            <Text style={styles.brandSub}>SAINT · PARIS 6e</Text>
          </View>
        )}
      </View>

      {/* Nav */}
      <View style={styles.nav}>
        {NAV_ITEMS.map(item => {
          const isActive = active === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onNavigate(item.id)}
              style={[
                styles.navItem,
                isActive && styles.navItemActive,
                collapsed && styles.navItemCollapsed,
              ]}
              activeOpacity={0.7}
            >
              {isActive && <View style={styles.activeBar} />}
              {!collapsed && (
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {item.label}
                </Text>
              )}
              {!collapsed && item.badge && (
                <Text style={styles.navBadge}>{item.badge}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* User */}
      <View style={styles.footer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>MV</Text>
        </View>
        {!collapsed && (
          <View style={styles.footerInfo}>
            <Text style={styles.footerName}>Mireille Vasseur</Text>
            <Text style={styles.footerRole}>Maître d'hôtel</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: Colors.bgSidebar,
    borderRightWidth: 0.5,
    borderRightColor: Colors.goldLine,
    paddingHorizontal: 12,
    paddingVertical: 20,
    flexDirection: 'column',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingBottom: 22,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.goldLine,
    marginBottom: 16,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
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
  brandName: {
    fontFamily: Typography.serif,
    fontSize: 18,
    color: Colors.text0,
    lineHeight: 20,
  },
  brandSub: {
    fontFamily: Typography.mono,
    fontSize: 9,
    color: Colors.text3,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  nav: {
    flex: 1,
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    position: 'relative',
    gap: 14,
  },
  navItemActive: {
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    width: 48,
    height: 48,
  },
  activeBar: {
    position: 'absolute',
    left: -1,
    top: 8,
    bottom: 8,
    width: 2,
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
  navLabel: {
    flex: 1,
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.text2,
    letterSpacing: 0.1,
  },
  navLabelActive: {
    color: Colors.gold,
  },
  navBadge: {
    fontFamily: Typography.mono,
    fontSize: 11,
    color: Colors.gold,
  },
  footer: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.goldLine,
    paddingTop: 14,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    backgroundColor: '#14141c',
    borderWidth: 0.5,
    borderColor: Colors.goldLine2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Typography.serif,
    fontSize: 13,
    color: Colors.gold,
  },
  footerInfo: {
    flex: 1,
  },
  footerName: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.text0,
  },
  footerRole: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.text2,
    marginTop: 1,
  },
});
