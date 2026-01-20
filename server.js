const express = require('express');
const app = express();
const path = require('path');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');

app.use(express.static('public'));

// 1. API TÌM KIẾM
app.get('/tim-kiem', async (req, res) => {
    try {
        const tukhoa = req.query.q;
        if (!tukhoa) return res.json([]);
        const r = await yts(tukhoa);
        const videos = r.videos.slice(0, 10).map(v => ({
            title: v.title,
            id: v.videoId,
            time: v.timestamp,
            img: v.thumbnail
        }));
        res.json(videos);
    } catch (e) { res.json([]); }
});

// 2. API LẤY LINK (BẢN NÂNG CẤP)
app.get('/xem-ngay', async (req, res) => {
    // A. LỆNH CẤM CACHE (Bắt buộc máy Hera phải tải mới mỗi lần)
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');

    try {
        const id = req.query.id;
        const time = req.query.t || 0; // Lấy thời gian sếp nhập
        const url = `https://www.youtube.com/watch?v=${id}`;

        const info = await ytdl.getInfo(url);
        
        // Chọn định dạng 360p (itag 18) có cả tiếng và hình
        const format = ytdl.chooseFormat(info.formats, { quality: '18' });

        if (format && format.url) {
            // B. MẸO TUA GIỜ: Thêm #t=xx vào đuôi link
            // Một số trình phát video sẽ hiểu cái này và tự nhảy
            const finalLink = format.url + '#t=' + time;
            
            res.redirect(finalLink);
        } else {
            res.send("<h1>Lỗi: Video này không có bản 360p (Có thể là 1080p Only).</h1>");
        }

    } catch (e) {
        console.error(e);
        res.send(`<h1>Lỗi: ${e.message}</h1>`);
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server Anti-Cache Running!"));