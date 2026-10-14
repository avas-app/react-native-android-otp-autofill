package com.avasapp.otpautofill

import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.gms.auth.api.phone.SmsRetriever

class OtpAutofillModule(reactContext: ReactApplicationContext) :
  NativeOtpAutofillSpec(reactContext) {

  // Play Services callbacks and the receiver run on the main thread, so the session lives there too.
  private val mainHandler = Handler(Looper.getMainLooper())
  private val session = SmsSession(SystemClock::elapsedRealtime, Host())

  override fun getAppHash(promise: Promise) {
    try {
      promise.resolve(AppSignatureHelper(reactApplicationContext).getAppHash())
    } catch (e: Exception) {
      Log.e(TAG, "Failed to compute app hash", e)
      promise.reject(SmsSession.E_FAILED, "Failed to compute app hash: ${e.message}", e)
    }
  }

  override fun startListening(promise: Promise) {
    mainHandler.post { session.start(promise) }
  }

  override fun stopListening() {
    mainHandler.post { session.stop() }
  }

  override fun invalidate() {
    mainHandler.post { session.invalidate() }
    super.invalidate()
  }

  private inner class Host : SmsSessionHost<Promise> {
    private val context get() = reactApplicationContext.applicationContext
    private var receiver: SmsBroadcastReceiver? = null

    override fun registerReceiver() {
      val newReceiver = SmsBroadcastReceiver(session::onResult)
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
      receiver = newReceiver
    }

    override fun unregisterReceiver() {
      val current = receiver ?: return
      receiver = null
      try {
        context.unregisterReceiver(current)
      } catch (e: IllegalArgumentException) {
        Log.w(TAG, "SMS receiver was already unregistered", e)
      }
    }

    override fun startRetriever(onFailure: (Exception) -> Unit) {
      SmsRetriever.getClient(context).startSmsRetriever()
        .addOnSuccessListener { Log.d(TAG, "SMS Retriever started") }
        .addOnFailureListener(onFailure)
    }

    override fun schedule(delayMs: Long, task: () -> Unit): () -> Unit {
      val runnable = Runnable(task)
      mainHandler.postDelayed(runnable, delayMs)
      return { mainHandler.removeCallbacks(runnable) }
    }

    // Never log the body: it holds the OTP and logcat is readable over adb.
    override fun resolve(wait: Promise, body: String) = wait.resolve(body)

    override fun reject(wait: Promise, code: String, message: String, cause: Exception?) =
      if (cause == null) wait.reject(code, message) else wait.reject(code, message, cause)

    override fun log(message: String) {
      Log.d(TAG, message)
    }
  }

  companion object {
    const val NAME = NativeOtpAutofillSpec.NAME
    private const val TAG = "OtpAutofill"
  }
}
