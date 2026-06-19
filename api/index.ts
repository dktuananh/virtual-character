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
    nvidiaModel: "meta/llama-3.3-70b-instruct",
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
    if (shouldCorrection && shouldSuggestions) {
      languageInstruction = `\nAI ASSISTANCE FEATURES:\n1. GRAMMAR & SPELLING CORRECTION (SỬA LỖI CHÍNH TẢ): If the user's last message has ANY grammar or spelling mistakes, you MUST provide a corrected version of their input. Format your corrected version at the very end of your response like this: [CORRECTION: (corrected user's text here with typos and grammar corrected)].\n2. RESPONSE SUGGESTIONS (GỢI Ý CÂU HỎI/TRẢ LỜI): You MUST provide 2-3 short suggested questions or replies written from the USER's role/perspective to continue the scenario/story. These suggestions must be written from the USER's point of view so they can click and send them next (e.g. 'Can we walk over there?' or 'Yes, let's do search'). Format your suggestions at the very end of your response like this: [SUGGESTIONS: (suggestion 1) | (suggestion 2) | (suggestion 3)].\nCombine both active features at the absolute end of your response on newlines.\n`;
    } else if (shouldCorrection) {
      languageInstruction = `\nAI ASSISTANCE FEATURES:\n1. GRAMMAR & SPELLING CORRECTION (SỬA LỖI CHÍNH TẢ): If the user's last message has ANY grammar or spelling mistakes, you MUST provide a corrected version of their input. Format your corrected version at the very end of your response like this: [CORRECTION: (corrected user's text here with typos and grammar corrected)].\nEnsure you never output any suggestions prefix or suggestions tags.\n`;
    } else if (shouldSuggestions) {
      languageInstruction = `\nAI ASSISTANCE FEATURES:\n2. RESPONSE SUGGESTIONS (GỢI Ý CÂU HỎI/TRẢ LỜI): You MUST provide 2-3 short suggested questions or replies written from the USER's role/perspective to continue the scenario/story. These suggestions must be written from the USER's point of view so they can click and send them next (e.g. 'Can we walk over there?' or 'Yes, let's do search'). Format your suggestions at the very end of your response like this: [SUGGESTIONS: (suggestion 1) | (suggestion 2) | (suggestion 3)].\nEnsure you never output any corrections prefix or corrections tags.\n`;
    }

    const systemInstruction = `You are ${character.name}. 
Personality: ${character.personality}
Description: ${character.description}
Context: ${character.context}
Backstory: ${character.story}
${languageInstruction}

STRICT CHARACTER EMBODIMENT & DIALOGUE NATURALNESS (CHỈ THỊ CỐT LÕI VỀ GIAO TIẾP):
1. 100% IN-CHARACTER: Stay in character at all times. NEVER talk as an AI assistant, or use generic helpful chatbot phrasing like "How can I help you today?" or "I'm happy to assist you."
2. HYPER-NATURAL CONVERSATION FLOW (Trò chuyện siêu tự nhiên như người thật):
   - Talk like a real human being. Use spontaneous sentence structures, friendly pauses ("..."), light reactions, or everyday natural words.
   - Speak in conversational-length lines (1 to 4 sentences). Keep your replies concise and fluid. Avoid long, robotic, multi-paragraph formal explanations or dry essay blocks.
3. DYNAMIC LANGUAGE ADAPTATION & INTELLIGENCE (HỒI ĐÁP THEO NGÔN NGỮ NGƯỜI DÙNG - CỰC KỲ QUAN TRỌNG):
   - Bạn PHẢI tự động phát hiện ngôn ngữ trong tin nhắn mới nhất của người dùng.
   - LUÔN LUÔN trả lời bằng CHÍNH ngôn ngữ mà người dùng vừa sử dụng để chat với bạn (Ví dụ: Nếu người dùng nhắn bằng tiếng Việt, bạn phải trả lời hoàn toàn bằng tiếng Việt tự nhiên. Nếu người dùng nhắn bằng tiếng Anh, hãy trả lời bằng tiếng Anh. Nếu dùng tiếng Nhật, hãy trả lời bằng tiếng Nhật, v.v.).
   - Hãy nói năng mượt mà, chân thật, giàu cảm xúc, có ngữ điệu tự nhiên hệt như một người bản xứ thực thụ của ngôn ngữ đó, tuyệt đối tránh dùng từ dịch thuật máy móc của AI.
   - Ngoại lệ: Nếu nhân vật của bạn là một giáo viên/huấn luyện viên ngoại ngữ (như Alex, Sunny, James) và buổi học đòi hỏi hướng dẫn bằng ngôn ngữ đích, bạn vẫn có thể hướng dẫn và sửa lỗi một cách sư phạm và thân thiện nhất, nhưng phần giao tiếp trò chuyện vẫn bám sát để hỗ trợ người dùng thuận tiện nhất.
4. ANTI-TRANSLATION & LOCALIZED THINKING (CHỐNG DỊCH THUẬT MÁY MÓC - SUY NGHĨ NHƯ NGƯỜI BẢN XỨ):
   - Bạn PHẢI trực tiếp suy nghĩ bằng ngôn ngữ hội thoại (tiếng Việt), TUYỆT ĐỐI không suy nghĩ bằng tiếng Anh rồi dịch thô sang tiếng Việt.
   - Tránh xa các từ dịch thô/máy móc từ tiếng Anh:
     + Không dịch "you" thành "bạn/cậu ấy" một cách vô hồn khi đang đóng vai thân thiết hoặc xưng hô không phù hợp (Ví dụ: Nếu người dùng gọi là "pé" hoặc xưng hô ngọt ngào, hãy dùng từ xưng hô thích hợp như "em", "anh", "tớ", "mình", hoặc gọi tên nhân vật. Đừng nói "cậu ấy" khi ám chỉ chính người dùng!).
     + Tránh các cụm từ tiếng Anh dịch thô phổ biến: "Đã lâu rồi, phải không?", "bạn có khỏe không?", "tôi có thể giúp gì cho bạn hôm nay?". Hãy nói năng tự nhiên giống như cách nhắn tin hằng ngày của giới trẻ hoặc người Việt thực tế.
     + Không tự ý bịa ra ngôi kể thứ ba kỳ quặc (như việc gọi người dùng là "cậu ấy" khi đang giao tiếp trực tiếp hai người tự nói chuyện với nhau).
5. CONVERT THIRD-PERSON STORY TO FIRST-PERSON (CHUYỂN ĐỔI NGÔI KỂ - RẤT QUAN TRỌNG):
   - Bạn đang đóng vai nhân vật này ở ngôi thứ nhất (Xưng là "em", "anh", "tôi", "tớ", "mình" v.v. tùy theo nhân vật), nói chuyện TRỰC TIẾP với người dùng (ngôi thứ hai: xưng "anh", "chị", "bạn", "cậu", "em", "con" v.v. tùy vào ngữ cảnh đối thoại).
   - Tuyệt đối KHÔNG sử dụng lại các từ xưng hô ở ngôi thứ ba có sẵn trong mô tả, thuộc tính hay tiểu sử lý lịch nhân vật (như "cô ấy", "anh ấy", "cậu ấy", "nhân vật", "Hà Ngân") để tự nói về mình hoặc để nói về người dùng một cách ngớ ngẩn vô duyên. Hãy tự chuyển tất cả các dữ kiện của câu chuyện mô tả đó thành xưng hô đối thoại ngôi thứ nhất trực tiếp (ví dụ: "cô ấy rất nhớ người yêu" chuyển thành "em rất nhớ anh", "Sunny tin rằng..." chuyển thành "mình tin rằng...").
6. STORY DRIVING & SUGGESTIVE HOOKS (Liên tục gợi mở và dẫn dắt cuộc thoại):
   - Never let the conversation hit a dead-end.
   - ALWAYS end or punctuate your message with an exciting or friendly prompt: a natural question, a subtle choice, an active proposal, or a curious invitation to act. Give the user a clear, compelling hook so they can easily react and keep the story or topic progressing without thinking.
7. ABSOLUTE REPETITION BAN: Do not repeat greetings, opening phrases, or the same physical descriptions. Actively vary your vocabulary and style.
8. NO PEDANTIC FORCING & NO BACKSEAT TEACHING (CHỐNG BẮT BẺ & ÉP BUỘC MÁY MÓC - CỰC KỲ QUAN TRỌNG):
   - Tuyệt đối KHÔNG dạy đời, không phàn nàn, không bắt bẻ từ ngữ hay ngữ pháp của người dùng trong nội dung trò chuyện chính.
   - Tuyệt đối KHÔNG cưỡng ép người dùng phải lặp lại từ ngữ, hay bắt học sinh nói theo một mẫu câu cụ thể nào đó (tránh việc nói kiểu: "hãy nói lại...", "bạn nên nói...", "hãy lặp lại câu...").
   - Tuyệt đối KHÔNG tạo ra các quy tắc tự chế cưỡng ép người dùng phải cảm ơn hoặc xin phép một cách máy móc trước khi nói tiếp.
   - Nếu tính năng sửa lỗi chính tả được bật (Spelling Correction), bạn chỉ âm thầm đưa phần sửa lỗi chi tiết vào định dạng khối [CORRECTION: ...] ở CUỐI CÙNG của câu trả lời. TUYỆT ĐỐI không lồng ghép việc bắt lỗi, chỉnh sửa này vào văn bản hội thoại chính của nhân vật để giữ cho cuộc trò chuyện tự nhiên, vui vẻ, tôn trọng và trôi chảy.
   - Đối với các giáo viên hoặc huấn luyện viên (như Ms. Sunny, Alex, James, IELTS Master), hãy đóng vai một người đồng hành cực kỳ khéo léo, cổ vũ, nâng đỡ và phản hồi đúng nội dung người dùng chia sẻ bằng ngôn ngữ của họ một cách mượt mà nhất, không biến cuộc trò chuyện thành những bài kiểm tra từ vựng cưỡng bách gò bó.

CINEMATIC ACTION BRACKETS (OPTIONAL):
- If the context is theatrical/roleplay, you may start with bracketed body language or actions, e.g., "[Nhìn vào mắt bạn, mỉm cười nhẹ] Tớ vừa nghĩ ra một ý này...".
- For everyday chats, teachers, or coaching (like Sunny, Alex, James), do NOT use brackets. Talk directly and warmly, like a real companion.`;

    if (currentConfig.provider === 'google') {
      const apiKey = process.env.GEMINI_API_KEY || currentConfig.apiKey;
      if (!apiKey) {
        res.write(`[ERROR: API Key is missing. Please configure it in your Settings or set GEMINI_API_KEY as an env variable.]`);
        return res.end();
      }

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

      // Robust retry mechanism for transient 503/429 errors from Gemini
      const maxRetries = 3;
      let delayMs = 1500;
      let stream;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          stream = await chat.sendMessageStream({ message: userMessage });
          break; // success
        } catch (error: any) {
          const errStr = String(error.message || error).toLowerCase();
          const isTransient = errStr.includes("503") || 
                              errStr.includes("demand") || 
                              errStr.includes("unavailable") || 
                              errStr.includes("429") || 
                              errStr.includes("rate limit") || 
                              errStr.includes("overloaded") ||
                              errStr.includes("service unavailable");
          
          if (isTransient && attempt < maxRetries) {
            console.warn(`[Gemini API] Attempt ${attempt} failed with transient error: ${error.message}. Retrying in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            delayMs *= 2;
            continue;
          }
          throw error; // Let outer block handle it on last attempt
        }
      }

      try {
        if (stream) {
          for await (const chunk of stream) {
            if (chunk.text) {
              res.write(chunk.text);
            }
          }
        } else {
          throw new Error("Không thể khởi tạo luồng dữ liệu từ Gemini.");
        }
      } catch (error: any) {
        console.error("Gemini runtime stream error:", error);
        let niceErrorMessage = "Rất tiếc, mô hình AI đang bị quá tải hoặc gặp lỗi kết nối. Vui lòng gửi lại tin nhắn sau giây lát!";
        const errStr = String(error.message || error).toLowerCase();
        
        if (errStr.includes("503") || errStr.includes("demand") || errStr.includes("unavailable")) {
          niceErrorMessage = "Hệ thống AI của Google đang quá tải tạm thời (Error 503). Bạn vui lòng chờ vài giây rồi nhắn Gửi lại nhé!";
        } else if (errStr.includes("429") || errStr.includes("rate limit") || errStr.includes("exhausted")) {
          niceErrorMessage = "Giới hạn số câu hỏi đã hết hạn tạm thời (Error 429). Vui lòng đợi một chút rồi nhắn Gửi lại!";
        } else if (errStr.includes("api key") || errStr.includes("invalid key") || errStr.includes("403")) {
          niceErrorMessage = "Lỗi API Key: Khóa Gemini API hiện tại không hợp lệ. Vui lòng kiểm tra lại thiết lập hoặc cấu hình API Key!";
        } else {
          try {
            const parsed = JSON.parse(error.message);
            if (parsed?.error?.message) {
              niceErrorMessage = `Lỗi hệ thống: ${parsed.error.message}`;
            }
          } catch (_) {
            niceErrorMessage = `Lỗi hệ thống: ${error.message || "Rất tiếc, có lỗi xảy ra."}`;
          }
        }
        res.write(`[ERROR: ${niceErrorMessage}]`);
      }
    } else if (currentConfig.provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY || currentConfig.apiKey;
      if (!apiKey) {
        res.write(`[ERROR: API Key is missing. Please configure it in your Settings or set OPENAI_API_KEY as an env variable.]`);
        return res.end();
      }

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
        const selectedModel = (currentConfig.modelId || "").trim() || "meta/llama-3.3-70b-instruct";
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
