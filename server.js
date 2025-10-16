const express = require('express');
const multer = require('multer');
const Jimp = require('jimp');
const jsQR = require('jsqr');

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi multer untuk upload ke memory (tidak simpan ke disk)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Hanya file gambar (JPEG, JPG, PNG) yang diperbolehkan!'));
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS untuk Vercel
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Function untuk decode QR Code dari buffer
async function decodeQRCode(imageBuffer) {
  try {
    const image = await Jimp.read(imageBuffer);
    const imageData = {
      data: new Uint8ClampedArray(image.bitmap.data),
      width: image.bitmap.width,
      height: image.bitmap.height
    };

    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      return code.data;
    } else {
      return null;
    }
  } catch (error) {
    throw new Error('Gagal membaca gambar: ' + error.message);
  }
}

// Function untuk parsing data QRIS
function parseQRIS(qrisString) {
  const data = {};
  let i = 0;

  while (i < qrisString.length) {
    const id = qrisString.substr(i, 2);
    const length = parseInt(qrisString.substr(i + 2, 2));
    const value = qrisString.substr(i + 4, length);

    data[id] = value;
    i += 4 + length;
  }

  return {
    raw: qrisString,
    parsed: {
      payloadFormatIndicator: data['00'],
      merchantAccountInformation: data['26'],
      merchantCategoryCode: data['52'],
      transactionCurrency: data['53'],
      transactionAmount: data['54'],
      countryCode: data['58'],
      merchantName: data['59'],
      merchantCity: data['60'],
      postalCode: data['61'],
      additionalData: data['62'],
      crc: data['63']
    }
  };
}

// Route: Home
app.get('/', (req, res) => {
  res.json({
    message: 'QRIS Decoder API',
    version: '1.0.0',
    endpoints: {
      upload: 'POST /api/qris/upload',
      health: 'GET /api/health'
    }
  });
});

// Route: Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Route: Upload dan Decode QRIS
app.post('/api/qris/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File gambar tidak ditemukan. Gunakan field "image" untuk upload.'
      });
    }

    // Decode QR Code dari buffer (tanpa simpan file)
    const qrisData = await decodeQRCode(req.file.buffer);

    if (!qrisData) {
      return res.status(400).json({
        success: false,
        message: 'QR Code tidak ditemukan dalam gambar atau tidak valid.'
      });
    }

    // Parse QRIS data
    const parsedData = parseQRIS(qrisData);

    res.json({
      success: true,
      message: 'QRIS berhasil di-decode',
      data: {
        qrisString: qrisData,
        parsed: parsedData.parsed
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memproses gambar',
      error: error.message
    });
  }
});

// Error handler
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Ukuran file terlalu besar. Maksimal 5MB.'
      });
    }
  }

  res.status(500).json({
    success: false,
    message: error.message
  });
});

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    console.log(`📝 Upload endpoint: POST http://localhost:${PORT}/api/qris/upload`);
  });
}

// Export untuk Vercel
module.exports = app;
