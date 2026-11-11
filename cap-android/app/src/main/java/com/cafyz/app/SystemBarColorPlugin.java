package com.cafyz.app;

import android.graphics.Color;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the web app colour the areas behind the status and navigation bars to match its theme. */
@CapacitorPlugin(name = "SystemBarColor")
public class SystemBarColorPlugin extends Plugin {

    @PluginMethod
    public void set(PluginCall call) {
        String color = call.getString("color", "#070511");
        boolean light = Boolean.TRUE.equals(call.getBoolean("light", false));
        int parsed;
        try {
            parsed = Color.parseColor(color);
        } catch (IllegalArgumentException e) {
            call.reject("Not a colour: " + color);
            return;
        }
        getActivity().runOnUiThread(() -> {
            ((MainActivity) getActivity()).paintSystemBars(parsed, light);
            call.resolve();
        });
    }
}
