const express = require('express');
const app = express();
const path = require('path');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core'); // Thư viện xịn

app.use(express.static('public'));

// 1. API TÌM KIẾM (Như cũ)
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

// 2. API LẤY LINK TRỰC TIẾP (Cái này mới quan trọng)
app.get('/xem-ngay', async (req, res) => {
    try {
        const id = req.query.id;
        const url = `https://www.youtube.com/watch?v=${id}`;

        // Lấy thông tin video
        const info = await ytdl.getInfo(url);
        
        // Chọn định dạng MP4 có cả hình và tiếng (itag 18 là 360p - nhẹ nhất cho Hera)
        const format = ytdl.chooseFormat(info.formats, { quality: '18' });

        if (format && format.url) {
            // Chuyển hướng trình duyệt Hera thẳng đến file Video
            // Máy sẽ tự bật trình phát video lên
            res.redirect(format.url);
        } else {
            res.send("<h1>Lỗi: Không lấy được link video này (Có thể do bản quyền).</h1>");
        }

    } catch (e) {
        console.error(e);
        res.send(`<h1>Lỗi Server: ${e.message}</h1><p>Hãy thử video khác.</p>`);
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server chạy!"));