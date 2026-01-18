import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import chatRouter from "./routes/chat.js";
import chatsRouter from "./routes/chats.js";
import messagesRouter from "./routes/messages.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
});

app.use(chatsRouter);
app.use(chatRouter);
app.use(messagesRouter);

const PORT = 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
