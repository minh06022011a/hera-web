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

// FILE LƯU LỊCH SỬ CỤC BỘ
const HISTORY_FILE = 'history.json';

// Hàm lưu lịch sử (An toàn)
function saveToHistory(videoInfo) {
    let history = [];
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE);
            if (data.length > 0) history = JSON.parse(data);
        }
        // Lọc bỏ video trùng (giữ lại cái mới nhất)
        history = history.filter(v => v.id !== videoInfo.id);
        history.unshift(videoInfo);
        if (history.length > 50) history.length = 50; // Chỉ lưu 50 cái
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history));
    } catch (e) { console.log("Lỗi lưu history: " + e.message); }
}

// Load Cookie (Nếu có thì tốt, ko có vẫn chạy)
let agent = null;
try {
    if (fs.existsSync('cookie.json')) {
        const cookies = JSON.parse(fs.readFileSync('cookie.json'));
        agent = ytdl.createAgent(cookies);
        console.log("--> Đã nạp Cookie!");
    }
} catch (err) {}

// 1. API TÌM KIẾM (BẢN BẤT TỬ - CHỐNG SẬP)
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);

        // Tìm kiếm
        const searchResults = await ytsr(query, { limit: 20 });
        
        // LỌC DỮ LIỆU RÁC (Quan trọng)
        const videos = searchResults.items
            .filter(item => item && item.type === 'video') // Chỉ lấy Video
            .map(item => {
                // Dùng dấu ?. để nếu không có ảnh thì cũng ko được báo lỗi
                return {
                    title: item.title || 'Không tiêu đề',
                    id: item.id,
                    // Nếu không có ảnh thì lấy ảnh rỗng, ko crash
                    thumbnail: item.bestThumbnail?.url || item.thumbnails?.[0]?.url || 'https://via.placeholder.com/150',
                    duration: item.duration || '??:??'
                };
            });

        res.json(videos);
    } catch (e) { 
        console.error(e);
        // Trả về danh sách rỗng thay vì lỗi chết người
        res.json([]); 
    }
});

// 2. API LỊCH SỬ
app.get('/api/history', (req, res) => {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            res.sendFile(path.join(__dirname, HISTORY_FILE));
        } else {
            res.json([]); // Chưa có file thì trả về rỗng
        }
    } catch(e) { res.json([]); }
});

// 3. API TẢI VIDEO
app.get('/download', async (req, res) => {
    try {
        const videoId = req.query.id;
        const mode = req.query.mode || 'sumo';
        const url = `https://www.youtube.com/watch?v=${videoId}`;

        // LƯU VÀO LỊCH SỬ KHI BẤM TẢI
        // (Lấy info cơ bản để lưu tên và ảnh)
        ytdl.getBasicInfo(url, { agent }).then(info => {
            saveToHistory({
                title: info.videoDetails.title,
                id: videoId,
                thumbnail: info.videoDetails.thumbnails?.[0]?.url || '',
                duration: 'Đã tải'
            });
        }).catch(err => console.log("Ko lấy dc info để lưu sử: " + err));

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

app.listen(process.env.PORT || 3000, () => console.log("Server chạy ngon!"));