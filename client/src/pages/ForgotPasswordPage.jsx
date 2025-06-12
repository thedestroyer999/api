// ForgotPasswordPage.js

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, KeyRound, Save, AlertCircle, CheckCircle, Leaf, ArrowLeft } from 'lucide-react';
import { API_ENDPOINTS } from '../config';

const ForgotPasswordPage = () => {
    // State untuk mengelola langkah: 'request' untuk form email, 'reset' untuk form OTP
    const [step, setStep] = useState('request'); 
    
    // State untuk seluruh proses
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // State untuk pesan, status loading, dan navigasi
    const [message, setMessage] = useState({ type: '', text: '' });
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    // Handler untuk langkah pertama: submit email untuk mendapatkan OTP
    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const res = await fetch(API_ENDPOINTS.forgotPassword, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Gagal mengirim email pemulihan.');
            
            // Jika berhasil, tampilkan pesan sukses dan pindah ke langkah berikutnya
            setMessage({ type: 'success', text: data.message });
            setStep('reset'); // Ubah tampilan ke form OTP dan kata sandi baru
            
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    // Handler untuk langkah kedua: submit OTP dan kata sandi baru
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' }); // Hapus pesan sebelumnya

        if (password.length < 6) {
            return setMessage({ type: 'error', text: 'Kata sandi minimal harus 6 karakter.' });
        }
        if (password !== confirmPassword) {
            return setMessage({ type: 'error', text: 'Konfirmasi kata sandi tidak cocok.' });
        }
        if (!otp.match(/^\d{6}$/)) {
            return setMessage({ type: 'error', text: 'Kode verifikasi harus 6 digit angka.' });
        }

        setIsLoading(true);

        try {
            const res = await fetch(API_ENDPOINTS.resetPassword, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp, newPassword: password }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Gagal mereset kata sandi.');
            
            // Jika sukses, tampilkan pesan dan alihkan ke halaman login
            setMessage({ type: 'success', text: `${data.message} Anda akan dialihkan ke halaman login...` });
            setTimeout(() => navigate('/login'), 2500);

        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    // Render tampilan berdasarkan state 'step' saat ini
    return (
        <div className="relative min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
            {/* Elemen Dekoratif */}
            <div className="absolute top-20 left-10 animate-bounce delay-100">
                <Leaf className="w-8 h-8 text-green-300 opacity-60" />
            </div>
            <div className="absolute bottom-10 right-20 animate-bounce delay-300">
                <Leaf className="w-10 h-10 text-emerald-300 opacity-50" />
            </div>

            {/* Kartu Reset Kata Sandi */}
            <div className="relative z-10 w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg">
                {step === 'request' ? (
                    // Tampilan 1: Form Meminta OTP
                    <>
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-gray-900">Lupa Kata Sandi?</h2>
                            <p className="mt-2 text-gray-600">
                                Jangan khawatir. Masukkan email Anda dan kami akan mengirimkan kode verifikasi untuk mengatur ulang kata sandi Anda.
                            </p>
                        </div>
                        <form className="mt-8 space-y-6" onSubmit={handleRequestOtp}>
                            {message.text && (
                                <div className={`p-4 rounded-md flex items-start space-x-3 bg-red-100 text-red-800`}>
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-sm font-medium">{message.text}</span>
                                </div>
                            )}
                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium text-gray-700">Alamat Email</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><Mail size={18} /></span>
                                    <input
                                        type="email" id="email" placeholder="contoh@email.com"
                                        value={email} onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isLoading}
                            >
                                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                                    <Mail className="h-5 w-5 text-green-300 group-hover:text-green-200" />
                                </span>
                                <span>{isLoading ? 'Mengirim...' : 'Kirim Kode Verifikasi'}</span>
                            </button>
                        </form>
                    </>
                ) : (
                    // Tampilan 2: Form Reset (OTP + Kata Sandi Baru)
                    <>
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-gray-900">Atur Ulang Kata Sandi</h2>
                            <p className="mt-2 text-gray-600">
                                Kode telah dikirim ke <strong>{email}</strong>. Masukkan kode dan kata sandi baru Anda.
                            </p>
                        </div>
                        <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
                            {message.text && (
                                <div className={`p-4 rounded-md flex items-start space-x-3 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {message.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                                    <span className="text-sm font-medium">{message.text}</span>
                                </div>
                            )}
                            
                            <div className="space-y-4">
                                {/* Input OTP */}
                                <div className="space-y-2">
                                    <label htmlFor="otp" className="text-sm font-medium text-gray-700">Kode Verifikasi (6 Digit)</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><KeyRound size={18} /></span>
                                        <input
                                            type="text" id="otp" placeholder="123456" maxLength="6"
                                            value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} // Hanya izinkan angka
                                            required
                                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                        />
                                    </div>
                                </div>
                                {/* Input Password Baru */}
                                <div className="space-y-2">
                                    <label htmlFor="password" className="text-sm font-medium text-gray-700">Kata Sandi Baru</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><KeyRound size={18} /></span>
                                        <input
                                            type="password" id="password" placeholder="••••••••"
                                            value={password} onChange={(e) => setPassword(e.target.value)}
                                            required
                                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                        />
                                    </div>
                                </div>
                                {/* Input Konfirmasi Password */}
                                <div className="space-y-2">
                                    <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Konfirmasi Kata Sandi Baru</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><KeyRound size={18} /></span>
                                        <input
                                            type="password" id="confirmPassword" placeholder="••••••••"
                                            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isLoading || message.type === 'success'}
                            >
                                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                                    <Save className="h-5 w-5 text-green-300 group-hover:text-green-200" />
                                </span>
                                <span>{isLoading ? 'Memproses...' : 'Simpan Kata Sandi'}</span>
                            </button>
                        </form>
                    </>
                )}

                {/* Tombol Kembali ke Login */}
                <div className="text-center pt-4">
                    <Link to="/login" className="flex items-center justify-center space-x-2 font-medium text-green-600 hover:text-green-500 hover:underline">
                        <ArrowLeft size={16}/>
                        <span>Kembali ke Login</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;