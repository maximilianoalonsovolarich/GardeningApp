const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
require('dotenv').config();

const app = express();
const port = 5000;

// Configuración de CORS
const corsOptions = {
  origin: '*', // Cambia esto para permitir solo los orígenes necesarios
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const sessions = {};

const generationConfig = {
  temperature: 0.7,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 512,
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

app.post('/api/chat', async (req, res) => {
  console.log('Solicitud recibida:', req.body);
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res
      .status(400)
      .json({ error: 'Se requiere el ID de la sesión y un mensaje.' });
  }

  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      model: genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction:
          'Eres un experto en plantas que responde preguntas solo sobre plantas, tampoco puedes analizar imagenes que no sean de plantas. Responde en español. No te salgas del contexto de plantas. Al final de cada respuesta, incluye la siguiente línea: "Para más información, visita Vivero Cosa Linda en Merlo, Buenos Aires. Horarios: Lunes a Sábado de 8:00 a 17:00."',
      }),
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
    console.error('Error al enviar el mensaje:', error);
    res.status(500).json({ error: 'Error al enviar el mensaje.' });
  }
});

app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  console.log('Solicitud de subida de imagen recibida:', req.body);
  const { sessionId } = req.body;

  if (!sessionId || !req.file) {
    return res
      .status(400)
      .json({ error: 'Se requiere el ID de la sesión y una imagen.' });
  }

  const imagePath = req.file.path;

  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      model: genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction:
          'Eres un experto en plantas que responde preguntas solo sobre plantas, tampoco puedes analizar imagenes que no sean de plantas. Responde en español. No te salgas del contexto de plantas. Al final de cada respuesta, incluye la siguiente línea: "Para más información, visita Vivero Cosa Linda en Merlo, Buenos Aires. Horarios: Lunes a Sábado de 8:00 a 17:00."',
      }),
      history: [],
    };
  }

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const prompt =
      '¿Puedes analizar esta imagen y decirme qué tipo de planta es?';
    const image = {
      inlineData: {
        data: base64Image,
        mimeType: req.file.mimetype,
      },
    };

    const result = await sessions[sessionId].model.generateContent([
      prompt,
      image,
    ]);
    const aiMessage = result.response.text();

    sessions[sessionId].history.push({
      role: 'user',
      parts: [{ text: 'Imagen subida' }],
    });
    sessions[sessionId].history.push({
      role: 'model',
      parts: [{ text: aiMessage }],
    });

    res.json({
      message: aiMessage,
      imageUrl: `http://localhost:${port}/uploads/${req.file.filename}`,
    });
  } catch (error) {
    console.error('Error al procesar la imagen:', error);
    res.status(500).json({ error: 'Error al procesar la imagen.' });
  }
});

app.use('/uploads', express.static('uploads'));

// Configuración HTTPS
const options = {
  key: fs.readFileSync('path/to/your/privkey.pem'),
  cert: fs.readFileSync('path/to/your/fullchain.pem'),
};

https.createServer(options, app).listen(port, () => {
  console.log(`Servidor en ejecución en https://localhost:${port}`);
});
