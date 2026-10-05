package com.cheerfulgames.resuming;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Above this the fixed-height bottom nav and tiles start clipping.
    private static final int MAX_TEXT_ZOOM = 130;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InstallReferrerPlugin.class);
        super.onCreate(savedInstanceState);
        lockPhonesToPortrait();
        applyFontScale();
    }

    // Tablets (600dp and up) rotate freely; the layout has a side rail for them.
    private void lockPhonesToPortrait() {
        if (getResources().getConfiguration().smallestScreenWidthDp < 600) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        applyFontScale();
    }

    private void applyFontScale() {
        if (bridge == null) return;
        WebView webView = bridge.getWebView();
        if (webView == null) return;
        float fontScale = getResources().getConfiguration().fontScale;
        int zoom = Math.round(fontScale * 100);
        zoom = Math.max(100, Math.min(MAX_TEXT_ZOOM, zoom));
        webView.getSettings().setTextZoom(zoom);
    }
}
