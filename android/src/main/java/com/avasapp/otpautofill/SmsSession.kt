package com.avasapp.otpautofill

sealed interface SmsResult {
  data class Message(val body: String) : SmsResult
  data object Timeout : SmsResult
  data class Error(val message: String) : SmsResult
}

// Android calls sit behind this interface so the session rules run in plain JVM tests.
interface SmsSessionHost<W> {
  fun registerReceiver()
  fun unregisterReceiver()
  fun startRetriever(onFailure: (Exception) -> Unit)
  fun schedule(delayMs: Long, task: () -> Unit): () -> Unit
  fun resolve(wait: W, body: String)
  fun reject(wait: W, code: String, message: String, cause: Exception?)
  fun log(message: String)
}

// Android gives an app one SMS Retriever session, 5 minutes from the first start, and closes an expired one lazily.
class SmsSession<W : Any>(
  private val clock: () -> Long,
  private val host: SmsSessionHost<W>,
) {
  private var pending: W? = null
  private var deadlineAt = 0L
  private var reopened = false
  private var cancelDeadline: (() -> Unit)? = null

  private var open = false
  private var sessionStart = 0L
  private var generation = 0

  fun start(wait: W) {
    stop()
    pending = wait
    reopened = false
    if (!open) {
      if (register()) begin()
    } else if (clock() - sessionStart < SESSION_MS) {
      arm()
    } else {
      // A no-op if Play Services still holds the expired session, a real start if not.
      begin()
    }
  }

  fun stop() {
    pending?.let { settle(it) { w -> host.reject(w, E_CANCELLED, "Stopped before an SMS arrived", null) } }
  }

  // The JS runtime is going away, so there is nothing to reject to.
  fun invalidate() {
    pending = null
    cancelDeadline?.invoke()
    cancelDeadline = null
    endSession()
  }

  fun onResult(result: SmsResult) {
    endSession()
    val wait = pending
    when (result) {
      is SmsResult.Message ->
        if (wait == null) host.log("Dropped an SMS with no pending wait")
        else settle(wait) { host.resolve(it, result.body) }
      SmsResult.Timeout ->
        if (wait == null) Unit
        else if (reopened || clock() >= deadlineAt) timeOut(wait)
        else {
          reopened = true
          if (register()) begin()
        }
      is SmsResult.Error ->
        wait?.let { settle(it) { w -> host.reject(w, E_FAILED, "SMS Retriever error: ${result.message}", null) } }
    }
  }

  private fun register(): Boolean {
    try {
      host.registerReceiver()
    } catch (e: Exception) {
      fail(E_FAILED, "Failed to register SMS receiver", e)
      return false
    }
    open = true
    return true
  }

  private fun begin() {
    val id = ++generation
    sessionStart = clock()
    arm()
    try {
      host.startRetriever { e -> if (id == generation) fail(E_UNAVAILABLE, "Failed to start SMS Retriever", e) }
    } catch (e: Exception) {
      fail(E_UNAVAILABLE, "Failed to start SMS Retriever", e)
    }
  }

  private fun arm() {
    val wait = pending ?: return
    cancelDeadline?.invoke()
    deadlineAt = sessionStart + SESSION_MS
    cancelDeadline = host.schedule(deadlineAt - clock()) { timeOut(wait) }
  }

  private fun timeOut(wait: W) =
    settle(wait) { host.reject(it, E_TIMEOUT, "Timed out waiting for the SMS", null) }

  private fun fail(code: String, message: String, e: Exception) {
    host.log("$message: ${e.message}")
    endSession()
    pending?.let { settle(it) { w -> host.reject(w, code, "$message: ${e.message}", e) } }
  }

  // A callback from a cancelled or superseded start must not settle the current wait.
  private fun settle(wait: W, action: (W) -> Unit) {
    if (pending !== wait) return
    pending = null
    cancelDeadline?.invoke()
    cancelDeadline = null
    action(wait)
  }

  private fun endSession() {
    generation++
    if (!open) return
    open = false
    host.unregisterReceiver()
  }

  companion object {
    const val SESSION_MS = 5 * 60 * 1000L
    const val E_CANCELLED = "CANCELLED"
    const val E_FAILED = "FAILED"
    const val E_TIMEOUT = "TIMEOUT"
    const val E_UNAVAILABLE = "UNAVAILABLE"
  }
}
