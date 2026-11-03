param([switch]$UiOnly)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskAlias=(Get-Content -LiteralPath (Join-Path $taskRoot '_rea_temp/release-android/path-alias.json') -Raw | ConvertFrom-Json).alias
$taskAdb=Join-Path $taskAlias '_rea_temp/toolchains/android-sdk/platform-tools/adb.exe'
$taskDebug=Join-Path $taskAlias 'apps/android/app/build/outputs/apk/debug/app-debug.apk'
$taskTests=Join-Path $taskAlias 'apps/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk'
& $taskAdb -s emulator-5556 install -r -t $taskDebug
if($LASTEXITCODE -ne 0){throw 'Debug APK install failed'}
& $taskAdb -s emulator-5556 install -r -t $taskTests
if($LASTEXITCODE -ne 0){throw 'Test APK install failed'}
$taskTestArgs=@('shell','am','instrument','-w','-r')
if($UiOnly){$taskTestArgs+=@('-e','class','cn.tuxu.drawing.ReaderDeviceTest#searchStepsDetailsAndThemeWorkOnPhone')}
$taskTestArgs+='cn.tuxu.drawing.test/androidx.test.runner.AndroidJUnitRunner'
& $taskAdb -s emulator-5556 @taskTestArgs *> (Join-Path $taskRoot '_rea_temp/release-android/instrumentation-results.log')
$taskResult=[IO.File]::ReadAllText((Join-Path $taskRoot '_rea_temp/release-android/instrumentation-results.log'))
$taskExpected=if($UiOnly){'OK \(1 test\)'}else{'OK \(2 tests\)'}
if($LASTEXITCODE -ne 0 -or $taskResult -notmatch $taskExpected -or $taskResult -match 'FAILURES!!!|INSTRUMENTATION_FAILED'){Write-Output $taskResult;throw 'Android device tests failed'}
Write-Output $taskResult
