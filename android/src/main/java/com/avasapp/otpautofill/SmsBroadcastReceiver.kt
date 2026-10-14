package com.avasapp.otpautofill

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.os.BundleCompat
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status

class SmsBroadcastReceiver(private val onResult: (SmsResult) -> Unit) : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
    onResult(parse(intent))
  }

  private fun parse(intent: Intent): SmsResult {
    val extras = intent.extras ?: return SmsResult.Error("Intent has no extras")
    val status = BundleCompat.getParcelable(extras, SmsRetriever.EXTRA_STATUS, Status::class.java)
      ?: return SmsResult.Error("Intent has no status")
    Log.d(TAG, "SMS Retriever status: ${status.statusCode}")

    return when (status.statusCode) {
      CommonStatusCodes.SUCCESS -> {
        val body = extras.getString(SmsRetriever.EXTRA_SMS_MESSAGE)
        if (body.isNullOrBlank()) SmsResult.Error("SMS body is empty") else SmsResult.Message(body)
      }
      CommonStatusCodes.TIMEOUT -> SmsResult.Timeout
      else -> SmsResult.Error(status.statusMessage ?: "status ${status.statusCode}")
    }
  }

  private companion object {
    const val TAG = "SmsBroadcastReceiver"
  }
}
