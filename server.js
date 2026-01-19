const express = require('express');
const app = express();
const path = require('path');
const yts = require('yt-search'); // Thư viện tìm kiếm nhẹ

app.use(express.static('public'));

// API Tìm kiếm (Chỉ lấy Tên và ID, siêu nhanh)
app.get('/tim-kiem', async (req, res) => {
    try {
        const tukhoa = req.query.q;
        if (!tukhoa) return res.json([]);
        
        // Tìm video
        const r = await yts(tukhoa);
        
        // Chỉ lấy 10 video đầu tiên cho nhẹ máy Hera
        const videos = r.videos.slice(0, 10).map(v => ({
            title: v.title,
            id: v.videoId,
            time: v.timestamp,
            img: v.thumbnail
        }));
        
        res.json(videos);
    } catch (e) {
        res.json([]); // Lỗi thì trả về rỗng, ko sập web
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web tìm kiếm chạy tại port ${PORT}`));