import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import App from "./app/App.tsx";
import { AuthProvider } from "./app/auth.tsx";
import "./styles/index.css";

async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return;
  document.documentElement.classList.add("cap-native");
  document.body.classList.add("cap-native");
  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#06091a" });
    await SplashScreen.hide();
  } catch {
    // plugins optional during web dev
  }
}

initNativeShell();

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
