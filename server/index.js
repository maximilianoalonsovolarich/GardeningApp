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

const systemInstruction =
  'Eres un experto en plantas que responde preguntas solo sobre plantas, puedes analizar imágenes solo si son de plantas. Responde en español. No te salgas del contexto de plantas. Solo la debes analizar y decir que es si es algo relacionado con las plantas o vivero, si es otra cosa no debes dar informacion de lo que es ni analizarla. Eres un experto en plantas y debes responder solo sobre plantas su nombre cientifico mejor epoca para plantarla en argentina y datos extras que puedas aportar sobre la planta.';

app.post('/api/chat', async (req, res) => {
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
        systemInstruction,
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
        systemInstruction,
      }),
      history: [],
    };
  }

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const prompt =
      '¿Puedes analizar esta imagen y decirme qué tipo de planta es? Solo la debes analizar y decir que es si es algo relacionado con las plantas o vivero, si es otra cosa no debes dar informacion de lo que es ni analizarla. Eres un experto en plantas y debes responder solo sobre plantas su nombre cientifico mejor epoca para plantarla en argentina y datos extras que puedas aportar sobre la planta.';
    const image = {
      inlineData: { data: base64Image, mimeType: req.file.mimetype },
    };

    const result = await sessions[sessionId].model.generateContent([
      prompt,
      image,
    ]);
    const aiMessage = result.response.text();

    let finalMessage =
      'No puedo responder sobre esta imagen, ya que no es una planta.';
    if (aiMessage.includes('planta')) {
      finalMessage = aiMessage;
    }

    sessions[sessionId].history.push({
      role: 'user',
      parts: [{ text: 'Imagen subida' }],
    });
    sessions[sessionId].history.push({
      role: 'model',
      parts: [{ text: finalMessage }],
    });

    res.json({
      message: finalMessage,
      imageUrl: `http://localhost:${port}/uploads/${req.file.filename}`,
    });
  } catch (error) {
    console.error('Error al procesar la imagen:', error);
    res.status(500).json({ error: 'Error al procesar la imagen.' });
  }
});

app.get('/test', (req, res) => {
  res.send('Servidor accesible');
});

app.use('/uploads', express.static('uploads'));

app.listen(port, () => {
  console.log(`Servidor en ejecución en http://localhost:${port}`);
});
