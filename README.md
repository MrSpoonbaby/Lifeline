# Lifeline

Tech ResQ's phone app. 
The store's business line on staff's own phones: calls and texts in and out on each store's Twilio number, with every
number matched to a customer in the shop system. Design: [docs/design.md](docs/design.md).

The server half lives in the shop system (POS Takeover repo, `shop/phone.py`). This repo is only the app.

## One-time setup

You need: the Twilio account the shop already uses for texts, a free Firebase project, and the shop system on Render.

### 1. A Twilio number per store
1. Twilio console → Phone Numbers → buy one local number per store (or reuse the one you text from today for one store).
2. Shop system → Settings → each store → **Twilio number**: enter it, like `+15551234567`.
3. On each number in Twilio (Phone Numbers → Manage → the number):
   - **Voice** → "A call comes in" → Webhook → `https://<your-site>/phone/voice/incoming/` (HTTP POST)
   - **Messaging** → "A message comes in" → Webhook → `https://<your-site>/sms/incoming/` (HTTP POST)
4. US only: each number must be on your **A2P 10DLC** campaign (Messaging → Regulatory Compliance), or carriers block its texts.

### 2. Twilio pieces for calling from the app
1. **API key**: Account → API keys & tokens → Create API key (Standard). Note the SID (`SK...`) and secret.
2. **TwiML App**: Voice → TwiML Apps → Create. Voice request URL: `https://<your-site>/phone/voice/outgoing/` (POST).
   Note its SID (`AP...`).

### 3. Firebase (makes the phone ring when the app is closed, and text alerts)
1. https://console.firebase.google.com → Add project (Analytics not needed).
2. Add an **Android app** with package name `com.techresq.phone`. Download `google-services.json` and put it in
   `android/app/` in this repo. (It's not secret, but it's ignored by git; keep a copy somewhere safe.)
3. Project settings → **Service accounts** → Generate new private key. That JSON file is secret.
4. Project settings → Cloud Messaging: make sure **Firebase Cloud Messaging API (V1)** is enabled.
5. Twilio console → Voice → Credentials (Push Credentials) → Create → type **FCM**, paste the *whole* service account
   JSON as the secret. Note the SID (`CR...`).

### 4. Render (the shop system's settings)
Render dashboard → the web service → Environment, add:

| Key | Value |
|---|---|
| `TWILIO_API_KEY` | `SK...` |
| `TWILIO_API_SECRET` | the API key's secret |
| `TWILIO_TWIML_APP_SID` | `AP...` |
| `TWILIO_PUSH_CREDENTIAL_SID` | `CR...` |
| `FIREBASE_SERVICE_ACCOUNT` | the whole service account JSON, pasted as one value |

`TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are already there from texting. Then deploy the shop system branch with the
phone app changes (it adds a database migration).

## Building the APK (Windows)

Needs Node 20+, Android Studio's SDK, and JDK 17 (in `%USERPROFILE%\.jdks`). With `google-services.json` in place:

```
build-apk.bat
```

The APK lands in `android\app\build\outputs\apk\release\app-release.apk`.

## Installing on a phone (sideloading)
1. Copy `app-release.apk` to the phone (USB, Google Drive, email to yourself).
2. Open it. Android asks to allow installing from that app (Files / Drive / Gmail): allow it, then Install.
3. Open **Lifeline** and allow the microphone and notifications.
4. On a computer, sign in to the shop system → Settings → **Phone app** → **Show QR code**. In the app tap
   **Scan QR code** (or point the phone's camera at it). Done: the phone now rings for that person's store.
5. Recommended: Settings → Apps → Lifeline → Battery → **Unrestricted**, so Android never delays a ringing call.

Updating: install the newer APK over the old one. It keeps the sign-in. Every APK must be built with the same signing
key (see below), or Android refuses the update.

## Testing on this PC (Android emulator)
1. Start the shop system: `start.bat` in the POS Takeover folder (keep it open).
2. Start the emulator (Android Studio → Device Manager → ▶) and install the APK:
   `adb install -r android\app\build\outputs\apk\release\app-release.apk`
3. Run `phone-demo.bat` in the POS Takeover folder. It gives the local stores test numbers (555-01xx), adds sample calls
   and texts, and signs the emulator in as `demo` (`phone-demo.bat tech` for the tech login). Same as scanning the QR,
   but with `http://10.0.2.2:8000`, which is how the emulator reaches this PC.
4. **Simulator:** `start.bat` runs the shop system in local test mode with no real Twilio keys, so it switches to fake ones
   and the simulator. Texts "send" without leaving the PC, calls are acted out in the app (rings, connects, mute,
   speaker, keypad, hang up), and Settings → Simulator fakes an incoming call or text from a real customer. Every
   simulated call and text shows up in Calls and Messages. It never runs in production: the live site doesn't run in
   that test mode.

## How it works
- **Incoming call** → Twilio asks the shop system → it rings every signed-in phone at that store (plus staff who see every
  store) with the customer's name → first to answer takes it → nobody in 25s → voicemail, listed under Calls.
- **Outgoing call** → the app asks Twilio → Twilio asks the shop system → it dials the customer from the store's number.
- **Texts** → the store's inbox under Messages, the customer's ticket Activity, and a notification on the store's phones.
- **Sign-in** → the QR on Settings → Phone app holds the shop system's address and a one-time code (5 minutes, works
  once). The app swaps it for its own sign-in. **Sign out on all devices** (or a manager's "Sign out everywhere" on a
  staff member) signs out the website and every phone, and those phones stop ringing at once.

## Known limits (v1)
- Signing: release APKs use the template's debug key (`android/app/debug.keystore`). Fine for sideloading; make a real
  upload key before the Play Store.
- A store rings at most 10 people at once (Twilio's limit for one dial).
- Tapping a text notification opens the app, not that conversation.
- iPhone: the code is shared, but it still needs Apple setup (VoIP push certificate, CallKit) and a Mac to build.
