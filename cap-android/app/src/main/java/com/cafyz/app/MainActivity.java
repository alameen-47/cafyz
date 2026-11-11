package com.cafyz.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Android 15 and newer draw every app edge to edge; the opt-out is ignored from Android 16. */
    private static final boolean EDGE_TO_EDGE = Build.VERSION.SDK_INT >= 35;
    private static final int DEFAULT_BAR_COLOR = Color.parseColor("#070511");

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemBarColorPlugin.class);
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        if (!EDGE_TO_EDGE) {
            // Older Android still reserves the bars for us.
            WindowCompat.setDecorFitsSystemWindows(window, true);
            paintSystemBars(DEFAULT_BAR_COLOR, false);
            return;
        }

        // The app is laid out behind the status and navigation bars, so the web view's parent is
        // padded by their size (and by the keyboard's, while it shows). The web view then always
        // sits between the bars, whatever the web view version or the screen being shown.
        WindowCompat.setDecorFitsSystemWindows(window, false);
        if (Build.VERSION.SDK_INT >= 29) window.setNavigationBarContrastEnforced(false);

        View frame = (View) getBridge().getWebView().getParent();
        ViewCompat.setOnApplyWindowInsetsListener(frame, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets keyboard = insets.getInsets(WindowInsetsCompat.Type.ime());
            boolean keyboardShown = insets.isVisible(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, keyboardShown ? Math.max(keyboard.bottom, bars.bottom) : bars.bottom);
            // Hand the web view zero insets (not CONSUMED, which stops later updates), so the
            // page's own safe-area padding does not add a second gap.
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(), Insets.NONE)
                .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
                .build();
        });
        paintSystemBars(DEFAULT_BAR_COLOR, false);
        ViewCompat.requestApplyInsets(frame);
    }

    /**
     * Colour the strips behind the status and navigation bars and pick readable bar icons.
     * `lightBackground` true means dark icons.
     */
    public void paintSystemBars(int color, boolean lightBackground) {
        Window window = getWindow();
        if (EDGE_TO_EDGE) {
            // The bars are transparent; what shows is the padded frame behind the web view.
            ((View) getBridge().getWebView().getParent()).setBackgroundColor(color);
            window.getDecorView().setBackgroundColor(color);
        } else {
            window.setStatusBarColor(color);
            // Before Android 8 the navigation icons are always white, so keep that bar dark.
            window.setNavigationBarColor(lightBackground && Build.VERSION.SDK_INT < 26 ? DEFAULT_BAR_COLOR : color);
        }
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(lightBackground);
        controller.setAppearanceLightNavigationBars(lightBackground);
    }
}
