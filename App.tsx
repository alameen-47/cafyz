import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { getCafyzWebAppHtml } from './src/web/cafyzWebApp';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#07060F" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#07060F' }}>
        <WebView
          source={{ html: getCafyzWebAppHtml(), baseUrl: 'https://cafyz.local' }}
          style={{ flex: 1, backgroundColor: '#07060F' }}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          startInLoadingState
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default App;
