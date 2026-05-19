/**
 * Cafyz — Hospitality OS
 * React Native implementation of the premium restaurant ERP design
 *
 * Custom fonts required (link or use expo-font):
 *   - PlayfairDisplay-SemiBold, PlayfairDisplay-Italic
 *   - Inter-Regular, Inter-Medium, Inter-Bold
 *   - JetBrainsMono-Regular, JetBrainsMono-Medium
 *
 * Place font files under: ios/cafyz/Fonts/ and android/app/src/main/assets/fonts/
 * Then run: npx react-native link (or follow manual linking guide)
 */

import React, { useState } from 'react';
import {
  StatusBar,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { LoginScreen } from './src/screens/LoginScreen';
import { ManagerScreen } from './src/screens/ManagerScreen';
import { POSScreen } from './src/screens/POSScreen';
import { KDSScreen } from './src/screens/KDSScreen';
import { WaiterScreen } from './src/screens/WaiterScreen';
import { MobileOrdersScreen } from './src/screens/MobileOrdersScreen';
import { MobileTableDetailScreen } from './src/screens/MobileTableDetailScreen';

import type { Screen } from './src/types';

type MobileOrdersVariant = 'waiter' | 'mobile';

function mobileOrdersVariantForWidth(width: number): MobileOrdersVariant {
  return width >= 768 ? 'waiter' : 'mobile';
}

function Navigator() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Default to manager panel (WebView dashboard)
  const [screen, setScreen] = useState<Screen>('manager');
  // Locked when entering mobileOrders so rotation does not swap screens mid-session
  const [mobileOrdersVariant, setMobileOrdersVariant] = useState<MobileOrdersVariant>(
    () => mobileOrdersVariantForWidth(width),
  );

  const navigate = (s: Screen) => {
    if (s === 'mobileOrders') {
      setMobileOrdersVariant(mobileOrdersVariantForWidth(width));
    }
    setScreen(s);
  };

  switch (screen) {
    case 'login':
      return <LoginScreen onNavigate={navigate} />;
    case 'manager':
      return <ManagerScreen onNavigate={navigate} />;
    case 'pos':
      return <POSScreen onNavigate={navigate} />;
    case 'kds':
      return <KDSScreen onNavigate={navigate} />;
    case 'waiter':
      return <WaiterScreen onNavigate={navigate} />;
    case 'menu':
      return <POSScreen onNavigate={navigate} sidebarActive="menu" />;
    case 'inventory':
      return <ManagerScreen onNavigate={navigate} sidebarActive="inventory" />;
    case 'staff':
      return <ManagerScreen onNavigate={navigate} sidebarActive="staff" />;
    case 'reports':
      return <ManagerScreen onNavigate={navigate} sidebarActive="reports" />;
    case 'mobileOrders':
      return mobileOrdersVariant === 'waiter'
        ? <WaiterScreen onNavigate={navigate} />
        : <MobileOrdersScreen onNavigate={navigate} />;
    case 'mobileTableDetail':
      return <MobileTableDetailScreen onNavigate={navigate} />;
    case 'mobileAddItem':
      return <MobileTableDetailScreen onNavigate={navigate} openAddItem />;
    default:
      return <LoginScreen onNavigate={navigate} />;
  }
}

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
        <Navigator />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default App;
