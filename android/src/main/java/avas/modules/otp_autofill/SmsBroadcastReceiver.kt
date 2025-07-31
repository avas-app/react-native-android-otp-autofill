package avas.modules.otp_autofill

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
    
    private val OTP_PATTERNS = listOf(
      // Standard 4-6 digit OTP patterns
      Regex("\\b\\d{4,6}\\b"),
      // OTP with common prefixes
      Regex("(?:OTP|Code|Verification|PIN|Password)[:\\s]*([0-9]{4,6})", RegexOption.IGNORE_CASE),
      // OTP with dashes or spaces
      Regex("([0-9]{4,6})"),
      // OTP in parentheses
      Regex("\\(([0-9]{4,6})\\)"),
      // OTP with dots
      Regex("([0-9]{4,6})"),
    )
    
    private val OTP_CONTEXT_KEYWORDS = listOf(
      "otp", "code", "verification", "pin", "password", "token", "authenticate"
    )
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
    
    val status = try {
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
        extras.getParcelable(SmsRetriever.EXTRA_STATUS, Status::class.java)
      } else {
        @Suppress("DEPRECATION")
        extras.getParcelable<Status>(SmsRetriever.EXTRA_STATUS)
      }
    } catch (e: Exception) {
      Log.e(TAG, "❌ Error getting status from intent extras", e)
      onError?.invoke("Error getting status: ${e.message}", ERROR_STATUS_PARSING)
      onCleanup?.invoke()
      return
    }
    
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
    
    Log.d(TAG, "📨✅ SMS received: $message")
    val otp = extractOtpFromMessage(message)
    onSmsReceived?.invoke(message, otp)
  }
  
  private fun extractOtpFromMessage(message: String): String? {
    // First, try to find OTP with context clues
    val contextOtp = findOtpWithContext(message)
    if (contextOtp != null) {
      Log.d(TAG, "🔍 Found OTP with context: $contextOtp")
      return contextOtp
    }
    
    // Fallback to pattern matching
    for (pattern in OTP_PATTERNS) {
      val matchResult = pattern.find(message)
      if (matchResult != null) {
        val otp = matchResult.groupValues.lastOrNull { it.matches(Regex("\\d{4,6}")) }
        if (otp != null) {
          Log.d(TAG, "🔍 Found OTP with pattern: $otp")
          return otp
        }
      }
    }
    
    Log.w(TAG, "🔍 No OTP found in message")
    return null
  }
  
  private fun findOtpWithContext(message: String): String? {
    val lowerMessage = message.lowercase()
    
    // Look for OTP near context keywords
    for (keyword in OTP_CONTEXT_KEYWORDS) {
      val keywordIndex = lowerMessage.indexOf(keyword)
      if (keywordIndex != -1) {
        // Look for numbers near the keyword
        val searchStart = maxOf(0, keywordIndex - 20)
        val searchEnd = minOf(message.length, keywordIndex + 50)
        val searchArea = message.substring(searchStart, searchEnd)
        
        // Try to find 4-6 digit numbers in this area
        val numberPattern = Regex("\\b\\d{4,6}\\b")
        val match = numberPattern.find(searchArea)
        if (match != null) {
          return match.value
        }
      }
    }
    
    return null
  }
}
