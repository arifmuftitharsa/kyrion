<#
.SYNOPSIS
  Uji akses Kyrion v0.3 terhadap dev server nyata (bukti B1/B3, Tugas 3 PAW).

.DESCRIPTION
  Dijalankan ARIF di Windows PowerShell 5.1 memakai curl.exe. Satu tahap per eksekusi:
    .\uji-akses-v0.3.ps1 -Peran anonim  -Slug <slug> -VersiSah <id> -VersiDraf <id>
    .\uji-akses-v0.3.ps1 -Peran sivitas -Slug <slug> -VersiDraf <id>
    .\uji-akses-v0.3.ps1 -Peran admin   -Slug <slug> -VersiSah <id> -VersiDraf <id> -VersiLain <id>
    .\uji-akses-v0.3.ps1 -Peran 503     -Slug <slug> -VersiDraf <id> -Konfirmasi   # lihat peringatan 503 di bawah
    .\uji-akses-v0.3.ps1 -Peran pemilik -Konfirmasi        # paling akhir, merusak satu sesi
  -VersiLain = ID versi milik regulasi LAIN dari -Slug. ID bukan rahasia.

  CATATAN PENTING
  - Batas laju OTP: 3 permintaan per menit per jalur (lib/auth/index.ts:62-68). Skrip mengirim
    paling banyak 2 permintaan OTP di seluruh eksekusi, keduanya ditolak SEBELUM email dikirim.
  - Arif login MANUAL di peramban untuk mendapat cookie (bukan dari skrip), lalu menaruhnya di
    variabel lingkungan sesi PowerShell ini saja (tidak disimpan ke berkas):
      $env:KY_COOKIE_SIVITAS  = "nama=nilai"
      $env:KY_COOKIE_SIVITAS2 = "nama=nilai"   # login kedua akun Sivitas yang SAMA
      $env:KY_COOKIE_ADMIN    = "nama=nilai"
  - JANGAN menempel isi cookie, OTP, atau keluaran log server yang memuat OTP ke chat mana pun.
  - Cookie dikirim ke curl lewat "-K -" (stdin), tidak pernah muncul di argumen, layar, atau berkas.
  - Tahap 503 dan pemilik wajib -Konfirmasi. Tahap 503: bila kunci penandatangan masih aktif, versi DRAF
    akan DISAHKAN sungguhan (pengesahan tidak dapat dibatalkan; Batalkan hanya untuk Draf); karena itu baris
    KYRION_SIGNING_KEY_FILE di .env.local harus sudah diberi # dan dev server di-restart lebih dulu.
  - Cakupan: GET, POST, DELETE. HEAD dan OPTIONS tidak diuji.
  - Berkas keluaran bukti\akses-v0.3-<peran>.txt ditimpa bila sudah ada.
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('anonim', 'sivitas', 'admin', '503', 'pemilik')]
  [string]$Peran,
  [string]$BaseUrl = 'http://localhost:3000',
  [string]$Slug,
  [string]$VersiSah,
  [string]$VersiDraf,
  [string]$VersiLain,
  [switch]$Konfirmasi
)

Set-StrictMode -Version 1
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------- konstanta

$Origin = ([uri]$BaseUrl).GetLeftPart('Authority')   # harus sama dengan origin BETTER_AUTH_URL (lib/api/origin.ts:13-16)
$OriginSalah = 'https://evil.example'
$UuidNol = '00000000-0000-0000-0000-000000000000'
$EmailLuar = 'x.luar@example.com'
$EmailKampus = 'sivitas.uji.kyrion@student.universitaspertamina.ac.id'
# Salinan konstanta PESAN_KUNCI_BELUM_SIAP (lib/domain/versi-admin.ts:83-84). Samakan bila berubah.
$PesanKunciBelumSiap = 'Pengesahan tidak dapat dilakukan: kunci penandatangan belum siap; hubungi operator.'
$KunciTerlarang = @('changeSummary', 'fileKey', 'fileName', 'fileSha256', 'integrityTag', 'signature', 'signingKeyId', 'approvedById')
$HeaderDiizinkan = @('content-type', 'content-disposition', 'content-length', 'x-content-type-options', 'cache-control', 'location')
$NamaCookie = @('KY_COOKIE_SIVITAS', 'KY_COOKIE_SIVITAS2', 'KY_COOKIE_ADMIN')
$Awalan = @{ 'anonim' = 'A'; 'sivitas' = 'S'; 'admin' = 'D'; '503' = 'X'; 'pemilik' = 'P' }[$Peran]

$script:Baris = New-Object System.Collections.Generic.List[string]
$script:Temp = New-Object System.Collections.Generic.List[string]
$script:Nomor = 0
$script:Pass = 0
$script:Fail = 0
$script:Skip = 0

# ---------------------------------------------------------------- bantuan umum

function Pendek([string]$teks) {
  # ID dipendekkan ke 8 karakter pertama di semua keluaran.
  return [regex]::Replace($teks, '([0-9a-fA-F]{8})-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '$1~')
}

function Berkas-Temp {
  $p = Join-Path $env:TEMP ('ky-uji-' + [guid]::NewGuid().ToString('N') + '.tmp')
  $script:Temp.Add($p)
  return $p
}

function Env-Ada([string]$nama) {
  return -not [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($nama))
}

# Nilai cookie masuk ke konfigurasi curl lewat stdin; satu baris dan karakter terbatas mencegah
# penyisipan opsi curl lain. \z (bukan $) karena $ di .NET masih menerima LF di akhir.
function Cookie-Valid([string]$nilai) {
  return ($nilai -cmatch '^better-auth\.session_token=[A-Za-z0-9%._~+/=\-]+\z') -and ($nilai -notmatch '[\r\n]')
}

function Wajib-Param([string[]]$nama) {
  foreach ($n in $nama) {
    $nilai = Get-Variable -Name $n -ValueOnly
    if ([string]::IsNullOrEmpty($nilai)) { throw "Parameter -$n wajib untuk -Peran $Peran." }
    if ($n -eq 'Slug') {
      if ($nilai -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') { throw "-Slug tidak berformat slug." }
    } elseif ($nilai -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
      throw "-$n harus berupa UUID."
    }
  }
}

function Wajib-Env([string[]]$nama) {
  foreach ($n in $nama) {
    if (-not (Env-Ada $n)) { throw "Variabel lingkungan $n kosong. Isi dulu (lihat petunjuk di kepala skrip)." }
  }
}

function Catat([string]$metode, [string]$path, [string]$harapan, [string]$hasil, [bool]$ok) {
  $script:Nomor++
  $id = '{0}{1:00}' -f $Awalan, $script:Nomor
  $status = if ($ok) { 'PASS' } else { 'FAIL' }
  if ($ok) { $script:Pass++ } else { $script:Fail++ }
  $baris = '{0} | {1} | {2} | {3} | harapan: {4} | hasil: {5} | {6}' -f $id, $Peran, $metode, (Pendek $path), $harapan, $hasil, $status
  $script:Baris.Add($baris)
  Write-Host $baris -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
}

function Lewati([string]$metode, [string]$path, [string]$alasan) {
  $script:Nomor++
  $script:Skip++
  $id = '{0}{1:00}' -f $Awalan, $script:Nomor
  $baris = '{0} | {1} | {2} | {3} | DILEWATI: {4}' -f $id, $Peran, $metode, (Pendek $path), $alasan
  $script:Baris.Add($baris)
  Write-Host $baris -ForegroundColor Yellow
}

function Peringatan([string]$teks) {
  $baris = 'PERINGATAN: ' + $teks
  $script:Baris.Add($baris)
  Write-Host $baris -ForegroundColor Red
}

# ---------------------------------------------------------------- curl

function Invoke-Curl {
  param(
    [string]$Metode,
    [string]$Path,
    [string]$CookieVar,
    [string]$OriginKirim,
    [string]$JsonBody,
    [switch]$BuangBody
  )
  $hdr = Berkas-Temp
  $badan = if ($BuangBody) { 'NUL' } else { Berkas-Temp }
  $a = @('-s', '-S', '--max-time', '30', '-X', $Metode, '-D', $hdr, '-o', $badan, '-w', '%{http_code}')
  if ($OriginKirim) { $a += @('-H', "Origin: $OriginKirim") }
  if ($JsonBody) {
    $fb = Berkas-Temp
    [IO.File]::WriteAllText($fb, $JsonBody, (New-Object System.Text.UTF8Encoding($false)))
    $a += @('-H', 'Content-Type: application/json', '--data-binary', "@$fb")
  }
  if ($CookieVar) { $a += @('-K', '-') }
  $a += ($BaseUrl.TrimEnd('/') + $Path)

  # Tanpa -L (redirect tidak diikuti), tanpa -v. Cookie hanya lewat stdin.
  if ($CookieVar) {
    $nilai = [Environment]::GetEnvironmentVariable($CookieVar)
    $esc = $nilai.Replace('\', '\\').Replace('"', '\"')
    $keluar = ('header = "Cookie: ' + $esc + '"') | & curl.exe @a
  } else {
    $keluar = & curl.exe @a
  }
  $kode = 0
  [void][int]::TryParse((($keluar | Out-String).Trim()), [ref]$kode)

  $h = @{}
  if (Test-Path $hdr) {
    foreach ($l in [IO.File]::ReadAllLines($hdr)) {
      if ($l -like 'HTTP/*') { $h = @{}; continue }
      $i = $l.IndexOf(':')
      if ($i -lt 1) { continue }
      $n = $l.Substring(0, $i).Trim().ToLowerInvariant()
      if ($HeaderDiizinkan -contains $n) { $h[$n] = $l.Substring($i + 1).Trim() }
    }
  }
  return [pscustomobject]@{ Status = $kode; Headers = $h; BodyFile = $badan }
}

function Uji {
  param(
    [string]$Metode,
    [string]$Path,
    [string]$Cookie,
    [string]$OriginKirim,
    [string]$Body,
    [int]$Status,
    [string]$TipeIsi,
    [string]$Lokasi,
    [hashtable]$Header,
    [switch]$TampilHeader,
    [switch]$SimpanBody
  )
  $r = Invoke-Curl -Metode $Metode -Path $Path -CookieVar $Cookie -OriginKirim $OriginKirim -JsonBody $Body -BuangBody:(-not $SimpanBody)
  $harap = @("status $Status")
  $hasil = @("status $($r.Status)")
  $ok = ($r.Status -eq $Status)

  if ($TipeIsi) {
    $v = $r.Headers['content-type']
    $harap += "Content-Type cocok $TipeIsi"
    $hasil += "Content-Type=$v"
    $ok = $ok -and ($null -ne $v) -and ($v -match $TipeIsi)
  }
  if ($Lokasi) {
    $v = $r.Headers['location']
    $harap += "Location cocok $Lokasi"
    $hasil += "Location=$v"
    $ok = $ok -and ($null -ne $v) -and ($v -match $Lokasi)
  }
  if ($Header) {
    foreach ($k in $Header.Keys) {
      $v = $r.Headers[$k.ToLowerInvariant()]
      $harap += "$k cocok $($Header[$k])"
      $hasil += "$k=$v"
      $ok = $ok -and ($null -ne $v) -and ($v -match $Header[$k])
    }
  }
  Catat $Metode $Path ($harap -join '; ') ($hasil -join '; ') $ok
  return $r
}

# ---------------------------------------------------------------- JSON dan HTML

function Telusuri-Kunci($n, $daftar) {
  if ($null -eq $n) { return }
  if (($n -is [System.Collections.IEnumerable]) -and ($n -isnot [string])) {
    foreach ($i in $n) { Telusuri-Kunci $i $daftar }
    return
  }
  if ($n -is [System.Management.Automation.PSCustomObject]) {
    foreach ($p in $n.PSObject.Properties) {
      [void]$daftar.Add($p.Name)
      Telusuri-Kunci $p.Value $daftar
    }
  }
}

# Hanya NAMA kunci (rekursif, termasuk di dalam larik); nilai tidak pernah dibaca ke keluaran.
function Kunci-Json([string]$berkas) {
  try { $o = [IO.File]::ReadAllText($berkas) | ConvertFrom-Json } catch { return $null }
  $daftar = New-Object System.Collections.Generic.List[string]
  Telusuri-Kunci $o $daftar
  return @($daftar | Sort-Object -Unique)
}

function Id-SesiSaatIni([string]$cookie) {
  $r = Invoke-Curl -Metode GET -Path '/api/v1/sessions' -CookieVar $cookie
  if ($r.Status -ne 200) { return $null }
  try { $o = [IO.File]::ReadAllText($r.BodyFile) | ConvertFrom-Json } catch { return $null }
  foreach ($s in @($o.data)) { if ($s.current -eq $true) { return [string]$s.id } }
  return $null
}

function Periksa-Terlarang([string]$path, $r) {
  $k = Kunci-Json $r.BodyFile
  if ($null -eq $k) { Catat 'GET' $path 'badan JSON terbaca' 'badan bukan JSON' $false; return }
  $ada = @($k | Where-Object { $KunciTerlarang -contains $_ })
  Catat 'GET' $path 'tanpa kunci terlarang pada kedalaman mana pun' ("kunci: " + ($k -join ',') + '; terlarang ditemukan: ' + $(if ($ada.Count -eq 0) { 'tidak ada' } else { $ada -join ',' })) ($ada.Count -eq 0)
}

function Hitung-Berkas([string]$berkas) {
  return ([regex]::Matches([IO.File]::ReadAllText($berkas), '/berkas')).Count
}

# ---------------------------------------------------------------- tahap

function Tahap-Anonim {
  Wajib-Param @('Slug', 'VersiSah', 'VersiDraf')
  $S = $Slug

  # proxy.ts:17-19 mengecualikan /masuk dan /api; app/masuk/page.tsx:10-12 menampilkan formulir bagi anonim.
  [void](Uji -Metode GET -Path '/masuk' -Status 200)
  # proxy.ts:8-13: tanpa cookie sesi -> redirect(new URL("/masuk", request.url)), 307 dengan Location mutlak.
  foreach ($p in @('/', "/regulasi/$S", '/akun/sesi', '/admin/verifikasi', "/admin/regulasi/$S/versi/$VersiSah/berkas")) {
    [void](Uji -Metode GET -Path $p -Status 307 -Lokasi '/masuk$' -TampilHeader)
  }
  # lib/akses/jaga-route.ts:17-21 (bentuk problem) dan lib/api/masalah.ts:42,52: 401 application/problem+json.
  [void](Uji -Metode GET -Path '/api/v1/regulations' -Status 401 -TipeIsi 'application/problem\+json')
  [void](Uji -Metode GET -Path '/api/v1/sessions' -Status 401 -TipeIsi 'application/problem\+json')
  # app/api/v1/sessions/[id]/route.ts:14-17: Origin diperiksa SEBELUM jagaRoute; lib/api/origin.ts:9-18:
  # Origin harus sama persis, tanpa Origin = 403. Origin sah + anonim -> jagaRoute 401.
  [void](Uji -Metode DELETE -Path "/api/v1/sessions/$UuidNol" -OriginKirim $Origin -Status 401 -TipeIsi 'application/problem\+json')
  [void](Uji -Metode DELETE -Path "/api/v1/sessions/$UuidNol" -Status 403 -TipeIsi 'application/problem\+json')
  [void](Uji -Metode DELETE -Path "/api/v1/sessions/$UuidNol" -OriginKirim $OriginSalah -Status 403 -TipeIsi 'application/problem\+json')
  # app/api/v1/regulations/[slug]/versions/[versionId]/approval/route.ts:27-30: Origin lalu jagaRoute("admin").
  [void](Uji -Metode POST -Path "/api/v1/regulations/$S/versions/$VersiDraf/approval" -OriginKirim $Origin -Status 401 -TipeIsi 'application/problem\+json')
  # app/api/[[...jalur]]/route.ts (uji: route.test.ts:11-20): jalur /api tak dikenal -> 404 problem+json.
  [void](Uji -Metode GET -Path '/api/v1/tidak-ada' -Status 404 -TipeIsi 'application/problem\+json')
  # lib/auth/izin.ts:6-9 hanya mengizinkan POST /email-otp/send-verification-otp dan POST /sign-in/email-otp;
  # lib/auth/index.ts:88-90 melempar NOT_FOUND untuk selainnya. Origin dikirim agar pemeriksaan asal
  # Better Auth (belum pasti berlaku tanpa cookie) tidak menutupi hasil.
  [void](Uji -Metode GET -Path '/api/auth/get-session' -OriginKirim $Origin -Status 404)
  # Tanpa badan JSON responsnya 415 (Better Auth menolak tipe media lebih dulu), sehingga allowlist
  # tidak terjangkau; karena itu dikirim badan '{}' (Content-Type: application/json ditambah Invoke-Curl).
  [void](Uji -Metode POST -Path '/api/auth/sign-out' -OriginKirim $Origin -Body '{}' -Status 404)

  # OTP: hanya penolakan sebelum pengiriman (lib/auth/index.ts:93-100). Paling banyak 2 permintaan.
  $jalurOtp = '/api/auth/email-otp/send-verification-otp'
  $b1 = '{"email":"' + $EmailLuar + '","type":"sign-in"}'
  $r1 = Uji -Metode POST -Path $jalurOtp -OriginKirim $Origin -Body $b1 -Status 400 -SimpanBody
  Cek-KodeGalat $jalurOtp $r1 'EMAIL_BUKAN_KAMPUS'   # lib/auth/index.ts:93-95, lib/auth/kode-galat.ts:6
  if ($r1.Status -ne 400) {
    Peringatan 'Permintaan OTP pertama BUKAN 400: mungkin ada email terkirim. Kasus OTP berikutnya dihentikan.'
    return
  }
  # "email-verification" termasuk tipe sah skema Better Auth (routes.mjs:19-24), jadi ditolak oleh hook
  # kita (lib/auth/index.ts:96-100, kode-galat.ts:7), bukan oleh validasi skema.
  $b2 = '{"email":"' + $EmailKampus + '","type":"email-verification"}'
  $r2 = Uji -Metode POST -Path $jalurOtp -OriginKirim $Origin -Body $b2 -Status 400 -SimpanBody
  Cek-KodeGalat $jalurOtp $r2 'TIPE_OTP_TIDAK_DIDUKUNG'
  if ($r2.Status -ne 400) { Peringatan 'Permintaan OTP kedua BUKAN 400: mungkin ada email terkirim.' }
}

function Cek-KodeGalat([string]$path, $r, [string]$kodeHarapan) {
  $ok = $false
  try {
    $o = [IO.File]::ReadAllText($r.BodyFile) | ConvertFrom-Json
    $ok = ($o.code -eq $kodeHarapan)
  } catch { }
  Catat 'POST' $path "badan memuat code = $kodeHarapan" ("code sesuai: " + $(if ($ok) { 'ya' } else { 'tidak' })) $ok
}

function Tahap-Sivitas {
  Wajib-Param @('Slug', 'VersiDraf')
  Wajib-Env @('KY_COOKIE_SIVITAS')
  $S = $Slug
  $c = 'KY_COOKIE_SIVITAS'

  # app/page.tsx:26 dan app/akun/sesi/page.tsx:17 memakai wajibMasuk; keputusan.ts:11 mengizinkan SIVITAS.
  [void](Uji -Metode GET -Path '/' -Cookie $c -Status 200)
  [void](Uji -Metode GET -Path '/akun/sesi' -Cookie $c -Status 200)
  # app/regulasi/[slug]/page.tsx:77-80: tautan unduh hanya bila admin; components/VersionTimeline.tsx:43.
  $r = Uji -Metode GET -Path "/regulasi/$S" -Cookie $c -Status 200 -SimpanBody
  $n = Hitung-Berkas $r.BodyFile
  Catat 'GET' "/regulasi/$S" 'jumlah "/berkas" pada HTML = 0' "jumlah = $n" ($n -eq 0)
  # lib/sesi.ts:27-34 + lib/akses/keputusan.ts:12: SIVITAS pada syarat admin -> "tolak" -> notFound() (404).
  # Belum pasti: status 404 bisa menjadi 200 bila halaman sudah mulai streaming sebelum notFound().
  [void](Uji -Metode GET -Path '/admin/regulasi' -Cookie $c -Status 404)
  [void](Uji -Metode GET -Path '/admin/verifikasi' -Cookie $c -Status 404)
  # app/admin/regulasi/[slug]/versi/[versionId]/berkas/route.ts:13 + lib/akses/jaga-route.ts:25-31,36-41: 403 teks.
  [void](Uji -Metode GET -Path "/admin/regulasi/$S/versi/$VersiDraf/berkas" -Cookie $c -Status 403 -TipeIsi 'text/plain')

  # Endpoint 1-3: jagaRoute("masuk") (app/api/v1/regulations/**/route.ts baris 9/14); data dari
  # lib/data/regulations.ts:19-29 (omit changeSummary) dan petakan* (lib/api/*.ts) tanpa kolom berkas.
  foreach ($p in @('/api/v1/regulations', "/api/v1/regulations/$S", "/api/v1/regulations/$S/current-version")) {
    $r = Uji -Metode GET -Path $p -Cookie $c -Status 200 -TipeIsi 'application/json' -SimpanBody
    Periksa-Terlarang $p $r
  }
  # app/api/v1/sessions/route.ts:13-18 dan lib/api/sesi.ts:13-18: { data: [ { id, createdAt, expiresAt, current } ] }.
  $r = Uji -Metode GET -Path '/api/v1/sessions' -Cookie $c -Status 200 -TipeIsi 'application/json' -SimpanBody
  $k = Kunci-Json $r.BodyFile
  $harapKunci = @('createdAt', 'current', 'data', 'expiresAt', 'id')
  $okK = ($null -ne $k) -and ((@($k) -join ',') -ceq ($harapKunci -join ','))
  Catat 'GET' '/api/v1/sessions' ('kunci tepat ' + ($harapKunci -join ',')) ('kunci: ' + (@($k) -join ',')) $okK

  # approval/route.ts:27-30: Origin sah lalu jagaRoute("admin") -> SIVITAS 403.
  [void](Uji -Metode POST -Path "/api/v1/regulations/$S/versions/$VersiDraf/approval" -OriginKirim $Origin -Cookie $c -Status 403 -TipeIsi 'application/problem\+json')
  # sessions/[id]/route.ts:14-15 + origin.ts:9-18: Origin salah -> 403 sebelum apa pun.
  [void](Uji -Metode DELETE -Path "/api/v1/sessions/$UuidNol" -OriginKirim $OriginSalah -Cookie $c -Status 403 -TipeIsi 'application/problem\+json')

  # IDOR: sessions/[id]/route.ts:21-22 dan lib/data/sesi.ts:25-28 (where id DAN userId): sesi orang lain -> 404.
  if (Env-Ada 'KY_COOKIE_ADMIN') {
    $idAdmin = Id-SesiSaatIni 'KY_COOKIE_ADMIN'
    if ($idAdmin) {
      [void](Uji -Metode DELETE -Path "/api/v1/sessions/$idAdmin" -OriginKirim $Origin -Cookie $c -Status 404 -TipeIsi 'application/problem\+json')
    } else {
      Lewati 'DELETE' '/api/v1/sessions/<id sesi Admin>' 'ID sesi Admin tidak terambil (cookie Admin tidak berlaku?)'
    }
  } else {
    Lewati 'DELETE' '/api/v1/sessions/<id sesi Admin>' 'KY_COOKIE_ADMIN kosong'
  }
}

function Tahap-Admin {
  Wajib-Param @('Slug', 'VersiSah', 'VersiDraf', 'VersiLain')
  Wajib-Env @('KY_COOKIE_ADMIN')
  $S = $Slug
  $c = 'KY_COOKIE_ADMIN'

  # lib/sesi.ts:47-50 + keputusan.ts:11: ADMIN lolos wajibAdmin.
  [void](Uji -Metode GET -Path '/admin/regulasi' -Cookie $c -Status 200)
  [void](Uji -Metode GET -Path '/admin/verifikasi' -Cookie $c -Status 200)
  # berkas/route.ts:13-23 dan lib/unduhan-pdf.ts:48-56: semua status boleh diunduh, header persis.
  $hdrUnduh = @{
    'Content-Type'           = '^application/pdf'
    'Content-Disposition'    = '^attachment'
    'X-Content-Type-Options' = '^nosniff$'
    'Cache-Control'          = 'no-store'
    'Content-Length'         = '^\d+$'
  }
  foreach ($v in @($VersiSah, $VersiDraf)) {
    $p = "/admin/regulasi/$S/versi/$v/berkas"
    $r = Invoke-Curl -Metode GET -Path $p -CookieVar $c -BuangBody
    $ok = ($r.Status -eq 200)
    $hasil = @("status $($r.Status)")
    foreach ($k in $hdrUnduh.Keys) {
      $x = $r.Headers[$k.ToLowerInvariant()]
      $hasil += "$k=$x"
      $ok = $ok -and ($null -ne $x) -and ($x -match $hdrUnduh[$k])
    }
    Catat 'GET' $p 'status 200 dan header unduhan sesuai lib/unduhan-pdf.ts:48-56' ($hasil -join '; ') $ok
  }
  # berkas/route.ts:19-23: findVersionFile(regulasi.id, versionId) -> versi regulasi lain tidak ditemukan;
  # lib/unduhan-pdf.ts:16-18: 404 teks.
  [void](Uji -Metode GET -Path "/admin/regulasi/$S/versi/$VersiLain/berkas" -Cookie $c -Status 404 -TipeIsi 'text/plain')

  # app/regulasi/[slug]/page.tsx:77-80 dan VersionTimeline.tsx:43: tautan "/berkas" untuk admin (versi ber-berkas).
  $r = Uji -Metode GET -Path "/regulasi/$S" -Cookie $c -Status 200 -SimpanBody
  $n = Hitung-Berkas $r.BodyFile
  Catat 'GET' "/regulasi/$S" 'jumlah "/berkas" pada HTML > 0' "jumlah = $n" ($n -gt 0)

  # Admin tidak punya hak atas sesi orang lain: lib/data/sesi.ts:25-28 (peran tidak ikut where).
  if (Env-Ada 'KY_COOKIE_SIVITAS') {
    $idSivitas = Id-SesiSaatIni 'KY_COOKIE_SIVITAS'
    if ($idSivitas) {
      [void](Uji -Metode DELETE -Path "/api/v1/sessions/$idSivitas" -OriginKirim $Origin -Cookie $c -Status 404 -TipeIsi 'application/problem\+json')
      [void](Uji -Metode GET -Path '/api/v1/sessions' -Cookie $c -Status 200)
      [void](Uji -Metode GET -Path '/api/v1/sessions' -Cookie 'KY_COOKIE_SIVITAS' -Status 200)
    } else {
      Lewati 'DELETE' '/api/v1/sessions/<id sesi Sivitas>' 'ID sesi Sivitas tidak terambil (cookie Sivitas tidak berlaku?)'
    }
  } else {
    Lewati 'DELETE' '/api/v1/sessions/<id sesi Sivitas>' 'KY_COOKIE_SIVITAS kosong'
  }
}

function Tahap-503 {
  if (-not $Konfirmasi) {
    throw 'Tahap 503 memanggil pengesahan SUNGGUHAN: bila kunci penandatangan masih aktif, versi DRAF akan DISAHKAN dan tidak bisa dikembalikan selain lewat alur Batalkan. Pastikan baris KYRION_SIGNING_KEY_FILE di .env.local sudah diberi # dan dev server sudah di-restart, lalu ulangi dengan -Konfirmasi.'
  }
  Wajib-Param @('Slug', 'VersiDraf')
  Wajib-Env @('KY_COOKIE_ADMIN')
  Peringatan 'Pastikan baris KYRION_SIGNING_KEY_FILE di .env.local diberi # dan dev server di-restart; jalankan hanya pada versi yang masih DRAF.'
  $p = "/api/v1/regulations/$Slug/versions/$VersiDraf/approval"
  # approval/route.ts:56-60: PenandatanganBelumSiapError -> 503 service-unavailable dengan detail PESAN_KUNCI_BELUM_SIAP.
  # lib/data/versions.ts:324-325: kunci disiapkan SEBELUM transaksi, jadi status versi tidak berubah.
  $r = Uji -Metode POST -Path $p -OriginKirim $Origin -Cookie 'KY_COOKIE_ADMIN' -Status 503 -TipeIsi 'application/problem\+json' -SimpanBody
  $teks = [IO.File]::ReadAllText($r.BodyFile)
  try { $o = $teks | ConvertFrom-Json } catch { $o = $null }
  $okTipe = ($null -ne $o) -and ([string]$o.type).EndsWith('/problems/service-unavailable')
  Catat 'POST' $p 'type berakhir /problems/service-unavailable' ('type sesuai: ' + $(if ($okTipe) { 'ya' } else { 'tidak' })) $okTipe
  $okDetail = ($null -ne $o) -and ([string]$o.detail -ceq $PesanKunciBelumSiap)
  Catat 'POST' $p 'detail sama dengan PESAN_KUNCI_BELUM_SIAP' ('detail sama: ' + $(if ($okDetail) { 'ya' } else { 'tidak' })) $okDetail
  $bocor = $teks.Contains('\') -or $teks.Contains('.json') -or $teks.Contains('.key') -or $teks.Contains('.pem')
  Catat 'POST' $p 'badan tanpa pola jalur berkas (backslash, .json, .key, .pem)' ('pola jalur ditemukan: ' + $(if ($bocor) { 'ya' } else { 'tidak' })) (-not $bocor)
}

function Tahap-Pemilik {
  if (-not $Konfirmasi) { throw 'Tahap pemilik merusak satu sesi (cookie ke-2). Ulangi dengan -Konfirmasi.' }
  Wajib-Env @('KY_COOKIE_SIVITAS', 'KY_COOKIE_SIVITAS2')
  Peringatan 'Setelah tahap ini cookie KY_COOKIE_SIVITAS2 tidak berlaku lagi.'
  $idS1 = Id-SesiSaatIni 'KY_COOKIE_SIVITAS'
  $idS2 = Id-SesiSaatIni 'KY_COOKIE_SIVITAS2'
  if (-not $idS1 -or -not $idS2) { throw 'Salah satu cookie tidak berlaku (tidak dapat membaca sesi saat ini).' }
  if ($idS1 -eq $idS2) { throw 'Kedua cookie menunjuk sesi yang SAMA; login kedua harus sesi baru. Dibatalkan sebelum mencabut apa pun.' }

  # sessions/[id]/route.ts:21-24 dan lib/data/sesi.ts:25-28: sesi milik sendiri dicabut -> 204.
  [void](Uji -Metode DELETE -Path "/api/v1/sessions/$idS2" -OriginKirim $Origin -Cookie 'KY_COOKIE_SIVITAS' -Status 204)
  # lib/sesi.ts:17-23 membaca sesi dari DB setiap permintaan; cookieCache tidak diaktifkan (lib/auth/index.ts:61),
  # sehingga pencabutan berlaku seketika: 401 (jaga-route.ts:17-21).
  [void](Uji -Metode GET -Path '/api/v1/sessions' -Cookie 'KY_COOKIE_SIVITAS2' -Status 401 -TipeIsi 'application/problem\+json')
}

# ---------------------------------------------------------------- pemeriksaan kebocoran

function Periksa-Kebocoran([string]$berkas) {
  if (-not (Test-Path $berkas)) { return }
  $teks = [IO.File]::ReadAllText($berkas)
  $bocor = $teks -match 'Set-Cookie'
  foreach ($n in $NamaCookie) {
    $v = [Environment]::GetEnvironmentVariable($n)
    if ([string]::IsNullOrEmpty($v)) { continue }
    $i = $v.IndexOf('=')
    $nilai = if ($i -ge 0) { $v.Substring($i + 1) } else { $v }
    # Batas 8 karakter menghindari kecocokan palsu pada nilai pendek; token sesi jauh lebih panjang.
    if ($nilai.Length -ge 8 -and $teks.Contains($nilai)) { $bocor = $true }
  }
  if ($bocor) {
    Remove-Item -LiteralPath $berkas -Force
    Write-Host 'PERINGATAN: keluaran memuat nilai rahasia atau Set-Cookie. Berkas keluaran DIHAPUS. Nilai tidak dicetak.' -ForegroundColor Red
  }
}

# ---------------------------------------------------------------- utama

$folder = if ($PSScriptRoot) { Join-Path $PSScriptRoot 'bukti' } else { Join-Path (Get-Location) 'bukti' }
if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder | Out-Null }
$berkasKeluar = Join-Path $folder ("akses-v0.3-$Peran.txt")

try {
  [void](Get-Command curl.exe)
  Write-Host ("Tahap {0} terhadap {1} (Origin {2})" -f $Peran, $BaseUrl, $Origin)
  foreach ($n in $NamaCookie) {
    Write-Host ("  {0}: {1}" -f $n, $(if (Env-Ada $n) { 'ada' } else { 'tidak ada' }))
  }
  # Hanya NAMA variabel yang disebut bila tidak valid; nilai, panjang, dan bagiannya tidak pernah dicetak.
  foreach ($n in $NamaCookie) {
    if ((Env-Ada $n) -and -not (Cookie-Valid ([Environment]::GetEnvironmentVariable($n)))) {
      throw "$n format tidak valid"
    }
  }
  switch ($Peran) {
    'anonim'  { Tahap-Anonim }
    'sivitas' { Tahap-Sivitas }
    'admin'   { Tahap-Admin }
    '503'     { Tahap-503 }
    'pemilik' { Tahap-Pemilik }
  }
}
catch {
  Peringatan ("Tahap dihentikan: " + $_.Exception.Message)
}
finally {
  $ringkasan = '{0} PASS, {1} FAIL' -f $script:Pass, $script:Fail
  if ($script:Skip -gt 0) { $ringkasan += ", $($script:Skip) DILEWATI" }
  $script:Baris.Add($ringkasan)
  Write-Host $ringkasan -ForegroundColor $(if ($script:Fail -eq 0) { 'Green' } else { 'Red' })

  # UTF-8 tanpa BOM.
  [IO.File]::WriteAllLines($berkasKeluar, $script:Baris.ToArray(), (New-Object System.Text.UTF8Encoding($false)))
  Periksa-Kebocoran $berkasKeluar
  if (Test-Path $berkasKeluar) { Write-Host "Keluaran: $berkasKeluar" }

  foreach ($t in $script:Temp) { if (Test-Path $t) { Remove-Item -LiteralPath $t -Force -ErrorAction SilentlyContinue } }
}
