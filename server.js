const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const ytdl = require('ytdl-core'); // Thư viện tải video

app.use(cors());
app.use(express.static('public'));

// 1. Vào trang chủ tự nhảy sang YouTube (Sửa lỗi Cannot GET /)
app.get('/', (req, res) => {
    res.redirect('/youtube');
});

app.get('/youtube', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/youtube.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/games.html'));
});

// 2. API TẢI VIDEO (MỚI)
app.get('/download', async (req, res) => {
    try {
        const url = req.query.url;
        if (!ytdl.validateURL(url)) {
            return res.status(400).send('Link YouTube không đúng!');
        }

        // Lấy thông tin video để đặt tên file
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, ''); // Xóa ký tự lạ tên file

        // Cài đặt header để trình duyệt hiểu là file cần tải về
        res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);

        // Tải video chất lượng thấp (lowest) để nhẹ máy và xem mượt trên Hera
        ytdl(url, { 
            quality: '18', // Format 18 là MP4 360p (Hầu hết máy cục gạch đều đọc được)
            filter: format => format.container === 'mp4'
        }).pipe(res);

    } catch (err) {
        console.error(err);
        res.status(500).send('Lỗi tải video: ' + err.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy tại port ${PORT}`);
});