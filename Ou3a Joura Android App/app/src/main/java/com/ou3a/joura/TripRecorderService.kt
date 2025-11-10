package com.ou3a.joura

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlin.math.abs
import java.util.concurrent.TimeUnit

class TripRecorderService : Service(), SensorEventListener {

    companion object {
        const val ACTION_START = "com.ou3a.joura.action.START"
        const val ACTION_STOP  = "com.ou3a.joura.action.STOP"
        private const val NOTIF_ID   = 1001
        private const val CHANNEL_ID = "trip_channel"
    }

    private lateinit var sensorManager: SensorManager
    private var accel: Sensor? = null
    private var gyro: Sensor?  = null

    private val fused by lazy { LocationServices.getFusedLocationProviderClient(this) }
    private lateinit var locationReq: LocationRequest
    private var locationCb: LocationCallback? = null

    private var writer: JsonTripWriter? = null
    private var started = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        accel = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        gyro  = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

        locationReq = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 200)
            .setWaitForAccurateLocation(false)
            .setMinUpdateIntervalMillis(200)
            .setMaxUpdateDelayMillis(400)
            .build()

        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startRecording()
            ACTION_STOP  -> stopRecording()
        }
        return START_STICKY
    }

    private fun startRecording() {
        if (started) return
        started = true

        startForeground(NOTIF_ID, buildNotification())

        val userId = IdManager.getOrCreateUserId(this)
        writer = JsonTripWriter(this, userId)
        writer?.startTrip()

        accel?.also { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        gyro ?.also { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }

        locationCb = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.locations.forEach { handleLocation(it) }
            }
        }
        fused.requestLocationUpdates(locationReq, locationCb as LocationCallback, mainLooper)
    }

    private fun stopRecording() {
        if (!started) return
        started = false

        sensorManager.unregisterListener(this)
        locationCb?.let { fused.removeLocationUpdates(it) }
        locationCb = null

        val filePath = writer?.endTrip()

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()

        filePath?.let { path ->
            val data = workDataOf(
                UploadWorker.KEY_FILE_PATH to path,
                UploadWorker.KEY_API_URL  to "http://192.168.7.149:8000/api/v1/trips",
                UploadWorker.KEY_API_KEY  to "eYZwuw39ZDb7znBYDpAtn6OIruPSqi1T8AJDDd6ufwE"
            )
            val req = OneTimeWorkRequestBuilder<UploadWorker>()
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .setInputData(data)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()
            WorkManager.getInstance(this).enqueue(req)
        }
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notif_channel_name),
                NotificationManager.IMPORTANCE_LOW
            )
            ch.description = getString(R.string.notif_channel_desc)
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(ch)
        }
    }

    private fun buildNotification(): Notification {
        val stopIntent = Intent(this, TripRecorderService::class.java).apply { action = ACTION_STOP }
        val pendingStop = PendingIntent.getService(
            this, 0, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val openIntent = Intent(this, MainActivity::class.java)
        val pendingOpen = PendingIntent.getActivity(
            this, 1, openIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.notif_title))
            .setSmallIcon(R.drawable.ic_stop_24)
            .setContentIntent(pendingOpen)
            .addAction(0, getString(R.string.notif_stop), pendingStop)
            .setOngoing(true)
            .build()
    }

    // -------- Sensor callbacks --------
    private var lastAccel: Triple<Long, FloatArray, Long>? = null // (uptimeNanos, values, wallMs)

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                lastAccel = Triple(event.timestamp, event.values.clone(), System.currentTimeMillis())
            }
            Sensor.TYPE_GYROSCOPE -> {
                val nowMs = System.currentTimeMillis()
                val accelSnap = lastAccel
                val accelOk = accelSnap != null &&
                        abs((event.timestamp - accelSnap.first) / 1_000_000.0) <= 50.0
                val axayaz = if (accelOk) accelSnap!!.second else null
                writer?.writeSample(
                    timestampMs = nowMs,
                    uptimeMs = (event.timestamp / 1_000_000L),
                    lat = lastLat,
                    lon = lastLon,
                    accM = lastAcc,
                    speed = lastSpeed,
                    accel = axayaz,
                    gyro = event.values
                )
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    // -------- Location plumbing --------
    private var lastLat: Double? = null
    private var lastLon: Double? = null
    private var lastAcc: Float? = null
    private var lastSpeed: Float? = null

    private fun handleLocation(loc: Location) {
        lastLat = loc.latitude
        lastLon = loc.longitude
        lastAcc = loc.accuracy
        lastSpeed = if (loc.hasSpeed()) loc.speed else null
    }
}
