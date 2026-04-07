package com.merplex.noterealm;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 15+ บังคับ edge-to-edge — setOverlaysWebView(false) ไม่ทำงาน
        // ดึง insets จาก decorView (ได้ค่าจริงเสมอ) แล้ว inject เป็น CSS var
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
