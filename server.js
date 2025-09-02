import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

const GEMINI_API_KEY = process.env.AIzaSyAl-z0JPXDHTEzlR_mQd8qa6l6w6_jv6MU;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

// 💡 Buradaki systemPrompt kısmını istediğin gibi değiştirebilirsin
let systemPrompt = "Sen kullanıcıya yardım eden bir asistan rolündesin.";


// Kullanıcı mesajını Gemini'ye gönderme endpointi
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "system", parts: [{ text: systemPrompt }] },
          { role: "user", parts: [{ text: message }] }
        ]
      })
    });

    const data = await response.json();
    const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Bir hata oluştu.";

    res.json({ response: aiResponse });
  } catch (error) {
    console.error("Gemini API Hatası:", error);
    res.status(500).json({ error: "Gemini API'ye bağlanılamadı." });
  }
});

app.listen(PORT, () => console.log(`🚀 Sunucu çalışıyor: http://localhost:${PORT}`));

