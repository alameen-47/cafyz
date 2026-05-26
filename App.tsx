import React from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

// Production URL — the same Vite/React app deployed on Vercel.
// All authentication, API calls, and state live there; React Native is just
// a thin native chrome (status bar, safe area, WebView).
const CAFYZ_URL = 'https://cafyz.ametronyx.com';

function LoadingSpinner() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color="#8B5CF6" />
    </View>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#07060F" />
      <SafeAreaView style={styles.safe}>
        <WebView
          source={{ uri: CAFYZ_URL }}
          style={styles.web}
          // Allow localStorage + IndexedDB so JWT session persists across app launches
          domStorageEnabled
          javaScriptEnabled
          // Keep a single browsing context — no pop-up windows
          setSupportMultipleWindows={false}
          // Media (receipt printing, KDS audio cues) works inline
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          // Show a purple spinner while the page loads on first launch
          renderLoading={() => <LoadingSpinner />}
          startInLoadingState
          // Pull-to-refresh disabled — the app manages its own refresh
          bounces={false}
          // Allow back-navigation via Android hardware back button
          allowsBackForwardNavigationGestures
          onShouldStartLoadWithRequest={req => {
            return (
              req.url.startsWith('https://cafyz.ametronyx.com') ||
              req.url.startsWith('https://cafyz.vercel.app') ||
              req.url.startsWith('https://cafyz-') ||
              req.url.includes('.vercel.app') ||
              req.url.includes('.ametronyx.com')
            );
          }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#07060F' },
  web:    { flex: 1, backgroundColor: '#07060F' },
  loader: { flex: 1, backgroundColor: '#07060F', justifyContent: 'center', alignItems: 'center' },
});

export default App;
