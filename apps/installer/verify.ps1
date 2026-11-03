param([string]$PythonExecutable='')
$ErrorActionPreference='Stop'
if(!$PythonExecutable){
    $taskCachedPython=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
    if(Test-Path -LiteralPath $taskCachedPython){$PythonExecutable=$taskCachedPython}
    else{$PythonExecutable='python.exe'}
}
& $PythonExecutable (Join-Path $PSScriptRoot 'verify.py')
if($LASTEXITCODE -ne 0){throw ('Installer verification failed: '+$LASTEXITCODE)}
