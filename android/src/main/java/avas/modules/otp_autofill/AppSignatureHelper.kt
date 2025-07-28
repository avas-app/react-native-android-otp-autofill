package avas.modules.otp_autofill

import android.content.Context
import android.util.Log
import java.security.MessageDigest
import java.security.NoSuchAlgorithmException
import java.util.*

class AppSignatureHelper(private val context: Context) {
  
  private val TAG = "AppSignatureHelper"
  
  fun getAppSignatures(): List<String> {
    try {
      val packageManager = context.packageManager
      val packageName = context.packageName
      
      val packageInfo = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
        // Use GET_SIGNING_CERTIFICATES for API 28+
        packageManager.getPackageInfo(packageName, android.content.pm.PackageManager.GET_SIGNING_CERTIFICATES)
      } else {
        // Use deprecated GET_SIGNATURES for older versions
        @Suppress("DEPRECATION")
        packageManager.getPackageInfo(packageName, android.content.pm.PackageManager.GET_SIGNATURES)
      }
      
      val signatures = mutableListOf<String>()
      
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
        // For API 28+, use signingInfo
        packageInfo.signingInfo?.let { signingInfo ->
          val signatureArray = if (signingInfo.hasMultipleSigners()) {
            signingInfo.apkContentsSigners
          } else {
            signingInfo.signingCertificateHistory
          }
          
          for (signature in signatureArray) {
            val hash = getHash(packageName, signature.toCharsString())
            if (hash != null) {
              signatures.add(hash)
            }
          }
        }
      } else {
        // For older versions, use deprecated signatures field
        @Suppress("DEPRECATION")
        packageInfo.signatures?.let { signatureArray ->
          for (signature in signatureArray) {
            val hash = getHash(packageName, signature.toCharsString())
            if (hash != null) {
              signatures.add(hash)
            }
          }
        }
      }
      
      return signatures
    } catch (e: Exception) {
      Log.e(TAG, "Error getting app signatures", e)
      return emptyList()
    }
  }
  
  private fun getHash(packageName: String, signature: String): String? {
    val appInfo = "$packageName $signature"
    try {
      val messageDigest = MessageDigest.getInstance("SHA-256")
      messageDigest.update(appInfo.toByteArray())
      var hashSignature = messageDigest.digest()
      
      // Need only first 9 bytes and encode it to base64
      hashSignature = Arrays.copyOfRange(hashSignature, 0, 9)
      val base64Hash = Base64.getEncoder().encodeToString(hashSignature)
      
      // Make it URL safe
      val urlSafeHash = base64Hash.replace("/", "_").replace("+", "-")
      
      return urlSafeHash.substring(0, 11)
    } catch (e: NoSuchAlgorithmException) {
      Log.e(TAG, "Hash algorithm not found", e)
      return null
    }
  }
}
