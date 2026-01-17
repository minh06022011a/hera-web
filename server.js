const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');

// Cấu hình
app.use(cors());
app.use(express.static('public')); // Cho phép truy cập thư mục public

// --- ĐƯỜNG DẪN (ROUTER) ---

// 1. Vào trang YouTube
app.get('/youtube', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/youtube.html'));
});

// 2. Vào trang Game
app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/games.html'));
});

// 3. API giả lập (Sau này ChatGPT sẽ viết thêm phần xử lý thật vào đây)
app.get('/api/test', (req, res) => {
    res.json({ message: "Server Hera đang chạy ngon lành!" });
});

// --- CHẠY SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy tại: http://localhost:${PORT}`);
});