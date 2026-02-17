param([string]$Command)

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction Stop
    $methods = [System.WindowsRuntimeSystemExtensions].GetMethods()
    $asTaskMethod = $null
    foreach ($m in $methods) {
        if ($m.Name -ne 'AsTask') { continue }
        if ($m.GetParameters().Count -ne 1) { continue }
        if ($m.GetParameters()[0].ParameterType.Name -ne 'IAsyncOperation`1') { continue }
        $asTaskMethod = $m
        break
    }
    $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
    $mgrType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
    $asTask = $asTaskMethod.MakeGenericMethod($mgrType)
    $netTask = $asTask.Invoke($null, @($mgrType::RequestAsync()))
    $netTask.Wait(3000) | Out-Null
    $mgr = $netTask.Result
    $session = $mgr.GetCurrentSession()
    if ($null -eq $session) { exit 0 }

    if ($Command -eq "playpause") {
        $session.TryTogglePlayPauseAsync() | Out-Null
    }
    if ($Command -eq "next") {
        $session.TrySkipNextAsync() | Out-Null
    }
    if ($Command -eq "prev") {
        $session.TrySkipPreviousAsync() | Out-Null
    }
}
catch {
    exit 0
}
