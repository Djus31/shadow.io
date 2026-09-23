$ErrorActionPreference = "Stop"
$ff = "C:\Users\J\AppData\Local\Programs\LNV\Stremio-4\ffmpeg.exe"
$brave = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe"
$cap = "C:\Users\J\Desktop\shadow.io\boutique\captures"

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class RecWinFs {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

Add-Type -AssemblyName System.Windows.Forms

function Close-GameWindows {
  Get-Process brave -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -like "*SHADOW*" -or $_.MainWindowTitle -like "*127.0.0.1*"
  } | ForEach-Object { [void]$_.CloseMainWindow() }
}

$jobs = @(
  @{ File = "13-video-bataille-royale-x1.mp4"; Url = "http://127.0.0.1:8083/?mode=br&local=1&zoom=1&v=93" },
  @{ File = "14-video-bataille-royale-x2.mp4"; Url = "http://127.0.0.1:8083/?mode=br&local=1&zoom=2&v=93" },
  @{ File = "15-video-raid-x1.mp4"; Url = "http://127.0.0.1:8083/?mode=raid&local=1&zoom=1&v=93" },
  @{ File = "16-video-raid-x2.mp4"; Url = "http://127.0.0.1:8083/?mode=raid&local=1&zoom=2&v=93" },
  @{ File = "17-video-bataille-x2-x1.mp4"; Url = "http://127.0.0.1:8083/?mode=rush&local=1&zoom=1&v=93" },
  @{ File = "18-video-bataille-x2-x2.mp4"; Url = "http://127.0.0.1:8083/?mode=rush&local=1&zoom=2&v=93" }
)

foreach ($j in $jobs) {
  Write-Host ("REC " + $j.File)
  Close-GameWindows
  Start-Sleep -Seconds 1
  Start-Process -FilePath $brave -ArgumentList @("--app=$($j.Url)") | Out-Null
  Start-Sleep -Seconds 5
  $p = Get-Process brave -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowHandle -ne 0 -and ($_.MainWindowTitle -like "*SHADOW*" -or $_.MainWindowTitle -like "*127.0.0.1*" -or $_.MainWindowTitle -like "*8083*")
  } | Select-Object -First 1
  if (-not $p) {
    $p = Get-Process brave -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Sort-Object StartTime -Descending | Select-Object -First 1
  }
  if ($p) {
    [RecWinFs]::ShowWindow($p.MainWindowHandle, 3) | Out-Null
    [RecWinFs]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
  }
  Start-Sleep -Milliseconds 400
  [System.Windows.Forms.SendKeys]::SendWait("{F11}")
  Start-Sleep -Seconds 3
  $out = Join-Path $cap $j.File
  & $ff -y -f gdigrab -framerate 30 -draw_mouse 0 -offset_x 0 -offset_y 0 -video_size 1280x720 -i desktop -t 32 -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 20 -an $out
  if ($LASTEXITCODE -ne 0) { throw "record fail $($j.File)" }
  Close-GameWindows
  Start-Sleep -Seconds 1
  Write-Host ("OK " + $j.File + " " + (Get-Item $out).Length)
}

Write-Host "DONE"
Get-ChildItem $cap -Filter "1*.mp4" | Select-Object Name, Length
