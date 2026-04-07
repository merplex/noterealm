package com.merplex.noterealm;

import com.getcapacitor.BridgeActivity;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Enable edge-to-edge (WebView วาดใต้ status bar)
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // 2. Allow drawing in display cutout area
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        // 3. Inject real status bar height เป็น CSS var --sat / --sab
        //    ผูกกับ decorView เพื่อรับ raw system insets เสมอ
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, insets) -> {
            int top = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
            int bottom = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;

            String js = "document.documentElement.style.setProperty('--sat', '" + top + "px');" +
                        "document.documentElement.style.setProperty('--sab', '" + bottom + "px');";

            getBridge().getWebView().post(() ->
                getBridge().getWebView().evaluateJavascript(js, null));

            return ViewCompat.onApplyWindowInsets(v, insets);
        });
    }
}
