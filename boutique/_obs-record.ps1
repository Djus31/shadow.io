$ErrorActionPreference = "Stop"
$obsDir = "C:\Program Files\obs-studio\bin\64bit"
$obsExe = Join-Path $obsDir "obs64.exe"
$brave = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe"
$outDir = "C:\Users\J\Desktop\shadow.io\boutique\videos"
$profileDir = Join-Path $env:TEMP "shadowio-brave-rec"
$wsUrl = "ws://127.0.0.1:4455/"
$wsPass = "0JpJnvnKTpDYkjZa"
$modes = @(
  @{ Key = "br"; File = "01-bataille-royale.mp4"; Url = "http://127.0.0.1:8083/?shot=video&mode=br&local=1&rec=2" },
  @{ Key = "raid"; File = "02-raid.mp4"; Url = "http://127.0.0.1:8083/?shot=video&mode=raid&local=1&rec=2" },
  @{ Key = "rush"; File = "03-bataille-x2.mp4"; Url = "http://127.0.0.1:8083/?shot=video&mode=rush&local=1&rec=2" }
)

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class RecWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

function Kill-RecBrave {
  Get-CimInstance Win32_Process -Filter "Name='brave.exe'" | Where-Object { $_.CommandLine -like "*shadowio-brave-rec*" } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Connect-Obs {
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [Threading.CancellationToken]::None
  $ws.ConnectAsync([Uri]$wsUrl, $ct).GetAwaiter().GetResult() | Out-Null
  return @{ Ws = $ws; Ct = $ct }
}

function Recv-Obs($sess) {
  $buffer = New-Object byte[] 262144
  $seg = New-Object ArraySegment[byte] -ArgumentList @(,$buffer)
  $sb = New-Object System.Text.StringBuilder
  do {
    $r = $sess.Ws.ReceiveAsync($seg, $sess.Ct).GetAwaiter().GetResult()
    [void]$sb.Append([Text.Encoding]::UTF8.GetString($buffer, 0, $r.Count))
  } while (-not $r.EndOfMessage)
  return $sb.ToString()
}

function Send-Obs($sess, [string]$json) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $seg = New-Object ArraySegment[byte] -ArgumentList @(,$bytes)
  $sess.Ws.SendAsync($seg, [Net.WebSockets.WebSocketMessageType]::Text, $true, $sess.Ct).GetAwaiter().GetResult() | Out-Null
}

function Identify-Obs($sess) {
  $hello = Recv-Obs $sess | ConvertFrom-Json
  $salt = $hello.d.authentication.salt
  $challenge = $hello.d.authentication.challenge
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $secret = [Convert]::ToBase64String($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($wsPass + $salt)))
  $auth = [Convert]::ToBase64String($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($secret + $challenge)))
  Send-Obs $sess ("{`"op`":1,`"d`":{`"rpcVersion`":1,`"authentication`":`"$auth`"}}")
  $id = Recv-Obs $sess | ConvertFrom-Json
  if ($id.op -ne 2) { throw "OBS Identify failed: $id" }
}

function Req-Obs($sess, [string]$type, [string]$dataJson) {
  $rid = [guid]::NewGuid().ToString("N")
  if ($dataJson) {
    $payload = "{`"op`":6,`"d`":{`"requestType`":`"$type`",`"requestId`":`"$rid`",`"requestData`":$dataJson}}"
  } else {
    $payload = "{`"op`":6,`"d`":{`"requestType`":`"$type`",`"requestId`":`"$rid`"}}"
  }
  Send-Obs $sess $payload
  while ($true) {
    $raw = Recv-Obs $sess
    $msg = $raw | ConvertFrom-Json
    if ($msg.op -eq 7 -and $msg.d.requestId -eq $rid) { return $msg }
  }
}

# Stop leftover OBS so config is reloaded
Get-Process obs64 -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Kill-RecBrave

if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

Write-Host "Starting OBS..."
$obsProc = Start-Process -FilePath $obsExe -WorkingDirectory $obsDir -ArgumentList "--disable-shutdown-check","--minimize-to-tray" -PassThru
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 4455)
    $tcp.Close()
    $ready = $true
    break
  } catch {}
}
if (-not $ready) { throw "OBS websocket 4455 not ready" }
Start-Sleep -Seconds 2

$sess = Connect-Obs
Identify-Obs $sess
Write-Host "OBS websocket OK"
try { Req-Obs $sess "SetRecordDirectory" "{`"recordDirectory`":`"C:/Users/J/Desktop/shadow.io/boutique/videos`"}" | Out-Null } catch {}

foreach ($m in $modes) {
  Write-Host ("=== RECORD " + $m.Key + " ===")
  Kill-RecBrave
  Start-Sleep -Seconds 1
  $args = @(
    "--user-data-dir=$profileDir",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-infobars",
    "--disable-session-crashed-bubble",
    "--disable-features=PrivacySandboxSettings4,TranslateUI",
    "--autoplay-policy=no-user-gesture-required",
    "--kiosk",
    "--new-window",
    $m.Url
  )
  Start-Process -FilePath $brave -ArgumentList $args | Out-Null
  Start-Sleep -Seconds 6
  $hwnd = (Get-Process brave -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Sort-Object StartTime -Descending | Select-Object -First 1).MainWindowHandle
  if ($hwnd) {
    [RecWin]::ShowWindow($hwnd, 3) | Out-Null
    [RecWin]::SetForegroundWindow($hwnd) | Out-Null
  }
  Start-Sleep -Seconds 3
  $start = Req-Obs $sess "StartRecord" $null
  Write-Host ("StartRecord " + ($start.d.requestStatus.code))
  Start-Sleep -Seconds 24
  $stop = Req-Obs $sess "StopRecord" $null
  $path = $stop.d.responseData.outputPath
  Write-Host ("StopRecord -> " + $path)
  Start-Sleep -Seconds 2
  Kill-RecBrave
  $dest = Join-Path $outDir $m.File
  if ($path -and (Test-Path -LiteralPath $path)) {
    if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Force }
    Move-Item -LiteralPath $path -Destination $dest -Force
    Write-Host ("SAVED " + $dest + " " + ((Get-Item $dest).Length))
  } else {
    Write-Host "MISSING output file"
    Get-ChildItem $outDir | Select-Object Name, Length, LastWriteTime | Format-Table
  }
}

try { Req-Obs $sess "StopRecord" $null | Out-Null } catch {}
$sess.Ws.CloseAsync([Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", $sess.Ct).Wait(2000) | Out-Null
Get-Process obs64 -ErrorAction SilentlyContinue | Stop-Process -Force
Kill-RecBrave
Write-Host "DONE"
Get-ChildItem $outDir -Filter "*.mp4" | Select-Object Name, Length, LastWriteTime | Format-Table
