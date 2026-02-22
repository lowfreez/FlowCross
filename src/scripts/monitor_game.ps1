Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}
"@

$prevX = -1
$prevY = -1
$prevW = -1
$prevH = -1
$prevFound = $false
$prevForeground = $false
$prevMinimized = $false
$cpuCounter = 0
$cpuLoad = 0
$musicCounter = 0
$curMusicJson = "null"

$sessionMgr = $null
$asTaskMethod = $null

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction Stop
    $methods = [System.WindowsRuntimeSystemExtensions].GetMethods()
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
    $netTask.Wait(-1) | Out-Null
    $sessionMgr = $netTask.Result
}
catch {
    $sessionMgr = $null
}

function Get-NowPlaying {
    if ($null -eq $sessionMgr) { return "null" }
    if ($null -eq $asTaskMethod) { return "null" }
    try {
        $session = $sessionMgr.GetCurrentSession()
        if ($null -eq $session) { return "null" }
        $playback = $session.GetPlaybackInfo()
        if ($null -eq $playback) { return "null" }
        $status = $playback.PlaybackStatus
        if ($status -ne [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing) { return "null" }
        $propsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
        $asTask2 = $asTaskMethod.MakeGenericMethod($propsType)
        $netTask2 = $asTask2.Invoke($null, @($session.TryGetMediaPropertiesAsync()))
        $netTask2.Wait(2000) | Out-Null
        if (-not $netTask2.IsCompleted) { return "null" }
        $props = $netTask2.Result
        if ($null -eq $props) { return "null" }
        $title = $props.Title
        if ([string]::IsNullOrEmpty($title)) { return "null" }
        $title = $title -replace '[\"\\]', ''
        $title = $title -replace '[\r\n]', ''
        $artist = ""
        if ($props.Artist) {
            $artist = $props.Artist -replace '[\"\\]', ''
            $artist = $artist -replace '[\r\n]', ''
        }
        return '{"title":"' + $title + '","artist":"' + $artist + '"}'
    }
    catch {
        return "null"
    }
}

while ($true) {
    $mcProcess = $null
    $procs = Get-Process
    foreach ($p in $procs) {
        if ($p.MainWindowTitle -like "*Minecraft*") {
            $mcProcess = $p
            break
        }
    }

    if ($null -ne $mcProcess -and $mcProcess.MainWindowHandle -ne [IntPtr]::Zero) {
        $fgHandle = [Win32]::GetForegroundWindow()
        $isFg = $false
        if ($mcProcess.MainWindowHandle -eq $fgHandle) { $isFg = $true }

        $minimized = [Win32]::IsIconic($mcProcess.MainWindowHandle)
        
        # Check Right Shift (0xA1 = 161)
        # 0x8000 = 32768 - key is down
        $rshiftState = [Win32]::GetAsyncKeyState(161)
        $rshiftDown = ($rshiftState -band 32768) -ne 0
        
        $keyStr = "null"
        if ($rshiftDown) { 
            $keyStr = '"rshift"' 
        }

        $rect = New-Object Win32+RECT
        # DWMWA_EXTENDED_FRAME_BOUNDS = 9
        $res = [Win32]::DwmGetWindowAttribute($mcProcess.MainWindowHandle, 9, [ref]$rect, [System.Runtime.InteropServices.Marshal]::SizeOf($rect))
        
        if ($res -ne 0) {
            # Fallback if Dwm fails
            [void][Win32]::GetWindowRect($mcProcess.MainWindowHandle, [ref]$rect)
        }
        
        $x = $rect.Left
        $y = $rect.Top
        $w = $rect.Right - $rect.Left
        $h = $rect.Bottom - $rect.Top

        $cpuCounter++
        if ($cpuCounter -ge 200) {
            $cpuCounter = 0
            try {
                $cpuLoad = [Math]::Round((Get-CimInstance Win32_Processor).LoadPercentage)
            }
            catch {
                $cpuLoad = 0
            }
            # Heartbeat (JSON)
            Write-Host '{"heartbeat":true}'
        }

        $musicCounter++
        if ($musicCounter -ge 300) {
            # Adjusted for 10ms sleep (3s)
            $musicCounter = 0
            $newMusic = Get-NowPlaying
            if ($newMusic -ne $curMusicJson) {
                $curMusicJson = $newMusic
                $prevX = -999 # Force update
            }
        }

        $fgStr = "false"
        if ($isFg) { $fgStr = "true" }
        $minStr = "false"
        if ($minimized) { $minStr = "true" }

        $changed = $false
        if ($x -ne $prevX) { $changed = $true }
        if ($y -ne $prevY) { $changed = $true }
        if ($w -ne $prevW) { $changed = $true }
        if ($h -ne $prevH) { $changed = $true }
        if (-not $prevFound) { $changed = $true }
        if ($isFg -ne $prevForeground) { $changed = $true }
        if ($minimized -ne $prevMinimized) { $changed = $true }
        if ($rshiftDown -ne $prevRShiftDown) { $changed = $true }
        $prevRShiftDown = $rshiftDown

        if ($changed) {
            $prevX = $x
            $prevY = $y
            $prevW = $w
            $prevH = $h
            $prevFound = $true
            $prevForeground = $isFg
            $prevMinimized = $minimized
            
            $json = '{"found":true,"foreground":' + $fgStr + ',"minimized":' + $minStr + ',"key":' + $keyStr + ',"x":' + $x + ',"y":' + $y + ',"w":' + $w + ',"h":' + $h + ',"music":' + $curMusicJson + ',"cpu":' + $cpuLoad + '}'
            [Console]::WriteLine($json)
            [Console]::Out.Flush()
        }
    }
    else {
        if ($prevFound) {
            $prevFound = $false
            $prevForeground = $false
            [Console]::WriteLine('{"found":false}')
            [Console]::Out.Flush()
        }
    }

    Start-Sleep -Milliseconds 1
}
