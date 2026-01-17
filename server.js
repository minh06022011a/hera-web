const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const ytsr = require('ytsr'); // Thư viện tìm kiếm
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Load Cookie từ file (Nếu có)
let agent = null;
if (fs.existsSync('cookie.json')) {
    const cookies = JSON.parse(fs.readFileSync('cookie.json'));
    // Tạo agent để ytdl đăng nhập bằng cookie của sếp
    agent = ytdl.createAgent(cookies);
    console.log("Đã load Cookie của sếp thành công!");
}

// 1. API TÌM KIẾM VIDEO (Không cần copy link nữa)
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);
        
        // Tìm kiếm video
        const filters1 = await ytsr.getFilters(query);
        const filter1 = filters1.get('Type').get('Video');
        const searchResults = await ytsr(filter1.url, { limit: 10 });
        
        // Trả về danh sách video cho Web
        res.json(searchResults.items.map(item => ({
            title: item.title,
            id: item.id,
            thumbnail: item.bestThumbnail.url,
            duration: item.duration
        })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. API TẢI & CONVERT 3GP (Cho Sumo/Hera)
app.get('/download', (req, res) => {
    const videoId = req.query.id;
    const type = req.query.type || '3gp'; // Mặc định là 3gp
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    res.header('Content-Disposition', `attachment; filename="video_${videoId}.${type}"`);

    // Cấu hình FFmpeg để ép file siêu nhỏ
    let command = ffmpeg(ytdl(url, { agent: agent, quality: 'lowest' }));

    if (type === '3gp') {
        // Cấu hình chuẩn cho máy cục gạch (Sumo T2)
        command
            .size('176x144')    // Độ phân giải màn hình bé
            .videoCodec('h263') // Codec cổ điển nhất
            .audioCodec('aac')
            .audioBitrate('32k')
            .videoBitrate('100k')
            .format('3gp');
    } else {
        // Cấu hình MP4 nhẹ (240p)
        command
            .size('320x240')
            .videoCodec('libx264')
            .audioCodec('aac')
            .format('mp4');
    }

    // Bắt đầu convert và gửi về cho sếp
    command.on('error', (err) => {
        console.log('Lỗi convert: ' + err.message);
        // Nếu Render không có ffmpeg (hiếm), nó sẽ báo lỗi ở đây
    }).pipe(res, { end: true });
});

// Trang chủ
app.get('/', (req, res) => res.redirect('/youtube'));
app.get('/youtube', (req, res) => res.sendFile(path.join(__dirname, 'public/youtube.html')));
app.get('/game', (req, res) => res.sendFile(path.join(__dirname, 'public/games.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại port ${PORT}`));