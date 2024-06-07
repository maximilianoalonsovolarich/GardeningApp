const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Rutas
app.use('/api/chat', require('./api/chat'));
app.use('/api/upload', require('./api/upload'));

app.get('/test', (req, res) => {
  res.send('Servidor accesible');
});

app.listen(port, () => {
  console.log(`Servidor en ejecución en http://localhost:${port}`);
});
