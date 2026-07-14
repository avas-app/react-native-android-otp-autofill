package avas.modules.otp_autofill

import android.content.Context
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.tasks.Task
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

class AvasOtpAutofillModule : Module() {

  private val TAG = "AvasOtpAutofillModule"
  // Serializes register/unregister so the two threads that touch smsReceiver
  // (Play Services main-thread callback vs. the module-queue stop) can't race.
  private val receiverLock = Any()
  @Volatile private var smsReceiver: SmsBroadcastReceiver? = null
  // The context the receiver was actually registered against — unregister must use
  // the same instance, or it throws "Receiver not registered" after a context swap.
  @Volatile private var registeredContext: Context? = null
  private var appSignatureHelper: AppSignatureHelper? = null
  private val isListening = AtomicBoolean(false)
  // Bumped on every stop so an in-flight start's async success can't register a
  // leaked receiver after the screen that requested it has gone away.
  private val startGeneration = AtomicInteger(0)
  // Dedicated handler for retry backoff so pending retries can be cancelled on stop.
  private val retryHandler = Handler(Looper.getMainLooper())

  companion object {
    private const val MAX_RETRY_ATTEMPTS = 3
    private const val RETRY_DELAY_MS = 1000L
  }

  override fun definition() = ModuleDefinition {
    Name("AvasOtpAutofill")

    Events("onSmsReceived", "onTimeout", "onError")

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

    OnDestroy {
      cleanup()
    }
  }

  private fun startSmsRetriever(promise: Promise, operation: String) {
    if (isListening.get()) {
      // A listener is already active. Treat start as an idempotent no-op rather than
      // rejecting — a re-mounted screen calling start again is expected, and a hard
      // rejection here surfaces as an unhandled promise rejection on the JS side.
      Log.w(TAG, "⚠️ SMS Retriever is already active — start is a no-op")
      promise.resolve(true)
      return
    }

    val generation = startGeneration.incrementAndGet()
    Log.d(TAG, "🎧 Starting SMS Retriever for operation: $operation (gen $generation)")
    startSmsRetrieverWithRetry(promise, operation, 1, generation)
  }

  private fun startSmsRetrieverWithRetry(promise: Promise, operation: String, attempt: Int, generation: Int) {
    if (generation != startGeneration.get()) {
      Log.d(TAG, "⏹️ Start (gen $generation) cancelled before attempt $attempt")
      promise.resolve(false)
      return
    }

    val reactContext = appContext.reactContext
    if (reactContext == null) {
      promise.reject("NO_CONTEXT", "React context is not available", null)
      return
    }

    try {
      val client = SmsRetriever.getClient(reactContext)
      val task: Task<Void> = client.startSmsRetriever()

      task.addOnSuccessListener {
        if (generation != startGeneration.get()) {
          Log.d(TAG, "⏹️ Start (gen $generation) cancelled — skipping receiver registration")
          promise.resolve(false)
          return@addOnSuccessListener
        }
        Log.d(TAG, "✅ SMS Retriever started successfully (attempt $attempt)")
        registerSmsReceiver(promise)
      }

      task.addOnFailureListener { exception ->
        if (generation != startGeneration.get()) {
          Log.d(TAG, "⏹️ Start (gen $generation) cancelled after failure")
          promise.resolve(false)
          return@addOnFailureListener
        }
        Log.e(TAG, "❌ Failed to start SMS Retriever (attempt $attempt/$MAX_RETRY_ATTEMPTS)", exception)

        if (attempt < MAX_RETRY_ATTEMPTS) {
          Log.d(TAG, "🔄 Retrying in ${RETRY_DELAY_MS}ms...")
          retryHandler.postDelayed({
            startSmsRetrieverWithRetry(promise, operation, attempt + 1, generation)
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
        val reactContext = appContext.reactContext
        if (reactContext == null) {
          promise.reject("NO_CONTEXT", "React context is not available", null)
          return
        }
        appSignatureHelper = AppSignatureHelper(reactContext)
      }

      val signatures = appSignatureHelper!!.getAppSignatures()
      if (signatures.isNotEmpty()) {
        Log.d(TAG, "✅ App hash generated successfully")
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
    val context = appContext.reactContext
    if (context == null) {
      promise.reject("NO_CONTEXT", "React context is not available", null)
      return
    }

    try {
      synchronized(receiverLock) {
        // Clean up any existing receiver first. Use the plain unregister (not
        // stopSmsRetriever) so we don't bump the generation and cancel the very
        // start we're completing.
        unregisterReceiverLocked()

        val receiver = SmsBroadcastReceiver()
        receiver.setCallbacks(
          onSmsReceived = { message, otp ->
            // Never log the message body or OTP value — it's a secret and Logcat is
            // readable via READ_LOGS/adb on release builds.
            Log.d(TAG, "📨 SMS received in module (otp len=${otp?.length ?: 0})")
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
        // Restrict the broadcast to Google Play Services via SmsRetriever.SEND_PERMISSION
        // (a GMS signature permission) so no other app can deliver a forged
        // SMS_RETRIEVED_ACTION carrying an attacker-controlled OTP. ContextCompat applies
        // RECEIVER_EXPORTED on API 33+ and the permission across all API levels.
        ContextCompat.registerReceiver(
          context,
          receiver,
          intentFilter,
          SmsRetriever.SEND_PERMISSION,
          null,
          ContextCompat.RECEIVER_EXPORTED,
        )

        smsReceiver = receiver
        registeredContext = context
        isListening.set(true)
      }

      Log.d(TAG, "📡 SMS receiver registered successfully")
      promise.resolve(true)
    } catch (e: Exception) {
      Log.e(TAG, "💥 Error registering SMS receiver", e)
      isListening.set(false)
      promise.reject("RECEIVER_ERROR", "Failed to register SMS receiver: ${e.message}", e)
    }
  }

  private fun stopSmsRetriever() {
    // Cancel any in-flight start so its async success can't register a leaked receiver,
    // drop any pending retry, tear down, and always clear the flag (even if no receiver
    // was registered yet).
    startGeneration.incrementAndGet()
    retryHandler.removeCallbacksAndMessages(null)
    synchronized(receiverLock) {
      unregisterReceiverLocked()
    }
    isListening.set(false)
  }

  // Must be called while holding receiverLock.
  private fun unregisterReceiverLocked() {
    val receiver = smsReceiver ?: return
    try {
      // Unregister against the same context we registered with, not a freshly read one.
      (registeredContext ?: appContext.reactContext)?.unregisterReceiver(receiver)
      Log.d(TAG, "📡❌ SMS receiver unregistered")
    } catch (e: Exception) {
      Log.e(TAG, "💥 Error unregistering receiver", e)
    } finally {
      // Always clear the reference, even if unregister threw, so it can't leak.
      smsReceiver = null
      registeredContext = null
    }
  }

  // Cleanup resources when module is no longer needed
  fun cleanup() {
    stopSmsRetriever()
    appSignatureHelper = null
    Log.d(TAG, "🧹 Module resources cleaned up")
  }
}
