package com.merplex.noterealm;

import com.getcapacitor.BridgeActivity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

public class MainActivity extends BridgeActivity {
    private int statusBarTopDp = 0;
    private int navBarBottomDp = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Edge-to-edge
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        // Expose status bar insets to JS
        getBridge().getWebView().addJavascriptInterface(new Object() {
            @JavascriptInterface
            public int getTop() {
                if (statusBarTopDp > 0) return statusBarTopDp;
                float density = MainActivity.this.getResources().getDisplayMetrics().density;
                int resId = MainActivity.this.getResources()
                    .getIdentifier("status_bar_height", "dimen", "android");
                return resId > 0
                    ? Math.round(MainActivity.this.getResources().getDimensionPixelSize(resId) / density)
                    : 24;
            }
            @JavascriptInterface
            public int getBottom() { return navBarBottomDp; }
        }, "NativeInsets");

        float density = getResources().getDisplayMetrics().density;
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, insets) -> {
            statusBarTopDp  = Math.round(insets.getInsets(WindowInsetsCompat.Type.statusBars()).top / density);
            navBarBottomDp  = Math.round(insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom / density);
            String js = "document.documentElement.style.setProperty('--sat', '" + statusBarTopDp + "px');" +
                        "document.documentElement.style.setProperty('--sab', '" + navBarBottomDp + "px');";
            getBridge().getWebView().post(() ->
                getBridge().getWebView().evaluateJavascript(js, null));
            return ViewCompat.onApplyWindowInsets(v, insets);
        });

        // Handle deep link ที่ส่งมาตอนเปิดแอปใหม่
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data == null || !"noterealm".equals(data.getScheme())) return;

        // noterealm://login?user={...json...}
        String userJson = data.getQueryParameter("user");
        if (userJson != null) {
            // dispatch CustomEvent ให้ JS รับได้
            String safe = userJson.replace("\\", "\\\\").replace("`", "\\`");
            String js = "window.dispatchEvent(new CustomEvent('nativeOAuth',{detail:" + safe + "}));";
            getBridge().getWebView().post(() ->
                getBridge().getWebView().evaluateJavascript(js, null));
        }
    }
}
