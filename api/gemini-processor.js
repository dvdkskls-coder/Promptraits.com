// api/gemini-processor.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Solo acepta POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { prompt, referenceImage, mimeType } = req.body;

    // Validación básica
    if (!prompt && !referenceImage) {
      return res.status(400).json({ error: 'Debes proporcionar un prompt o una imagen' });
    }

    // Inicializa Gemini con tu API key desde variables de entorno
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let result;

    if (referenceImage) {
      // Si hay imagen, procesa con visión
      const imageParts = [
        {
          inlineData: {
            data: referenceImage,
            mimeType: mimeType || "image/jpeg"
          }
        }
      ];

      const promptText = prompt || "Analiza esta imagen y genera un prompt detallado para recrear un retrato similar con IA, incluyendo iluminación, composición, estilo fotográfico y ajustes técnicos.";
      
      result = await model.generateContent([promptText, ...imageParts]);
    } else {
      // Solo texto
      const fullPrompt = `Eres un experto en fotografía profesional y prompts para IA. 
      
El usuario quiere: ${prompt}

Genera un prompt técnico y detallado para crear un retrato profesional que incluya:
- Descripción de la escena y sujeto
- Iluminación específica (tipo, ángulo, temperatura de color)
- Configuración de cámara (focal, apertura, ISO, velocidad)
- Composición y encuadre
- Estilo de post-procesamiento
- Keywords técnicos

El prompt debe ser preciso, profesional y listo para usar en herramientas como Midjourney, DALL-E o Stable Diffusion.`;

      result = await model.generateContent(fullPrompt);
    }

    const response = await result.response;
    const text = response.text();

    return res.status(200).send(text);

  } catch (error) {
    console.error('Error en Gemini:', error);
    return res.status(500).json({ 
      error: 'Error al procesar la solicitud',
      details: error.message 
    });
  }
}
