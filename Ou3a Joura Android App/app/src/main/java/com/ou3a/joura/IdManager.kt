package com.ou3a.joura


import android.content.Context
import java.util.UUID


object IdManager {
    private const val PREF = "ids"
    private const val KEY_UID = "user_id"


    fun getOrCreateUserId(ctx: Context): String {
        val sp = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)
        val existing = sp.getString(KEY_UID, null)
        if (existing != null) return existing
        val uid = UUID.randomUUID().toString()
        sp.edit().putString(KEY_UID, uid).apply()
        return uid
    }
}