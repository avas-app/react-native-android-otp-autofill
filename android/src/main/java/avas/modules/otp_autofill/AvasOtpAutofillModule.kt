package avas.modules.otp_autofill

import android.content.Context
import android.content.IntentFilter
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.tasks.Task
import java.util.concurrent.atomic.AtomicBoolean

class AvasOtpAutofillModule : Module() {
  
  private val TAG = "AvasOtpAutofillModule"
  private var smsReceiver: SmsBroadcastReceiver? = null
  private var appSignatureHelper: AppSignatureHelper? = null
  private val isListening = AtomicBoolean(false)
  
  companion object {
    private const val MAX_RETRY_ATTEMPTS = 3
    private const val RETRY_DELAY_MS = 1000L
  }

  override fun definition() = ModuleDefinition {
    Name("AvasOtpAutofill")

    Events("onSmsReceived", "onTimeout", "onError")

    AsyncFunction("getOtp") { promise: Promise ->
      startSmsRetriever(promise, "getOtp")
    }

    AsyncFunction("startOtpListener") { promise: Promise ->
      startSmsRetriever(promise, "startOtpListener")
    }

    AsyncFunction("stopSmsRetriever") { promise: Promise ->
      Log.d(TAG, "🛑 Stopping SMS Retriever")
      stopSmsRetriever()
      promise.resolve("SMS Retriever stopped")
    }

    AsyncFunction("getHash") { promise: Promise ->
      Log.d(TAG, "🔐 Getting app hash")
      getAppHash(promise)
    }

    AsyncFunction("requestHint") { promise: Promise ->
      Log.d(TAG, "📞 Phone number hint not supported")
      promise.reject("PHONE_HINT_NOT_SUPPORTED", "Phone number hint is not supported in this version", null)
    }
  }

  private fun startSmsRetriever(promise: Promise, operation: String) {
    if (isListening.get()) {
      Log.w(TAG, "⚠️ SMS Retriever is already active")
      promise.reject("ALREADY_LISTENING", "SMS Retriever is already active", null)
      return
    }

    Log.d(TAG, "🎧 Starting SMS Retriever for operation: $operation")
    startSmsRetrieverWithRetry(promise, operation, 1)
  }

  private fun startSmsRetrieverWithRetry(promise: Promise, operation: String, attempt: Int) {
    try {
      val client = SmsRetriever.getClient(appContext.reactContext!!)
      val task: Task<Void> = client.startSmsRetriever()

      task.addOnSuccessListener {
        Log.d(TAG, "✅ SMS Retriever started successfully (attempt $attempt)")
        registerSmsReceiver(promise)
      }

      task.addOnFailureListener { exception ->
        Log.e(TAG, "❌ Failed to start SMS Retriever (attempt $attempt/$MAX_RETRY_ATTEMPTS)", exception)
        
        if (attempt < MAX_RETRY_ATTEMPTS) {
          Log.d(TAG, "🔄 Retrying in ${RETRY_DELAY_MS}ms...")
          android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            startSmsRetrieverWithRetry(promise, operation, attempt + 1)
          }, RETRY_DELAY_MS * attempt) // Exponential backoff
        } else {
          promise.reject("SMS_RETRIEVER_ERROR", "Failed to start SMS Retriever after $MAX_RETRY_ATTEMPTS attempts: ${exception.message}", exception)
        }
      }
    } catch (e: Exception) {
      Log.e(TAG, "💥 Unexpected error starting SMS Retriever", e)
      promise.reject("SMS_RETRIEVER_ERROR", "Unexpected error: ${e.message}", e)
    }
  }

  private fun getAppHash(promise: Promise) {
    try {
      if (appSignatureHelper == null) {
        appSignatureHelper = AppSignatureHelper(appContext.reactContext!!)
      }
      
      val signatures = appSignatureHelper!!.getAppSignatures()
      if (signatures.isNotEmpty()) {
        Log.d(TAG, "✅ App hash generated successfully: ${signatures.first().substring(0, 8)}...")
        promise.resolve(signatures)
      } else {
        Log.e(TAG, "❌ No app signatures found")
        promise.reject("HASH_ERROR", "Could not generate app hash - no signatures found", null)
      }
    } catch (e: Exception) {
      Log.e(TAG, "❌ Error getting hash", e)
      promise.reject("HASH_ERROR", "Error getting hash: ${e.message}", e)
    }
  }

  private fun registerSmsReceiver(promise: Promise) {
    try {
      val context = appContext.reactContext!!
      
      // Clean up any existing receiver
      stopSmsRetriever()
      
      // Create new receiver
      smsReceiver = SmsBroadcastReceiver()
      smsReceiver?.setCallbacks(
        onSmsReceived = { message, otp ->
          Log.d(TAG, "📨 SMS received in module: $message")
          isListening.set(false)
          sendEvent("onSmsReceived", mapOf(
            "message" to message,
            "otp" to otp
          ))
        },
        onTimeout = {
          Log.d(TAG, "⏰ SMS Retriever timeout")
          isListening.set(false)
          sendEvent("onTimeout", mapOf("message" to "SMS retrieval timed out"))
        },
        onError = { errorMessage, code ->
          Log.e(TAG, "💥 SMS Retriever error: $errorMessage (code: $code)")
          isListening.set(false)
          sendEvent("onError", mapOf(
            "message" to errorMessage,
            "code" to code
          ))
        },
        onCleanup = {
          Log.d(TAG, "🧹 Cleaning up SMS receiver")
          stopSmsRetriever()
        }
      )
      
      val intentFilter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
        context.registerReceiver(smsReceiver, intentFilter, Context.RECEIVER_EXPORTED)
      } else {
        context.registerReceiver(smsReceiver, intentFilter)
      }
      
      isListening.set(true)
      Log.d(TAG, "📡 SMS receiver registered successfully")
      promise.resolve(true)
      
    } catch (e: Exception) {
      Log.e(TAG, "💥 Error registering SMS receiver", e)
      isListening.set(false)
      promise.reject("RECEIVER_ERROR", "Failed to register SMS receiver: ${e.message}", e)
    }
  }

  private fun stopSmsRetriever() {
    try {
      smsReceiver?.let { receiver ->
        appContext.reactContext?.unregisterReceiver(receiver)
        smsReceiver = null
        isListening.set(false)
        Log.d(TAG, "📡❌ SMS receiver unregistered")
      }
    } catch (e: Exception) {
      Log.e(TAG, "💥 Error unregistering receiver", e)
    }
  }
  
  // Cleanup resources when module is no longer needed
  fun cleanup() {
    stopSmsRetriever()
    appSignatureHelper = null
    Log.d(TAG, "🧹 Module resources cleaned up")
  }
}
