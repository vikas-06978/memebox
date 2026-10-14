# Read-only static preview on loopback. No elevated privileges, installs, secrets or policy changes.
$ErrorActionPreference = 'Stop'
$reviewRoot = $env:MEMEBOX_REVIEW_ROOT
if (-not $reviewRoot) { $reviewRoot = $PSScriptRoot }
$roomRoot = [IO.Path]::GetFullPath((Join-Path $reviewRoot 'music-room'))
$prefix = $roomRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8'; '.png'='image/png'; '.ico'='image/x-icon' }
$listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 8790)
try {
  $listener.Start()
  Write-Host 'MemeBox: http://127.0.0.1:8790/music-room.html'
  Write-Host 'Keep this window open. Close it or press Ctrl+C to stop the local server.'
  Start-Process 'http://127.0.0.1:8790/music-room.html'
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $null
    try {
      $stream = $client.GetStream(); $stream.ReadTimeout = 3000; $stream.WriteTimeout = 3000
      $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
      $line = $reader.ReadLine()
      if (-not $line -or $line.Length -gt 8192) { continue }
      $parts = $line.Split(' ')
      if ($parts.Length -ne 3) { continue }
      $headerBytes = $line.Length
      do { $header = $reader.ReadLine(); if ($null -ne $header) { $headerBytes += $header.Length }; if ($headerBytes -gt 16384) { throw 'Request too large' } } while ($header)
      $method = $parts[0]; $route = [Uri]::UnescapeDataString($parts[1].Split('?')[0])
      if ($route -eq '/') { $route = '/music-room.html' }
      $body = [Text.Encoding]::UTF8.GetBytes('Not found'); $status = '404 Not Found'; $contentType = 'text/plain; charset=utf-8'
      if ($method -notin @('GET','HEAD')) { $status = '405 Method Not Allowed'; $body = [Text.Encoding]::UTF8.GetBytes('Read-only preview') }
      elseif ($route -notmatch '[\x00-\x1f]' -and $route -notmatch '\\') {
        $file = [IO.Path]::GetFullPath((Join-Path $roomRoot $route.TrimStart('/')))
        $extension = [IO.Path]::GetExtension($file).ToLowerInvariant()
        if ($file.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) -and $types.ContainsKey($extension) -and [IO.File]::Exists($file)) {
          $body = [IO.File]::ReadAllBytes($file); $status = '200 OK'; $contentType = $types[$extension]
        }
      }
      $response = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nReferrer-Policy: strict-origin-when-cross-origin`r`nContent-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src https://www.youtube-nocookie.com; connect-src 'self' http://127.0.0.1:8789; object-src 'none'; base-uri 'self'`r`n`r`n"
      $bytes = [Text.Encoding]::ASCII.GetBytes($response); $stream.Write($bytes,0,$bytes.Length)
      if ($method -ne 'HEAD') { $stream.Write($body,0,$body.Length) }
      $stream.Flush()
    } catch { Write-Host 'A preview request was closed or refused.' }
    finally { if ($stream) { $stream.Dispose() }; $client.Close() }
  }
} finally { $listener.Stop() }
