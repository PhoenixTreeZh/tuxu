param([string]$Task='assembleRelease')
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskTools=Get-Content -LiteralPath (Join-Path $taskRoot '_rea_temp/release-android/toolchain.json') -Raw | ConvertFrom-Json
$taskAliases=Join-Path $taskRoot '_rea_temp/release-android/path-alias.json'
if(Test-Path -LiteralPath $taskAliases){$taskRoot=(Get-Content -LiteralPath $taskAliases -Raw | ConvertFrom-Json).alias}
$env:JAVA_HOME=Join-Path $taskRoot ('_rea_temp/toolchains/jdk21/'+(Split-Path $taskTools.java -Leaf))
$env:ANDROID_HOME=Join-Path $taskRoot '_rea_temp/toolchains/android-sdk'
$taskUser=Join-Path $taskRoot '_rea_temp/toolchains/android-user'
$env:ANDROID_USER_HOME=Join-Path $taskUser '.android'
$env:ANDROID_PREFS_ROOT=$taskUser
New-Item -ItemType Directory -Path $env:ANDROID_USER_HOME -Force | Out-Null
$env:GRADLE_USER_HOME=Join-Path $taskRoot '_rea_temp/toolchains/gradle-cache'
$env:TEMP=Join-Path $taskRoot '_rea_temp/release-android/build-temp'
$env:TMP=$env:TEMP
New-Item -ItemType Directory -Path $env:TEMP -Force | Out-Null
$taskSigning=Join-Path $taskRoot '_rea_temp/release-android/signing'
New-Item -ItemType Directory -Path $taskSigning -Force | Out-Null
$taskSecret=Join-Path $taskSigning 'password.txt'
$taskBackup=Join-Path $taskRoot '本地签名备份/Android'
if((!(Test-Path -LiteralPath $taskSecret) -or !(Test-Path -LiteralPath (Join-Path $taskSigning 'tuxu-release.p12'))) -and (Test-Path -LiteralPath (Join-Path $taskBackup 'tuxu-release.p12'))){
    foreach($taskName in @('tuxu-release.p12','password.txt')){Copy-Item -LiteralPath (Join-Path $taskBackup $taskName) -Destination (Join-Path $taskSigning $taskName) -Force}
}
if(!(Test-Path -LiteralPath $taskSecret)){
    $taskBytes=[byte[]]::new(32);[Security.Cryptography.RandomNumberGenerator]::Fill($taskBytes)
    [Convert]::ToBase64String($taskBytes) | Set-Content -LiteralPath $taskSecret -NoNewline
}
$env:TUXU_KEY_PASSWORD=[IO.File]::ReadAllText($taskSecret).Trim()
$taskKey=Join-Path $taskSigning 'tuxu-release.p12'
if(!(Test-Path -LiteralPath $taskKey)){
    & (Join-Path $env:JAVA_HOME 'bin/keytool.exe') -genkeypair -keystore $taskKey -storepass:env TUXU_KEY_PASSWORD -keypass:env TUXU_KEY_PASSWORD -alias tuxu -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Tuxu Local Release' -storetype PKCS12
    if($LASTEXITCODE -ne 0){throw 'APK signing key creation failed'}
}
Push-Location (Join-Path $taskRoot 'apps/android')
try{
    & (Join-Path $taskRoot '_rea_temp/toolchains/gradle-8.13/bin/gradle.bat') $Task --console=plain --no-daemon --stacktrace ('-Duser.home='+$taskUser)
    if($LASTEXITCODE -ne 0){throw ('Android build failed: '+$LASTEXITCODE)}
}finally{Pop-Location;Remove-Item Env:TUXU_KEY_PASSWORD -ErrorAction SilentlyContinue}
