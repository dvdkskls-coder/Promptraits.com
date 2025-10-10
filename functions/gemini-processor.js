// functions/gemini-processor.js
// ESTA VERSIÓN CONTIENE LA LÓGICA MULTIMODAL, LECTURA DE BASE DE DATOS Y EL PROMPT COMPLETO.

import { GoogleGenAI } from "@google/genai";
// Usamos require para asegurar compatibilidad con el entorno Node.js de Netlify Functions
const fs = require("fs");
const path = require("path");

// ---------------------- CONFIGURACIÓN INICIAL ----------------------
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Rutas a la base de conocimiento
const KNOWLEDGE_PATH = path.join(__dirname, "..", "knowledge");

// ******************************************************************
// 🎯 INSTRUCCIONES CLAVE DE TU GEM (Promptraits) - ¡TEXTO COMPLETO!
// ******************************************************************
const SYSTEM_INSTRUCTION = `
System prompt para agente generador de retratos ultra realistas
Eres Promptraits, un agente experto en crear descripciones hiperrealistas (prompts) para modelos de generación de imágenes. Tu función es entrevistar al usuario, comprender qué tipo de retrato desea y sintetizar toda la información en un único prompt extremadamente detallado y técnico. Dicho prompt se utilizará para generar imágenes fotorrealistas de retratos y debe garantizar que se mantiene la identidad facial de la persona retratada.
Base de conocimiento
Cuentas con una base de datos interna que incluye manuales de Capture One Pro, guías completas de fotografía profesional (iluminación, composición y emoción) y un manual de filtros fotográficos y cinematográficos. Utiliza estos documentos para:
•	Comprender y aplicar estilos fotográficos (editorial, cinematográfico, moda, retrato clásico) y técnicas de iluminación, composición y color.
•	Aplicar ajustes técnicos (exposición, balance de blancos, curvas, capas) y filtros creativos o cinematográficos, sabiendo cuándo es necesario ajustarlos o cuándo mantener la naturalidad de la imagen.
•	Evitar errores comunes y emplear herramientas como Capture One Pro para modificar fondos, aplicar bokeh, controlar la luz o transferir estilos, preservando siempre la textura y los detalles faciales.
Principios generales
1.	Estructura básica del prompt – Un prompt eficaz indica qué se va a mostrar, el estilo/estado de ánimo y los parámetros técnicos.
2.	Preservación de identidad – Si se proporciona una imagen selfie, la IA debe generar el rostro con el 100% de los rasgos, textura de piel y cabello de la foto original, sin retoques, suavizado o alteración de la edad.
3.	Adaptación de Referencia – Si se adjunta una imagen de referencia, extrae y aplica su esquema de iluminación, vestuario, pose y composición al rostro del usuario.
4.	Tono – Mantén un tono profesional, técnico y editorial.

Protocolos de salida
•	Tu respuesta debe ser un prompt monolítico, sin separaciones ni enumeraciones, pero claramente dividido por comas y guiones para la legibilidad del modelo de IA.
•	El prompt debe contener los bloques técnicos (cámara, óptica, iluminación, postprocesado) que el usuario necesita.
•	Al final del prompt incluye una sección de Keywords.

Reglas de Contenido
•	Si no hay selfie, genera un sujeto genérico (unisex/neutro) con la descripción, listo para ser sustituido si el usuario envía una más tarde.
•	Si se proporciona una imagen de referencia sin especificar el estilo, replícalo.

Estructura del Prompt (EN) ten en cuenta el documento de referencia (obligatorio): Antes de redactar cualquier salida, lee y aplica el archivo de conocimiento “FORMATO OBLIGATORIO DEL PROMPT.txt”. Trátalo como fuente de verdad para la estructura y estilo del prompt (8 líneas, sin encabezados). Si el archivo contradice cualquier instrucción, prevalece el archivo. Si el archivo no está disponible/legible, replica fielmente el formato de 8 líneas indicado en este System Prompt y declara internamente que se ha usado el fallback (no lo menciones en la respuesta al usuario).

// Regla Crucial para la API: Tu respuesta final debe ser solo texto plano o, preferiblemente, un objeto JSON si la aplicación lo necesita para su estructura.
// Por ejemplo: Tienes prohibido usar cualquier tipo de saludo o despedida.
`;
// ******************************************************************

// ---------------------- LÓGICA DE LECTURA DE ARCHIVOS ----------------------
function loadKnowledgeBase() {
  let knowledgeContent = "\n## KNOWLEDGE BASE START\n\n";

  try {
    const files = fs.readdirSync(KNOWLEDGE_PATH);

    files.forEach((file) => {
      const filePath = path.join(KNOWLEDGE_PATH, file);
      // Solo procesa archivos de texto (txt o md) y evita directorios
      if (
        fs.lstatSync(filePath).isFile() &&
        (file.endsWith(".txt") || file.endsWith(".md"))
      ) {
        const fileContent = fs.readFileSync(filePath, "utf8");

        // Agrega el contenido, identificando qué archivo es
        knowledgeContent += `--- Contenido de: ${file} ---\n${fileContent}\n\n`;
      }
    });

    knowledgeContent += "## KNOWLEDGE BASE END\n";
    return knowledgeContent;
  } catch (e) {
    console.error(
      "Error al cargar la base de conocimiento (Server Side):",
      e.message
    );
    return `\n## KNOWLEDGE BASE START - ERROR\n\nNo se pudo cargar la base de conocimiento: ${e.message}\n\n## KNOWLEDGE BASE END\n`;
  }
}

const KNOWLEDGE_BASE_TEXT = loadKnowledgeBase();

// ---------------------- HANDLER DE NETLIFY FUNCTION ----------------------

exports.handler = async (event) => {
  // 1. Manejo del Payload Multimodal (Texto y Base64 de las imágenes)
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Método no permitido" };
  }

  try {
    // Obtenemos los datos del frontend (texto y bases de imágenes)
    const { prompt, selfieImage, referenceImage } = JSON.parse(event.body);

    // 2. Construcción del Prompt Multimodal para la API
    let contents = [];

    // El cuerpo del prompt (reglas y conocimiento)
    let textPrompt =
      KNOWLEDGE_BASE_TEXT + "\n\nPetición del usuario: " + prompt;

    // Añadir imagen Selfie (para el rostro)
    if (selfieImage) {
      // Empuja la imagen como objeto de datos en línea
      contents.push({
        inlineData: {
          mimeType: "image/jpeg", // Asumimos JPEG
          data: selfieImage,
        },
      });
      textPrompt +=
        "\n\n[IMAGEN DE SELFIE ADJUNTADA. UTILIZA ESTE ROSTRO EXACTO.]";
    }

    // Añadir imagen de Referencia (para estilo)
    if (referenceImage) {
      // Empuja la imagen de referencia como objeto de datos en línea
      contents.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: referenceImage,
        },
      });
      textPrompt +=
        "\n\n[IMAGEN DE REFERENCIA ADJUNTADA. UTILIZA ESTE ESTILO, ATMÓSFERA Y ENTORNO.]";
    }

    // El texto (incluyendo el conocimiento) va al final del array de 'contents'
    contents.push({ text: textPrompt });

    // 3. Llamada a Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Modelo multimodal
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    // 4. Devuelve el texto generado por Gemini
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/plain" },
      body: response.text,
    };
  } catch (error) {
    console.error("Error grave en la función de servidor:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error:
          "Fallo interno del servidor al procesar la IA. Detalle: " +
          error.message,
      }),
    };
  }
};
