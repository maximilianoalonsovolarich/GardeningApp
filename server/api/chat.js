const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const router = express.Router();
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const sessions = {};

const systemInstruction =
  'Eres un experto en plantas que responde preguntas solo sobre plantas...';

router.post('/', async (req, res) => {
  const { sessionId, message } = req.body;
  // Toda la lógica del manejo de sesiones y generación de respuestas
  // ...
  res.json({ message: 'Respuesta generada por el modelo' });
});

module.exports = router;
