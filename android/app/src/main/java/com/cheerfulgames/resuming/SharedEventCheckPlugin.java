package com.cheerfulgames.resuming;

import android.content.Context;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "SharedEventCheck")
public class SharedEventCheckPlugin extends Plugin {
    static final String PREFS = "shared-event-check";
    static final String KEY_URL = "url";
    static final String KEY_ANON = "anonKey";
    private static final String WORK_NAME = "shared-event-check";
    private static final long INTERVAL_HOURS = 1;

    @PluginMethod
    public void start(PluginCall call) {
        String url = call.getString("url");
        String anonKey = call.getString("anonKey");
        if (url == null || url.isEmpty() || anonKey == null || anonKey.isEmpty()) {
            call.reject("url and anonKey are required");
            return;
        }
        Context context = getContext();
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_URL, url)
            .putString(KEY_ANON, anonKey)
            .apply();
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
            SharedEventCheckWorker.class,
            INTERVAL_HOURS,
            TimeUnit.HOURS
        ).setConstraints(constraints).build();
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        WorkManager.getInstance(getContext()).cancelUniqueWork(WORK_NAME);
        call.resolve();
    }
}
