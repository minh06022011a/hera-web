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

// FILE LƯU LỊCH SỬ RIÊNG CỦA WEB
const HISTORY_FILE = 'history.json';

// Hàm lưu lịch sử
function saveToHistory(videoInfo) {
    let history = [];
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            history = JSON.parse(fs.readFileSync(HISTORY_FILE));
        }
        // Xóa video trùng lặp cũ
        history = history.filter(v => v.id !== videoInfo.id);
        // Thêm video mới vào đầu danh sách
        history.unshift(videoInfo);
        // Chỉ giữ lại 50 video gần nhất
        if (history.length > 50) history.length = 50;
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history));
    } catch (e) { console.log("Lỗi lưu history: " + e.message); }
}

// Load Cookie (Để tải video không bị chặn)
let agent = null;
try {
    if (fs.existsSync('cookie.json')) {
        const cookies = JSON.parse(fs.readFileSync('cookie.json'));
        agent = ytdl.createAgent(cookies);
        console.log("--> Đã nạp Cookie thành công!");
    }
} catch (err) {}

// 1. API TÌM KIẾM (ĐÃ SỬA LỖI READING URL)
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);

        // TÌM KIẾM TRỰC TIẾP (Bỏ qua bước getFilters gây lỗi)
        const searchResults = await ytsr(query, { limit: 20 });
        
        // Lọc kết quả chỉ lấy Video (bỏ qua Playlist/Channel)
        const videos = searchResults.items
            .filter(item => item.type === 'video')
            .map(item => ({
                title: item.title,
                id: item.id,
                thumbnail: item.bestThumbnail ? item.bestThumbnail.url : item.thumbnails[0].url, // Fix lỗi thiếu ảnh
                duration: item.duration || '??:??'
            }));

        res.json(videos);
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "Lỗi tìm kiếm: " + e.message }); 
    }
});

// 2. API LẤY LỊCH SỬ (LOCAL)
app.get('/api/history', (req, res) => {
    if (fs.existsSync(HISTORY_FILE)) {
        res.sendFile(path.join(__dirname, HISTORY_FILE));
    } else {
        res.json([]);
    }
});

// 3. API TẢI VIDEO (CÓ LƯU LỊCH SỬ)
app.get('/download', async (req, res) => {
    try {
        const videoId = req.query.id;
        const mode = req.query.mode || 'sumo';
        const url = `https://www.youtube.com/watch?v=${videoId}`;

        // Lấy thông tin video để lưu vào lịch sử
        try {
            const info = await ytdl.getBasicInfo(url, { agent });
            saveToHistory({
                title: info.videoDetails.title,
                id: videoId,
                thumbnail: info.videoDetails.thumbnails[0].url,
                duration: info.videoDetails.lengthSeconds + 's' // Lưu tạm giây
            });
        } catch(e) {}

        // --- XỬ LÝ TẢI ---
        if (mode === 'direct') {
            const info = await ytdl.getInfo(url);
            const format = ytdl.chooseFormat(info.formats, { quality: '18' });
            res.header('Content-Disposition', `attachment; filename="video_nhanh_${videoId}.mp4"`);
            ytdl(url, { format: format, agent: agent }).pipe(res);
            return;
        }

        const ext = mode === 'sumo' ? '3gp' : 'mp4';
        res.header('Content-Disposition', `attachment; filename="video_${mode}_${videoId}.${ext}"`);

        let stream = ytdl(url, { agent: agent, quality: 'lowest' });
        let command = ffmpeg(stream);

        if (mode === 'sumo') {
            command.size('176x144').videoCodec('h263').audioCodec('aac').audioBitrate('32k').format('3gp');
        } else {
            command.size('320x240').videoCodec('libx264')
                .addOption('-profile:v', 'baseline').addOption('-level', '3.0')
                .audioCodec('aac').videoBitrate('250k').format('mp4');
        }

        command.on('error', (err) => console.log('Lỗi convert: ' + err.message)).pipe(res, { end: true });

    } catch (e) { res.status(500).send("Lỗi: " + e.message); }
});

// Redirect
app.get('/', (req, res) => res.redirect('/youtube'));
app.get('/youtube', (req, res) => res.sendFile(path.join(__dirname, 'public/youtube.html')));
app.get('/game', (req, res) => res.sendFile(path.join(__dirname, 'public/games.html')));

app.listen(process.env.PORT || 3000, () => console.log("Server đang chạy..."));