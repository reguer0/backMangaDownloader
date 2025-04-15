

// backend/routes/manga.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const archiver = require('archiver');


const BASE_URL = 'https://api.mangadex.org';

// Ruta 1: Buscar manga por título
// Ejemplo: GET /api/manga/search?title=Blue Exorcist
router.get('/search', async (req, res) => {
  const { title } = req.query;

  if (!title) return res.status(400).json({ error: 'Falta el parámetro "title"' });

  try {
    const response = await axios.get(`${BASE_URL}/manga`, {
      params: { title }
    });

    if (response.data.data.length === 0) {
      return res.status(404).json({ error: 'Manga no encontrado' });
    }

    const manga = response.data.data[0];
    res.json({ id: manga.id });
  } catch (err) {
    res.status(500).json({ error: 'Error buscando manga' });
  }
});

// Ruta 2: Obtener capítulos por mangaId y rango
// Ejemplo: GET /api/manga/:id/chapters?start=0&end=12
router.get('/:id/chapters', async (req, res) => {
  const { id } = req.params;
  const { start = 0, end = 10 } = req.query;

  console.log(`📥 Buscando capítulos para manga ${id} del capítulo ${start} al ${end}`);

  try {
    const response = await axios.get(`${BASE_URL}/chapter`, {
      params: {
        manga: id,
       'translatedLanguage[]': ['es', 'en'], // <-- español e inglés
        'order[chapter]': 'asc',
        limit: 100
      }
    });

    
    const allChapters = response.data.data;   

    

    const filtered = allChapters.filter((ch) => {
      const num = parseFloat(ch.attributes.chapter);
      return !isNaN(num) && num >= parseFloat(start) && num <= parseFloat(end);
    });
   



    console.log(`✅ Capítulos encontrados: ${filtered.length}`);
    res.json(filtered);
  } catch (err) {
    console.error('❌ Error en /chapters:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error obteniendo capítulos' });
  }
});


// Función para obtener las imágenes de un capítulo por su ID
async function getChapterImages(chapterId) {
  try {
    const response = await axios.get(`${BASE_URL}/at-home/server/${chapterId}`);
    const baseUrl = response.data.baseUrl;
    const chapterHash = response.data.chapter.hash;
    const images = response.data.chapter.data;
    
    return images.map(img => `${baseUrl}/data/${chapterHash}/${img}`);
  } catch (err) {
    console.error("Error obteniendo imágenes del capítulo:", err);
    throw new Error("No se pudieron obtener las imágenes del capítulo.");
  }
}

// Ruta para descargar un solo capítulo como ZIP
router.get('/:chapterId/download', async (req, res) => {
  const { chapterId } = req.params;
  const { lang } = req.query; // El idioma (es o en)

  try {
    console.log(`📥 Descargando capítulo ${chapterId} en ${lang}`);
    const images = await getChapterImages(chapterId);

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.attachment(`chapter-${chapterId}-${lang}.zip`);
    archive.pipe(res);

    // Agregar cada imagen al archivo ZIP
    for (let i = 0; i < images.length; i++) {
      const imgRes = await axios.get(images[i], { responseType: 'arraybuffer' });
      archive.append(imgRes.data, { name: `page_${i + 1}.jpg` });
    }

    await archive.finalize();
   
  } catch (err) {
    console.error("❌ Error al crear el ZIP para el capítulo:", err.message);
    res.status(500).json({ error: 'Error al generar el archivo de descarga.' });
  }
});

// Ruta para descargar todos los capítulos de un rango como ZIP
router.get('/:mangaId/downloadAll', async (req, res) => {
  const { mangaId } = req.params;
  const { lang, start, end } = req.query;

  try {
    console.log(`📥 Descargando capítulos ${start} a ${end} de manga ${mangaId} en ${lang}`);

    const allChapters = await getChaptersInRange(mangaId, start, end, lang); // Obtener capítulos en el rango
    const archive = archiver('zip', { zlib: { level: 9 } });
    res.attachment(`manga-${mangaId}-${lang}-chapters.zip`);
    archive.pipe(res);

    for (const chapter of allChapters) {
      const images = await getChapterImages(chapter.id);
      for (let i = 0; i < images.length; i++) {
        const imgRes = await axios.get(images[i], { responseType: 'arraybuffer' });
        archive.append(imgRes.data, { name: `chapter-${chapter.attributes.chapter}/page_${i + 1}.jpg` });
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error("❌ Error al crear el ZIP para los capítulos:", err.message);
    res.status(500).json({ error: 'Error al generar el archivo de descarga.' });
  }
});

// Función para obtener capítulos en un rango de un manga específico (idioma y rango)
async function getChaptersInRange(mangaId, start, end, lang) {
  try {
    const response = await axios.get(`${BASE_URL}/chapter`, {
      params: {
        manga: mangaId,
        'translatedLanguage[]': lang,
        'order[chapter]': 'asc',
        limit: 100
      }
    });

    const chapters = response.data.data;
    return chapters.filter(chapter => {
      const chapterNumber = parseFloat(chapter.attributes.chapter);
      return !isNaN(chapterNumber) && chapterNumber >= parseFloat(start) && chapterNumber <= parseFloat(end);
    });
  } catch (err) {
    console.error("❌ Error obteniendo capítulos en rango:", err.message);
    throw new Error("No se pudieron obtener los capítulos.");
  }
}



module.exports = router;
