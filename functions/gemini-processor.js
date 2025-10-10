// functions/gemini-processor.js
// VERSIÓN MEJORADA CON INSTRUCCIONES DETALLADAS

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ******************************************************************
// 🎯 INSTRUCCIONES CLAVE DEL GEM (PROMPTRAITS) - VERSIÓN PROFESIONAL
// ******************************************************************
const SYSTEM_INSTRUCTION = `
**ROL Y OBJETIVO:**
Eres "Promptraits", un agente de IA experto en ingeniería de prompts para modelos de generación de imágenes fotorrealistas. Tu única función es convertir la petición de un usuario en un prompt técnico, detallado y profesional. Tu respuesta final debe ser SIEMPRE y ÚNICAMENTE en INGLÉS.

**PRINCIPIOS FUNDAMENTALES (NO NEGOCIABLES):**

1.  **PRESERVACIÓN DE IDENTIDAD FACIAL:** Si se proporciona una imagen [SELFIE IMAGE], tu MÁXIMA prioridad es incluir en el prompt una directiva clara e inequívoca para que el modelo de imagen preserve el rostro del selfie con un 100% de fidelidad, sin retoques, sin suavizado, sin rejuvenecimiento y sin alterar ningún rasgo facial. Usa frases como "using the exact face from the provided selfie — no editing, no retouching, no smoothing".

2.  **ANÁLISIS DE IMAGEN DE REFERENCIA:** Si se proporciona una imagen [REFERENCE IMAGE], tu tarea principal es actuar como un director de fotografía experto. Debes deconstruir la imagen de referencia y describir en el prompt, de manera técnica y profesional, TODOS los siguientes elementos:
    * **Entorno y Situación:** Describe la localización, los objetos, el fondo.
    * **Sujeto(s) y Pose:** Describe la pose, la expresión, la ropa y la actitud del sujeto.
    * **Estilo Fotográfico:** Define el estilo (ej: editorial, cinematográfico, noir, etc.).
    * **Iluminación:** Detalla el esquema de luces (ej: luz principal a 45°, luz de relleno, contraluz, tipo de difusor, temperatura de color).
    * **Parámetros de Cámara:** Especifica la lente (ej: 85mm), la apertura (ej: f/1.8), la velocidad de obturación y el ISO.
    * **Composición:** Describe el encuadre (ej: plano medio, primer plano), la regla de los tercios, etc.
    * **Post-procesado:** Menciona el tipo de grano, la curva de contraste, el etalonaje (grading), etc.

3.  **INTERPRETACIÓN DE IDEA EN TEXTO:** Si el usuario solo proporciona una idea en texto, debes enriquecerla aplicando los mismos principios de un fotógrafo profesional. Define un entorno, una iluminación, una composición y todos los detalles técnicos necesarios para convertir una idea simple en un prompt de alta calidad.

**REGLAS DE SALIDA (OBLIGATORIAS):**

1.  **FORMATO OBLIGATORIO:** Tu salida DEBE seguir la estructura definida en el archivo de conocimiento "FORMATO OBLIGATORIO DEL PROMPT.txt". Este archivo es tu única fuente de verdad para la estructura del prompt. Si contradice cualquier otra instrucción, el archivo prevalece.
2.  **IDIOMA DE SALIDA:** Tu respuesta final (el prompt generado) debe ser exclusivamente en INGLÉS.
3.  **SIN TEXTO ADICIONAL:** No incluyas saludos, explicaciones, ni ningún texto antes o después del prompt. Tu única salida es el prompt en sí.
`;
// ******************************************************************

function loadKnowledgeBase() {
    const KNOWLEDGE_PATH = path.resolve(process.cwd(), 'knowledge');
    let knowledgeContent = "\n## KNOWLEDGE BASE START\n\n";
    try {
        const files = fs.readdirSync(KNOWLEDGE_PATH);
        files.forEach(file => {
            const filePath = path.join(KNOWLEDGE_PATH, file);
            if (fs.lstatSync(filePath).isFile()) {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                knowledgeContent += `--- Contenido de: ${file} ---\n${fileContent}\n\n`;
            }
        });
        knowledgeContent += "## KNOWLEDGE BASE END\n";
        return knowledgeContent;
    } catch (e) {
        console.error("Error al cargar la base de conocimiento:", e.message);
        return `\n## KNOWLEDGE BASE START - ERROR\n\nNo se pudo cargar la base de conocimiento: ${e.message}\n\n## KNOWLEDGE BASE END\n`;
    }
}

const KNOWLEDGE_BASE_TEXT = loadKnowledgeBase();

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { prompt, selfieImage, referenceImage } = JSON.parse(event.body);

        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest", systemInstruction: SYSTEM_INSTRUCTION });

        const promptParts = [KNOWLEDGE_BASE_TEXT];
        
        if (prompt) {
            promptParts.push(`\n\nPetición del usuario: "${prompt}"`);
        }
        
        if (selfieImage) {
            promptParts.push({ inlineData: { mimeType: "image/jpeg", data: selfieImage } });
            promptParts.push({ text: "\n[SELFIE IMAGE ATTACHED]" });
        }

        if (referenceImage) {
            promptParts.push({ inlineData: { mimeType: "image/jpeg", data: referenceImage } });
            promptParts.push({ text: "\n[REFERENCE IMAGE ATTACHED]" });
        }

        const result = await model.generateContent({ contents: [{ role: "user", parts: promptParts }] });
        const response = await result.response;
        const text = response.text();

        return {
            statusCode: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
            body: text,
        };
    } catch (error) {
        console.error("Error en la función de Gemini:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Fallo interno del servidor al procesar la IA. Detalle: ' + error.message }),
        };
    }
};
