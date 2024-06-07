const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const sessions = {};

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: 'text/plain',
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now());
  },
});
const upload = multer({ storage: storage });

// Endpoint to handle chat messages
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res
      .status(400)
      .json({ error: 'Session ID and message are required' });
  }

  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      model: genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }),
      history: [],
    };
  }

  try {
    const chatSession = sessions[sessionId].model.startChat({
      generationConfig,
      history: sessions[sessionId].history,
    });

    const result = await chatSession.sendMessage(message);
    const aiMessage = result.response.text();

    // Update session history with user and model responses
    sessions[sessionId].history.push({
      role: 'user',
      parts: [{ text: message }],
    });
    sessions[sessionId].history.push({
      role: 'model',
      parts: [{ text: aiMessage }],
    });

    res.json({ message: aiMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Error sending message' });
  }
});

// Endpoint to handle image uploads
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  const { sessionId } = req.body;

  console.log('Received body:', req.body);
  console.log('Received file:', req.file);

  if (!sessionId || !req.file) {
    return res.status(400).json({ error: 'Session ID and image are required' });
  }

  const imagePath = req.file.path;

  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      model: genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }),
      history: [],
    };
  }

  try {
    // Leer la imagen desde el sistema de archivos
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const prompt = 'Analyze this image.';
    const image = {
      inlineData: {
        data: base64Image,
        mimeType: req.file.mimetype,
      },
    };

    // Enviar la imagen y el prompt al modelo
    const result = await sessions[sessionId].model.generateContent([
      prompt,
      image,
    ]);
    const aiMessage = result.response.text();

    // Actualizar el historial de la sesión
    sessions[sessionId].history.push({
      role: 'user',
      parts: [{ text: 'Image uploaded' }],
    });
    sessions[sessionId].history.push({
      role: 'model',
      parts: [{ text: aiMessage }],
    });

    // Responder con el mensaje del AI y la URL de la imagen
    res.json({
      message: aiMessage,
      imageUrl: `http://localhost:${port}/uploads/${req.file.filename}`,
    });
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: 'Error processing image' });
  }
});

// Servir imágenes subidas
app.use('/uploads', express.static('uploads'));

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
