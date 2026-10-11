package com.avasapp.otpautofill

import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.gms.auth.api.phone.SmsRetriever

class OtpAutofillModule(reactContext: ReactApplicationContext) :
  NativeOtpAutofillSpec(reactContext) {

  // All listener state below is only touched on the main thread, where Play
  // Services callbacks and the receiver also run, so start/stop can't race.
  private val mainHandler = Handler(Looper.getMainLooper())
  private var pending: Promise? = null
  private var receiver: SmsBroadcastReceiver? = null

  override fun getAppHash(promise: Promise) {
    try {
      promise.resolve(AppSignatureHelper(reactApplicationContext).getAppHash())
    } catch (e: Exception) {
      Log.e(TAG, "Failed to compute app hash", e)
      promise.reject(E_FAILED, "Failed to compute app hash: ${e.message}", e)
    }
  }

  override fun startListening(promise: Promise) {
    mainHandler.post { start(promise) }
  }

  override fun stopListening() {
    mainHandler.post { cancel() }
  }

  override fun invalidate() {
    // The JS runtime is going away, so drop the promise instead of rejecting it.
    mainHandler.post {
      pending = null
      unregisterReceiver()
    }
    super.invalidate()
  }

  private fun start(promise: Promise) {
    cancel()
    pending = promise

    val context = reactApplicationContext.applicationContext
    val newReceiver = SmsBroadcastReceiver { result -> onResult(promise, result) }
    try {
      // Register before starting the retriever so an SMS that arrives right away
      // isn't missed. SEND_PERMISSION limits senders to Google Play Services.
      ContextCompat.registerReceiver(
        context,
        newReceiver,
        IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION),
        SmsRetriever.SEND_PERMISSION,
        null,
        ContextCompat.RECEIVER_EXPORTED,
      )
    } catch (e: Exception) {
      Log.e(TAG, "Failed to register SMS receiver", e)
      settle(promise) { it.reject(E_FAILED, "Failed to register SMS receiver: ${e.message}", e) }
      return
    }
    receiver = newReceiver

    SmsRetriever.getClient(context).startSmsRetriever()
      .addOnSuccessListener { Log.d(TAG, "SMS Retriever started") }
      .addOnFailureListener { e ->
        Log.e(TAG, "Failed to start SMS Retriever", e)
        settle(promise) {
          it.reject(E_UNAVAILABLE, "Failed to start SMS Retriever: ${e.message}", e)
        }
      }
  }

  private fun onResult(promise: Promise, result: SmsBroadcastReceiver.Result) {
    settle(promise) {
      when (result) {
        // Never log the body: it holds the OTP and logcat is readable over adb.
        is SmsBroadcastReceiver.Result.Message -> it.resolve(result.body)
        SmsBroadcastReceiver.Result.Timeout ->
          it.reject(E_TIMEOUT, "Timed out waiting for the SMS")
        is SmsBroadcastReceiver.Result.Error ->
          it.reject(E_FAILED, "SMS Retriever error: ${result.message}")
      }
    }
  }

  // Settles [promise] only if it is still the active wait, so a callback from a
  // cancelled or superseded start can't touch the current one.
  private fun settle(promise: Promise, action: (Promise) -> Unit) {
    if (pending !== promise) return
    pending = null
    unregisterReceiver()
    action(promise)
  }

  private fun cancel() {
    val promise = pending ?: run {
      unregisterReceiver()
      return
    }
    settle(promise) { it.reject(E_CANCELLED, "Stopped before an SMS arrived") }
  }

  private fun unregisterReceiver() {
    val current = receiver ?: return
    receiver = null
    try {
      reactApplicationContext.applicationContext.unregisterReceiver(current)
    } catch (e: IllegalArgumentException) {
      Log.w(TAG, "SMS receiver was already unregistered", e)
    }
  }

  companion object {
    const val NAME = NativeOtpAutofillSpec.NAME
    private const val TAG = "OtpAutofill"
    private const val E_CANCELLED = "CANCELLED"
    private const val E_FAILED = "FAILED"
    private const val E_TIMEOUT = "TIMEOUT"
    private const val E_UNAVAILABLE = "UNAVAILABLE"
  }
}
