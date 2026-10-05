package com.cheerfulgames.resuming;

import android.provider.Settings;
import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "InstallReferrer")
public class InstallReferrerPlugin extends Plugin {
    @PluginMethod
    public void getAttribution(PluginCall call) {
        String androidId = Settings.Secure.getString(
            getContext().getContentResolver(),
            Settings.Secure.ANDROID_ID
        );
        if (androidId == null || androidId.isEmpty()) {
            JSObject empty = new JSObject();
            empty.put("ok", false);
            empty.put("deviceKey", "");
            empty.put("referrer", "");
            call.resolve(empty);
            return;
        }

        String deviceKey = sha256(androidId);
        InstallReferrerClient client = InstallReferrerClient.newBuilder(getContext()).build();
        AtomicBoolean settled = new AtomicBoolean(false);
        client.startConnection(new InstallReferrerStateListener() {
            @Override
            public void onInstallReferrerSetupFinished(int responseCode) {
                if (!settled.compareAndSet(false, true)) return;
                String referrer = "";
                boolean ok = responseCode == InstallReferrerClient.InstallReferrerResponse.OK;
                if (ok) {
                    try {
                        ReferrerDetails details = client.getInstallReferrer();
                        if (details.getInstallReferrer() != null) {
                            referrer = details.getInstallReferrer();
                        }
                    } catch (Exception ignored) {
                        ok = false;
                    }
                }
                try {
                    client.endConnection();
                } catch (Exception ignored) {
                    /* already closed */
                }
                JSObject ret = new JSObject();
                ret.put("ok", ok);
                ret.put("deviceKey", deviceKey);
                ret.put("referrer", referrer);
                call.resolve(ret);
            }

            @Override
            public void onInstallReferrerServiceDisconnected() {
                if (!settled.compareAndSet(false, true)) return;
                JSObject ret = new JSObject();
                ret.put("ok", false);
                ret.put("deviceKey", deviceKey);
                ret.put("referrer", "");
                call.resolve(ret);
            }
        });
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                out.append(String.format("%02x", b));
            }
            return out.toString();
        } catch (Exception error) {
            return "";
        }
    }
}
