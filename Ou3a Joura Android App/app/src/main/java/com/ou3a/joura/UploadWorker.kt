package com.ou3a.joura


import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL


class UploadWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    companion object {
        const val KEY_FILE_PATH = "file_path"
        const val KEY_API_URL = "api_url"
    }


    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val path = inputData.getString(KEY_FILE_PATH) ?: return@withContext Result.failure()
        val apiUrl = inputData.getString(KEY_API_URL) ?: "http://0.0.0.0:0/api/v1/trips"
        val file = File(path)
        if (!file.exists()) return@withContext Result.failure()


        try {
            val url = URL(apiUrl)
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15000
                readTimeout = 30000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
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
                val original = file
                val uploadedDir = File(original.parentFile, "uploaded").apply { mkdirs() }
                val target = File(uploadedDir, original.name)
                val moved = original.renameTo(target)
                if (!moved) {
                    try {
                        original.copyTo(target, overwrite = true)
                        original.delete()
                    } catch (_: Exception) { /* keep original if move fails */ }
                }
                return@withContext Result.success()
            } else {
                return@withContext Result.retry()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Result.retry()
        }
    }
}