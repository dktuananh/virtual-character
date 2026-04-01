import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AI Chat Proxy Endpoint
  app.post("/api/chat", async (req, res) => {
    const { character, history, userMessage, config } = req.body;
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
      return res.status(400).json({ error: "API Key is missing." });
    }

    const systemInstruction = `You are ${character.name}. 
Personality: ${character.personality}
Description: ${character.description}
Context: ${character.context}
Backstory: ${character.story}

CRITICAL INSTRUCTION: 
Every response MUST start with a descriptive emotion, feeling, or action enclosed in square brackets, followed by your actual message.
The emotion/action should reflect your current state and the context of the conversation.
Example: 
- "[Smiling warmly, eyes sparkling with curiosity] It is a pleasure to see you again."
- "[Thinking deeply, pacing around the neon-lit room] That is a fascinating question, let me consider the implications."
- "[Sighing softly, a hint of melancholy in the voice] The digital winds are cold tonight."

Keep the emotion/action part descriptive and relevant to your character's personality.
Separate the emotion/action from the main text.
Speak naturally, expressively, and stay in character at all times. Be concise but impactful.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      if (config.provider === 'google') {
        const ai = new GoogleGenAI({ apiKey });
        let modelName = config.modelId || "gemini-3-flash-preview";
        if (!modelName.startsWith('models/')) {
          modelName = `models/${modelName}`;
        }
        
        const recentHistory = history.slice(-20).map((m: any) => ({
          role: m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const chat = ai.chats.create({
          model: modelName,
          history: recentHistory,
          config: {
            systemInstruction,
          }
        });

        const result = await chat.sendMessageStream({ message: userMessage });
        for await (const chunk of result) {
          const text = chunk.text;
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }
      } else if (config.provider === 'openai') {
        const openai = new OpenAI({ apiKey });

        const recentHistory = history.slice(-20).map((m: any) => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.content
        }));

        const messages: any[] = [
          { role: 'system', content: systemInstruction },
          ...recentHistory,
          { role: 'user', content: userMessage }
        ];

        const stream = await openai.chat.completions.create({
          model: config.modelId || "gpt-4o",
          messages,
          stream: true,
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err: any) {
      console.error("Server AI Error:", err);
      res.write(`data: ${JSON.stringify({ error: err.message || "AI Service Error" })}\n\n`);
      res.end();
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
