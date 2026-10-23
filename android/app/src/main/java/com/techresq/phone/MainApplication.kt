package com.techresq.phone

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.twiliovoicereactnative.VoiceApplicationProxy

class MainApplication : Application(), ReactApplication {
  private val voiceApplicationProxy = VoiceApplicationProxy(this)

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(this).packages.apply { add(PhoneHelpersPackage()) },
    )
  }

  override fun onCreate() {
    super.onCreate()
    voiceApplicationProxy.onCreate()
    loadReactNative(this)
  }

  override fun onTerminate() {
    voiceApplicationProxy.onTerminate()
    super.onTerminate()
  }
}
