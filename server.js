const express = require('express');
const app = express();
const path = require('path');

app.use(express.static('public'));

// DANH SÁCH SERVER MẠNH NHẤT HIỆN TẠI (Đã lọc)
const SERVERS = [
    "https://inv.tux.pizza",
    "https://vid.puffyan.us",
    "https://invidious.drg.li",
    "https://yt.artemislena.eu",
    "https://invidious.protokolla.fi"
];

// Hàm đi săn có Timeout (3 giây quá lâu thì bỏ qua ngay)
async function fetchWithTimeout(url, timeout = 3000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

// 1. API TÌM KIẾM (Thử lần lượt các server)
app.get('/tim-kiem', async (req, res) => {
    try {
        const query = req.query.q;
        let data = null;

        // Vòng lặp thử từng server
        for (const domain of SERVERS) {
            try {
                console.log(`Dang tim tai: ${domain}`);
                const resApi = await fetchWithTimeout(`${domain}/api/v1/search?q=${encodeURIComponent(query)}`);
                if (resApi.ok) {
                    data = await resApi.json();
                    break; // Tìm được rồi thì thoát vòng lặp
                }
            } catch (e) { continue; }
        }

        if (!data) return res.json([]); // Hết cách thì trả về rỗng

        // Lọc lấy video
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

// 2. API LẤY LINK (CÓ DỰ PHÒNG EMBED)
app.get('/xem-ngay', async (req, res) => {
    // Chống cache tuyệt đối
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    
    const id = req.query.id;
    const time = req.query.t || 0;

    try {
        let videoUrl = null;

        // A. CHIẾN THUẬT SĂN LINK MP4 (Nhanh)
        for (const domain of SERVERS) {
            try {
                const resApi = await fetchWithTimeout(`${domain}/api/v1/videos/${id}`);
                if (resApi.ok) {
                    const data = await resApi.json();
                    // Tìm file MP4 360p hoặc bất kỳ
                    let format = data.formatStreams.find(f => f.resolution === '360p' && f.container === 'mp4');
                    if (!format) format = data.formatStreams.find(f => f.container === 'mp4');
                    
                    if (format && format.url) {
                        videoUrl = format.url;
                        break; // Có link ngon thì dừng
                    }
                }
            } catch (e) { continue; }
        }

        // B. QUYẾT ĐỊNH CUỐI CÙNG
        if (videoUrl) {
            // Trường hợp 1: Có link MP4 xịn -> Redirect sang MP4 (Tua được)
            res.redirect(videoUrl + '#t=' + time);
        } else {
            // Trường hợp 2: Thất bại toàn tập -> Redirect sang Youtube Embed (Chậm nhưng chắc chắn chạy)
            // Dùng youtube-nocookie để nhẹ hơn bản gốc
            console.log("Fallback sang Embed");
            res.redirect(`https://www.youtube-nocookie.com/embed/${id}?start=${time}&autoplay=1`);
        }

    } catch (e) {
        // Trường hợp 3: Lỗi hệ thống -> Vẫn ném sang Embed cho chắc
        res.redirect(`https://www.youtube-nocookie.com/embed/${id}?start=${time}&autoplay=1`);
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// CẤU HÌNH VERCEL
module.exports = app;
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log("Server Fail-Safe Running!"));
}