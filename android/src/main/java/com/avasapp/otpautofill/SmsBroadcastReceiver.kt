package com.avasapp.otpautofill

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.os.BundleCompat
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status

class SmsBroadcastReceiver(private val onResult: (Result) -> Unit) : BroadcastReceiver() {

  sealed interface Result {
    data class Message(val body: String) : Result
    data object Timeout : Result
    data class Error(val message: String) : Result
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
    onResult(parse(intent))
  }

  private fun parse(intent: Intent): Result {
    val extras = intent.extras ?: return Result.Error("Intent has no extras")
    val status = BundleCompat.getParcelable(extras, SmsRetriever.EXTRA_STATUS, Status::class.java)
      ?: return Result.Error("Intent has no status")
    Log.d(TAG, "SMS Retriever status: ${status.statusCode}")

    return when (status.statusCode) {
      CommonStatusCodes.SUCCESS -> {
        val body = extras.getString(SmsRetriever.EXTRA_SMS_MESSAGE)
        if (body.isNullOrBlank()) Result.Error("SMS body is empty") else Result.Message(body)
      }
      CommonStatusCodes.TIMEOUT -> Result.Timeout
      else -> Result.Error(status.statusMessage ?: "status ${status.statusCode}")
    }
  }

  private companion object {
    const val TAG = "SmsBroadcastReceiver"
  }
}
