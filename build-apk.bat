@echo off
rem Builds the installable app: android\app\build\outputs\apk\release\app-release.apk
cd /d "%~dp0"
for /d %%j in ("%USERPROFILE%\.jdks\jdk-17*") do set "JAVA_HOME=%%j"
if not defined ANDROID_HOME set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
rem Short cache path: React Native's cached headers pass Windows' 260-char limit under %USERPROFILE%\.gradle
if not defined GRADLE_USER_HOME set "GRADLE_USER_HOME=C:\gh"
if not exist android\app\google-services.json echo WARNING: android\app\google-services.json is missing. The app will build, but it won't ring when closed or show text alerts.
call npm install || exit /b 1
cd android
call .\gradlew.bat assembleRelease || exit /b 1
echo.
echo Built: %~dp0android\app\build\outputs\apk\release\app-release.apk
