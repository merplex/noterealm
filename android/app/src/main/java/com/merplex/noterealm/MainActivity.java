package com.merplex.noterealm;

import com.getcapacitor.BridgeActivity;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

public class MainActivity extends BridgeActivity {
    // เก็บเป็น dp (CSS px) ไม่ใช่ physical px
    private int statusBarTopDp = 0;
    private int navBarBottomDp = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable edge-to-edge
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Support display cutout (notch/punch-hole)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        // Expose insets to JS ผ่าน window.NativeInsets
        getBridge().getWebView().addJavascriptInterface(new Object() {
            @JavascriptInterface
            public int getTop() {
                // ถ้า listener ยังไม่ fire → fallback จาก Android resource (sync, ได้ทันที)
                if (statusBarTopDp > 0) return statusBarTopDp;
                float density = MainActivity.this.getResources().getDisplayMetrics().density;
                int resId = MainActivity.this.getResources()
                    .getIdentifier("status_bar_height", "dimen", "android");
                return resId > 0
                    ? Math.round(MainActivity.this.getResources().getDimensionPixelSize(resId) / density)
                    : 24; // default fallback
            }
            @JavascriptInterface
            public int getBottom() {
                return navBarBottomDp;
            }
        }, "NativeInsets");

        // Track insets — แปลง physical px → dp แล้วค่อย inject
        float density = getResources().getDisplayMetrics().density;
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, insets) -> {
            int topPx    = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
            int bottomPx = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
            statusBarTopDp  = Math.round(topPx / density);
            navBarBottomDp  = Math.round(bottomPx / density);

            String js = "document.documentElement.style.setProperty('--sat', '" + statusBarTopDp + "px');" +
                        "document.documentElement.style.setProperty('--sab', '" + navBarBottomDp + "px');";
            getBridge().getWebView().post(() ->
                getBridge().getWebView().evaluateJavascript(js, null));

            return ViewCompat.onApplyWindowInsets(v, insets);
        });
    }
}
