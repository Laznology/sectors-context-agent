# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Investor retail Indonesia, level beginner-to-intermediate. Sudah paham ticker, return, volume, fundamental dasar, punya watchlist sendiri. Tidak nyaman membaca banyak dashboard finansial dan harus membuka beberapa halaman untuk memahami penyebab satu pergerakan saham. Mencari penjelasan, bukan tambahan data mentah.

Bukan trader profesional, bukan kuantitatif, bukan institutional allocator.

## Product Purpose

Membantu user menjawab satu pertanyaan: kenapa saham di watchlist saya bergerak, dan data apa yang paling relevan untuk menjelaskannya.

Produk mengambil data pasar Indonesia dari Sectors, menghitung sinyal deterministik, memilih sumber data tambahan secara kondisional, lalu menghasilkan penjelasan berbasis bukti beserta jejak investigasinya.

Sukses = user memahami penjelasan utama tanpa membuka platform finansial lain untuk menafsirkan data yang sama.

## Positioning

Bedanya bukan meringkas data, tapi **menginvestigasi secara kondisional**. Agent tidak memanggil semua tool untuk setiap ticker; ia memutuskan data mana yang relevan untuk pergerakan spesifik itu, dan explainability-nya diaudit lewat jejak langkah yang terlihat.

Produk analisar dan konteks. Bukan rekomendasi BUY/SELL/HOLD, bukan prediksi harga, bukan eksekusi trade.

## Operating Context

Sumber data tunggal: Sectors (REST API v2), data end-of-day. Alur utama: pilih ticker dari watchlist → mulai investigasi → baseline (harga + IHSG + company) → hitung sinyal → rencanakan → kumpulkan bukti kondisional → sintesis → tampilkan penjelasan + keyakinan → persist → investigasi berikutnya bisa membandingkan.

Target next: demo 3 menit yang direkam, judged async. Skor: real-world usability 40%, video & storytelling 30%, technical depth 30%. Deadline submit 8 Oktober 2026.

## Capabilities and Constraints

- Watchlist: tambah ticker (divalidasi lewat Sectors), hapus, persist.
- Investigasi end-to-end dengan routing kondisional deterministik; branch dipilih sinyal, planner LLM memilih tool di dalam branch, server menegakkan ulang keputusan itu.
- LLM hanya merumuskan hipotesis, memilih tool yang disetujui, menafsirkan bukti, menyusun penjelasan, dan menjawab follow-up terarah.
- Perhitungan finansial wajib di TypeScript deterministik, tidak boleh ke LLM.
- Missing data tetap missing. Bukti yang konflik menurunkan keyakinan, bukan disembunyikan.
- Bahasa Indonesia untuk seluruh antarmuka (chrome dan output agent).
- Data bersifat end-of-day, jangan diklaim real-time.
- Disclaimer wajib pada setiap hasil.

Belum diputuskan: apakah branch boleh dibuka oleh pertanyaan eksplisit user (PRD §13 menyebut planner boleh memodifikasi route; implementasi sekarang belum).

## Brand Commitments

Nama: **Sectors Context Agent**. Tagline: _Understand what changed, why it matters, and what deserves your attention._

Identitas visual yang sudah ada dan dipertahankan: dark editorial, serif (Newsreader) untuk judul, monospace (JetBrains Mono) untuk label dan data, satu warna sinyal maroon sebagai aksen. Perbaikan fokus pada hierarki, layout, tipografi — bukan penggantian dunia visual.

## Evidence on Hand

Data nyata Sectors untuk saham IDX, termasuk foreign flow, broker activity, news, filings, dan indeks IHSG. Tidak ada testimonial, pengguna nyata, studi kasus, atau klaim performa yang boleh dipakai. tidak ada logo/aset brand resmi selain nama produk.

## Product Principles

1. **Jawab dulu, data kemudian.** Urutan halaman mengikuti urutan pertanyaan user, bukan urutan pipeline teknis.
2. **Bukti sebelum keyakinan.** Setiap klaim substantif bisa ditelusuri ke evidence yang dikumpulkan; classification dan confidence selalu ditampilkan bersama alasannya.
3. **Kondisional, bukan memanggil semua.** Menjalankan lebih sedikit data dengan routing yang bisa dijelaskan lebih baik daripada memanggil semuanya.
4. **Pemilik tidak melihat bahasa mesin.** Label manusia, temuan singkat, tanpa durasi milidetik atau kode error di tampilan utama.
5. **Keputusan visual mengikuti mode Operate.** Scanabilitas dan kedalaman penjelasan agent lebih penting daripada pameran teknologi.

## Accessibility & Inclusion

Target pengguna mobile dan desktop. Bahasa Indonesia sebagai bahasa antarmuka. Kontras teks harus tetap terbaca di atas latar gelap; ukuran teks isi laporan harus nyaman dibaca, bukan ukuran label.
