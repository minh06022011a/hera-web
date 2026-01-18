const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search'); // Dùng cái này bao bền
const ytpl = require('ytpl');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

app.use(cors());
app.use(express.static('public'));

// NẠP COOKIE (CÓ CHECK LỖI ĐỂ KHÔNG SẬP SERVER)
let agent = null;
try {
    if (fs.existsSync('cookie.json')) {
        const fileContent = fs.readFileSync('cookie.json', 'utf8');
        // Kiểm tra xem có phải JSON xịn không
        if (fileContent.trim().startsWith('[')) {
            const cookies = JSON.parse(fileContent);
            agent = ytdl.createAgent(cookies);
            console.log("--> Cookie ngon, đã nạp!");
        } else {
            console.log("--> LỖI: File cookie.json chứa rác (HTML?), bỏ qua.");
        }
    }
} catch (err) { console.log("--> Bỏ qua cookie lỗi: " + err.message); }

// 1. TÌM KIẾM (FIXED)
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);
        
        const r = await yts(query);
        const videos = r.videos.slice(0, 15).map(v => ({
            title: v.title,
            id: v.videoId,
            thumbnail: v.thumbnail,
            duration: v.timestamp
        }));
        res.json(videos);
    } catch (e) { 
        console.log(e);
        res.json([]); 
    }
});

// 2. PLAYLIST
app.get('/api/playlist', async (req, res) => {
    try {
        const listId = req.query.id;
        if (!listId) return res.status(400).json({ error: "Thiếu ID" });
        const playlist = await ytpl(listId, { limit: 20 });
        const videos = playlist.items.map(item => ({
            title: item.title,
            id: item.id,
            thumbnail: item.bestThumbnail?.url,
            duration: item.duration || '??:??'
        }));
        res.json(videos);
    } catch (e) { res.status(500).json({ error: "Lỗi Playlist: " + e.message }); }
});

// 3. TẢI VIDEO
app.get('/download', async (req, res) => {
    try {
        const videoId = req.query.id;
        const mode = req.query.mode || 'sumo';
        const url = `https://www.youtube.com/watch?v=${videoId}`;

        if (mode === 'direct') {
            // Tải nhanh (dùng cookie nếu có)
            const info = await ytdl.getInfo(url, { agent });
            const format = ytdl.chooseFormat(info.formats, { quality: '18' });
            res.header('Content-Disposition', `attachment; filename="video_nhanh_${videoId}.mp4"`);
            ytdl(url, { format: format, agent }).pipe(res);
            return;
        }

        // Convert
        const ext = mode === 'sumo' ? '3gp' : 'mp4';
        res.header('Content-Disposition', `attachment; filename="video_${mode}_${videoId}.${ext}"`);
        
        let stream = ytdl(url, { agent, quality: 'lowest' });
        let command = ffmpeg(stream);

        if (mode === 'sumo') {
            command.size('176x144').videoCodec('h263').audioCodec('aac').audioBitrate('32k').format('3gp');
        } else {
            command.size('320x240').videoCodec('libx264')
                .addOption('-profile:v', 'baseline').addOption('-level', '3.0')
                .audioCodec('aac').videoBitrate('250k').format('mp4');
        }
        command.on('error', err => console.log('Convert lỗi: ' + err)).pipe(res, { end: true });

    } catch (e) { res.status(500).send("Lỗi tải: " + e.message); }
});

app.get('/', (req, res) => res.redirect('/youtube'));
app.get('/youtube', (req, res) => res.sendFile(path.join(__dirname, 'public/youtube.html')));

app.listen(process.env.PORT || 3000, () => console.log("Server Sống!"));