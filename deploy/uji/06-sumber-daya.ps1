# Bukti sumber daya VM untuk Tugas 6 (free -m, df -h, docker system df). Dijalankan Arif sekali dari PowerShell 5.1.
#   .\deploy\uji\06-sumber-daya.ps1
# Hanya membaca di VM. ssh meminta passphrase dan sudo meminta kata sandi; keduanya tidak disimpan.
$ErrorActionPreference = 'Stop'
$akar   = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bukti  = Join-Path $akar 'security\bukti\vm-sumber-daya.txt'
$remote = '/tmp/kyrion-uji-06'
if (Test-Path $bukti) { throw "Berkas bukti sudah ada, tidak ditimpa: $bukti" }
$hash = (& git -C $akar rev-parse --short HEAD).Trim()

& ssh kyrion-staging mkdir -p $remote
if ($LASTEXITCODE -ne 0) { throw 'ssh mkdir gagal' }
& scp (Join-Path $akar 'deploy\uji\06-sumber-daya-vm.sh') "kyrion-staging:$remote/"
if ($LASTEXITCODE -ne 0) { throw 'scp gagal' }
& ssh -t kyrion-staging sudo bash "$remote/06-sumber-daya-vm.sh"
$kode = $LASTEXITCODE
$tmp = Join-Path $env:TEMP 'kyrion-06.txt'
& scp "kyrion-staging:$remote/keluaran.txt" $tmp
if ($LASTEXITCODE -ne 0) { throw 'scp keluaran gagal' }
& ssh kyrion-staging rm -rf $remote

$tanggal = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss') + ' UTC'
$kepala = @(
  '# Bukti sumber daya VM (Tugas 6)',
  "# Tanggal: $tanggal",
  "# Hash commit: $hash",
  '# Perintah: ssh -t kyrion-staging sudo bash 06-sumber-daya-vm.sh (free -m, df -h, docker system df, docker stats, timedatectl)',
  "# Kode keluar: $kode",
  ''
) -join "`n"
$isi = ([System.IO.File]::ReadAllText($tmp)) -replace "`r", ''
[System.IO.File]::WriteAllText($bukti, $kepala + "`n" + $isi, (New-Object System.Text.UTF8Encoding($false)))
Remove-Item $tmp
Write-Host "Bukti disimpan: $bukti"
