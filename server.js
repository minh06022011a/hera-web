const express = require('express');
const app = express();
const path = require('path');

app.use(express.static('public'));

// DANH SÁCH 5 SERVER INVIDIOUS (Chết cái này tự nhảy cái kia)
const SERVERS = [
    "https://inv.tux.pizza",        // Server Châu Âu (Ngon)
    "https://vid.puffyan.us",       // Server Mỹ (Trâu bò)
    "https://invidious.drg.li",     // Server dự phòng 1
    "https://inv.nadeko.net",       // Server cũ (Để cuối cùng)
    "https://invidious.projectsegfault.net" // Server dự phòng 2
];

// Hàm đi săn: Thử từng server một, cái nào sống thì lấy
async function fetchWithFailover(endpoint) {
    for (const domain of SERVERS) {
        try {
            console.log(`Dang thu server: ${domain}...`);
            // Đặt timeout 3 giây để không đợi lâu
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(`${domain}${endpoint}`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            console.log(`Server ${domain} loi, bo qua.`);
            // Lỗi thì vòng lặp tự chạy tiếp sang server sau
        }
    }
    throw new Error("Toàn bộ Server đều bận, sếp thử lại sau!");
}

// 1. API TÌM KIẾM (Đa luồng)
app.get('/tim-kiem', async (req, res) => {
    try {
        const query = req.query.q;
        // Gọi hàm đi săn
        const data = await fetchWithFailover(`/api/v1/search?q=${encodeURIComponent(query)}`);
        
        const videos = data.filter(i => i.type === 'video').slice(0, 15).map(v => ({
            title: v.title,
            id: v.videoId,
            time: v.lengthSeconds,
            img: v.videoThumbnails?.[1]?.url || v.videoThumbnails?.[0]?.url
        }));
        res.json(videos);
    } catch (e) {
        console.log(e);
        res.json([]); 
    }
});

// 2. API LẤY LINK (Đa luồng)
app.get('/xem-ngay', async (req, res) => {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    
    try {
        const id = req.query.id;
        const time = req.query.t || 0;
        
        // Gọi hàm đi săn lấy thông tin video
        const data = await fetchWithFailover(`/api/v1/videos/${id}`);
        
        // Tìm 360p (nhẹ nhất) hoặc MP4 bất kỳ
        let format = data.formatStreams.find(f => f.resolution === '360p' && f.container === 'mp4');
        if (!format) format = data.formatStreams.find(f => f.container === 'mp4');

        if (format && format.url) {
            res.redirect(format.url + '#t=' + time);
        } else {
            res.send("<h1>Lỗi: Không tìm thấy link tải video này.</h1>");
        }

    } catch (e) {
        res.send(`<h1>Lỗi: ${e.message}</h1>`);
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// CẤU HÌNH CHO VERCEL (BẮT BUỘC GIỮ NGUYÊN)
module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log("Server Multi-Invidious Running!"));
}