// --- API TẢI VIDEO (BẢN FIX LỖI) ---
app.get('/download', async (req, res) => {
    try {
        const videoId = req.query.id;
        const mode = req.query.mode || 'sumo';
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        // 1. CHẾ ĐỘ TẢI NHANH (DIRECT) - KHÔNG CONVERT
        // Dành cho Hera nếu bị lỗi "Contact Vendor" do chờ lâu
        if (mode === 'direct') {
            const info = await ytdl.getInfo(url);
            // Chọn định dạng MP4 có cả tiếng và hình (thường là itag 18 - 360p)
            const format = ytdl.chooseFormat(info.formats, { quality: '18' });
            
            res.header('Content-Disposition', `attachment; filename="video_nhanh_${videoId}.mp4"`);
            ytdl(url, { format: format, agent: agent }).pipe(res);
            return;
        }

        // 2. CHẾ ĐỘ CONVERT (SUMO/HERA) - CÓ THỂ CHẬM
        const ext = mode === 'sumo' ? '3gp' : 'mp4';
        res.header('Content-Disposition', `attachment; filename="video_${mode}_${videoId}.${ext"`);

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
        res.status(500).send("Lỗi rồi sếp ơi: " + e.message);
    }
});