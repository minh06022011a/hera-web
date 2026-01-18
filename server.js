const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search'); // DÙNG HÀNG MỚI NAY
const ytpl = require('ytpl');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

app.use(cors());
app.use(express.static('public'));

// NẠP COOKIE (CHÌA KHÓA VẠN NĂNG)
let agent = null;
try {
    if (fs.existsSync('cookie.json')) {
        const cookies = JSON.parse(fs.readFileSync('cookie.json'));
        agent = ytdl.createAgent(cookies);
        console.log("--> Đã nạp Cookie thần thánh!");
    } else {
        console.log("--> CẢNH BÁO: Chưa có cookie.json, dễ bị chặn Sign in!");
    }
} catch (err) { console.log("Lỗi cookie: " + err.message); }

// 1. API TÌM KIẾM (DÙNG YT-SEARCH KHÔNG BỊ LỖI)
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);

        // Tìm kiếm bằng thư viện mới
        const r = await yts(query);
        
        // Lọc kết quả lấy Video
        const videos = r.videos.slice(0, 15).map(item => ({
            title: item.title,
            id: item.videoId,
            thumbnail: item.thumbnail,
            duration: item.timestamp
        }));

        res.json(videos);
    } catch (e) { 
        console.log("Lỗi tìm kiếm: " + e.message);
        res.json([]); 
    }
});

// 2. API PLAYLIST
app.get('/api/playlist', async (req, res) => {
    try {
        const listId = req.query.id;
        if (!listId) return res.status(400).json({ error: "Thiếu ID" });
        const playlist = await ytpl(listId, { limit: 20 });
        const videos = playlist.items.map(item => ({
            title: item.title,
            id: item.id,
            thumbnail: item.bestThumbnail?.url || item.thumbnails?.[0]?.url,
            duration: item.duration || '??:??'
        }));
        res.json(videos);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. API TẢI VIDEO (CÓ THUỐC TRỊ SIGN IN)
app.get('/download', async (req, res) => {
    try {
        const videoId = req.query.id;
        const mode = req.query.mode || 'sumo';
        const url = `https://www.youtube.com/watch?v=${videoId}`;

        // CHẾ ĐỘ TẢI NHANH
        if (mode === 'direct') {
            const info = await ytdl.getInfo(url, { agent: agent }); // Nhét Cookie vào
            const format = ytdl.chooseFormat(info.formats, { quality: '18' });
            res.header('Content-Disposition', `attachment; filename="video_nhanh_${videoId}.mp4"`);
            ytdl(url, { format: format, agent: agent }).pipe(res);
            return;
        }

        // CHẾ ĐỘ CONVERT
        const ext = mode === 'sumo' ? '3gp' : 'mp4';
        res.header('Content-Disposition', `attachment; filename="video_${mode}_${videoId}.${ext}"`);

        // Luôn luôn dùng agent (Cookie) để tải
        let stream = ytdl(url, { agent: agent, quality: 'lowest' });
        let command = ffmpeg(stream);

        if (mode === 'sumo') {
            // Cấu hình Sumo
            command.size('176x144').videoCodec('h263').audioCodec('aac').audioBitrate('32k').format('3gp');
        } else {
            // Cấu hình Hera
            command.size('320x240').videoCodec('libx264')
                .addOption('-profile:v', 'baseline').addOption('-level', '3.0')
                .audioCodec('aac').videoBitrate('250k').format('mp4');
        }
        command.on('error', (err) => console.log('Lỗi convert: ' + err.message)).pipe(res, { end: true });

    } catch (e) { 
        console.log(e);
        res.status(500).send("Lỗi tải (Check Cookie): " + e.message); 
    }
});

app.get('/', (req, res) => res.redirect('/youtube'));
app.get('/youtube', (req, res) => res.sendFile(path.join(__dirname, 'public/youtube.html')));
app.get('/game', (req, res) => res.sendFile(path.join(__dirname, 'public/games.html')));

app.listen(process.env.PORT || 3000, () => console.log("Server Đã Sống Lại!"));