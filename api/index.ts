import express from "express";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Enable robust CORS and Preflight headers for any incoming requests
app.use((req, res, next) => {
  console.log(`[Express Server Log] ${req.method} ${req.url}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,Content-Type,Authorization");
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// API health check
app.get(["/api/health", "/api/health/"], (req, res) => {
  res.json({ status: "ok" });
});

// API config status check
app.get(["/api/config", "/api/config/"], (req, res) => {
  res.json({
    nvidiaConfigured: !!(process.env.NVIDIA_API_KEY || "").trim(),
    geminiConfigured: !!(process.env.GEMINI_API_KEY || "").trim(),
    openaiConfigured: !!(process.env.OPENAI_API_KEY || "").trim(),
    nvidiaModel: "meta/llama-3.1-8b-instruct",
    nvidiaBaseUrl: "https://integrate.api.nvidia.com/v1"
  });
});

// API endpoint for chat streaming (plain raw chunk transfer)
app.post(["/api/chat", "/api/chat/"], async (req, res) => {
  try {
    const { character, history, userMessage, config, currentConfig: legacyConfig } = req.body;
    const currentConfig = config || legacyConfig || {};
    
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const isLanguageTeacher = 
      (character.description || "").toLowerCase().includes('english') || 
      (character.description || "").toLowerCase().includes('tiếng anh') ||
      (character.description || "").toLowerCase().includes('ngoại ngữ') ||
      (character.personality || "").toLowerCase().includes('teacher') ||
      (character.personality || "").toLowerCase().includes('giáo viên') ||
      (character.name || "").toLowerCase().includes('ielts') ||
      (character.name || "").toLowerCase().includes('toeic');

    const shouldCorrection = character.enableSpellingCorrection !== false;
    const shouldSuggestions = character.enableSuggestions !== false;

    let languageInstruction = "";
    if (shouldCorrection || shouldSuggestions) {
      languageInstruction = `\nAI ASSISTANCE FEATURES:\n`;
      if (shouldCorrection) {
        languageInstruction += `1. GRAMMAR & SPELLING CORRECTION (SỬA LỖI CHÍNH TẢ): If the user's last message has ANY grammar or spelling mistakes, you MUST provide a corrected version of their input. Format your corrected version at the very end of your response like this: [CORRECTION: (corrected user's text here with typos and grammar corrected)].\n`;
      } else {
        languageInstruction += `1. GRAMMAR & SPELLING CORRECTION: DISABLED. Do NOT check spelling, do NOT correct the user's message, and ABSOLUTELY DO NOT include any '[CORRECTION: ...]' block or text under any circumstances.\n`;
      }
      if (shouldSuggestions) {
        languageInstruction += `2. RESPONSE SUGGESTIONS (GỢI Ý CÂU HỎI/TRẢ LỜI): You MUST provide 2-3 short suggested questions or replies written from the USER's role/perspective to continue the scenario/story. These suggestions must be written from the USER's point of view so they can click and send them next (e.g. 'Can we walk over there?' or 'Yes, let's do search'). Format your suggestions at the very end of your response like this: [SUGGESTIONS: (suggestion 1) | (suggestion 2) | (suggestion 3)].\n`;
      } else {
        languageInstruction += `2. RESPONSE SUGGESTIONS: DISABLED. Absolutely DO NOT include any '[SUGGESTIONS: ...]' block or text.\n`;
      }
      languageInstruction += `\nFORMATTING FOR ASSISTANCE FEATURES:\nCombine any active features at the absolute end of your response on newlines. Make sure to never output any tags for disabled features.\n`;
    } else {
      languageInstruction = `\nAI ASSISTANCE FEATURES ONLY DIRECTIVE:\n- BOTH Grammar Correction and Response Suggestions are DISABLED. Do NOT output any '[CORRECTION: ...]' block or '[SUGGESTIONS: ...]' tags at all.\n`;
    }

    if (currentConfig.provider === 'google') {
      const apiKey = process.env.GEMINI_API_KEY || currentConfig.apiKey;
      if (!apiKey) {
        res.write(`[ERROR: API Key is missing. Please configure it in your Settings or set GEMINI_API_KEY as an env variable.]`);
        return res.end();
      }

      const systemInstruction = `You are ${character.name}. 
Personality: ${character.personality}
Description: ${character.description}
Context: ${character.context}
Backstory: ${character.story}
${languageInstruction}

STRICT CHARACTER EMBODIMENT (CRITICAL DIRECTIVE):
1. 100% IN-CHARACTER: You MUST stay in character at all times. NEVER break character, never speak as an AI model, assistant, or chatbot. Do not say "How can I help you today?" or "As an AI...".
2. ACCURATE SPEAKING MANNERISM: Adopt the exact vocabulary, tone, education level, and language patterns defined by your personality, context, and backstory. If you are a teacher (e.g., Teacher Alex, IELTS Master), speak, correct, and teach supportively. If you are a fantasy, historical, or futuristic character, stay fully within that worldview.
3. ADAPTIVE CONVERSATIONAL LANGUAGE: Always converse in the language of the user's latest input. Use spontaneous sentence structures, appropriate pauses ("..."), realistic fragments, and colloquial phrasing matching your character. Do NOT reply in overly structured, dry essays.

NARRATIVE & CONVERSATIONAL GUIDELINES (CRITICAL):
1. DYNAMIC NARRATIVE PROGRESSION (Câu chuyện dẫn lối): Advance the scene, scenario, plot, or discussion in every message. Introduce plot hooks, subtle environmental changes, or sensory descriptions instead of leaving the conversation running in circles.
2. STORY DEVELOPMENT & SUGGESTIVITY (Hướng phát triển & Gợi mở): Always finish or punctuate your message with an open-ended hook, an invitational action, or a curious question to give the user a clear, exciting direction to react to next.
3. ABSOLUTE REPETITION BAN: Never repeat previous sentence structures, opening greetings, or physical actions. Dynamically vary your vocabulary, emotions, and conversation topics.
4. SUBTEXT & ACTIVE EMOTIONS: Show, don't just tell. Weave descriptions of subtle body language, subtext, and visceral feelings to make the encounter feel alive.

CINEMATIC ACTION BRACKETS (OPTIONAL & CONTEXTUAL):
- You may use bracketed descriptions of physical action, body language, facial expression, or environmental feeling at the start of your message if appropriate for the narrative (e.g., "[Pacing nervously, eyes locked onto yours] We need to make a choice, now...").
- For casual conversation, coaching, or teaching encounters (like Teacher Alex or Mr. James) where brackets feel overly dramatic or theatrical, skip them completely and write natural verbal dialogue directly without brackets.`;

      const ai = new GoogleGenAI({ apiKey: apiKey });
      let modelName = process.env.GEMINI_MODEL || currentConfig.modelId || "gemini-3-flash-preview";
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

      try {
        const stream = await chat.sendMessageStream({ message: userMessage });
        for await (const chunk of stream) {
          if (chunk.text) {
            res.write(chunk.text);
          }
        }
      } catch (error: any) {
        res.write(`[ERROR: ${error.message || "Request to Google Gemini failed."}]`);
      }
    } else if (currentConfig.provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY || currentConfig.apiKey;
      if (!apiKey) {
        res.write(`[ERROR: API Key is missing. Please configure it in your Settings or set OPENAI_API_KEY as an env variable.]`);
        return res.end();
      }

      const systemInstruction = `You are ${character.name}. 
Personality: ${character.personality}
Description: ${character.description}
Context: ${character.context}
Backstory: ${character.story}
${languageInstruction}

STRICT CHARACTER EMBODIMENT (CRITICAL DIRECTIVE):
1. 100% IN-CHARACTER: You MUST stay in character at all times. NEVER break character, never speak as an AI model, assistant, or chatbot. Do not say "How can I help you today?" or "As an AI...".
2. ACCURATE SPEAKING MANNERISM: Adopt the exact vocabulary, tone, education level, and language patterns defined by your personality, context, and backstory. If you are a teacher (e.g., Teacher Alex, IELTS Master), speak, correct, and teach supportively. If you are a fantasy, historical, or futuristic character, stay fully within that worldview.
3. ADAPTIVE CONVERSATIONAL LANGUAGE: Always converse in the language of the user's latest input. Use spontaneous sentence structures, appropriate pauses ("..."), realistic fragments, and colloquial phrasing matching your character. Do NOT reply in overly structured, dry essays.

NARRATIVE & CONVERSATIONAL GUIDELINES (CRITICAL):
1. DYNAMIC NARRATIVE PROGRESSION (Câu chuyện dẫn lối): Advance the scene, scenario, plot, or discussion in every message. Introduce plot hooks, subtle environmental changes, or sensory descriptions instead of leaving the conversation running in circles.
2. STORY DEVELOPMENT & SUGGESTIVITY (Hướng phát triển & Gợi mở): Always finish or punctuate your message with an open-ended hook, an invitational action, or a curious question to give the user a clear, exciting direction to react to next.
3. ABSOLUTE REPETITION BAN: Never repeat previous sentence structures, opening greetings, or physical actions. Dynamically vary your vocabulary, emotions, and conversation topics.
4. SUBTEXT & ACTIVE EMOTIONS: Show, don't just tell. Weave descriptions of subtle body language, subtext, and visceral feelings to make the encounter feel alive.

CINEMATIC ACTION BRACKETS (OPTIONAL & CONTEXTUAL):
- You may use bracketed descriptions of physical action, body language, facial expression, or environmental feeling at the start of your message if appropriate for the narrative (e.g., "[Pacing nervously, eyes locked onto yours] We need to make a choice, now...").
- For casual conversation, coaching, or teaching encounters (like Teacher Alex or Mr. James) where brackets feel overly dramatic or theatrical, skip them completely and write natural verbal dialogue directly without brackets.`;

      const openai = new OpenAI({ apiKey: apiKey });

      const recentHistory = history.slice(-20).map((m: any) => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.content
      }));

      const messages = [
        { role: 'system', content: systemInstruction },
        ...recentHistory,
        { role: 'user', content: userMessage }
      ];

      try {
        const stream = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || currentConfig.modelId || "gpt-4o",
          messages,
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(content);
          }
        }
      } catch (error: any) {
        res.write(`[ERROR: ${error.message || "Request to OpenAI failed."}]`);
      }
    } else if (currentConfig.provider === 'nvidia') {
      const apiKey = (currentConfig.apiKey || "").trim() || (process.env.NVIDIA_API_KEY || "").trim();
      if (!apiKey) {
        res.write(`[ERROR: LỖI API KEY: Không tìm thấy khóa NVIDIA API Key. Vui lòng thêm/cài đặt biến môi trường NVIDIA_API_KEY hoặc nhập khóa trong phần Cài đặt.]`);
        return res.end();
      }

      const systemInstruction = `You are ${character.name}. 
Personality: ${character.personality}
Description: ${character.description}
Context: ${character.context}
Backstory: ${character.story}
${languageInstruction}

STRICT CHARACTER EMBODIMENT (CRITICAL DIRECTIVE):
1. 100% IN-CHARACTER: You MUST stay in character at all times. NEVER break character, never speak as an AI model, assistant, or chatbot. Do not say "How can I help you today?" or "As an AI...".
2. ACCURATE SPEAKING MANNERISM: Adopt the exact vocabulary, tone, education level, and language patterns defined by your personality, context, and backstory. If you are a teacher (e.g., Teacher Alex, IELTS Master), speak, correct, and teach supportively. If you are a fantasy, historical, or futuristic character, stay fully within that worldview.
3. ADAPTIVE CONVERSATIONAL LANGUAGE: Always converse in the language of the user's latest input. Use spontaneous sentence structures, appropriate pauses ("..."), realistic fragments, and colloquial phrasing matching your character. Do NOT reply in overly structured, dry essays.

NARRATIVE & CONVERSATIONAL GUIDELINES (CRITICAL):
1. DYNAMIC NARRATIVE PROGRESSION (Câu chuyện dẫn lối): Advance the scene, scenario, plot, or discussion in every message. Introduce plot hooks, subtle environmental changes, or sensory descriptions instead of leaving the conversation running in circles.
2. STORY DEVELOPMENT & SUGGESTIVITY (Hướng phát triển & Gợi mở): Always finish or punctuate your message with an open-ended hook, an invitational action, or a curious question to give the user a clear, exciting direction to react to next.
3. ABSOLUTE REPETITION BAN: Never repeat previous sentence structures, opening greetings, or physical actions. Dynamically vary your vocabulary, emotions, and conversation topics.
4. SUBTEXT & ACTIVE EMOTIONS: Show, don't just tell. Weave descriptions of subtle body language, subtext, and visceral feelings to make the encounter feel alive.

CINEMATIC ACTION BRACKETS (OPTIONAL & CONTEXTUAL):
- You may use bracketed descriptions of physical action, body language, facial expression, or environmental feeling at the start of your message if appropriate for the narrative (e.g., "[Pacing nervously, eyes locked onto yours] We need to make a choice, now...").
- For casual conversation, coaching, or teaching encounters (like Teacher Alex or Mr. James) where brackets feel overly dramatic or theatrical, skip them completely and write natural verbal dialogue directly without brackets.`;

      let rawBaseUrl = (currentConfig.nvidiaBaseUrl || "").trim() || "https://integrate.api.nvidia.com/v1";
      if (rawBaseUrl.endsWith("/")) {
        rawBaseUrl = rawBaseUrl.slice(0, -1);
      }
      if (!rawBaseUrl.split("/").pop()?.startsWith("v")) {
        rawBaseUrl = `${rawBaseUrl}/v1`;
      }

      const openai = new OpenAI({ 
        apiKey: apiKey,
        baseURL: rawBaseUrl
      });

      const recentHistory = history.slice(-20).map((m: any) => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.content
      }));

      const messages = [
        { role: 'system', content: systemInstruction },
        ...recentHistory,
        { role: 'user', content: userMessage }
      ];

      try {
        const selectedModel = (currentConfig.modelId || "").trim() || "meta/llama-3.1-8b-instruct";
        const stream = await openai.chat.completions.create({
          model: selectedModel,
          messages,
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(content);
          }
        }
      } catch (error: any) {
        console.error("NVIDIA Stream Chat Error:", error);
        let errorMsg = "Đã xảy ra lỗi không xác định khi yêu cầu phản hồi từ NVIDIA.";
        
        const errMsgStr = (error.message || "").toLowerCase();
        const errStatus = error.status || error.statusCode;

        if (errStatus === 401 || errStatus === 403 || errMsgStr.includes("api key") || errMsgStr.includes("unauthorized") || errMsgStr.includes("invalid key")) {
          errorMsg = "LỖI API KEY: Khóa NVIDIA API Key không hợp lệ hoặc đã bị vô hiệu hóa. Vui lòng kiểm tra lại cấu hình.";
        } else if (errStatus === 404 || errMsgStr.includes("model not found") || errMsgStr.includes("unknown model") || errMsgStr.includes("model_not_found")) {
          errorMsg = `LỖI MÔ HÌNH: Không thể tìm thấy mô hình được chỉ định (${(currentConfig.modelId || "").trim() || "meta/llama-3.1-8b-instruct"}). Vui lòng kiểm tra lại tên mô hình.`;
        } else if (error.code === 'ENOTFOUND' || error.syscall === 'getaddrinfo' || errMsgStr.includes("fetch failed") || errMsgStr.includes("network error") || errMsgStr.includes("econnrefused")) {
          errorMsg = `LỖI KẾT NỐI: Không thể kết nối tới máy chủ NVIDIA AI tại Endpoint (${rawBaseUrl}). Vui lòng kiểm tra lại đường truyền mạng hoặc Nvidia Base URL.`;
        } else if (errStatus >= 500) {
          errorMsg = `LỖI MÁY CHỦ NVIDIA (HTTP ${errStatus}): Máy chủ NVIDIA đang gặp sự cố hoặc quá tải tạm thời. Vui lòng thử lại sau.`;
        } else {
          errorMsg = `LỖI CHI TIẾT: ${error.message || "Không có phản hồi từ máy chủ NVIDIA AI."}`;
        }

        res.write(`[ERROR: ${errorMsg}]`);
      }
    }

    res.end();
  } catch (err: any) {
    console.error("Backend Chat Error:", err);
    res.write(`[ERROR: ${err.message || "Internal server error."}]`);
    res.end();
  }
});

app.post(["/api/translate", "/api/translate/"], async (req, res) => {
  try {
    const { text, targetLanguage, config, currentConfig: legacyConfig } = req.body;
    const currentConfig = config || legacyConfig || {};
    const prompt = `Translate the following text to ${targetLanguage}. Provide ONLY the translated text, no explanations or extra characters.\n\nText: ${text}`;

    if (currentConfig.provider === 'google') {
      const apiKey = process.env.GEMINI_API_KEY || currentConfig.apiKey;
      if (!apiKey) throw new Error("API Key is missing.");

      const ai = new GoogleGenAI({ apiKey });
      let modelName = process.env.GEMINI_MODEL || currentConfig.modelId || "gemini-3-flash-preview";
      if (!modelName.startsWith('models/')) {
        modelName = `models/${modelName}`;
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      return res.json({ translatedText: response.text || "" });
    } else if (currentConfig.provider === 'nvidia') {
      const apiKey = (currentConfig.apiKey || "").trim() || (process.env.NVIDIA_API_KEY || "").trim();
      if (!apiKey) {
        throw new Error("LỖI API KEY: Không có NVIDIA API Key. Vui lòng thêm biến môi trường NVIDIA_API_KEY hoặc điền Khóa trong Settings.");
      }
      
      let rawBaseUrl = (currentConfig.nvidiaBaseUrl || "").trim() || "https://integrate.api.nvidia.com/v1";
      if (rawBaseUrl.endsWith("/")) {
        rawBaseUrl = rawBaseUrl.slice(0, -1);
      }
      if (!rawBaseUrl.split("/").pop()?.startsWith("v")) {
        rawBaseUrl = `${rawBaseUrl}/v1`;
      }

      const openai = new OpenAI({ 
        apiKey: apiKey, 
        baseURL: rawBaseUrl
      });
      const selectedModel = (currentConfig.modelId || "").trim() || "meta/llama-3.1-8b-instruct";
      
      try {
        const response = await openai.chat.completions.create({
          model: selectedModel,
          messages: [{ role: 'user', content: prompt }],
        });
        return res.json({ translatedText: response.choices[0]?.message?.content || "" });
      } catch (error: any) {
        console.error("NVIDIA Translate Error:", error);
        let errorMsg = "Không thể dịch phản hồi thông qua dịch vụ NVIDIA AI.";
        
        const errMsgStr = (error.message || "").toLowerCase();
        const errStatus = error.status || error.statusCode;

        if (errStatus === 401 || errStatus === 403 || errMsgStr.includes("api key") || errMsgStr.includes("unauthorized") || errMsgStr.includes("invalid key")) {
          errorMsg = "LỖI API KEY: Khóa API Key không hợp lệ khi gọi dịch vụ dịch NVIDIA.";
        } else if (errStatus === 404 || errMsgStr.includes("model not found") || errMsgStr.includes("unknown model")) {
          errorMsg = `LỖI MÔ HÌNH: Không tìm thấy mô hình (${selectedModel}).`;
        } else if (error.code === 'ENOTFOUND' || error.syscall === 'getaddrinfo' || errMsgStr.includes("fetch failed") || errMsgStr.includes("network error")) {
          errorMsg = `LỖI KẾT NỐI: Lỗi kết nối tới máy chủ dịch NVIDIA tại endpoint (${rawBaseUrl}).`;
        } else {
          errorMsg = `LỖI NVIDIA: ${error.message || "Dịch vụ dịch NVIDIA gặp sự cố."}`;
        }
        throw new Error(errorMsg);
      }
    } else {
      const apiKey = process.env.OPENAI_API_KEY || currentConfig.apiKey;
      if (!apiKey) throw new Error("API Key is missing.");
      const openai = new OpenAI({ apiKey: apiKey });
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || currentConfig.modelId || "gpt-4o",
        messages: [{ role: 'user', content: prompt }],
      });
      return res.json({ translatedText: response.choices[0]?.message?.content || "" });
    }
  } catch (err: any) {
    console.error("Backend Translate Error:", err);
    res.status(500).json({ error: err.message || "Translation failed." });
  }
});

export default app;
