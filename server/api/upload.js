const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const router = express.Router();
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const sessions = {};

const systemInstruction =
  'Eres un experto en plantas que responde preguntas solo sobre plantas, puedes analizar imágenes solo si son de plantas...';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now());
  },
});
const upload = multer({ storage: storage });

router.post('/', upload.single('image'), async (req, res) => {
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
    const image = {
      inlineData: { data: base64Image, mimeType: req.file.mimetype },
    };

    const prompt =
      '¿Puedes analizar esta imagen y decirme qué tipo de planta es?';
    const result = await sessions[sessionId].model.generateContent([
      prompt,
      image,
    ]);
    const aiMessage = result.response.text();

    let finalMessage = aiMessage.includes('planta')
      ? aiMessage
      : 'No puedo responder sobre esta imagen, ya que no es una planta.';
    res.json({
      message: finalMessage,
      imageUrl: `http://localhost:${port}/uploads/${req.file.filename}`,
    });
  } catch (error) {
    console.error('Error al procesar la imagen:', error);
    res.status(500).json({ error: 'Error al procesar la imagen.' });
  }
});

module.exports = router;
