# Periksa sumber log untuk aturan deteksi (Tugas 7). Dijalankan Arif dari PowerShell 5.1:
#   .\deploy\uji\07-deteksi-periksa.ps1
# Urutan: lalu lintas uji dari laptop (dua port tertutup dan satu SSH gagal ke VM sendiri), lalu pemeriksaan di VM.
# Hasil: security\bukti\07-deteksi-periksa.txt. Tinjau isinya (journal sshd memuat IP dan sidik jari kunci) sebelum
# di-commit. ssh meminta passphrase, sudo meminta kata sandi; tidak disimpan.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$akar    = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bukti   = Join-Path $akar 'security\bukti\07-deteksi-periksa.txt'
$remote  = '/tmp/kyrion-uji-07'
$alamat  = '192.168.56.101'
$userUji = 'uji-tidak-ada'
if (Test-Path $bukti) { throw "Berkas bukti sudah ada, tidak ditimpa: $bukti" }
$hash = (& git -C $akar rev-parse --short HEAD).Trim()

function Get-WaktuUtc { (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') }

function Test-PortTertutup([int]$Port) {
  try {
    $hasil = Test-NetConnection -ComputerName $alamat -Port $Port -WarningAction SilentlyContinue
    "$(Get-WaktuUtc) Test-NetConnection ${alamat}:$Port -> TcpTestSucceeded=$($hasil.TcpTestSucceeded)"
  } catch {
    "$(Get-WaktuUtc) BELUM TERBUKTI: Test-NetConnection ${alamat}:$Port gagal: $($_.Exception.Message)"
  }
}

# Sengaja gagal. 'Continue' lokal: di PowerShell 5.1 stderr ssh yang dialihkan menjadi galat penghenti bila 'Stop'.
function Test-SshGagal {
  $ErrorActionPreference = 'Continue'
  "$(Get-WaktuUtc) ssh -o BatchMode=yes -o ConnectTimeout=10 $userUji@$alamat"
  $keluaran = @(& ssh -o BatchMode=yes -o ConnectTimeout=10 "$userUji@$alamat" exit 2>&1 | ForEach-Object { "$_" })
  $kodeSsh = $LASTEXITCODE
  $keluaran
  "kode keluar ssh: $kodeSsh"
  if ($keluaran.Count -eq 0) { 'BELUM TERBUKTI: ssh tidak menghasilkan keluaran' }
}

& ssh kyrion-staging rm -rf $remote
& ssh kyrion-staging mkdir -p $remote
if ($LASTEXITCODE -ne 0) { throw 'ssh mkdir gagal' }
& scp (Join-Path $akar 'deploy\uji\07-deteksi-periksa-vm.sh') "kyrion-staging:$remote/"
if ($LASTEXITCODE -ne 0) { throw 'scp skrip gagal' }

# Dilakukan sebelum skrip VM agar sudah ada di journal saat skrip VM membacanya (jendela 10 menit).
Write-Host 'Lalu lintas uji dari laptop (port tertutup dapat memakan puluhan detik)...'
$laptop = @('== 4. lalu lintas uji dari laptop (sebelum skrip VM)') +
  (Test-PortTertutup 8081) + (Test-PortTertutup 8082) + (Test-SshGagal)
$laptop | ForEach-Object { Write-Host $_ }

& ssh -t kyrion-staging sudo bash "$remote/07-deteksi-periksa-vm.sh"
$kode = $LASTEXITCODE

$tmp = Join-Path $env:TEMP 'kyrion-07-periksa.txt'
$tersalin = $false
foreach ($percobaan in 1..3) {
  & scp "kyrion-staging:$remote/keluaran-periksa.txt" $tmp
  if ($LASTEXITCODE -eq 0) { $tersalin = $true; break }
  Write-Host "scp hasil gagal (percobaan $percobaan dari 3)"
  if ($percobaan -lt 3) { Start-Sleep -Seconds 3 }
}
if (-not $tersalin) {
  # Folder di VM sengaja tidak dihapus agar hasil masih dapat diambil.
  Write-Host 'Salin manual:'
  Write-Host "scp kyrion-staging:$remote/keluaran-periksa.txt `"$tmp`""
  throw 'scp keluaran gagal; bukti belum disimpan (hasil butir 4 hanya tercetak di layar ini)'
}
& ssh kyrion-staging rm -rf $remote

$tanggal = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss') + ' UTC'
$kepala = @(
  '# Bukti pemeriksaan sumber log deteksi (Tugas 7)',
  "# Tanggal: $tanggal",
  "# Hash commit: $hash",
  '# Perintah: .\deploy\uji\07-deteksi-periksa.ps1 (ssh -t kyrion-staging sudo bash 07-deteksi-periksa-vm.sh)',
  "# Kode keluar skrip VM: $kode",
  ''
) + $laptop + @('')
$isi = ([System.IO.File]::ReadAllText($tmp)) -replace "`r", ''
[System.IO.File]::WriteAllText($bukti, ($kepala -join "`n") + "`n" + $isi, (New-Object System.Text.UTF8Encoding($false)))
Remove-Item $tmp
Write-Host "Bukti disimpan: $bukti"
