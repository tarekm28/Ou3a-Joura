package com.ou3a.joura

import android.content.Context
import com.google.gson.stream.JsonWriter
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStreamWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class JsonTripWriter(private val context: Context, private val userId: String) {
    private var writer: JsonWriter? = null
    private var file: File? = null
    private var count = 0
    private var tripId: String = ""

    fun startTrip() {
        val sdf = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        tripId = "trip_${sdf.format(Date())}"
        val dir = context.getExternalFilesDir("trips")!!.apply { mkdirs() }
        file = File(dir, "${userId}_${tripId}.json")
        val fos = FileOutputStream(file!!)
        writer = JsonWriter(OutputStreamWriter(fos, Charsets.UTF_8)).apply {
            setIndent("  ")
            beginObject()
            name("user_id").value(userId)
            name("trip_id").value(tripId)
            name("start_time").value(isoNow())
            name("samples").beginArray()
        }
    }

    fun writeSample(
        timestampMs: Long,
        uptimeMs: Long,
        lat: Double?,
        lon: Double?,
        accM: Float?,
        speed: Float?,
        accel: FloatArray?,
        gyro: FloatArray
    ) {
        val w = writer ?: return
        w.beginObject()
        w.name("timestamp").value(isoFromMs(timestampMs))
        w.name("uptime_ms").value(uptimeMs)
        if (lat != null && lon != null) {
            w.name("latitude").value(lat)
            w.name("longitude").value(lon)
        } else {
            w.name("latitude").nullValue()
            w.name("longitude").nullValue()
        }
        if (accM != null) w.name("accuracy_m").value(accM.toDouble()) else w.name("accuracy_m").nullValue()
        if (speed != null) w.name("speed_mps").value(speed.toDouble()) else w.name("speed_mps").nullValue()
        if (accel != null) {
            w.name("accel").beginArray(); accel.forEach { w.value(it.toDouble()) }; w.endArray()
        } else {
            w.name("accel").nullValue()
        }
        w.name("gyro").beginArray(); gyro.forEach { w.value(it.toDouble()) }; w.endArray()
        w.endObject()
        count++
    }

    fun endTrip(): String? {
        val w = writer ?: return null
        w.endArray()
        w.name("end_time").value(isoNow())
        w.name("sample_count").value(count)
        w.endObject()
        w.flush()
        w.close()
        writer = null
        return file?.absolutePath
    }

    private fun isoNow(): String = isoFromMs(System.currentTimeMillis())

    private fun isoFromMs(ms: Long): String {
        val df = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        df.timeZone = TimeZone.getTimeZone("UTC")
        return df.format(Date(ms))
    }
}
