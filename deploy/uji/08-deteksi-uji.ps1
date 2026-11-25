# Uji query kandidat deteksi D-1..D-3 (Tugas 7). Dijalankan Arif dari PowerShell 5.1:
#   .\deploy\uji\08-deteksi-uji.ps1
# Urutan: lalu lintas sintetis dari laptop ke VM sendiri (tiga request HTTPS, pindai 30 port tertutup), lalu
# pemeriksaan di VM. Hasil: security\bukti\08-deteksi-uji.txt. ssh meminta passphrase, sudo meminta kata sandi;
# tidak disimpan.
$ErrorActionPreference = 'Stop'
$akar   = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bukti  = Join-Path $akar 'security\bukti\08-deteksi-uji.txt'
$remote = '/tmp/kyrion-uji-08'
$alamat = '192.168.56.101'
$ca     = 'C:\Projects\kyrion-ca\ca.crt'
$port   = 9001..9030
if (Test-Path $bukti) { throw "Berkas bukti sudah ada, tidak ditimpa: $bukti" }
if (-not (Test-Path $ca)) { throw "Sertifikat CA tidak ada: $ca" }
$hash = (& git -C $akar rev-parse --short HEAD).Trim()

function Get-WaktuUtc { (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') }

# 'Continue' lokal: di PowerShell 5.1 stderr program yang dialihkan menjadi galat penghenti bila 'Stop'.
function Invoke-RequestUji([string]$Label, [string]$Jalur, [string[]]$Opsi = @()) {
  $ErrorActionPreference = 'Continue'
  $keluaran = @(& curl.exe -sS --max-time 20 -o NUL -w 'HTTP %{http_code}' `
    --resolve "kyrion.test:443:$alamat" --cacert $ca --ssl-no-revoke @Opsi "https://kyrion.test$Jalur" 2>&1 |
    ForEach-Object { "$_" })
  $kodeCurl = $LASTEXITCODE
  "$(Get-WaktuUtc) $Label $Jalur -> $($keluaran -join ' | ')"
  if ($kodeCurl -ne 0) { "BELUM TERBUKTI: $Label $Jalur (curl kode $kodeCurl)" }
}

function Invoke-LaluLintasHttp {
  # Badan JSON lewat berkas: PowerShell 5.1 menghilangkan tanda kutip pada argumen program luar.
  $badan = Join-Path $env:TEMP 'kyrion-08-otp.json'
  [System.IO.File]::WriteAllText($badan, '{"email":"uji@contoh.invalid","otp":"000000"}', [System.Text.Encoding]::ASCII)
  $origin = @('-H', 'Origin: https://kyrion.test')
  try {
    Invoke-RequestUji 'GET' '/admin'
    Invoke-RequestUji 'POST' '/api/v1/regulations/uji/versions/uji/approval' (@('-X', 'POST') + $origin)
    Invoke-RequestUji 'POST' '/api/auth/sign-in/email-otp' (
      @('-X', 'POST', '-H', 'Content-Type: application/json', '--data-binary', "@$badan") + $origin)
  } finally {
    Remove-Item $badan
  }
}

function Invoke-PindaiNmap {
  $ErrorActionPreference = 'Continue'
  # -Pn dan -n: tanpa penemuan host dan DNS, agar pindaian tidak batal bila ping tidak dijawab.
  & nmap -sT -Pn -n --max-retries 0 -p "$($port[0])-$($port[-1])" $alamat 2>&1 | ForEach-Object { "$_" }
  if ($LASTEXITCODE -ne 0) { "BELUM TERBUKTI: nmap kode keluar $LASTEXITCODE" }
}

function Invoke-PindaiTcpClient {
  $terhubung = @()
  foreach ($p in $port) {
    $klien = New-Object System.Net.Sockets.TcpClient
    try {
      $tugas = $klien.ConnectAsync($alamat, $p)
      if ($tugas.Wait(500) -and $klien.Connected) { $terhubung += $p }
    } catch [System.AggregateException] {
      # Ditolak atau tidak terjangkau: port tidak terhubung, pindaian dilanjutkan.
    } finally {
      $klien.Close()
    }
  }
  "port dicoba: $($port.Count), terhubung: $($terhubung.Count) $($terhubung -join ',')"
}

function Invoke-PindaiPort {
  $pakaiNmap = [bool](Get-Command nmap -ErrorAction SilentlyContinue)
  $alat = if ($pakaiNmap) { 'nmap -sT --max-retries 0' } else { 'TcpClient async, timeout 500 ms' }
  "$(Get-WaktuUtc) pindai port $($port[0])-$($port[-1]) di $alamat, alat: $alat"
  $jam = [System.Diagnostics.Stopwatch]::StartNew()
  if ($pakaiNmap) { Invoke-PindaiNmap } else { Invoke-PindaiTcpClient }
  "$(Get-WaktuUtc) pindai selesai, durasi $([math]::Round($jam.Elapsed.TotalSeconds, 1)) detik"
}

& ssh kyrion-staging rm -rf $remote
& ssh kyrion-staging mkdir -p $remote
if ($LASTEXITCODE -ne 0) { throw 'ssh mkdir gagal' }
& scp (Join-Path $akar 'deploy\uji\08-deteksi-uji-vm.sh') "kyrion-staging:$remote/"
if ($LASTEXITCODE -ne 0) { throw 'scp skrip gagal' }

Write-Host 'Lalu lintas uji dari laptop...'
$awal = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$laptop = @("== A. lalu lintas uji dari laptop; waktu awal $(Get-WaktuUtc) (epoch $awal)") +
  @(Invoke-LaluLintasHttp) + @(Invoke-PindaiPort)
$laptop | ForEach-Object { Write-Host $_ }

# Query VM memakai jendela 15 menit: masukkan passphrase dan kata sandi sudo tanpa menunda lama.
& ssh -t kyrion-staging sudo bash "$remote/08-deteksi-uji-vm.sh" $awal
$kode = $LASTEXITCODE

$tmp = Join-Path $env:TEMP 'kyrion-08-uji.txt'
$tersalin = $false
foreach ($percobaan in 1..3) {
  & scp "kyrion-staging:$remote/keluaran-uji.txt" $tmp
  if ($LASTEXITCODE -eq 0) { $tersalin = $true; break }
  Write-Host "scp hasil gagal (percobaan $percobaan dari 3)"
  if ($percobaan -lt 3) { Start-Sleep -Seconds 3 }
}
if (-not $tersalin) {
  # Folder di VM sengaja tidak dihapus agar hasil masih dapat diambil.
  Write-Host 'Salin manual:'
  Write-Host "scp kyrion-staging:$remote/keluaran-uji.txt `"$tmp`""
  throw 'scp keluaran gagal; bukti belum disimpan (hasil bagian A hanya tercetak di layar ini)'
}
& ssh kyrion-staging rm -rf $remote

$tanggal = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss') + ' UTC'
$kepala = @(
  '# Bukti uji query deteksi (Tugas 7)',
  "# Tanggal: $tanggal",
  "# Hash commit: $hash",
  '# Perintah: .\deploy\uji\08-deteksi-uji.ps1 (ssh -t kyrion-staging sudo bash 08-deteksi-uji-vm.sh <waktu-awal>)',
  "# Kode keluar skrip VM: $kode",
  ''
) + $laptop + @('')
$isi = ([System.IO.File]::ReadAllText($tmp)) -replace "`r", ''
[System.IO.File]::WriteAllText($bukti, ($kepala -join "`n") + "`n" + $isi, (New-Object System.Text.UTF8Encoding($false)))
Remove-Item $tmp
Write-Host "Bukti disimpan: $bukti"
