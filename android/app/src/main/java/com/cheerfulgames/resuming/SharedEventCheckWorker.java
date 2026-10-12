package com.cheerfulgames.resuming;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.capacitorjs.plugins.localnotifications.NotificationStorage;
import com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher;
import com.getcapacitor.JSObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/** Drops armed reminder alerts whose shared event was cancelled or switched off. */
public class SharedEventCheckWorker extends Worker {
    private static final Pattern UUID = Pattern.compile(
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
    );
    private static final int TIMEOUT_MS = 15000;

    public SharedEventCheckWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(SharedEventCheckPlugin.PREFS, Context.MODE_PRIVATE);
        String url = prefs.getString(SharedEventCheckPlugin.KEY_URL, null);
        String anonKey = prefs.getString(SharedEventCheckPlugin.KEY_ANON, null);
        if (url == null || anonKey == null) return Result.success();

        NotificationStorage storage = new NotificationStorage(context);
        Map<String, List<Integer>> alertsByEvent = new HashMap<>();
        for (String key : storage.getSavedNotificationIds()) {
            JSObject notification = storage.getSavedNotificationAsJSObject(key);
            if (notification == null) continue;
            JSONObject extra = notification.optJSONObject("extra");
            if (extra == null || !"reminder".equals(extra.optString("kind"))) continue;
            String eventId = extra.optString("sharedEventId", "");
            if (!UUID.matcher(eventId).matches()) continue;
            try {
                int id = Integer.parseInt(key);
                alertsByEvent.computeIfAbsent(eventId, unused -> new ArrayList<>()).add(id);
            } catch (NumberFormatException ignored) {
                /* not one of ours */
            }
        }
        if (alertsByEvent.isEmpty()) return Result.success();

        Set<String> gone;
        try {
            gone = goneEvents(url, anonKey, alertsByEvent.keySet());
        } catch (Exception error) {
            return Result.retry();
        }
        for (String eventId : gone) {
            List<Integer> ids = alertsByEvent.get(eventId);
            if (ids == null) continue;
            for (Integer id : ids) cancelAlert(context, storage, id);
        }
        return Result.success();
    }

    private static Set<String> goneEvents(String baseUrl, String anonKey, Set<String> eventIds) throws Exception {
        JSONObject body = new JSONObject();
        body.put("p_ids", new JSONArray(eventIds));
        URL endpoint = new URL(baseUrl.replaceAll("/+$", "") + "/rest/v1/rpc/shared_event_statuses");
        HttpURLConnection connection = (HttpURLConnection) endpoint.openConnection();
        try {
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(TIMEOUT_MS);
            connection.setReadTimeout(TIMEOUT_MS);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("apikey", anonKey);
            connection.setRequestProperty("Authorization", "Bearer " + anonKey);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) throw new IllegalStateException("HTTP " + code);
            JSONArray rows = new JSONArray(readAll(connection.getInputStream()));
            Set<String> gone = new HashSet<>();
            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.getJSONObject(i);
                String status = row.optString("status");
                if ("cancelled".equals(status) || "switched_off".equals(status)) {
                    gone.add(row.optString("id"));
                }
            }
            return gone;
        } finally {
            connection.disconnect();
        }
    }

    private static String readAll(InputStream in) throws Exception {
        try (InputStream stream = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = stream.read(buffer)) != -1) out.write(buffer, 0, read);
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }

    /** Matches how the LocalNotifications plugin arms the alarm, so the same PendingIntent is found. */
    private static void cancelAlert(Context context, NotificationStorage storage, int id) {
        Intent intent = new Intent(context, TimedNotificationPublisher.class);
        int flags = PendingIntent.FLAG_NO_CREATE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        PendingIntent pending = PendingIntent.getBroadcast(context, id, intent, flags);
        if (pending != null) {
            AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarms != null) alarms.cancel(pending);
            pending.cancel();
        }
        NotificationManagerCompat.from(context).cancel(id);
        storage.deleteNotification(Integer.toString(id));
    }
}
