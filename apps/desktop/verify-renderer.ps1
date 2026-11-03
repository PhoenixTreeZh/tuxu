param([string]$OutputDirectory)
$ErrorActionPreference='Stop'
$taskOutput=if($OutputDirectory){[IO.Path]::GetFullPath($OutputDirectory)}else{Join-Path $PSScriptRoot 'bin/Release/net10.0-windows/win-x64'}
$taskStarted=[DateTime]::UtcNow
$taskStart=[Diagnostics.ProcessStartInfo]::new()
$taskStart.FileName=Join-Path $taskOutput 'DrawingStudio.exe'
$taskStart.Arguments='--verify-renderer'
$taskStart.WorkingDirectory=$taskOutput
$taskStart.UseShellExecute=$false
$taskStart.CreateNoWindow=$true
$taskStart.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
$taskProcess=[Diagnostics.Process]::Start($taskStart)
if(-not $taskProcess.WaitForExit(45000)){Stop-Process -Id $taskProcess.Id -Force;throw 'Renderer check timed out'}
$taskReport=Join-Path $taskOutput 'renderer-verification.json'
if($taskProcess.ExitCode -ne 0 -or -not(Test-Path -LiteralPath $taskReport)){throw 'Renderer check failed'}
if((Get-Item -LiteralPath $taskReport).LastWriteTimeUtc -lt $taskStarted){throw 'Stale renderer report'}
$taskResult=Get-Content -LiteralPath $taskReport -Raw | ConvertFrom-Json
if(-not $taskResult.passed){throw 'Renderer reported a failure'}
Write-Output ('Renderer passed: '+$taskResult.all.scenes+' scenes, '+$taskResult.vectors.reference_mismatches+' reference pixel mismatches.')
