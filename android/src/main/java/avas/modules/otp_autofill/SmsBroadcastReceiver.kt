package avas.modules.otp_autofill

import androidx.core.os.BundleCompat
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status

class SmsBroadcastReceiver : BroadcastReceiver() {
  
  private var onSmsReceived: ((message: String, otp: String?) -> Unit)? = null
  private var onTimeout: (() -> Unit)? = null
  private var onError: ((message: String, code: Int) -> Unit)? = null
  private var onCleanup: (() -> Unit)? = null
  
  fun setCallbacks(
    onSmsReceived: (message: String, otp: String?) -> Unit,
    onTimeout: () -> Unit,
    onError: (message: String, code: Int) -> Unit,
    onCleanup: () -> Unit
  ) {
    this.onSmsReceived = onSmsReceived
    this.onTimeout = onTimeout
    this.onError = onError
    this.onCleanup = onCleanup
  }
  
  private val TAG = "SmsBroadcastReceiver"
  
  companion object {
    const val ERROR_NULL_EXTRAS = -1001
    const val ERROR_NULL_STATUS = -1002
    const val ERROR_STATUS_PARSING = -1003
    const val ERROR_NULL_MESSAGE = -1004
    
    // The SMS Retriever protocol always appends the 11-char app hash on the last line.
    // Strip it before extraction: its digits are not the OTP, and for ~0.3% of signing
    // keys a hash starting with 4+ digits would otherwise be picked up as the code
    // (deterministically, per key — so it can pass QA on a debug key and ship broken).
    private val HASH_LINE = Regex("\\s*\\n[A-Za-z0-9+/=]{11}\\s*$")

    // Prefer a code that immediately FOLLOWS an OTP keyword (word-bounded so "code"
    // doesn't match inside "barcode"), skipping only non-digit separators so a number
    // appearing *before* the keyword can't win. The gap excludes \n so it can never run
    // past the end of the sentence onto a following line. The trailing (?!\d) / leading
    // (?<!\d) guards prevent truncating a longer number down to 4-8 digits.
    // Since the SMS Retriever message is authored by our own backend, this is reliable;
    // if a fixed length is ever needed, thread it from JS and tighten \d{4,8} to \d{n}.
    private val KEYWORD_ANCHORED = Regex(
      "\\b(?:otp|passcode|code|verification|pin|password|token|authenticate)\\b[^0-9\\n]{0,20}(\\d{4,8})(?!\\d)",
      RegexOption.IGNORE_CASE,
    )
    private val STANDALONE = Regex("(?<!\\d)(\\d{4,8})(?!\\d)")
  }
  
  override fun onReceive(context: Context, intent: Intent) {
    Log.d(TAG, "📻 Broadcast receiver called with action: ${intent.action}")
    
    if (SmsRetriever.SMS_RETRIEVED_ACTION == intent.action) {
      handleSmsRetrievedIntent(intent)
    } else {
      Log.w(TAG, "📻 Unexpected action received: ${intent.action}")
    }
  }
  
  private fun handleSmsRetrievedIntent(intent: Intent) {
    val extras = intent.extras
    if (extras == null) {
      Log.e(TAG, "❌ Intent extras are null")
      onError?.invoke("Intent extras are null", ERROR_NULL_EXTRAS)
      onCleanup?.invoke()
      return
    }

    val status = BundleCompat.getParcelable(extras, SmsRetriever.EXTRA_STATUS, Status::class.java)
    
    Log.d(TAG, "📊 SMS Retriever status: ${status?.statusCode}")

    if (status == null) {
      Log.e(TAG, "❌ Status is null")
      onError?.invoke("Status is null", ERROR_NULL_STATUS)
      onCleanup?.invoke()
      return
    }

    when (status.statusCode) {
      CommonStatusCodes.SUCCESS -> {
        handleSmsSuccess(extras)
      }
      CommonStatusCodes.TIMEOUT -> {
        Log.d(TAG, "⏰ SMS Retriever timeout")
        onTimeout?.invoke()
      }
      else -> {
        Log.e(TAG, "❌ SMS Retriever error: ${status.statusMessage}")
        onError?.invoke(
          "SMS retriever error: ${status.statusMessage}",
          status.statusCode
        )
      }
    }
    
    // Clean up after receiving any status
    onCleanup?.invoke()
  }
  
  private fun handleSmsSuccess(extras: android.os.Bundle) {
    val message = extras.getString(SmsRetriever.EXTRA_SMS_MESSAGE)
    if (message.isNullOrBlank()) {
      Log.e(TAG, "❌ SMS message is null or empty")
      onError?.invoke("SMS message is null or empty", ERROR_NULL_MESSAGE)
      return
    }
    
    // Never log the raw SMS body — it contains the OTP and Logcat is readable via
    // READ_LOGS/adb on release builds.
    Log.d(TAG, "📨✅ SMS received (len=${message.length})")
    val otp = extractOtpFromMessage(message)
    Log.d(TAG, "🔍 OTP extracted: ${if (otp != null) "yes (len=${otp.length})" else "none"}")
    onSmsReceived?.invoke(message, otp)
  }

  private fun extractOtpFromMessage(message: String): String? {
    // Drop the trailing app-hash line first so neither pattern can read digits out of it.
    val body = HASH_LINE.replace(message, "")
    // Prefer a code that follows an OTP keyword; only fall back to a standalone
    // digit run when no keyword-anchored code is present.
    KEYWORD_ANCHORED.find(body)?.groupValues?.getOrNull(1)?.let { return it }
    return STANDALONE.find(body)?.groupValues?.getOrNull(1)
  }
}
