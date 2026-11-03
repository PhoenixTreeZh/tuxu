$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskOutput=Join-Path $taskRoot '新版软件/图序-React版'
$taskStart=[Diagnostics.ProcessStartInfo]::new()
$taskStart.FileName=Join-Path $taskRoot '打开新版阅读器.lnk'
$taskStart.WorkingDirectory=Join-Path $taskRoot '_rea_temp/startup-audit'
$taskStart.UseShellExecute=$true
$taskStart.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
$taskStarted=[DateTime]::UtcNow
$taskProcess=[Diagnostics.Process]::Start($taskStart)
try{
    $taskStatus=$null
    for($taskAttempt=0;$taskAttempt -lt 100;$taskAttempt++){
        if($taskProcess.HasExited){throw 'Shortcut target exited during startup'}
        $taskStatusPath=Join-Path $taskOutput 'startup-status.json'
        if(Test-Path -LiteralPath $taskStatusPath){
            try{
                $taskCandidate=Get-Content -LiteralPath $taskStatusPath -Raw | ConvertFrom-Json
                if($taskCandidate.pid -eq $taskProcess.Id -and [DateTime]$taskCandidate.updatedUtc -ge $taskStarted){$taskStatus=$taskCandidate}
            }catch{}
        }
        if($taskStatus.phase -eq 'failed'){throw 'Shortcut target reported startup failure'}
        if($taskStatus.phase -eq 'ready'){break}
        Start-Sleep -Milliseconds 150
    }
    if($taskStatus.phase -ne 'ready' -or $taskStatus.testMode -or $taskStatus.debugPortEnabled){throw 'Shortcut did not confirm a normal visible drawing'}
    $taskReport=[ordered]@{passed=$true;shellExecute=$true;entrypoint='打开新版阅读器.lnk';firstDrawingVisible=$true;testMode=$false;debugPortEnabled=$false;pid=$taskProcess.Id;profile=$taskStatus.profile}
    $taskReport | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskOutput 'shortcut-startup-verification.json') -Encoding utf8
    $taskReport | ConvertTo-Json
}finally{
    if(-not $taskProcess.HasExited){Stop-Process -Id $taskProcess.Id -Force}
}
