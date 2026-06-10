import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

// Setup Multer for parsing multipart/form-data
const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Make sure we parse JSON bodies
  app.use(express.json());

  // API endpoint for Gemini Vision scanning
  app.post("/api/scan-card", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image provided" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const filePart = {
        inlineData: {
          data: req.file.buffer.toString("base64"),
          mimeType: req.file.mimetype,
        },
      };

      const prompt = `Analyze this Pokemon card image and extract the following details into a valid JSON object:
      {
        "itemName": "The name of the pokemon/item (e.g., Charizard ex)",
        "cardSetName": "The set name if visible or recognizable (e.g., 151, Obsidian Flames)",
        "cardNumber": "The card number usually at the bottom (e.g., 199/165)",
        "rarity": "The rarity of the card (e.g., Special Illustration Rare, Common)",
        "foilType": "Foil, Reverse Holo, or Non-Foil"
      }
      If a field is not recognizable, leave it as an empty string. Only return valid JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [filePart, { text: prompt }] },
        config: {
          responseMimeType: "application/json",
        }
      });

      let responseText = await response.text;
      if (!responseText && typeof response.text === 'function') {
        responseText = await (response as any).text();
      }
      responseText = responseText || "{}";

      const cleanedJson = responseText.replace(/```(?:json)?/g, '').trim();
      
      const parsed = JSON.parse(cleanedJson);
      res.json(parsed);
    } catch (error: any) {
      console.error("Error analyzing card:", error);
      const errStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
      const isQuotaMessage = (error?.message && (
        error.message.includes("credits are depleted") ||
        error.message.includes("429") ||
        error.message.includes("quota") ||
        error.message.includes("RESOURCE_EXHAUSTED") ||
        error.message.includes("prepayment")
      )) || errStr.includes("prepayment") || errStr.includes("credits are depleted") || errStr.includes("RESOURCE_EXHAUSTED") || error?.status === 429;

      if (isQuotaMessage) {
        return res.status(429).json({ 
          error: "Gemini AI billing limits/prepayment credits are depleted. Please input the card's details manually below.",
          isQuota: true
        });
      }
      res.status(500).json({ error: error.message || "Failed to analyze card" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
