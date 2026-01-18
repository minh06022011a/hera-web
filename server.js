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

// Load Cookie (Nếu có)
let agent = null;
try {
    if (fs.existsSync('cookie.json')) {
        const cookies = JSON.parse(fs.readFileSync('cookie.json'));
        agent = ytdl.createAgent(cookies);
        console.log("--> Đã nạp Cookie thành công!");
    }
} catch (err) { console.log("Lỗi đọc cookie: " + err.message); }

// 1. API TÌM KIẾM
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);
        const filters1 = await ytsr.getFilters(query);
        const filter1 = filters1.get('Type').get('Video');
        const searchResults = await ytsr(filter1.url, { limit: 15 });
        res.json(searchResults.items.map(item => ({
            title: item.title,
            id: item.id,
            thumbnail: item.bestThumbnail.url,
            duration: item.duration
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. API TẢI VIDEO (FIXED)
app.get('/download', async (req, res) => {
    try {
        const videoId = req.query.id;
        const mode = req.query.mode || 'sumo';
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        // CHẾ ĐỘ TẢI NHANH (DIRECT)
        if (mode === 'direct') {
            const info = await ytdl.getInfo(url);
            const format = ytdl.chooseFormat(info.formats, { quality: '18' });
            res.header('Content-Disposition', `attachment; filename="video_nhanh_${videoId}.mp4"`);
            ytdl(url, { format: format, agent: agent }).pipe(res);
            return;
        }

        // CHẾ ĐỘ CONVERT
        const ext = mode === 'sumo' ? '3gp' : 'mp4';
        
        // --- ĐÃ SỬA LỖI THIẾU DẤU HUYỀN Ở DÒNG DƯỚI NÀY ---
        res.header('Content-Disposition', `attachment; filename="video_${mode}_${videoId}.${ext}"`);

        let stream = ytdl(url, { agent: agent, quality: 'lowest' });
        let command = ffmpeg(stream);

        if (mode === 'sumo') {
            command.size('176x144').videoCodec('h263').audioCodec('aac').audioBitrate('32k').format('3gp');
        } else {
            // HERA MODE
            command.size('320x240').videoCodec('libx264')
                .addOption('-profile:v', 'baseline').addOption('-level', '3.0')
                .audioCodec('aac').videoBitrate('250k').format('mp4');
        }

        command.on('error', (err) => console.log('Lỗi convert: ' + err.message)).pipe(res, { end: true });

    } catch (e) {
        console.log(e);
        res.status(500).send("Lỗi: " + e.message);
    }
});

// Redirect
app.get('/', (req, res) => res.redirect('/youtube'));
app.get('/youtube', (req, res) => res.sendFile(path.join(__dirname, 'public/youtube.html')));
app.get('/game', (req, res) => res.sendFile(path.join(__dirname, 'public/games.html')));

app.listen(process.env.PORT || 3000, () => console.log("Server đang chạy..."));