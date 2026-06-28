import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { applyNativeSafeAreas, watchNativeSafeAreas } from "./utils/nativeSafeArea";
import App from "./app/App.tsx";
import { ErrorBoundary } from "./app/components/ErrorBoundary.tsx";
import { AuthProvider } from "./app/auth.tsx";
import { PlanConfigProvider } from "./app/PlanConfigProvider.tsx";
import { ThemeProvider } from "./app/ThemeProvider.tsx";
import { LanguageProvider } from "./i18n/LanguageProvider.tsx";
import "./styles/index.css";

function bootNativeShell() {
  if (!Capacitor.isNativePlatform()) return;
  document.documentElement.classList.add("cap-native");
  document.body.classList.add("cap-native");
  // Dismiss splash immediately so the WebView paints without waiting on plugins.
  void SplashScreen.hide().catch(() => {});
  void (async () => {
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: "#06091a" });
      await applyNativeSafeAreas();
      watchNativeSafeAreas();
    } catch {
      /* plugins optional during web dev */
    }
  })();
}

bootNativeShell();

function installGlobalErrorHandlers() {
  const log = (label: string, detail: unknown) => {
    console.error(`[cafyz] ${label}`, detail);
  };
  window.addEventListener('error', ev => {
    log('uncaught error', ev.error ?? ev.message);
  });
  window.addEventListener('unhandledrejection', ev => {
    log('unhandled rejection', ev.reason);
    ev.preventDefault();
  });
}
installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <PlanConfigProvider>
            <App />
          </PlanConfigProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </ErrorBoundary>
);
