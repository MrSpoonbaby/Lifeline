# Tech ResQ Phone

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
3. Open **Tech ResQ Phone**, allow the microphone and notifications, enter the shop system's address, sign in with
   Google. Done: the phone now rings for the store's calls.
4. Recommended: Settings → Apps → Tech ResQ Phone → Battery → **Unrestricted**, so Android never delays a ringing call.

Updating: install the newer APK over the old one. It keeps the sign-in. Every APK must be built with the same signing
key (see below), or Android refuses the update.

## How it works
- **Incoming call** → Twilio asks the shop system → it rings every signed-in phone at that store (plus staff who see every
  store) with the customer's name → first to answer takes it → nobody in 25s → voicemail, listed under Calls.
- **Outgoing call** → the app asks Twilio → Twilio asks the shop system → it dials the customer from the store's number.
- **Texts** → the store's inbox under Messages, the customer's ticket Activity, and a notification on the store's phones.
- **Sign-in** → Chrome opens the shop system's own Google sign-in (Google blocks sign-in inside apps), then hands the
  app a one-time code. "Sign out everywhere" in the shop system signs the app out too.

## Known limits (v1)
- Signing: release APKs use the template's debug key (`android/app/debug.keystore`). Fine for sideloading; make a real
  upload key before the Play Store.
- A store rings at most 10 people at once (Twilio's limit for one dial).
- Tapping a text notification opens the app, not that conversation.
- iPhone: the code is shared, but it still needs Apple setup (VoIP push certificate, CallKit) and a Mac to build.
