# 📱 Panduan Setup — Janice Collab Scheduler (PWA + Cloud Sync)

App ini bisa dipasang seperti aplikasi di HP dan menyimpan semua data di cloud
sehingga tersinkron di HP + laptop. Ada **3 langkah**. Total sekali setup ± 15 menit.

Kalau kamu **hanya mau install ke HP tanpa sinkron cloud** (data lokal saja), lakukan
Langkah 2 saja, lalu buka appnya dan langsung pakai — lewati Langkah 1 & 3.

---

## Langkah 1 — Siapkan database cloud (Supabase) — GRATIS

1. Buka **https://supabase.com** → klik **Start your project** → daftar (bisa pakai akun Google).
2. Klik **New project**. Isi nama (mis. `janice-collab`), buat password database (simpan),
   pilih region terdekat (Singapore). Klik **Create** — tunggu ± 2 menit sampai siap.
3. Di menu kiri buka **SQL Editor** → **New query** → tempel SQL di bawah ini → klik **Run**:

```sql
create table if not exists collabs (
  id text primary key,
  workspace text not null,
  data jsonb,
  updated_at timestamptz default now(),
  deleted boolean default false
);
alter table collabs enable row level security;
create policy "app access" on collabs
  for all using (true) with check (true);
```

   > Catatan: policy ini membuat tabel bisa diakses siapa saja yang punya key + workspace-mu.
   > Untuk jadwal konten pribadi risikonya kecil selama key & workspace tidak kamu sebar.

4. Ambil 2 nilai config: menu kiri **Project Settings** (ikon gear) → **API**:
   - **Project URL** → contoh `https://abcdxyz.supabase.co`
     (HANYA alamat dasar — JANGAN pakai yang berakhiran `/rest/v1/` dari halaman Data API.
     App otomatis membersihkan jika terlanjur, tapi lebih baru ambil dari Settings → API di sini.)
   - **Project API keys → `anon` `public`** → string panjang diawali `eyJ...`

   Simpan dua nilai ini untuk Langkah 3.

---

## Langkah 2 — Pasang app ke HP (hosting gratis)

App PWA harus dibuka lewat alamat **https://** (bukan file), supaya bisa di-install & offline.
Cara paling mudah: hosting gratis **Netlify Drop**.

1. Buka **https://app.netlify.com/drop** di laptop.
2. **Seret seluruh folder `madeby-janice-app`** (berisi `index.html`, `manifest.webmanifest`,
   `sw.js`, `icon-192.png`, `icon-512.png`) ke area upload. Login singkat bila diminta (gratis).
3. Netlify memberi link, contoh `https://janice-collab.netlify.app`. Ini alamat app-mu.
   (Bisa di-rename di **Site settings → Change site name**.)

**Alternatif hosting gratis lain:** GitHub Pages, Vercel, atau Cloudflare Pages — sama saja,
yang penting hasilnya alamat `https://`.

### Pasang ikon ke Home Screen
- **iPhone (Safari):** buka link → tombol **Share** (kotak panah) → **Add to Home Screen** → **Add**.
- **Android (Chrome):** buka link → menu **⋮** → **Install app** / **Add to Home screen**.

Sekarang ada ikon app di HP, buka fullscreen tanpa address bar, dan tetap jalan saat offline.

---

## Langkah 3 — Nyalakan sinkron cloud di app

1. Buka app (dari ikon HP atau linknya).
2. Tap chip status (**Lokal**) di kanan atas, atau buka **Lainnya → Sinkron cloud** (di laptop: tombol **Cloud**).
3. Isi:
   - **Project URL** → dari Langkah 1 no.4
   - **Anon / Public Key** → dari Langkah 1 no.4
   - **Workspace** → kata sandi rahasia bebas, mis. `janice-2026-rahasia`
     (pakai **workspace yang sama persis** di setiap perangkat agar datanya nyambung)
4. Tap **Simpan dan sambungkan**. Chip status berubah **hijau, "Tersinkron"**.

Ulangi Langkah 3 di perangkat lain (laptop/HP kedua) dengan **URL, Key, dan Workspace yang sama**
→ semua data langsung muncul & selalu update di kedua sisi.

---

## Langkah 4 — Notifikasi H-1 di HP (opsional)

App mengirim notifikasi jam **12.00 WIB**, sehari sebelum setiap jadwal masak, kirim draft,
atau posting. Tugas yang sudah beres tidak diingatkan. Butuh Langkah 1–3 sudah jalan.
Setup sekali ± 15 menit, semuanya di dashboard Supabase.

**Siapkan kunci VAPID.** Kunci ini untuk mengirim push. Isinya ada di file `vapid-keys.txt` yang
dibuat saat fitur ini dipasang (tidak ikut di GitHub). Kalau perlu membuat yang baru, jalankan
`npx web-push generate-vapid-keys`, lalu ganti juga nilai `VAPID_PUBLIC` di `index.html`.

1. **Aktifkan ekstensi.** Menu kiri **Database → Extensions** → cari dan nyalakan **pg_cron** dan **pg_net**.
2. **Buat fungsinya.** Menu kiri **Edge Functions** → **Deploy a new function** → **Via Editor**.
   - Nama fungsi: `notify-h1`
   - Hapus isi contoh, tempel seluruh isi file `supabase/functions/notify-h1/index.ts` → **Deploy**.
3. **Isi secrets.** Masih di **Edge Functions** → **Secrets** → tambahkan tiga nilai dari `vapid-keys.txt`:
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, dan `VAPID_SUBJECT`.
4. **Jadwalkan tiap hari jam 12.00 WIB.** Buka **SQL Editor** → **New query** → tempel SQL di bawah,
   ganti `PROJECT-REF` (bagian depan Project URL, mis. `abcdxyz`) dan `ANON-KEY` (key `eyJ...` dari
   Langkah 1) → **Run**.

```sql
select cron.schedule(
  'janice-notif-h1',
  '0 5 * * *',  -- 05.00 UTC = 12.00 WIB
  $$
  select net.http_post(
    url     := 'https://PROJECT-REF.supabase.co/functions/v1/notify-h1',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ANON-KEY'),
    body    := '{}'::jsonb
  );
  $$
);
```

5. **Nyalakan di HP.** Buka app → tab **Lainnya** → **Aktifkan notifikasi H-1** → **Izinkan**.
   Notif "Notifikasi H-1 aktif" langsung muncul sebagai tanda berhasil. Ulangi di setiap HP yang
   ingin diingatkan (laptop: lewat tombol **Cloud**).
   - **iPhone:** wajib iOS 16.4 ke atas, dan app harus dibuka dari ikon Home Screen (Langkah 2),
     bukan dari Safari.
6. **Tes kirim sekarang.** Buat collab dengan tanggal masak/draft/posting **besok**, lalu di
   **Edge Functions → notify-h1** klik **Test** (atau jalankan isi `select net.http_post(...)` di atas
   di SQL Editor). Notif harus muncul di HP dalam beberapa detik.

Kalau tes gagal:
- Hasil tes `401` → di pengaturan fungsi `notify-h1`, matikan **Verify JWT**, lalu tes lagi.
- `"sent":0` padahal ada jadwal besok → cek tanggalnya benar-benar besok, dan HP sudah diaktifkan di langkah 5.
- Untuk mematikan jadwal: `select cron.unschedule('janice-notif-h1');`

---

## 📖 Fitur Resep (catatan ala Notes iPhone)

- Buka tab **Resep** di bawah. Tap tombol **+** (atau **Resep baru**) untuk menulis.
- **Baris pertama = judul.** Semua tersimpan otomatis saat mengetik, tidak ada tombol simpan.
- **Checklist bahan:** awali baris dengan `- ` (atau tap **Checklist**). Tekan Enter untuk item
  berikutnya, Enter di item kosong untuk mengakhiri list. Setelah **Selesai**, tap lingkaran untuk centang.
  Tombol **Reset centang** mengosongkan semua centang (berguna sebelum belanja/masak lagi).
- Tap teks resep untuk lanjut mengedit. Resep kosong otomatis dibuang. Hapus resep bisa di-**Urungkan**.
- **Sinkron:** ikut sinkron cloud yang sama, **tidak perlu menjalankan SQL baru**.
- **Backup Data** sekarang berisi collab + resep. File backup lama tetap bisa di-restore.

---

## Cara kerja & catatan penting

- **Offline-first:** app selalu bisa dibuka & diedit tanpa internet. Perubahan disimpan lokal,
  lalu otomatis dikirim ke cloud saat online. Tap chip status di kanan atas (atau **Lainnya → Sync sekarang**) untuk memaksa sinkron.
- **Anti bentrok:** kalau satu collab diedit di dua tempat, versi dengan waktu edit terbaru yang dipakai.
- **Backup manual:** tombol **CSV** (di HP: **Lainnya → Export CSV**) mengekspor semua data ke file (untuk arsip/Excel).
- **Keamanan:** jangan bagikan URL + Key + Workspace ke orang lain. Kalau ingin lebih aman,
  Supabase mendukung login email (Auth) — bisa diaktifkan nanti sebagai peningkatan.
- **Batasan localStorage:** cache lokal bisa terhapus kalau storage HP penuh, tapi **data cloud
  tetap aman** dan akan tertarik lagi saat app dibuka & online.

Selesai. Kamu sekarang punya app collab yang bisa dipasang di HP, jalan offline,
dan datanya tersimpan aman di cloud serta sinkron di semua perangkat.
