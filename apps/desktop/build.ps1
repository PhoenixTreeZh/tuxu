param([switch]$RestoreOnly)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskSdk=Join-Path $taskRoot '_rea_temp/toolchains/dotnet-10/dotnet.exe'
if(-not (Test-Path -LiteralPath $taskSdk)){$taskSdk=(Get-Command dotnet -ErrorAction Stop).Source}
$env:DOTNET_CLI_HOME=Join-Path $taskRoot '_rea_temp/toolchains/cli-home'
$env:DOTNET_CLI_TELEMETRY_OPTOUT='1'
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE='1'
$env:MSBUILDDISABLENODEREUSE='1'
$env:APPDATA=Join-Path $taskRoot '_rea_temp/toolchains/build-roaming'
$env:LOCALAPPDATA=Join-Path $taskRoot '_rea_temp/toolchains/build-local'
$env:NUGET_PACKAGES=Join-Path $taskRoot '_rea_temp/toolchains/nuget'
$env:NUGET_HTTP_CACHE_PATH=Join-Path $taskRoot '_rea_temp/toolchains/nuget-http'
$env:TEMP=Join-Path $taskRoot '_rea_temp/toolchains/build-temp'
$env:TMP=$env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
$taskProject=Join-Path $PSScriptRoot 'Studio.csproj'
if($RestoreOnly){& $taskSdk restore $taskProject --configfile (Join-Path $taskRoot 'NuGet.Config')}
else{& $taskSdk build $taskProject -c Release}
if($LASTEXITCODE -ne 0){throw ('Desktop build failed: '+$LASTEXITCODE)}
