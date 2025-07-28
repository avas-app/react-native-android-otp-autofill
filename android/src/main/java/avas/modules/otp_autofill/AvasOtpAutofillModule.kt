package avas.modules.otp_autofill

import android.content.Context
import android.content.IntentFilter
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.tasks.Task

class AvasOtpAutofillModule : Module() {
  
  private val TAG = "AvasOtpAutofillModule"
  private var smsReceiver: SmsBroadcastReceiver? = null
  private var appSignatureHelper: AppSignatureHelper? = null

  override fun definition() = ModuleDefinition {
    Name("AvasOtpAutofill")

    Events("onSmsReceived", "onTimeout", "onError")

    AsyncFunction("getOtp") { promise: Promise ->
      Log.d(TAG, "📱 Starting SMS Retriever")
      
      val client = SmsRetriever.getClient(appContext.reactContext!!)
      val task: Task<Void> = client.startSmsRetriever()

      task.addOnSuccessListener {
        Log.d(TAG, "✅ SMS Retriever started successfully")
        registerSmsReceiver(promise)
      }

      task.addOnFailureListener { exception ->
        Log.e(TAG, "❌ Failed to start SMS Retriever", exception)
        promise.reject("SMS_RETRIEVER_ERROR", "Failed to start SMS Retriever: ${exception.message}", exception)
      }
    }

    AsyncFunction("startOtpListener") { promise: Promise ->
      Log.d(TAG, "🎧 Starting OTP Listener")
      
      val client = SmsRetriever.getClient(appContext.reactContext!!)
      val task: Task<Void> = client.startSmsRetriever()

      task.addOnSuccessListener {
        Log.d(TAG, "✅ OTP Listener started successfully")
        registerSmsReceiver(promise)
      }

      task.addOnFailureListener { exception ->
        Log.e(TAG, "❌ Failed to start OTP Listener", exception)
        promise.reject("SMS_RETRIEVER_ERROR", "Failed to start OTP Listener: ${exception.message}", exception)
      }
    }

    AsyncFunction("stopSmsRetriever") { promise: Promise ->
      Log.d(TAG, "🛑 Stopping SMS Retriever")
      stopSmsRetriever()
      promise.resolve("SMS Retriever stopped")
    }

    AsyncFunction("getHash") { promise: Promise ->
      Log.d(TAG, "🔐 Getting app hash")
      try {
        if (appSignatureHelper == null) {
          appSignatureHelper = AppSignatureHelper(appContext.reactContext!!)
        }
        
        val signatures = appSignatureHelper!!.getAppSignatures()
        if (signatures.isNotEmpty()) {
          promise.resolve(signatures) // Return the full array as expected
        } else {
          promise.reject("HASH_ERROR", "Could not generate app hash", null)
        }
      } catch (e: Exception) {
        Log.e(TAG, "❌ Error getting hash", e)
        promise.reject("HASH_ERROR", "Error getting hash: ${e.message}", e)
      }
    }

    AsyncFunction("requestHint") { promise: Promise ->
      Log.d(TAG, "📞 Phone number hint not supported")
      promise.reject("PHONE_HINT_NOT_SUPPORTED", "Phone number hint is not supported in this version", null)
    }
  }

  private fun registerSmsReceiver(promise: Promise) {
    try {
      val context = appContext.reactContext!!
      
      // Clean up any existing receiver
      stopSmsRetriever()
      
      // Create new receiver
      smsReceiver = SmsBroadcastReceiver(
        onSmsReceived = { message, otp ->
          Log.d(TAG, "📨 SMS received in module: $message")
          sendEvent("onSmsReceived", mapOf(
            "message" to message,
            "otp" to otp
          ))
          // Don't resolve promise here, let the event handle it
        },
        onTimeout = {
          Log.d(TAG, "⏰ SMS Retriever timeout")
          sendEvent("onTimeout", mapOf("message" to "SMS retrieval timed out"))
          // Don't reject promise here, let the event handle it
        },
        onError = { errorMessage, code ->
          Log.e(TAG, "💥 SMS Retriever error: $errorMessage (code: $code)")
          sendEvent("onError", mapOf(
            "message" to errorMessage,
            "code" to code
          ))
          // Don't reject promise here, let the event handle it
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
      
      Log.d(TAG, "📡 SMS receiver registered successfully")
      // Return true to indicate successful start
      promise.resolve(true)
      
    } catch (e: Exception) {
      Log.e(TAG, "💥 Error registering SMS receiver", e)
      promise.reject("RECEIVER_ERROR", "Failed to register SMS receiver: ${e.message}", e)
    }
  }

  private fun stopSmsRetriever() {
    try {
      smsReceiver?.let { receiver ->
        appContext.reactContext?.unregisterReceiver(receiver)
        smsReceiver = null
        Log.d(TAG, "📡❌ SMS receiver unregistered")
      }
    } catch (e: Exception) {
      Log.e(TAG, "💥 Error unregistering receiver", e)
    }
  }
}
