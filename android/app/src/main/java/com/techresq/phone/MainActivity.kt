package com.techresq.phone

import android.Manifest
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.twiliovoicereactnative.VoiceActivityProxy

class MainActivity : ReactActivity() {
  // Twilio: asks for the microphone/notification permissions and handles answering from the call notification
  private val voiceActivityProxy = VoiceActivityProxy(this) { permission ->
    if (permission == Manifest.permission.RECORD_AUDIO || permission == Manifest.permission.POST_NOTIFICATIONS) {
      Toast.makeText(this, "Calls need the microphone and notifications. Allow them in Settings > Apps > Tech ResQ Phone.",
        Toast.LENGTH_LONG).show()
    }
  }

  override fun getMainComponentName(): String = "TechResQPhone"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    voiceActivityProxy.onCreate(savedInstanceState)
  }

  override fun onDestroy() {
    voiceActivityProxy.onDestroy()
    super.onDestroy()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    voiceActivityProxy.onNewIntent(intent)
  }
}
