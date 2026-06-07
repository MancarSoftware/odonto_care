Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $root "apps\desktop\public"
$outputPath = Join-Path $outputDirectory "icon.png"
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$size = 512
$bitmap = New-Object System.Drawing.Bitmap($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

function New-RoundedRectanglePath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc(
    $X + $Width - $diameter,
    $Y + $Height - $diameter,
    $diameter,
    $diameter,
    0,
    90
  )
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

$backgroundPath = New-RoundedRectanglePath 28 28 456 456 104
$backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point 70, 60),
  (New-Object System.Drawing.Point 440, 460),
  [System.Drawing.Color]::FromArgb(255, 57, 130, 246),
  [System.Drawing.Color]::FromArgb(255, 22, 163, 210)
)
$graphics.FillPath($backgroundBrush, $backgroundPath)

$tooth = New-Object System.Drawing.Drawing2D.GraphicsPath
$tooth.StartFigure()
$tooth.AddBezier(170, 150, 143, 176, 154, 225, 180, 257)
$tooth.AddBezier(180, 257, 193, 274, 187, 358, 222, 378)
$tooth.AddBezier(222, 378, 253, 395, 244, 303, 256, 286)
$tooth.AddBezier(256, 286, 268, 303, 259, 395, 290, 378)
$tooth.AddBezier(290, 378, 325, 358, 319, 274, 332, 257)
$tooth.AddBezier(332, 257, 358, 225, 369, 176, 342, 150)
$tooth.AddBezier(342, 150, 317, 126, 284, 148, 256, 158)
$tooth.AddBezier(256, 158, 228, 148, 195, 126, 170, 150)
$tooth.CloseFigure()
$toothBrush = New-Object System.Drawing.SolidBrush(
  [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
)
$graphics.FillPath($toothBrush, $tooth)

$smile = New-Object System.Drawing.Drawing2D.GraphicsPath
$smile.AddBezier(211, 232, 231, 260, 281, 260, 301, 232)
$smilePen = New-Object System.Drawing.Pen(
  [System.Drawing.Color]::FromArgb(255, 52, 120, 246),
  13
)
$smilePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$smilePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawPath($smilePen, $smile)

$accentBrush = New-Object System.Drawing.SolidBrush(
  [System.Drawing.Color]::FromArgb(255, 45, 212, 191)
)
$graphics.FillEllipse($accentBrush, 342, 104, 54, 54)
$accentPen = New-Object System.Drawing.Pen(
  [System.Drawing.Color]::White,
  8
)
$accentPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$accentPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($accentPen, 369, 116, 369, 146)
$graphics.DrawLine($accentPen, 354, 131, 384, 131)

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$accentPen.Dispose()
$accentBrush.Dispose()
$smilePen.Dispose()
$smile.Dispose()
$toothBrush.Dispose()
$tooth.Dispose()
$backgroundBrush.Dispose()
$backgroundPath.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output "Icono generado en $outputPath"
