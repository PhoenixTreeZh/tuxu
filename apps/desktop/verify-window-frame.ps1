param([string]$OutputDirectory)
$ErrorActionPreference='Stop'
$taskOutput=if($OutputDirectory){[IO.Path]::GetFullPath($OutputDirectory)}else{Join-Path $PSScriptRoot 'bin/Release/net10.0-windows/win-x64'}
$taskStarted=[DateTime]::UtcNow
$taskStart=[Diagnostics.ProcessStartInfo]::new()
$taskStart.FileName=Join-Path $taskOutput 'DrawingStudio.exe'
$taskStart.Arguments='--verify-window-frame'
$taskStart.WorkingDirectory=$taskOutput
$taskStart.UseShellExecute=$false
$taskStart.CreateNoWindow=$true
$taskStart.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
$taskProcess=[Diagnostics.Process]::Start($taskStart)
if(-not $taskProcess.WaitForExit(30000)){Stop-Process -Id $taskProcess.Id -Force;throw 'Window frame check timed out'}
$taskReport=Join-Path $taskOutput 'window-frame-verification.json'
if(-not(Test-Path -LiteralPath $taskReport)){throw 'Window frame report missing'}
if((Get-Item -LiteralPath $taskReport).LastWriteTimeUtc -lt $taskStarted){throw 'Stale window frame report'}
Get-Content -LiteralPath $taskReport -Raw
if($taskProcess.ExitCode -ne 0 -or -not(Get-Content -LiteralPath $taskReport -Raw | ConvertFrom-Json).passed){throw 'Window frame checks failed'}
