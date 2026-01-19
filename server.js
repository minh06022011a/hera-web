const express = require('express');
const app = express();
const path = require('path');

// Mở thư mục public để chạy web
app.use(express.static('public'));

// Vào trang chủ thì hiện file html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Chạy server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Web đã chạy tại port ${PORT}`);
});