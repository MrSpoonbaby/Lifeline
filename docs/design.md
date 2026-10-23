# Tech ResQ Phone — design

An Android app (iPhone later) that turns staff's own phones into the store's business line: calls in and out, texts in
and out, on the store's Twilio number. Every number is matched to a customer in the shop system and shown by name.
No ticket screens.

## Decisions

| | |
|---|---|
| Who rings | Every signed-in phone at the store the customer called, plus staff with no home store (owners/managers). First to answer takes it. |
| No answer | 25 seconds, then the store's voicemail. The recording shows in the app's call list. |
| Several calls | Each call is independent; Twilio has no line limit. A busy phone sees the next call like call waiting. |
| Caller ID out | The store's Twilio number. Personal numbers are never shown. |
| Texts | One inbox per store number. Status texts the shop system already sends come from the same store number, so they sit in the same conversation. |
| Sign-in | The app opens the shop system's own Google sign-in in Chrome (Google blocks sign-in inside apps' web views), then the browser hands a one-time code back to the app (PKCE). Same rules as the website: company Google account, active staff only. "Sign out everywhere" signs the app out too. |
| App stack | React Native (bare, no Expo) + Twilio's official `@twilio/voice-react-native-sdk` + Firebase Cloud Messaging. One codebase so iPhone is mostly Apple setup later. |
| First release | Android, installed by APK (sideloading). Play Store later. |

## Pieces

**Shop system (POS Takeover repo, `shop/phone.py`)**
- `Location.twilio_number`, `CallLog`, `AppDevice`; `SmsLog` gains `location` and `sent_by`.
- Twilio webhooks: `/phone/voice/incoming/`, `/phone/voice/outgoing/` (TwiML App), `/phone/voice/dial-done/`,
  `/phone/voice/answered/`, `/phone/voice/voicemail/`; `/sms/incoming/` now notes which store number was texted.
- App API under `/phone/api/` with a bearer token: sign-in, me (+ Twilio voice token), push token, lookup, threads, send,
  calls, voicemail audio.
- Push for texts and voicemails via FCM HTTP v1. Calls ring through Twilio's own push.

**App (this repo)**
- Tabs: Calls (history + dial pad), Messages (threads → conversation), Settings (store to call from, sign out).
- Incoming calls use the SDK's native call screen, with the caller's name from the shop system.

## Not in v1
Call recording, transfers, contacts outside the customer list, iPhone, Play Store.
