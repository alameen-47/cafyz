import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Colors } from '../theme';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { TabBar } from '../components/TabBar';
import { getManagerPanelHtml } from '../web/managerPanelHtml';
import type { Screen } from '../types';

interface ManagerScreenProps {
  onNavigate: (screen: Screen) => void;
  sidebarActive?: Screen;
  restaurantName?: string;
}

const MANAGER_SECTIONS = new Set<Screen>(['manager', 'inventory', 'staff', 'reports']);

function crumbForSection(section: Screen): [string, string] {
  switch (section) {
    case 'inventory':
      return ['Operations', 'Inventory'];
    case 'staff':
      return ['Operations', 'Staff'];
    case 'reports':
      return ['Operations', 'Reports'];
    default:
      return ['Operations', 'Overview'];
  }
}

export function ManagerScreen({
  onNavigate,
  sidebarActive = 'manager',
  restaurantName = 'Cafyz',
}: ManagerScreenProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const webRef = useRef<WebView>(null);
  const section = MANAGER_SECTIONS.has(sidebarActive) ? sidebarActive : 'manager';

  useEffect(() => {
    webRef.current?.injectJavaScript(
      `window.setManagerSection && window.setManagerSection('${section}'); true;`,
    );
  }, [section]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type: string;
          screen?: Screen;
        };
        if (data.type === 'navigate' && data.screen) {
          onNavigate(data.screen);
        }
      } catch {
        // ignore malformed messages
      }
    },
    [onNavigate],
  );

  const webContent = (
    <WebView
      ref={webRef}
      source={{
        html: getManagerPanelHtml(section),
        baseUrl: 'https://cafyz.local',
      }}
      style={styles.webview}
      onMessage={handleMessage}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      allowsInlineMediaPlayback
      setSupportMultipleWindows={false}
      startInLoadingState
      renderLoading={() => (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.gold} size="large" />
        </View>
      )}
    />
  );

  if (isTablet) {
    return (
      <View style={styles.root}>
        <Sidebar active={sidebarActive} onNavigate={onNavigate} />
        <View style={styles.main}>
          <TopBar
            crumb={crumbForSection(section)}
            restaurantName={restaurantName}
          />
          {webContent}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TopBar
        crumb={crumbForSection(section)}
        restaurantName={restaurantName}
      />
      {webContent}
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
  main: {
    flex: 1,
    flexDirection: 'column',
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.bg0,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg0,
  },
});
