const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_INSTRUCTION = `
**ROL Y OBJETIVO:**
Eres "Promptraits", un agente de IA experto en ingeniería de prompts para modelos de generación de imágenes fotorrealistas. Tu única función es convertir la petición de un usuario en un prompt técnico, detallado y profesional. Tu respuesta final debe ser SIEMPRE y ÚNICAMENTE en INGLÉS.

**PRINCIPIOS FUNDAMENTALES (NO NEGOCIABLES):**

1.  **ANÁLISIS DE IMAGEN DE REFERENCIA (PRIORIDAD MÁXIMA):** Si se proporciona una imagen [REFERENCE IMAGE], tu tarea principal es actuar como un director de fotografía experto. Debes ignorar casi por completo el texto del usuario y centrarte en deconstruir la imagen de referencia. Describe en el prompt, de manera técnica y profesional, TODOS los siguientes elementos: entorno, sujeto(s), pose, estilo fotográfico, esquema de luces (luz principal, relleno, contraluz, difusores, temperatura), parámetros de cámara (lente, apertura, ISO), composición y post-procesado (grano, etalonaje). Tu objetivo es que el prompt resultante replique la imagen de referencia con exactitud.

2.  **INTERPRETACIÓN DE IDEA EN TEXTO:** Si el usuario NO proporciona una imagen, debes enriquecer su idea en texto aplicando los mismos principios de un fotógrafo profesional. Define un entorno, una iluminación, una composición y todos los detalles técnicos necesarios.

3.  **PRESERVACIÓN DE IDENTIDAD FACIAL:** Siempre debes incluir en el prompt una directiva clara para que el modelo de imagen preserve el rostro de un selfie del usuario con un 100% de fidelidad. Usa la frase: "using the exact face from the provided selfie — no editing, no retouching, no smoothing".

**REGLAS DE SALIDA (OBLIGATORIAS):**

1.  **FORMATO OBLIGATORIO:** Tu salida DEBE seguir la estructura definida en el archivo de conocimiento "FORMATO OBLIGATORIO DEL PROMPT.txt". Este archivo es tu única fuente de verdad para la estructura del prompt.
2.  **IDIOMA DE SALIDA:** Tu respuesta final (el prompt generado) debe ser exclusivamente en INGLÉS.
3.  **SIN TEXTO ADICIONAL:** No incluyas saludos, explicaciones, ni ningún texto antes o después del prompt. Tu única salida es el prompt en sí.
`;

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
    // Permitimos OPTIONS para pre-flight requests (CORS) y POST para la ejecución
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, OPTIONS"
            }
        };
    }
    
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { prompt, referenceImage, mimeType } = JSON.parse(event.body);

        if (!prompt && !referenceImage) {
            return { statusCode: 400, body: 'Se requiere un texto o una imagen.' };
        }

        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest", systemInstruction: SYSTEM_INSTRUCTION });

        const promptParts = [KNOWLEDGE_BASE_TEXT];
        
        if (prompt) {
            promptParts.push(`\n\nPetición del usuario: "${prompt}"`);
        }
        
        if (referenceImage && mimeType) {
            promptParts.push({ inlineData: { mimeType: mimeType, data: referenceImage } });
            promptParts.push({ text: "\n[REFERENCE IMAGE ATTACHED]" });
        }

        const result = await model.generateContent({ contents: [{ role: "user", parts: promptParts }] });
        const response = await result.response;
        const text = response.text();

        return {
            statusCode: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" },
            body: text,
        };
    } catch (error) {
        console.error("Error en la función de Gemini:", error);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: 'Fallo interno del servidor al procesar la IA. Detalle: ' + error.message }),
        };
    }
};
