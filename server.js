const express = require('express');
const app = express();
const path = require('path');

app.use(express.static('public'));

// Cấu hình Server trung gian (Dùng Invidious API)
const INV_DOMAIN = "https://inv.nadeko.net"; 

// 1. API TÌM KIẾM
app.get('/tim-kiem', async (req, res) => {
    try {
        const query = req.query.q;
        const response = await fetch(`${INV_DOMAIN}/api/v1/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        const videos = data.filter(i => i.type === 'video').slice(0, 15).map(v => ({
            title: v.title,
            id: v.videoId,
            time: v.lengthSeconds,
            img: v.videoThumbnails?.[1]?.url || v.videoThumbnails?.[0]?.url
        }));
        
        res.json(videos);
    } catch (e) {
        console.log(e);
        res.json([]); 
    }
});

// 2. API LẤY LINK TRỰC TIẾP
app.get('/xem-ngay', async (req, res) => {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    
    try {
        const id = req.query.id;
        const time = req.query.t || 0;
        
        const response = await fetch(`${INV_DOMAIN}/api/v1/videos/${id}`);
        const data = await response.json();
        
        let format = data.formatStreams.find(f => f.resolution === '360p' && f.container === 'mp4');
        if (!format) format = data.formatStreams.find(f => f.container === 'mp4');

        if (format && format.url) {
            res.redirect(format.url + '#t=' + time);
        } else {
            res.send("<h1>Lỗi: Video này không có link tải trực tiếp.</h1>");
        }

    } catch (e) {
        res.send(`<h1>Lỗi Invidious: ${e.message}</h1>`);
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// --- ĐOẠN QUAN TRỌNG ĐÃ SỬA CHO VERCEL ---

// 1. Xuất khẩu App để Vercel dùng
module.exports = app;

// 2. Vẫn giữ lệnh listen để nếu sếp chạy trên máy tính (Local) thì vẫn được
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log("Server đang chạy!"));
}