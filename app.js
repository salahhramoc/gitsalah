(function () {
  "use strict";
  const rp = n => "Rp " + Number(n).toLocaleString("id-ID"), $ = id => document.getElementById(id);
  const cari = n => KOTA.find(k => k[0].toLowerCase() === String(n).trim().toLowerCase());

  const WARNA_KURIR = {
    jne: "#e11d2e",
    tiki: "#0284c7",
    pos: "#ea580c"
  };

  function jarak(a, b) {
    const R = 6371, r = x => x * Math.PI / 180, dA = r(b[2] - a[2]), dO = r(b[3] - a[3]);
    const h = Math.sin(dA / 2) ** 2 + Math.cos(r(a[2])) * Math.cos(r(b[2])) * Math.sin(dO / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.25);
  }

  function hitungCadangan(a, t, gram) {
    const d = jarak(a, t);
    let z = d <= 40 ? 0 : d <= 300 ? 1 : d <= 800 ? 2 : d <= 1500 ? 3 : d <= 2500 ? 4 : 5;
    if (a[4] !== t[4] && z < 5) z++;
    const kg = Math.max(1, Math.ceil(gram / 1000)), f = FAKTOR_PULAU[t[4]] || 1, out = [];
    KURIR.forEach(k => k.layanan.forEach(l => {
      if ((l.maxZ !== undefined && z > l.maxZ)) return;
      const harga = Math.ceil((kg * (l.b + z * l.s) * f) / 500) * 500;
      const e = l.tipe === "Express" ? Math.floor(z / 3) : Math.floor(z / 2);
      const lo = l.h[0] + e, hi = l.h[1] + Math.ceil(z / 2);
      out.push({
        kode: k.id,
        nama: k.nama,
        layanan: l.n,
        deskripsi: l.tipe,
        harga: harga,
        hari: lo === hi ? lo + " hari" : lo + "-" + hi + " hari"
      });
    }));
    return out.sort((x, y) => x.harga - y.harga);
  }

  let ringkasan = "";

  async function prosesCekOngkir(a, t, g) {
    const box = $("hasil");
    const btn = document.querySelector("#form-ongkir button[type='submit']");
    const kg = Math.max(1, Math.ceil(g / 1000));
    const d = jarak(a, t);

    btn.disabled = true;
    btn.textContent = "Memeriksa Tarif...";

    let daftarTarif = [];
    let isResmi = false;

    try {
      const res = await fetch(`api.php?origin=${a[5]}&destination=${t[5]}&weight=${g}`);
      const json = await res.json();

      if (json.status === "success" && Array.isArray(json.data) && json.data.length > 0) {
        isResmi = true;
        json.data.forEach(kurir => {
          const kode = kurir.code.toLowerCase();
          const namaKurir = kurir.name.toUpperCase();
          if (Array.isArray(kurir.costs)) {
            kurir.costs.forEach(service => {
              if (service.cost && service.cost[0]) {
                let etd = service.cost[0].etd ? service.cost[0].etd.replace(/HARI/gi, "").trim() + " hari" : "2-4 hari";
                daftarTarif.push({
                  kode: kode,
                  nama: namaKurir,
                  layanan: service.service,
                  deskripsi: service.description || "Reguler",
                  harga: service.cost[0].value,
                  hari: etd
                });
              }
            });
          }
        });
        daftarTarif.sort((x, y) => x.harga - y.harga);
      }
    } catch (err) {
      // الانتقال التلقائي في حال عدم دعم الخادم لـ PHP أو انقطاع الاتصال
    }

    if (daftarTarif.length === 0) {
      daftarTarif = hitungCadangan(a, t, g);
      isResmi = false;
    }

    btn.disabled = false;
    btn.textContent = "Cek Ongkir Sekarang";

    box.innerHTML = `
      <div class="ringkas">
        <h2>Hasil Cek Ongkir</h2>
        <p>${a[0]} → ${t[0]} · ${g.toLocaleString("id-ID")} gram (ditagih ${kg} kg) · ±${d.toLocaleString("id-ID")} km</p>
      </div>
      <ul class="daftar">
        ${daftarTarif.map(x => `
          <li class="kartu">
            <span class="lencana" style="background:${WARNA_KURIR[x.kode] || '#0a7a55'}">${x.kode.slice(0, 3).toUpperCase()}</span>
            <div class="info">
              <strong>${x.nama} - ${x.layanan}</strong>
              <small>${x.deskripsi} · Estimasi ${x.hari}</small>
            </div>
            <span class="harga">${rp(x.harga)}</span>
          </li>
        `).join("")}
      </ul>
      <button class="btn btn-garis" id="salin" type="button">Salin Hasil</button>
      <p class="catatan">
        <strong>${isResmi ? "Tarif Resmi Kurir." : "Tarif Estimasi."}</strong> 
        Harga dapat berubah sewaktu-waktu sesuai kebijakan ekspedisi. Cek info lengkap di situs resmi: 
        <a href="https://www.jne.co.id" target="_blank" rel="noopener">JNE</a>, 
        <a href="https://www.tiki.id" target="_blank" rel="noopener">TIKI</a>, 
        <a href="https://www.posindonesia.co.id" target="_blank" rel="noopener">POS Indonesia</a>.
      </p>`;

    box.hidden = false;
    ringkasan = `*Cek Ongkir ${a[0]} ke ${t[0]}*\nBerat: ${g} gram (ditagih ${kg} kg)\n\n` +
      daftarTarif.slice(0, 8).map(x => `• ${x.nama} (${x.layanan}): ${rp(x.harga)} (${x.hari})`).join("\n") +
      `\n\nDicek via Cek Ongkir`;

    $("salin").onclick = salin;
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function salin() {
    const b = $("salin"), ok = () => { b.textContent = "Tersalin! Tempel di WhatsApp"; setTimeout(() => b.textContent = "Salin Hasil", 2500); };
    const cad = () => { const x = document.createElement("textarea"); x.value = ringkasan; document.body.appendChild(x); x.select(); try { document.execCommand("copy"); ok(); } catch (e) { b.textContent = "Gagal menyalin"; } x.remove(); };
    navigator.clipboard ? navigator.clipboard.writeText(ringkasan).then(ok, cad) : cad();
  }

  function init() {
    const f = $("form-ongkir");
    if (!f) return;
    $("daftar-kota").innerHTML = KOTA.map(k => `<option value="${k[0]}">${k[1]}</option>`).join("");
    f.addEventListener("submit", e => {
      e.preventDefault();
      const a = cari($("asal").value), t = cari($("tujuan").value), g = parseInt($("berat").value, 10), er = $("galat");
      er.textContent = "";
      if (!a) return er.textContent = "Pilih Kota Asal dari daftar yang muncul.";
      if (!t) return er.textContent = "Pilih Kota Tujuan dari daftar yang muncul.";
      if (!g || g < 1 || g > 100000) return er.textContent = "Isi berat antara 1 sampai 100.000 gram.";
      prosesCekOngkir(a, t, g);
    });
    $("tukar").onclick = () => { const a = $("asal").value; $("asal").value = $("tujuan").value; $("tujuan").value = a; };
    document.querySelectorAll("[data-berat]").forEach(b => b.onclick = () => $("berat").value = b.dataset.berat);
  }

  document.addEventListener("DOMContentLoaded", init);
})();