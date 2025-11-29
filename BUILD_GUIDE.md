# Peek4c - Android Build Guide

Complete guide for building and testing the Peek4c Android application on Windows using PowerShell.

## 1. Prerequisites

### Required Software
- **Node.js**: v18 or higher
- **JDK**: Version 17 (Oracle JDK or OpenJDK)
- **Android SDK**: Latest version
- **Android Studio**: Recommended for SDK management

## 2. Environment Setup

### Set Java Home (Required for every PowerShell session)
```powershell
# Set JDK 17 path (adjust path to your JDK installation)
$env:JAVA_HOME="D:\Dev\jdk-17.0.12"
$env:Path="$env:JAVA_HOME\bin;$env:Path"

# Verify Java version
java -version
# Should output: java version "17.0.12" or similar
```

### Set Android SDK Path

You have two options:

**Option A: Set ANDROID_HOME environment variable (Recommended)**

This is a one-time setup that persists across sessions:

```powershell
# Set ANDROID_HOME environment variable permanently
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'D:\Android\Sdk', 'User')

# Verify (restart PowerShell after setting)
echo $env:ANDROID_HOME
# Should output: D:\Android\Sdk
```

## 3. Project Setup

Before building, you must install the project dependencies.

```powershell
# Install dependencies
npm install
```

## 4. Build & Run

### Clean Build

Use this if you encounter build errors or want to ensure a fresh build.

```powershell
# Clean and regenerate native code
npx expo prebuild --clean
```

**What `prebuild --clean` does**:
- Deletes `android/` and `ios/` directories
- Regenerates native code from `app.json`
- Applies all config plugins

### Debug Build

```powershell
# Build debug APK
npx expo run:android
```

### Release APK (Optimized, for distribution)

```powershell
# Generate keystore (first time only)
keytool -genkeypair -v -storetype PKCS12 -keystore peek4c-release.keystore -alias peek4c-key -keyalg RSA -keysize 2048 -validity 10000

# Build release APK
cd android
.\gradlew assembleRelease

# Find APK at:
# android\app\build\outputs\apk\release\app-release.apk
```

## 5. Debugging & Verification

### Database Verification

To retrieve the SQLite database (`app.db`) from the device for verification:

```powershell
# Add cmd /c before the command and wrap the entire command in double quotes
cmd /c "D:\Android\Sdk\platform-tools\adb.exe exec-out run-as io.github.peek4c cat files/SQLite/app.db > ./app.db"
```
