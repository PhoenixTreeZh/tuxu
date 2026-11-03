$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskRoot=(Get-Content -LiteralPath (Join-Path $taskRoot '_rea_temp/release-android/path-alias.json') -Raw | ConvertFrom-Json).alias
$taskTools=Get-Content -LiteralPath (Join-Path $taskRoot '_rea_temp/release-android/toolchain.json') -Raw | ConvertFrom-Json
$env:JAVA_HOME=Join-Path $taskRoot ('_rea_temp/toolchains/jdk21/'+(Split-Path $taskTools.java -Leaf))
$env:ANDROID_HOME=Join-Path $taskRoot '_rea_temp/toolchains/android-sdk'
$env:ANDROID_USER_HOME=Join-Path $taskRoot '_rea_temp/toolchains/android-user/.android'
$env:ANDROID_EMULATOR_HOME=$env:ANDROID_USER_HOME
$env:ANDROID_SDK_HOME=Join-Path $taskRoot '_rea_temp/toolchains/android-user'
$env:USERPROFILE=$env:ANDROID_SDK_HOME
$env:ANDROID_AVD_HOME=Join-Path $taskRoot '_rea_temp/release-android/avd'
$env:TEMP=Join-Path $taskRoot '_rea_temp/release-android/build-temp';$env:TMP=$env:TEMP
New-Item -ItemType Directory -Path $env:ANDROID_AVD_HOME -Force | Out-Null
$taskDevice=Join-Path $env:ANDROID_AVD_HOME 'Tuxu_API30.avd'
if(!(Test-Path -LiteralPath $taskDevice)){
    'no' | & (Join-Path $env:ANDROID_HOME 'cmdline-tools/latest/bin/avdmanager.bat') create avd --name Tuxu_API30 --package 'system-images;android-30;default;x86_64' --path $taskDevice --device pixel_5 --force
    if($LASTEXITCODE -ne 0){throw 'AVD creation failed'}
    Add-Content -LiteralPath (Join-Path $taskDevice 'config.ini') -Value "`nhw.keyboard=yes`nhw.lcd.width=1080`nhw.lcd.height=2340`nhw.lcd.density=440`nshowDeviceFrame=no"
}
$taskAdb=Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
& $taskAdb start-server
$taskBooted=& $taskAdb -s emulator-5556 shell getprop sys.boot_completed 2>$null
if($taskBooted -eq '1'){Write-Output 'Existing project test emulator is ready';exit 0}
$taskArguments=@('-avd','Tuxu_API30','-no-window','-no-audio','-no-boot-anim','-no-snapshot','-gpu','swiftshader_indirect','-feature','-Vulkan','-accel','on','-memory','2048','-cores','2','-port','5556','-verbose')
$taskStdout=Join-Path $taskRoot '_rea_temp/release-android/emulator-output.log'
$taskStderr=Join-Path $taskRoot '_rea_temp/release-android/emulator-error.log'
$taskProcess=Start-Process -FilePath (Join-Path $env:ANDROID_HOME 'emulator/emulator.exe') -ArgumentList $taskArguments -WindowStyle Hidden -PassThru -RedirectStandardOutput $taskStdout -RedirectStandardError $taskStderr
Set-Content -LiteralPath (Join-Path $taskRoot '_rea_temp/release-android/emulator.pid') -Value $taskProcess.Id
for($taskAttempt=0;$taskAttempt -lt 180;$taskAttempt++){
    if($taskProcess.HasExited){Get-Content $taskStdout -Tail 12;Get-Content $taskStderr -Tail 12;throw 'Emulator exited before boot'}
    $taskBooted=& $taskAdb -s emulator-5556 shell getprop sys.boot_completed 2>$null
    if($taskBooted -eq '1'){Write-Output 'Project software emulator booted';exit 0}
    Start-Sleep -Seconds 2
}
throw 'Emulator boot timed out; process left running for diagnosis'
