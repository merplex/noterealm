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
    private int statusBarTop = 0;
    private int navBarBottom = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable edge-to-edge
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Support display cutout (notch)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        // Expose insets to JS — JS อ่านได้ทันทีเมื่อ page โหลดเสร็จ
        getBridge().getWebView().addJavascriptInterface(new Object() {
            @JavascriptInterface
            public int getTop() { return statusBarTop; }
            @JavascriptInterface
            public int getBottom() { return navBarBottom; }
        }, "NativeInsets");

        // Track insets จาก decorView (raw system insets เสมอ)
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, insets) -> {
            statusBarTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
            navBarBottom = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;

            // inject ด้วยเผื่อ page โหลดอยู่แล้ว
            String js = "document.documentElement.style.setProperty('--sat', '" + statusBarTop + "px');" +
                        "document.documentElement.style.setProperty('--sab', '" + navBarBottom + "px');";
            getBridge().getWebView().post(() ->
                getBridge().getWebView().evaluateJavascript(js, null));

            return ViewCompat.onApplyWindowInsets(v, insets);
        });
    }
}
