$ErrorActionPreference = "Stop"
$ff = "C:\Users\J\AppData\Local\Programs\LNV\Stremio-4\ffmpeg.exe"
$root = "C:\Users\J\Desktop\shadow.io"
$cap = Join-Path $root "boutique\captures"
$vid = Join-Path $root "boutique\videos"
$work = Join-Path $vid "_trailer"
$font = "C\:/Windows/Fonts/segoeui.ttf"
$fontB = "C\:/Windows/Fonts/segoeuib.ttf"
if (-not (Test-Path "C:\Windows\Fonts\segoeuib.ttf")) { $fontB = $font }
New-Item -ItemType Directory -Force -Path $work | Out-Null

$commonV = "-c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 20 -r 30 -an"

function Run-Ff {
  param([string[]]$FfArgs)
  & $ff @FfArgs
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed ($LASTEXITCODE)" }
}

function StillClip($src, $outName, $sec, $xfade) {
  $out = Join-Path $work $outName
  $fadeOutStart = [Math]::Max(0, $sec - 0.35)
  $vf = "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(1.10,1+0.0012*on)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$([int]($sec*30)):s=1280x720:fps=30,fade=t=in:st=0:d=0.28,fade=t=out:st=${fadeOutStart}:d=0.35,format=yuv420p"
  Run-Ff @("-y","-loop","1","-i",$src,"-t","$sec","-vf",$vf,"-c:v","libx264","-pix_fmt","yuv420p","-preset","veryfast","-crf","20","-an",$out)
}

function VideoClip($src, $outName, $ss, $sec) {
  $out = Join-Path $work $outName
  $fadeOutStart = [Math]::Max(0, $sec - 0.35)
  $vf = "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,fade=t=in:st=0:d=0.25,fade=t=out:st=${fadeOutStart}:d=0.35,format=yuv420p"
  Run-Ff @("-y","-ss","$ss","-i",$src,"-t","$sec","-vf",$vf,"-c:v","libx264","-pix_fmt","yuv420p","-preset","veryfast","-crf","20","-an",$out)
}

function TitleCard($outName, $sec, $line1, $line2, $line3) {
  $out = Join-Path $work $outName
  $t1 = $line1.Replace("'","\’")
  $fadeOutStart = [Math]::Max(0, $sec - 0.4)
  $vf = @"
drawtext=fontfile=${fontB}:text='$line1':fontsize=72:fontcolor=0xe7c56a:x=(w-text_w)/2:y=h/2-90:shadowcolor=black:shadowx=2:shadowy=2,drawtext=fontfile=${font}:text='$line2':fontsize=32:fontcolor=0x5ad4ff:x=(w-text_w)/2:y=h/2+8:shadowcolor=black:shadowx=1:shadowy=1,drawtext=fontfile=${font}:text='$line3':fontsize=26:fontcolor=0xefe7d6:x=(w-text_w)/2:y=h/2+58,fade=t=in:st=0:d=0.35,fade=t=out:st=${fadeOutStart}:d=0.4,format=yuv420p
"@
  $vf = $vf.Trim()
  Run-Ff @("-y","-f","lavfi","-i","color=c=0x07080c:s=1280x720:d=$sec","-vf",$vf,"-c:v","libx264","-pix_fmt","yuv420p","-preset","veryfast","-crf","18","-an",$out)
}

Write-Host "1 open cover"
$cover = Join-Path $cap "couverture.png"
$coverVf = "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,eq=brightness=-0.08:saturation=0.92,zoompan=z='min(1.08,1+0.0008*on)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=114:s=1280x720:fps=30,drawtext=fontfile=${fontB}:text='SHADOW.io':fontsize=78:fontcolor=0xe7c56a:x=(w-text_w)/2:y=h-210:shadowcolor=black:shadowx=3:shadowy=3,drawtext=fontfile=${font}:text='Chasseurs  &  Ombres':fontsize=30:fontcolor=0x5ad4ff:x=(w-text_w)/2:y=h-128:shadowcolor=black:shadowx=2:shadowy=2,drawtext=fontfile=${font}:text='[ SYSTEME ]  CHASSE AUTORISEE':fontsize=18:fontcolor=0xe7c56a:x=(w-text_w)/2:y=58,fade=t=in:st=0:d=0.6,fade=t=out:st=3.3:d=0.5,format=yuv420p"
Run-Ff @("-y","-loop","1","-i",$cover,"-t","3.8","-vf",$coverVf,"-c:v","libx264","-pix_fmt","yuv420p","-preset","veryfast","-crf","18","-an",(Join-Path $work "01-open.mp4"))

Write-Host "2 stills + titles + gameplay"
StillClip (Join-Path $cap "01-menu.png") "02-menu.mp4" 2.3
VideoClip (Join-Path $vid "01-bataille-royale.mp4") "03-br.mp4" 4.0 7.0
StillClip (Join-Path $cap "03-coffre-et-boss.png") "04-coffre.mp4" 2.2
StillClip (Join-Path $cap "04-bataille-royale.png") "05-brstill.mp4" 2.0
TitleCard "06-raidtitle.mp4" 1.8 "RAID" "Terrasse Malakor" "Souverain de l Abime"
VideoClip (Join-Path $vid "02-raid.mp4") "07-raid.mp4" 5.0 7.2
StillClip (Join-Path $cap "10-zoom-raid-malakor.png") "08-malakor.mp4" 2.3
StillClip (Join-Path $cap "11-zoom-raid-tyran.png") "09-tyran.mp4" 2.0
StillClip (Join-Path $cap "12-zoom-armures.png") "10-armures.mp4" 2.3
StillClip (Join-Path $root "preview\armures-abime.png") "11-armprev.mp4" 2.0
TitleCard "12-rushtitle.mp4" 1.7 "BATAILLE x2" "Vitesse double" "Mode fun"
VideoClip (Join-Path $vid "03-bataille-x2.mp4") "13-rush.mp4" 6.0 7.2
StillClip (Join-Path $cap "06-bataille-x2.png") "14-rushstill.mp4" 2.0
StillClip (Join-Path $cap "05-mini-boss.png") "15-miniboss.mp4" 2.0

Write-Host "3 end card"
$endVf = "drawtext=fontfile=${fontB}:text='SHADOW.io':fontsize=70:fontcolor=0xe7c56a:x=(w-text_w)/2:y=160:shadowcolor=black:shadowx=2:shadowy=2,drawtext=fontfile=${font}:text='Bataille royale   ·   Raid   ·   Bataille x2':fontsize=28:fontcolor=0xefe7d6:x=(w-text_w)/2:y=280,drawtext=fontfile=${font}:text='Leve une armee d ombres. Survits. Tue le Monarque.':fontsize=24:fontcolor=0x5ad4ff:x=(w-text_w)/2:y=340,drawtext=fontfile=${font}:text='Musique  ·  Emilio Rudoy  ·  @emiliorudoy':fontsize=20:fontcolor=0xb9ad96:x=(w-text_w)/2:y=520,fade=t=in:st=0:d=0.45,fade=t=out:st=4.1:d=0.7,format=yuv420p"
Run-Ff @("-y","-f","lavfi","-i","color=c=0x07080c:s=1280x720:d=4.8","-vf",$endVf,"-c:v","libx264","-pix_fmt","yuv420p","-preset","veryfast","-crf","18","-an",(Join-Path $work "16-end.mp4"))

$list = Join-Path $work "concat.txt"
@(
  "file '01-open.mp4'",
  "file '02-menu.mp4'",
  "file '03-br.mp4'",
  "file '04-coffre.mp4'",
  "file '05-brstill.mp4'",
  "file '06-raidtitle.mp4'",
  "file '07-raid.mp4'",
  "file '08-malakor.mp4'",
  "file '09-tyran.mp4'",
  "file '10-armures.mp4'",
  "file '11-armprev.mp4'",
  "file '12-rushtitle.mp4'",
  "file '13-rush.mp4'",
  "file '14-rushstill.mp4'",
  "file '15-miniboss.mp4'",
  "file '16-end.mp4'"
) | Set-Content -Encoding ASCII $list

$silent = Join-Path $work "silent.mp4"
Write-Host "4 concat"
Run-Ff @("-y","-f","concat","-safe","0","-i",$list,"-c","copy",$silent)

$out = Join-Path $vid "00-bande-annonce.mp4"
$theme = Join-Path $root "audio\theme.mp3"
Write-Host "5 mix music"
# duration via ffprobe after concat
$fp = "C:\Users\J\AppData\Local\Programs\LNV\Stremio-4\ffprobe.exe"
$dur = [double](& $fp -v error -show_entries format=duration -of default=nw=1:nk=1 $silent)
$fadeStart = [Math]::Max(0, $dur - 2.8)
$afilter = "volume=0.72,afade=t=in:st=0:d=1.1,afade=t=out:st=${fadeStart}:d=2.6"
Run-Ff @("-y","-i",$silent,"-i",$theme,"-filter_complex","[1:a]$afilter[a]","-map","0:v","-map","[a]","-t","$dur","-c:v","copy","-c:a","aac","-b:a","192k","-shortest",$out)

Write-Host "DONE $out size=$((Get-Item $out).Length) dur=$dur"
