package com.avasapp.otpautofill

import android.content.Context
import android.util.Base64
import androidx.core.content.pm.PackageInfoCompat
import java.security.MessageDigest

class AppSignatureHelper(private val context: Context) {

  /** The SMS Retriever hash for the app's first signing certificate, or null if unsigned. */
  fun getAppHash(): String? {
    val packageName = context.packageName
    val signature = PackageInfoCompat.getSignatures(context.packageManager, packageName)
      .firstOrNull() ?: return null
    return hash("$packageName ${signature.toCharsString()}")
  }

  private fun hash(appInfo: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(appInfo.toByteArray())
    // Standard base64, not URL-safe: the SMS provider validates the hash against
    // ^[A-Za-z0-9+/=]{11}$. android.util.Base64 also works below API 26.
    return Base64.encodeToString(digest.copyOfRange(0, 9), Base64.NO_PADDING or Base64.NO_WRAP)
      .substring(0, 11)
  }
}
