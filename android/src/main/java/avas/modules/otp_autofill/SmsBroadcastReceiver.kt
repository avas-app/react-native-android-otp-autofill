package avas.modules.otp_autofill

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status

class SmsBroadcastReceiver(
  private val onSmsReceived: (message: String, otp: String?) -> Unit,
  private val onTimeout: () -> Unit,
  private val onError: (message: String, code: Int) -> Unit,
  private val onCleanup: () -> Unit
) : BroadcastReceiver() {
  
  private val TAG = "SmsBroadcastReceiver"
  
  override fun onReceive(context: Context, intent: Intent) {
    Log.d(TAG, "📻 Broadcast receiver called with action: ${intent.action}")
    
    if (SmsRetriever.SMS_RETRIEVED_ACTION == intent.action) {
      val extras = intent.extras
      if (extras == null) {
        Log.e(TAG, "❌ Intent extras are null")
        onError("Intent extras are null", -1)
        onCleanup()
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
        onError("Error getting status: ${e.message}", -1)
        onCleanup()
        return
      }
      
      Log.d(TAG, "📊 SMS Retriever status: ${status?.statusCode}")

      if (status == null) {
        Log.e(TAG, "❌ Status is null")
        onError("Status is null", -1)
        onCleanup()
        return
      }

      when (status.statusCode) {
        CommonStatusCodes.SUCCESS -> {
          // Get SMS message contents
          val message = extras?.getString(SmsRetriever.EXTRA_SMS_MESSAGE)
          Log.d(TAG, "📨✅ SMS received: $message")
          
          message?.let {
            val otp = extractOtpFromMessage(it)
            onSmsReceived(it, otp)
          }
        }
        CommonStatusCodes.TIMEOUT -> {
          Log.d(TAG, "⏰ SMS Retriever timeout")
          onTimeout()
        }
        else -> {
          Log.e(TAG, "❌ SMS Retriever error: ${status.statusMessage}")
          onError(
            "SMS retriever error: ${status.statusMessage}",
            status.statusCode
          )
        }
      }
      
      // Clean up after receiving any status
      onCleanup()
    }
  }
  
  private fun extractOtpFromMessage(message: String): String? {
    // Extract OTP using regex - looking for 4-6 digit numbers
    val otpPattern = Regex("\\b\\d{4,6}\\b")
    val matchResult = otpPattern.find(message)
    return matchResult?.value
  }
}
