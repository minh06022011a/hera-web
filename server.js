const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const ytsr = require('ytsr');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

app.use(cors());
app.use(express.static('public'));

// Load Cookie an toàn (Tránh lỗi nếu file không tồn tại)
let agent = null;
try {
    if (fs.existsSync('cookie.json')) {
        const cookies = JSON.parse(fs.readFileSync('cookie.json'));
        agent = ytdl.createAgent(cookies);
        console.log("--> Đã nạp Cookie thành công!");
    } else {
        console.log("--> Cảnh báo: Chưa có file cookie.json, Lịch sử sẽ không chạy.");
    }
} catch (err) { console.log("Lỗi đọc cookie: " + err.message); }

// 1. API TÌM KIẾM
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);
        const filters1 = await ytsr.getFilters(query);
        const filter1 = filters1.get('Type').get('Video');
        const searchResults = await ytsr(filter1.url, { limit: 15 }); // Tăng lên 15 kết quả
        res.json(searchResults.items.map(item => ({
            title: item.title,
            id: item.id,
            thumbnail: item.bestThumbnail.url,
            duration: item.duration
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. API LỊCH SỬ (Thử vận may)
app.get('/api/history', async (req, res) => {
    // Vì ytdl không hỗ trợ lấy history trực tiếp, ta bỏ qua hoặc 
    // phải dùng thư viện khác phức tạp hơn.
    // Tạm thời trả về danh sách rỗng để không lỗi web.
    res.json([]); 
});

// 3. API TẢI VIDEO (PHÂN LOẠI MÁY)
app.get('/download', (req, res) => {
    const videoId = req.query.id;
    const mode = req.query.mode || 'sumo'; // 'sumo' hoặc 'hera'
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Đặt tên file
    const ext = mode === 'sumo' ? '3gp' : 'mp4';
    res.header('Content-Disposition', `attachment; filename="video_${mode}_${videoId}.${ext}"`);

    // Lấy luồng video gốc
    let stream = ytdl(url, { agent: agent, quality: 'lowest' });
    let command = ffmpeg(stream);

    if (mode === 'sumo') {
        // CẤU HÌNH CHO VIETTEL SUMO (Màn hình bé tí 1.8 inch)
        // Chuẩn: 3GP, Codec H.263, Size 176x144 (QCIF)
        command
            .size('176x144')
            .videoCodec('h263')
            .audioCodec('aac')
            .audioBitrate('32k')
            .videoBitrate('64k') // Bitrate thấp cho nhẹ
            .format('3gp');
    } else {
        // CẤU HÌNH CHO HERA S9 / MASSTEL (Màn hình 2.4 inch)
        // Chuẩn: MP4, Codec H.264 Baseline, Size 320x240 (QVGA)
        // Đây là chuẩn "thần thánh" cho mọi máy bàn phím chạy 4G
        command
            .size('320x240')
            .videoCodec('libx264')
            .addOption('-profile:v', 'baseline') // Quan trọng: Baseline để chip yếu cũng đọc được
            .addOption('-level', '3.0')
            .audioCodec('aac')
            .audioBitrate('64k') // Âm thanh ngon hơn Sumo
            .videoBitrate('250k') // Hình ảnh nét hơn
            .format('mp4');
    }

    command.on('error', (err) => console.log('Lỗi convert: ' + err.message))
           .pipe(res, { end: true });
});

// Redirect
app.get('/', (req, res) => res.redirect('/youtube'));
app.get('/youtube', (req, res) => res.sendFile(path.join(__dirname, 'public/youtube.html')));
app.get('/game', (req, res) => res.sendFile(path.join(__dirname, 'public/games.html')));

app.listen(process.env.PORT || 3000, () => console.log("Server đang chạy..."));