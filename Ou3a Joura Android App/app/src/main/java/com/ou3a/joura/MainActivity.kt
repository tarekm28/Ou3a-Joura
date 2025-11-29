package com.ou3a.joura

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.io.File
import java.time.Duration
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.BufferedOutputStream
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {
    private lateinit var tvStatus: TextView
    private lateinit var tvPath: TextView
    private lateinit var tvUploadStatus: TextView

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        updateButtons()
        // After permissions are granted, try to enqueue any pending offline trips
        enqueuePendingUploads()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvStatus = findViewById(R.id.tvStatus)
        tvPath = findViewById(R.id.tvPath)
        tvUploadStatus = findViewById(R.id.tvUploadStatus)
        val btnStart = findViewById<Button>(R.id.btnStart)
        val btnStop  = findViewById<Button>(R.id.btnStop)
        val btnUpload = findViewById<Button>(R.id.btnUpload)
        val btnClearUploaded = findViewById<Button>(R.id.btnClearUploaded)

        btnStart.setOnClickListener {
            if (ensurePermissions()) {
                val intent = Intent(this, TripRecorderService::class.java)
                intent.action = TripRecorderService.ACTION_START
                ContextCompat.startForegroundService(this, intent)
                tvStatus.text = getString(R.string.status_recording)
            }
        }

        btnStop.setOnClickListener {
            val intent = Intent(this, TripRecorderService::class.java)
            intent.action = TripRecorderService.ACTION_STOP
            startService(intent)
            tvStatus.text = getString(R.string.status_idle)
        }

        btnUpload.setOnClickListener {
            val tripsDir = getExternalFilesDir("trips") ?: return@setOnClickListener
            val files = tripsDir.listFiles { f ->
                f.isFile && f.parentFile == tripsDir && f.extension.equals("json", true)
            } ?: emptyArray()

            if (files.isEmpty()) {
                tvUploadStatus.text = "No trips to upload"
            } else {
                tvUploadStatus.text = "Uploading ${files.size} trip(s)..."
                uploadTripsDirectly(files.toList())
            }
        }

        btnClearUploaded.setOnClickListener {
            val tripsDir = getExternalFilesDir("trips") ?: return@setOnClickListener
            val uploadedDir = File(tripsDir, "uploaded")

            if (!uploadedDir.exists()) {
                tvUploadStatus.text = "No uploaded trips to clear"
                return@setOnClickListener
            }

            val uploadedFiles = uploadedDir.listFiles { f ->
                f.isFile && f.extension.equals("json", true)
            } ?: emptyArray()

            if (uploadedFiles.isEmpty()) {
                tvUploadStatus.text = "No uploaded trips to clear"
            } else {
                val count = uploadedFiles.size
                uploadedFiles.forEach { it.delete() }
                tvUploadStatus.text = "Deleted $count uploaded trip(s)"
            }
        }

        tvPath.text = getExternalFilesDir("trips")?.absolutePath ?: ""
        updateButtons()

        // ⬇️ Also scan on app start (will be a no-op if no files / no network yet)
        enqueuePendingUploads()
    }

    private fun updateButtons() { /* no-op for now */ }

    private fun ensurePermissions(): Boolean {
        val needed = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= 33) {
            needed += Manifest.permission.POST_NOTIFICATIONS
        }
        val notGranted = needed.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        return if (notGranted.isNotEmpty()) {
            permissionLauncher.launch(notGranted.toTypedArray())
            false
        } else true
    }

    // scan trips folder and enqueue uploads for any .json files
    private fun enqueuePendingUploads() {
        val tripsDir = getExternalFilesDir("trips") ?: return
        // Only consider files directly in /trips, not in subfolders (e.g., /trips/uploaded)
        val files = tripsDir.listFiles { f ->
            f.isFile && f.parentFile == tripsDir && f.extension.equals("json", true)
        } ?: return

        files.forEach { file ->
            val data = workDataOf(
                UploadWorker.KEY_FILE_PATH to file.absolutePath,
                UploadWorker.KEY_API_URL  to "http://192.168.1.114:8000/api/v1/trips",
                UploadWorker.KEY_API_KEY  to "eYZwuw39ZDb7znBYDpAtn6OIruPSqi1T8AJDDd6ufwE"
            )
            val req = OneTimeWorkRequestBuilder<UploadWorker>()
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, Duration.ofSeconds(30))
                .setInputData(data)
                .setConstraints(
                    Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
                )
                .build()
            WorkManager.getInstance(this).enqueue(req)
        }
    }

    private fun uploadTripsDirectly(files: List<File>) {
        CoroutineScope(Dispatchers.IO).launch {
            var successCount = 0
            var failCount = 0
            var lastError = ""

            files.forEach { file ->
                try {
                    val url = URL("http://192.168.1.114:8000/api/v1/trips")
                    val conn = (url.openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        connectTimeout = 15000
                        readTimeout = 30000
                        doOutput = true
                        setRequestProperty("Content-Type", "application/json")
                        setRequestProperty("X-API-Key", "eYZwuw39ZDb7znBYDpAtn6OIruPSqi1T8AJDDd6ufwE")
                    }

                    FileInputStream(file).use { fis ->
                        BufferedOutputStream(conn.outputStream).use { os ->
                            fis.copyTo(os)
                            os.flush()
                        }
                    }

                    val code = conn.responseCode
                    conn.disconnect()

                    if (code in 200..299) {
                        successCount++
                        // Move to uploaded folder
                        val uploadedDir = File(file.parentFile, "uploaded").apply { mkdirs() }
                        val target = File(uploadedDir, file.name)
                        file.renameTo(target)
                    } else {
                        failCount++
                        lastError = "HTTP $code"
                    }
                } catch (e: Exception) {
                    failCount++
                    lastError = "${e.javaClass.simpleName}: ${e.message}"
                }
            }

            withContext(Dispatchers.Main) {
                if (failCount > 0) {
                    tvUploadStatus.text = "Done: $successCount OK, $failCount failed. Last error: $lastError"
                } else {
                    tvUploadStatus.text = "Done: $successCount uploaded successfully!"
                }
            }
        }
    }
}
