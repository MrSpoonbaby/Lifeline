package com.techresq.phone

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.AudioAttributes
import android.media.ExifInterface
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
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

/** The few native bits the JS side needs: saved settings, the sign-in QR scanner, this phone's Firebase token,
 *  voicemail playback (Android's own MediaPlayer streams the signed link from the shop system), the phone's own accent
 *  color, and picking a background photo. */
class PhoneHelpersModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  // App-private storage; Android keeps other apps out of it.
  private val prefs = context.getSharedPreferences("techresq_phone", Context.MODE_PRIVATE)
  private var pickPromise: Promise? = null

  init {
    context.addActivityEventListener(object : BaseActivityEventListener() {
      override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != PICK_IMAGE) return
        val promise = pickPromise ?: return
        pickPromise = null
        val uri = data?.data
        if (resultCode != Activity.RESULT_OK || uri == null) {
          promise.resolve(null) // cancelled
          return
        }
        try {
          promise.resolve(saveBackground(uri))
        } catch (e: Exception) {
          promise.reject("pick_failed", e.message ?: "That photo couldn't be used", e)
        }
      }
    })
  }

  override fun getName(): String = "PhoneHelpers"

  /** The phone's Material You colors (Android 12+, from the wallpaper): a strong, a light and a dark shade, or null. */
  @ReactMethod
  fun systemAccent(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      promise.resolve(null)
      return
    }
    val c = reactApplicationContext
    fun hex(id: Int) = String.format("#%06X", 0xFFFFFF and c.getColor(id))
    promise.resolve(Arguments.createMap().apply {
      putString("light", hex(android.R.color.system_accent1_600))
      putString("lightSoft", hex(android.R.color.system_accent1_100))
      putString("dark", hex(android.R.color.system_accent1_200))
      putString("darkSoft", hex(android.R.color.system_accent1_800))
    })
  }

  /** Opens the phone's photo picker. Resolves with a file:// URI of the app's own copy, or null if cancelled. */
  @ReactMethod
  fun pickImage(promise: Promise) {
    val activity = reactApplicationContext.currentActivity ?: return promise.reject("no_activity", "Open the app first")
    pickPromise?.resolve(null)
    pickPromise = promise
    val intent = if (Build.VERSION.SDK_INT >= 33) Intent(MediaStore.ACTION_PICK_IMAGES)
      else Intent(Intent.ACTION_GET_CONTENT).setType("image/*")
    activity.startActivityForResult(intent, PICK_IMAGE)
  }

  @ReactMethod
  fun clearImage(promise: Promise) {
    backgrounds().forEach { it.delete() }
    promise.resolve(null)
  }

  private fun backgrounds() = reactApplicationContext.filesDir.listFiles { f -> f.name.startsWith("background-") }.orEmpty()

  /** Copies the photo into the app's own storage, upright and no bigger than a phone screen needs. */
  private fun saveBackground(uri: Uri): String {
    val resolver = reactApplicationContext.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= 1600) sample *= 2
    var bitmap = resolver.openInputStream(uri).use {
      BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
    } ?: throw IllegalArgumentException("That file isn't a photo")
    val degrees = resolver.openInputStream(uri).use { stream ->
      when (stream?.let { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1) }) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
      }
    }
    if (degrees != 0f) {
      bitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, Matrix().apply { postRotate(degrees) }, true)
    }
    backgrounds().forEach { it.delete() }
    val file = java.io.File(reactApplicationContext.filesDir, "background-${System.currentTimeMillis()}.jpg") // new name: no stale cache
    file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 88, it) }
    return Uri.fromFile(file).toString()
  }

  companion object {
    private const val PICK_IMAGE = 4207
  }

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

  private var player: MediaPlayer? = null

  /** Plays a voicemail from its URL. Resolves with its length in ms once it starts. */
  @ReactMethod
  fun play(url: String, promise: Promise) {
    stopPlayer()
    var settled = false
    player = MediaPlayer().apply {
      setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
      setOnPreparedListener {
        it.start()
        if (!settled) { settled = true; promise.resolve(it.duration) }
      }
      setOnErrorListener { _, what, extra ->
        if (!settled) { settled = true; promise.reject("play_failed", "The voicemail didn't play ($what/$extra)") }
        stopPlayer()
        true
      }
      try {
        setDataSource(url)
        prepareAsync()
      } catch (e: Exception) {
        settled = true
        promise.reject("play_failed", e.message ?: "The voicemail didn't play", e)
      }
    }
  }

  @ReactMethod
  fun pause(promise: Promise) {
    player?.takeIf { it.isPlaying }?.pause()
    promise.resolve(null)
  }

  @ReactMethod
  fun resume(promise: Promise) {
    player?.start()
    promise.resolve(null)
  }

  @ReactMethod
  fun seek(ms: Double, promise: Promise) {
    player?.seekTo(ms.toInt())
    promise.resolve(null)
  }

  @ReactMethod
  fun stop(promise: Promise) {
    stopPlayer()
    promise.resolve(null)
  }

  /** Where playback is: {position, duration, playing} in ms, or null when nothing is loaded. */
  @ReactMethod
  fun playback(promise: Promise) {
    val p = player ?: return promise.resolve(null)
    promise.resolve(Arguments.createMap().apply {
      putInt("position", runCatching { p.currentPosition }.getOrDefault(0))
      putInt("duration", runCatching { p.duration }.getOrDefault(0))
      putBoolean("playing", runCatching { p.isPlaying }.getOrDefault(false))
    })
  }

  private fun stopPlayer() {
    player?.release()
    player = null
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
