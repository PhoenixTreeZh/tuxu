param([string]$SourceDirectory='新版软件/图序-React版', [string]$PythonExecutable='')
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskSource=[IO.Path]::GetFullPath((Join-Path $taskRoot $SourceDirectory))
if(!$PythonExecutable){
    $taskCachedPython=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
    if(Test-Path -LiteralPath $taskCachedPython){$PythonExecutable=$taskCachedPython}
    else{$PythonExecutable='python.exe'}
}
& $PythonExecutable (Join-Path $PSScriptRoot 'build.py') '--source' $taskSource
if($LASTEXITCODE -ne 0){throw ('Installer build failed: '+$LASTEXITCODE)}
