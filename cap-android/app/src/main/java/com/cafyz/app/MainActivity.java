package com.cafyz.app;

import android.graphics.Color;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Keep status + navigation bars reserved — WebView content stays below/above system UI.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        getWindow().setStatusBarColor(Color.parseColor("#06091a"));
        getWindow().setNavigationBarColor(Color.parseColor("#06091a"));
    }
}
