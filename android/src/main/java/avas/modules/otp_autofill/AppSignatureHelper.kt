package avas.modules.otp_autofill

import androidx.core.content.pm.PackageInfoCompat
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import android.util.Base64
import java.security.MessageDigest
import java.security.NoSuchAlgorithmException

class AppSignatureHelper(private val context: Context) {
  
  private val TAG = "AppSignatureHelper"
  
  companion object {
    private const val HASH_ALGORITHM = "SHA-256"
    private const val HASH_BYTES_LENGTH = 9
    private const val HASH_STRING_LENGTH = 11
    private const val MAX_RETRY_ATTEMPTS = 3
  }
  
  fun getAppSignatures(): List<String> {
    var lastException: Exception? = null
    
    for (attempt in 1..MAX_RETRY_ATTEMPTS) {
      try {
        return getAppSignaturesInternal()
      } catch (e: PackageManager.NameNotFoundException) {
        Log.e(TAG, "Package not found (attempt $attempt/$MAX_RETRY_ATTEMPTS)", e)
        lastException = e
      } catch (e: SecurityException) {
        Log.e(TAG, "Security exception (attempt $attempt/$MAX_RETRY_ATTEMPTS)", e)
        lastException = e
      } catch (e: Exception) {
        Log.e(TAG, "Unexpected error getting app signatures (attempt $attempt/$MAX_RETRY_ATTEMPTS)", e)
        lastException = e
      }
      
      if (attempt < MAX_RETRY_ATTEMPTS) {
        try {
          Thread.sleep(100L * attempt) // Exponential backoff
        } catch (e: InterruptedException) {
          Thread.currentThread().interrupt()
          break
        }
      }
    }
    
    Log.e(TAG, "Failed to get app signatures after $MAX_RETRY_ATTEMPTS attempts", lastException)
    return emptyList()
  }
  
  private fun getAppSignaturesInternal(): List<String> {
    val packageManager = context.packageManager
    val packageName = context.packageName

    val signatures = mutableListOf<String>()

    PackageInfoCompat.getSignatures(packageManager, packageName)?.forEach { signature ->
      getHash(packageName, signature.toCharsString())?.let { hash ->
        signatures.add(hash)
      }
    } ?: run {
      Log.w(TAG, "Signatures not found")
    }
    
    return signatures
  }
  
  private fun getHash(packageName: String, signature: String): String? {
    val appInfo = "$packageName $signature"
    return try {
      val messageDigest = MessageDigest.getInstance(HASH_ALGORITHM)
      messageDigest.update(appInfo.toByteArray())
      val fullHash = messageDigest.digest()
      
      // First HASH_BYTES_LENGTH bytes → STANDARD base64 (alphabet A-Za-z0-9+/), no
      // padding/wrap → first HASH_STRING_LENGTH chars, per Google's SMS Retriever
      // app-hash spec. Do NOT URL-safe encode: the provider validates against
      // ^[A-Za-z0-9+/=]{11}$, so replacing + / with - _ produces a rejected hash.
      // android.util.Base64 works on all minSdk levels (java.util.Base64 is API 26+
      // and would NoClassDefFoundError on API 21–25).
      val truncatedHash = fullHash.copyOfRange(0, HASH_BYTES_LENGTH)
      val base64Hash = Base64.encodeToString(truncatedHash, Base64.NO_PADDING or Base64.NO_WRAP)

      if (base64Hash.length >= HASH_STRING_LENGTH) {
        base64Hash.substring(0, HASH_STRING_LENGTH)
      } else {
        Log.w(TAG, "Generated hash is shorter than expected")
        base64Hash
      }
    } catch (e: NoSuchAlgorithmException) {
      Log.e(TAG, "Hash algorithm $HASH_ALGORITHM not found", e)
      null
    } catch (e: Exception) {
      Log.e(TAG, "Error generating hash", e)
      null
    }
  }
}
