// server.js
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();

// --- Middleware ---
// Pastikan CORS mengizinkan domain frontend Anda saat online
// Anda bisa menggunakan process.env.FRONTEND_URL di sini juga untuk produksi
app.use(cors({
    origin: process.env.FRONTEND_URL, // Sesuaikan dengan URL frontend Anda
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

// --- Konstanta & Konfigurasi ---
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-that-is-long-and-secure';
const PORT = process.env.PORT || 3001;

// --- Koneksi Database ---
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cornleafai'
};

let db;
async function connectToDatabase() {
    try {
        db = await mysql.createConnection(dbConfig);
        console.log('Successfully connected to MySQL database.');
    } catch (err) {
        console.error('Database connection failed:', err.stack);
        process.exit(1);
    }
}
connectToDatabase();

// --- Konfigurasi Nodemailer ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    },
});

transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP Error:', error);
    } else {
        console.log('SMTP Server ready');
    }
});

// --- Middleware Verifikasi JWT ---
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') return res.status(401).json({ message: 'Sesi telah berakhir, silakan login kembali.' });
        return res.status(403).json({ message: 'Token tidak valid.' });
    }
};

// --- Rute API (Direfaktor dengan Async/Await) ---

// --- Rute Autentikasi ---
app.post('/api/register', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password || password.length < 6) {
            return res.status(400).json({ message: 'Harap isi semua kolom. Kata sandi minimal 6 karakter.' });
        }
        const [users] = await db.query('SELECT email FROM users WHERE email = ?', [email]);
        if (users.length > 0) {
            return res.status(400).json({ message: 'Email ini sudah terdaftar.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)', [fullName, email, hashedPassword]);
        res.status(201).json({ message: 'Registrasi berhasil! Silakan login.' });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Harap masukkan email dan password.' });
        }
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Email atau kata sandi salah.' });
        }
        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Email atau kata sandi salah.' });
        }
        const payload = { user: { id: user.id, email: user.email, fullName: user.full_name } };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login berhasil!', token, user: payload.user });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});
// --- Rute Lupa Kata Sandi ---
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        // Validasi input email
        if (!email) {
            return res.status(400).json({ message: 'Email harus diisi.' });
        }

        // Cek apakah email terdaftar
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            // Balasan tetap sama untuk alasan keamanan
            return res.status(200).json({ message: 'Jika email terdaftar, link pemulihan telah dikirim.' });
        }

        const user = users[0];

        // Buat token dan waktu kadaluarsa (1 jam)
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiryDate = new Date(Date.now() + 3600000); // 1 jam dari sekarang

        // Simpan token dan waktu kedaluwarsa ke database
        await db.query(
            'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
            [resetToken, expiryDate, user.id]
        );

        // Buat tautan reset menggunakan variabel environment FRONTEND_URL
        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        // Konfigurasi email
        const mailOptions = {
            from: `"CornLeaf AI" <${process.env.GMAIL_USER}>`,
            to: user.email,
            subject: 'Pemulihan Kata Sandi Akun Anda',
            html: `
                <p>Halo ${user.full_name},</p>
                <p>Klik link berikut untuk mereset kata sandi Anda:</p>
                <p>
                    <a href="${resetLink}" style="background-color:#16a34a;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
                        Reset Kata Sandi
                    </a>
                </p>
                <p>Link ini akan kedaluwarsa dalam 1 jam. Jika Anda tidak meminta ini, abaikan email ini.</p>
            `
        };

        // Kirim email reset
        await transporter.sendMail(mailOptions);

        // Kirim respons sukses
        res.status(200).json({ message: 'Jika email terdaftar, link pemulihan telah dikirim.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Gagal memproses permintaan.' });
    }
});

// --- Rute Lupa Kata Sandi (via OTP) ---
// Langkah 1: Pengguna meminta kode OTP
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        // Validasi input
        if (!email) {
            return res.status(400).json({ message: 'Email harus diisi.' });
        }

        // Cek apakah pengguna ada
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        // Balasan tetap sama, baik email ditemukan atau tidak
        if (users.length === 0) {
            return res.status(200).json({ message: 'Jika email Anda terdaftar, kami telah mengirimkan kode verifikasi.' });
        }

        const user = users[0];

        // Generate OTP 6 digit
        const otp = crypto.randomInt(100000, 999999).toString();

        // Waktu kadaluarsa OTP: 10 menit dari sekarang
        const expiryDate = new Date(Date.now() + 10 * 60 * 1000);

        // Hash OTP untuk keamanan
        const hashedOtp = await bcrypt.hash(otp, 10);

        // Simpan OTP dan kadaluarsa ke database
        await db.query(
            'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
            [hashedOtp, expiryDate, user.id]
        );

        // Kirim email berisi OTP
        const mailOptions = {
            from: `"CornLeaf AI" <${process.env.GMAIL_USER}>`,
            to: user.email,
            subject: 'Kode Verifikasi Pemulihan Kata Sandi',
            html: `
                <p>Halo ${user.full_name},</p>
                <p>Gunakan kode berikut untuk mengatur ulang kata sandi Anda. Kode ini berlaku selama 10 menit:</p>
                <h2 style="background-color:#f0fdf4;color:#166534;padding:10px 20px;text-align:center;border-radius:5px;letter-spacing:2px;">
                    ${otp}
                </h2>
                <p>Jika Anda tidak meminta pemulihan ini, abaikan email ini.</p>
            `
        };

        await transporter.sendMail(mailOptions);

        // Kirim respons generik
        res.status(200).json({ message: 'Jika email Anda terdaftar, kami telah mengirimkan kode verifikasi.' });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Gagal memproses permintaan.' });
    }
});

// --- Rute Riwayat ---
app.post('/api/history/save', verifyToken, async (req, res) => {
    try {
        const { detection_result, accuracy, recommendation, image_data } = req.body;
        if (!detection_result || !image_data) return res.status(400).json({ message: 'Data tidak lengkap.' });
        await db.query('INSERT INTO scan_history (user_id, image_data, detection_result, accuracy, recommendation) VALUES (?, ?, ?, ?, ?)', [req.user.id, image_data, detection_result, accuracy, JSON.stringify(recommendation)]);
        res.status(201).json({ message: 'Riwayat berhasil disimpan.' });
    } catch (error) {
        console.error('Save history error:', error);
        res.status(500).json({ message: 'Gagal menyimpan riwayat.' });
    }
});

app.get('/api/history', verifyToken, async (req, res) => {
    try {
        const [history] = await db.query('SELECT id, image_data, detection_result, accuracy, scanned_at FROM scan_history WHERE user_id = ? ORDER BY scanned_at DESC', [req.user.id]);
        res.json(history);
    } catch (error) {
        console.error('Fetch history error:', error);
        res.status(500).json({ message: 'Gagal mengambil data riwayat.' });
    }
});

app.delete('/api/history/:id', verifyToken, async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM scan_history WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Riwayat tidak ditemukan.' });
        res.status(200).json({ message: 'Riwayat berhasil dihapus.' });
    } catch (error) {
        console.error('Delete history error:', error);
        res.status(500).json({ message: 'Gagal menghapus riwayat.' });
    }
});

// --- Rute Profil ---
app.get('/api/profile', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, full_name, email, profile_picture FROM users WHERE id = ?', [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });
        res.json(rows[0]);
    } catch (error) {
        console.error('Fetch profile error:', error);
        res.status(500).json({ message: 'Gagal mengambil profil.' });
    }
});

app.put('/api/profile/details', verifyToken, async (req, res) => {
    try {
        const { fullName, profilePicture } = req.body;
        if (!fullName) return res.status(400).json({ message: 'Nama lengkap tidak boleh kosong.' });
        await db.query('UPDATE users SET full_name = ?, profile_picture = ? WHERE id = ?', [fullName, profilePicture, req.user.id]);
        
        const [users] = await db.query('SELECT id, full_name, email FROM users WHERE id = ?', [req.user.id]);
        const user = users[0];
        const payload = { user: { id: user.id, email: user.email, fullName: user.full_name } };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        
        res.json({ message: 'Profil berhasil diperbarui.', user: payload.user, token });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Gagal memperbarui profil.' });
    }
});

app.put('/api/profile/password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Harap isi semua kolom.' });
        if (newPassword.length < 6) return res.status(400).json({ message: 'Kata sandi baru minimal 6 karakter.' });
        
        const [users] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
        const isMatch = await bcrypt.compare(currentPassword, users[0].password);
        if (!isMatch) return res.status(400).json({ message: 'Kata sandi saat ini salah.' });
        
        const newHashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [newHashedPassword, req.user.id]);
        
        res.status(200).json({ message: 'Kata sandi berhasil diubah.' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Gagal mengubah kata sandi.' });
    }
});

// --- Rute Statistik ---
app.get('/api/stats', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const queries = [
            db.query('SELECT COUNT(*) as totalScans FROM scan_history WHERE user_id = ?', [userId]),
            db.query("SELECT COUNT(*) as diseasesDetected FROM scan_history WHERE user_id = ? AND detection_result != 'Sehat'", [userId]),
            db.query('SELECT AVG(accuracy) as averageAccuracy FROM scan_history WHERE user_id = ?', [userId]),
            db.query('SELECT COUNT(*) as scansThisMonth FROM scan_history WHERE user_id = ? AND MONTH(scanned_at) = MONTH(CURRENT_DATE()) AND YEAR(scanned_at) = YEAR(CURRENT_DATE())', [userId])
        ];
        const results = await Promise.all(queries.map(p => p.then(res => res[0][0])));
        res.json({
            totalScans: results[0].totalScans,
            diseasesDetected: results[1].diseasesDetected,
            averageAccuracy: results[2].averageAccuracy || 0,
            scansThisMonth: results[3].scansThisMonth
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ message: 'Gagal memuat statistik.' });
    }
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Backend API is running on http://localhost:${PORT}`);
});