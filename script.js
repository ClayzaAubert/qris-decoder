// Helpers
const $ = s => document.querySelector(s);
const drop = $('#drop');
const fileInput = $('#fileInput');
const preview = $('#preview');
const output = $('#output');
const statusEl = $('#status');
const copyBtn = $('#copyBtn');
const canvas = $('#canvas');
const ctx = canvas.getContext('2d');

function setStatus(msg, type) {
  statusEl.className = 'status' + (type ? ' ' + type : '');
  statusEl.textContent = msg;
}

function showImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function processImageFile(file) {
  if (!file) return;
  try {
    setStatus('Memuat gambar…');
    const img = await showImage(file);
    preview.innerHTML = '';
    preview.appendChild(img);

    // Resize ke canvas untuk performa
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    canvas.width = Math.floor(img.width * scale);
    canvas.height = Math.floor(img.height * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Decode
    setStatus('Mendecode…');
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(data, width, height, { inversionAttempts: "attemptBoth" });

    if (code && code.data) {
      output.value = code.data;
      setStatus('Berhasil decode ✅', 'ok');
    } else {
      output.value = '';
      setStatus('Gagal menemukan QR pada gambar. Coba gambar yang lebih jelas.', 'err');
    }
  } catch (e) {
    console.error(e);
    output.value = '';
    setStatus('Terjadi kesalahan saat memproses gambar.', 'err');
  }
}

// Drag & drop
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
  e.preventDefault(); e.stopPropagation(); drop.classList.add('drag');
}));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
  e.preventDefault(); e.stopPropagation(); drop.classList.remove('drag');
}));
drop.addEventListener('drop', e => {
  const file = e.dataTransfer.files?.[0];
  processImageFile(file);
});

// File picker
fileInput.addEventListener('change', e => {
  const file = e.target.files?.[0];
  processImageFile(file);
  fileInput.value = ''; // reset agar bisa pilih file sama berulang
});

// Copy
copyBtn.addEventListener('click', async () => {
  try {
    const text = output.value.trim();
    if (!text) { setStatus('Belum ada hasil untuk dicopy.', 'err'); return; }
    await navigator.clipboard.writeText(text);
    setStatus('Tersalin ke clipboard.', 'ok');
  } catch {
    setStatus('Gagal menyalin ke clipboard.', 'err');
  }
});
