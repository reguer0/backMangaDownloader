// backend/index.js
const express = require('express');
const cors = require('cors');
const mangaRoutes = require('./routes/manga');

const app = express();
const PORT = 3001;

app.use(cors()); // Habilita CORS para que el frontend pueda comunicarse con este backend
app.use(express.json());

// Rutas principales
app.use('/api/manga', mangaRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
