const express = require('express');
const app = express();
const port = process.env.PORT || 80;

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/data/index.html');
});

app.get('/script.js', (req, res) => {
    res.sendFile(__dirname + '/data/script.js');
});

app.get('/style.css', (req, res) => {
    res.sendFile(__dirname + '/data/style.css');
});
