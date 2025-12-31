import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/chat", async (req, res) => {

  try {
    const response = await client.responses.create({
      model: "gpt-5.2",
      input: "Fammi un breve riassunto su chi è l'autore di Kallocaina, Karin BOYE, e se il libro potrebbe interessarmi. Indica per quali motivi un libro del genere potrebbe interessare ad una persona, senza fare alcuno spoiler.",
    });

    res.json({
      reply: response.output_text,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OpenAI request failed" });
  }
});

const PORT = 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
