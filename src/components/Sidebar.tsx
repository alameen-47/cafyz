import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, type ImageSourcePropType } from 'react-native';
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
  restaurantLogoUrl?: string | null;
  restaurantName?: string;
  restaurantSub?: string;
  userName?: string;
  userRole?: string;
  userInitials?: string;
}

function isRenderableLogo(url?: string | null): url is string {
  if (!url) return false;
  return url.startsWith('data:image/') || url.startsWith('http://') || url.startsWith('https://');
}

export function Sidebar({
  active,
  onNavigate,
  collapsed = false,
  restaurantLogoUrl,
  restaurantName = 'Cafyz',
  restaurantSub = 'SAINT · PARIS 6e',
  userName = 'Mireille Vasseur',
  userRole = "Maître d'hôtel",
  userInitials = 'MV',
}: SidebarProps) {
  const w = collapsed ? 72 : 240;
  const logoSource: ImageSourcePropType = isRenderableLogo(restaurantLogoUrl)
    ? { uri: restaurantLogoUrl }
    : require('../../logo.png');

  return (
    <View style={[styles.sidebar, { width: w, minWidth: w }]}>
      {/* Brand */}
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Image source={logoSource} style={styles.logoImage} resizeMode="cover" />
        </View>
        {!collapsed && (
          <View>
            <Text style={styles.brandName}>{restaurantName}</Text>
            <Text style={styles.brandSub}>{restaurantSub}</Text>
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
          <Text style={styles.avatarText}>{userInitials}</Text>
        </View>
        {!collapsed && (
          <View style={styles.footerInfo}>
            <Text style={styles.footerName}>{userName}</Text>
            <Text style={styles.footerRole}>{userRole}</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
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
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
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
    backgroundColor: '#100B1E',
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
