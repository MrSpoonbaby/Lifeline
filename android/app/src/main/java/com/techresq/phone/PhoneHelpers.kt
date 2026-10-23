package com.techresq.phone

import android.content.Context
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning

/** The few native bits the JS side needs: saved settings, the sign-in QR scanner, and this phone's Firebase token. */
class PhoneHelpersModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  // App-private storage; Android keeps other apps out of it.
  private val prefs = context.getSharedPreferences("techresq_phone", Context.MODE_PRIVATE)

  override fun getName(): String = "PhoneHelpers"

  @ReactMethod
  fun get(key: String, promise: Promise) {
    promise.resolve(prefs.getString(key, null))
  }

  @ReactMethod
  fun set(key: String, value: String?, promise: Promise) {
    prefs.edit().apply { if (value == null) remove(key) else putString(key, value) }.apply()
    promise.resolve(null)
  }

  /** Google Play services' own scanner screen: no camera permission or scanner UI of ours. Resolves null if cancelled. */
  @ReactMethod
  fun scanQr(promise: Promise) {
    val options = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
    GmsBarcodeScanning.getClient(reactApplicationContext.currentActivity ?: reactApplicationContext, options).startScan()
      .addOnSuccessListener { promise.resolve(it.rawValue) }
      .addOnCanceledListener { promise.resolve(null) }
      .addOnFailureListener { promise.reject("scan_failed", it.message ?: "The scanner didn't open", it) }
  }

  @ReactMethod
  fun pushToken(promise: Promise) {
    if (FirebaseApp.getApps(reactApplicationContext).isEmpty()) {
      promise.resolve(null) // built without google-services.json: no text alerts
      return
    }
    FirebaseMessaging.getInstance().token
      .addOnSuccessListener { promise.resolve(it) }
      .addOnFailureListener { promise.resolve(null) }
  }
}

class PhoneHelpersPackage : ReactPackage {
  @Deprecated("Legacy module registration; fine through the new architecture's interop layer")
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(PhoneHelpersModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<in Nothing, in Nothing>> =
    emptyList()
}
