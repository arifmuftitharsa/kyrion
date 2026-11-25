# Pembangkit lalu lintas simulasi untuk D-1..D-3 (Tugas 7). Dipakai dengan dot-source:
#   . .\security\detection\simulasi.ps1
#   Invoke-SimulasiLaluLintas -Skenario D-1 -Mode benign
# ETIKA: hanya ke VM milik sendiri. Target terkunci ke 192.168.56.101 dan kyrion.test; target lain ditolak.
# Data sintetis (uji@contoh.invalid). Jangan menyalin fungsi ini untuk sistem milik orang lain.

Set-Variable -Name SimulasiAlamat -Value '192.168.56.101' -Option ReadOnly -Scope Script -Force
Set-Variable -Name SimulasiNamaHost -Value 'kyrion.test' -Option ReadOnly -Scope Script -Force
Set-Variable -Name SimulasiCa -Value 'C:\Projects\kyrion-ca\ca.crt' -Option ReadOnly -Scope Script -Force

# Nilai ditulis literal di sini, sehingga mengubah variabel di atas tidak membuka target lain.
function Assert-TargetSimulasi([string]$Alamat, [string]$NamaHost) {
  if ($Alamat -cne '192.168.56.101' -or $NamaHost -cne 'kyrion.test') {
    throw "Target ditolak: '$Alamat' / '$NamaHost'. Simulasi hanya untuk 192.168.56.101 dan kyrion.test (VM milik sendiri)."
  }
}

function Get-WaktuUtc { (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') }

# 'Continue' lokal: di PowerShell 5.1 stderr program yang dialihkan menjadi galat penghenti bila 'Stop'.
# --noproxy mencegah permintaan dibelokkan ke proxy; pengalihan (307) tidak diikuti.
function Invoke-RequestSimulasi {
  param(
    [string]$Urutan, [string]$Metode, [string]$Jalur, [string[]]$Opsi = @(),
    [string]$Alamat = $SimulasiAlamat, [string]$NamaHost = $SimulasiNamaHost
  )
  Assert-TargetSimulasi $Alamat $NamaHost
  $ErrorActionPreference = 'Continue'
  $keluaran = @(& curl.exe -sS --max-time 20 --noproxy '*' -o NUL -w '%{http_code}' `
    --resolve "${NamaHost}:443:$Alamat" --cacert $SimulasiCa --ssl-no-revoke @Opsi "https://$NamaHost$Jalur" 2>&1 |
    ForEach-Object { "$_" })
  $kodeCurl = $LASTEXITCODE
  [pscustomobject]@{
    Status = if ($kodeCurl -eq 0) { "$($keluaran[-1])" } else { 'gagal' }
    Baris  = "$(Get-WaktuUtc) [$Urutan] $Metode $Jalur -> HTTP $($keluaran -join ' | ')" +
      $(if ($kodeCurl -ne 0) { " BELUM TERBUKTI: curl kode $kodeCurl" })
  }
}

function Get-RingkasanStatus($Hasil) {
  $per = @($Hasil | Group-Object Status | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Count)" })
  "hitungan: $(@($Hasil).Count) request; per status: $($per -join ', ')"
}

function Send-PostBerulang {
  param([int]$Jumlah, [string]$Jalur, [scriptblock]$Badan)
  $berkas = [System.IO.Path]::GetTempFileName()
  try {
    foreach ($i in 1..$Jumlah) {
      $opsi = @('-X', 'POST', '-H', 'Origin: https://kyrion.test')
      if ($Badan) {
        # Badan lewat berkas: PowerShell 5.1 menghilangkan tanda kutip pada argumen program luar.
        [System.IO.File]::WriteAllText($berkas, (& $Badan), [System.Text.Encoding]::ASCII)
        $opsi += @('-H', 'Content-Type: application/json', '--data-binary', "@$berkas")
      }
      Invoke-RequestSimulasi -Urutan "$i/$Jumlah" -Metode 'POST' -Jalur $Jalur -Opsi $opsi
    }
  } finally {
    Remove-Item $berkas
  }
}

function Send-GetBerulang([int]$Jumlah, [string]$Jalur) {
  foreach ($i in 1..$Jumlah) { Invoke-RequestSimulasi -Urutan "$i/$Jumlah" -Metode 'GET' -Jalur $Jalur }
}

function Send-TebakOtp([int]$Jumlah) {
  Send-PostBerulang -Jumlah $Jumlah -Jalur '/api/auth/sign-in/email-otp' -Badan {
    '{{"email":"uji@contoh.invalid","otp":"{0:D6}"}}' -f (Get-Random -Minimum 0 -Maximum 1000000)
  }
}

function Send-ApprovalTanpaSesi([int]$Jumlah) {
  Send-PostBerulang -Jumlah $Jumlah -Jalur '/api/v1/regulations/uji/versions/uji/approval'
}

function Invoke-PindaiPortSimulasi {
  param([int[]]$Port, [string]$Alamat = $SimulasiAlamat)
  Assert-TargetSimulasi $Alamat $SimulasiNamaHost
  $ErrorActionPreference = 'Continue'
  $pakaiNmap = [bool](Get-Command nmap -ErrorAction SilentlyContinue)
  $alat = if ($pakaiNmap) { 'nmap -sT -Pn -n --max-retries 0' } else { 'TcpClient async, timeout 500 ms' }
  "$(Get-WaktuUtc) koneksi ke $($Port.Count) port ($($Port -join ',')) di $Alamat, alat: $alat"
  $jam = [System.Diagnostics.Stopwatch]::StartNew()
  if ($pakaiNmap) {
    # Deret berurutan ditulis sebagai rentang (9001-9030), selain itu sebagai daftar.
    $berurutan = $Port.Count -gt 2 -and ($Port[-1] - $Port[0] + 1) -eq $Port.Count
    $spek = if ($berurutan) { "$($Port[0])-$($Port[-1])" } else { $Port -join ',' }
    & nmap -sT -Pn -n --max-retries 0 -p $spek $Alamat 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) { "BELUM TERBUKTI: nmap kode keluar $LASTEXITCODE" }
  } else {
    $terhubung = @()
    foreach ($p in $Port) {
      $klien = New-Object System.Net.Sockets.TcpClient
      try {
        if ($klien.ConnectAsync($Alamat, $p).Wait(500) -and $klien.Connected) { $terhubung += $p }
      } catch [System.AggregateException] {
        # Ditolak atau tidak terjangkau: port tidak terhubung, pindaian dilanjutkan.
      } finally {
        $klien.Close()
      }
    }
    "port dicoba: $($Port.Count), terhubung: $($terhubung.Count) $($terhubung -join ',')"
  }
  "$(Get-WaktuUtc) koneksi port selesai, durasi $([math]::Round($jam.Elapsed.TotalSeconds, 1)) detik"
}

# Mencetak baris tiap request lalu hitungannya.
function Write-HasilRequest($Hasil) {
  $Hasil | ForEach-Object { $_.Baris }
  Get-RingkasanStatus $Hasil
}

function Invoke-SimulasiLaluLintas {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('D-1', 'D-2', 'D-3')][string]$Skenario,
    [Parameter(Mandatory = $true)][ValidateSet('serangan', 'benign')][string]$Mode,
    [string]$Alamat = $SimulasiAlamat, [string]$NamaHost = $SimulasiNamaHost
  )
  Assert-TargetSimulasi $Alamat $NamaHost
  "$(Get-WaktuUtc) awal lalu lintas: $Skenario $Mode ke $NamaHost ($Alamat)"
  switch ("$Skenario $Mode") {
    'D-1 serangan' { Write-HasilRequest @(Send-TebakOtp 30) }
    'D-1 benign'   { Write-HasilRequest @(Send-TebakOtp 3) }
    'D-2 serangan' { Write-HasilRequest @(Send-ApprovalTanpaSesi 15) }
    'D-2 benign'   { Write-HasilRequest (@(Send-GetBerulang 20 '/admin') + @(Send-ApprovalTanpaSesi 3)) }
    'D-3 serangan' { Invoke-PindaiPortSimulasi -Port (9001..9030) }
    'D-3 benign'   {
      Invoke-PindaiPortSimulasi -Port 9001, 9002
      Write-HasilRequest @(Send-GetBerulang 1 '/')
    }
  }
  "$(Get-WaktuUtc) akhir lalu lintas: $Skenario $Mode"
}
