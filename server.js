const express = require('express');
const app = express();
const path = require('path');

app.use(express.static('public'));

// Cấu hình Server trung gian (Dùng Invidious API)
const INV_DOMAIN = "https://inv.nadeko.net"; 

// 1. API TÌM KIẾM (Nhờ Invidious tìm hộ -> Không lo lỗi gridShelfViewModel)
app.get('/tim-kiem', async (req, res) => {
    try {
        const query = req.query.q;
        // Gọi API tìm kiếm của Invidious
        const response = await fetch(`${INV_DOMAIN}/api/v1/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        // Lọc lấy video
        const videos = data.filter(i => i.type === 'video').slice(0, 15).map(v => ({
            title: v.title,
            id: v.videoId,
            time: v.lengthSeconds, // Invidious trả về tổng số giây
            img: v.videoThumbnails?.[1]?.url || v.videoThumbnails?.[0]?.url // Lấy ảnh nét
        }));
        
        res.json(videos);
    } catch (e) {
        console.log(e);
        res.json([]); 
    }
});

// 2. API LẤY LINK TRỰC TIẾP (Nhờ Invidious lấy link hộ -> Không lo lỗi Sign in)
app.get('/xem-ngay', async (req, res) => {
    // Chống Cache để luôn lấy link tươi mới
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    
    try {
        const id = req.query.id;
        const time = req.query.t || 0;
        
        // Gọi API lấy thông tin video
        const response = await fetch(`${INV_DOMAIN}/api/v1/videos/${id}`);
        const data = await response.json();
        
        // Tìm file MP4 chất lượng 360p hoặc 720p (có cả tiếng và hình)
        // formatStreams là danh sách các file video trực tiếp
        let format = data.formatStreams.find(f => f.resolution === '360p' && f.container === 'mp4');
        
        // Nếu không có 360p thì lấy cái đầu tiên tìm được
        if (!format) format = data.formatStreams.find(f => f.container === 'mp4');

        if (format && format.url) {
            // Redirect thẳng người dùng sang link video gốc
            // Thêm #t=... để tua
            res.redirect(format.url + '#t=' + time);
        } else {
            res.send("<h1>Lỗi: Video này không có link tải trực tiếp (Bản quyền gắt).</h1>");
        }

    } catch (e) {
        res.send(`<h1>Lỗi Invidious: ${e.message}</h1>`);
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server Invidious Proxy Running!"));