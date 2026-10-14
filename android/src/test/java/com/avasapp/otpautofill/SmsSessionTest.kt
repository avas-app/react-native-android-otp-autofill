package com.avasapp.otpautofill

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private const val MIN = 60_000L

private class FakeHost : SmsSessionHost<String> {
  class Task(val at: Long, val run: () -> Unit, var cancelled: Boolean = false)

  var now = 0L
  var registered = 0
  var unregistered = 0
  var retrieverStarts = 0
  var throwOnRegister = false
  var throwOnStart = false
  val failureCallbacks = mutableListOf<(Exception) -> Unit>()
  val tasks = mutableListOf<Task>()
  val events = mutableListOf<String>()

  val liveTasks get() = tasks.filter { !it.cancelled }

  override fun registerReceiver() {
    if (throwOnRegister) throw SecurityException("no")
    registered++
  }

  override fun unregisterReceiver() {
    unregistered++
  }

  override fun startRetriever(onFailure: (Exception) -> Unit) {
    retrieverStarts++
    if (throwOnStart) throw IllegalStateException("no gms")
    failureCallbacks += onFailure
  }

  override fun schedule(delayMs: Long, task: () -> Unit): () -> Unit {
    val entry = Task(now + delayMs, task)
    tasks += entry
    return { entry.cancelled = true }
  }

  override fun resolve(wait: String, body: String) {
    events += "$wait resolved $body"
  }

  override fun reject(wait: String, code: String, message: String, cause: Exception?) {
    events += "$wait rejected $code"
  }

  override fun log(message: String) {}

  fun advanceTo(time: Long) {
    now = time
    liveTasks.filter { it.at <= now }.forEach {
      it.cancelled = true
      it.run()
    }
  }
}

class SmsSessionTest {
  private val host = FakeHost()
  private val session = SmsSession(clock = { host.now }, host = host)

  @Test
  fun startWithNoSessionRegistersAndStartsTheRetriever() {
    session.start("a")
    assertEquals(1, host.registered)
    assertEquals(1, host.retrieverStarts)
    assertEquals(5 * MIN, host.liveTasks.single().at)

    session.onResult(SmsResult.Message("code 1234"))
    assertEquals(listOf("a resolved code 1234"), host.events)
    assertEquals(1, host.unregistered)
    assertTrue(host.liveTasks.isEmpty())
  }

  @Test
  fun aWaitTimesOutOnTheModulesOwnClock() {
    session.start("a")
    host.advanceTo(5 * MIN)
    assertEquals(listOf("a rejected TIMEOUT"), host.events)
    assertEquals(0, host.unregistered)
  }

  @Test
  fun aSecondStartCancelsTheFirstAndAttachesToTheLiveSession() {
    session.start("a")
    host.now = 4 * MIN + 50_000
    session.start("b")
    assertEquals(listOf("a rejected CANCELLED"), host.events)
    assertEquals(1, host.registered)
    assertEquals(1, host.retrieverStarts)
    assertEquals(5 * MIN, host.liveTasks.single().at)

    host.advanceTo(5 * MIN)
    assertEquals(listOf("a rejected CANCELLED", "b rejected TIMEOUT"), host.events)
  }

  @Test
  fun anExpiredSessionStartsTheRetrieverAgainAndKeepsTheReceiver() {
    session.start("a")
    host.advanceTo(5 * MIN)
    host.now = 5 * MIN + 10_000
    session.start("b")
    assertEquals(1, host.registered)
    assertEquals(2, host.retrieverStarts)
    assertEquals(10 * MIN + 10_000, host.liveTasks.single().at)
  }

  @Test
  fun aStaleTimeoutReopensASessionForThePendingWait() {
    session.start("a")
    host.advanceTo(5 * MIN)
    host.now = 5 * MIN + 10_000
    session.start("b")

    host.now = 5 * MIN + 20_000
    session.onResult(SmsResult.Timeout)
    assertEquals(1, host.unregistered)
    assertEquals(2, host.registered)
    assertEquals(3, host.retrieverStarts)
    assertEquals(10 * MIN + 20_000, host.liveTasks.single().at)

    session.onResult(SmsResult.Message("code 9999"))
    assertEquals(listOf("a rejected TIMEOUT", "b resolved code 9999"), host.events)
  }

  @Test
  fun aTimeoutAfterTheWaitsDeadlineRejectsInsteadOfReopening() {
    session.start("a")
    host.now = 5 * MIN + 1 // the deadline task has not run yet, as after deep sleep
    session.onResult(SmsResult.Timeout)
    assertEquals(listOf("a rejected TIMEOUT"), host.events)
    assertEquals(1, host.registered)
    assertTrue(host.liveTasks.isEmpty())
  }

  @Test
  fun aTimeoutWithNoWaitJustEndsTheSession() {
    session.start("a")
    session.stop()
    session.onResult(SmsResult.Timeout)
    assertEquals(1, host.unregistered)
    assertEquals(1, host.registered)
  }

  @Test
  fun aSuccessWithNoWaitIsDroppedAndEndsTheSession() {
    session.start("a")
    session.stop()
    session.onResult(SmsResult.Message("code 1234"))
    assertEquals(listOf("a rejected CANCELLED"), host.events)
    assertEquals(1, host.unregistered)

    session.start("b")
    assertEquals(2, host.registered)
    assertEquals(2, host.retrieverStarts)
  }

  @Test
  fun stopRejectsCancelledAndKeepsTheSession() {
    session.start("a")
    session.stop()
    assertEquals(listOf("a rejected CANCELLED"), host.events)
    assertTrue(host.liveTasks.isEmpty())
    assertEquals(0, host.unregistered)

    session.start("b")
    assertEquals(1, host.retrieverStarts)
  }

  @Test
  fun aSynchronousStartFailureRejectsAndTearsDown() {
    host.throwOnStart = true
    session.start("a")
    assertEquals(listOf("a rejected UNAVAILABLE"), host.events)
    assertEquals(1, host.unregistered)
    assertTrue(host.liveTasks.isEmpty())
  }

  @Test
  fun aReceiverRegistrationFailureRejectsFailed() {
    host.throwOnRegister = true
    session.start("a")
    assertEquals(listOf("a rejected FAILED"), host.events)
    assertEquals(0, host.retrieverStarts)
    assertEquals(0, host.unregistered)
  }

  @Test
  fun anAsyncStartFailureRejectsAndTearsDown() {
    session.start("a")
    host.failureCallbacks.single()(RuntimeException("gms"))
    assertEquals(listOf("a rejected UNAVAILABLE"), host.events)
    assertEquals(1, host.unregistered)
  }

  @Test
  fun aLateFailureFromAnOldSessionIsIgnored() {
    session.start("a")
    val old = host.failureCallbacks.single()
    session.onResult(SmsResult.Message("code 1234"))
    session.start("b")

    old(RuntimeException("late"))
    assertEquals(listOf("a resolved code 1234"), host.events)
    assertEquals(1, host.unregistered)
    assertEquals(1, host.liveTasks.size)
  }

  @Test
  fun invalidateDropsTheWaitAndANewInstanceStartsFresh() {
    session.start("a")
    session.invalidate()
    assertTrue(host.events.isEmpty())
    assertEquals(1, host.unregistered)
    assertTrue(host.liveTasks.isEmpty())

    val next = SmsSession(clock = { host.now }, host = host)
    next.start("b")
    assertEquals(2, host.registered)
    assertEquals(2, host.retrieverStarts)
  }

  @Test
  fun anErrorResultRejectsFailedAndEndsTheSession() {
    session.start("a")
    session.onResult(SmsResult.Error("status 6"))
    assertEquals(listOf("a rejected FAILED"), host.events)
    assertEquals(1, host.unregistered)
    assertTrue(host.liveTasks.isEmpty())
  }

  @Test
  fun aReopenMovesTheDeadlineToFiveMinutesFromNow() {
    session.start("a")
    host.now = 1 * MIN
    session.onResult(SmsResult.Timeout)
    assertEquals(6 * MIN, host.liveTasks.single().at)

    host.advanceTo(5 * MIN + 59_000)
    assertTrue(host.events.isEmpty())
    host.advanceTo(6 * MIN)
    assertEquals(listOf("a rejected TIMEOUT"), host.events)
  }

  @Test
  fun aSecondStaleTimeoutBeforeTheDeadlineRejects() {
    session.start("a")
    host.now = 1 * MIN
    session.onResult(SmsResult.Timeout)
    host.now = 2 * MIN
    session.onResult(SmsResult.Timeout)
    assertEquals(listOf("a rejected TIMEOUT"), host.events)
    assertEquals(2, host.registered)
    assertEquals(2, host.retrieverStarts)
    assertTrue(host.liveTasks.isEmpty())
  }

  @Test
  fun theReopenCapStartsOverWithANewWait() {
    session.start("a")
    host.now = 1 * MIN
    session.onResult(SmsResult.Timeout)
    session.start("b")
    host.now = 2 * MIN
    session.onResult(SmsResult.Timeout)
    assertEquals(listOf("a rejected CANCELLED"), host.events)
    assertEquals(3, host.registered)
  }

  @Test
  fun aStaleTimeoutWithNoOpenSessionDoesNothing() {
    session.onResult(SmsResult.Timeout)
    assertTrue(host.events.isEmpty())
    assertEquals(0, host.registered)
    assertEquals(0, host.unregistered)

    session.start("a")
    session.onResult(SmsResult.Error("status 6"))
    session.onResult(SmsResult.Timeout)
    assertEquals(listOf("a rejected FAILED"), host.events)
    assertEquals(1, host.registered)
  }
}
