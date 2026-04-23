// What: minimal proxy to HF
// Why: prove network works from cloud, not your PC

import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// replace with a NEW token (do not reuse exposed one)
const HF_TOKEN = process.env.HF_TOKEN;

// health
app.get("/", (req, res) => res.send("OK"));

// test endpoint
app.post("/test-hf", async (req, res) => {
  try {
    const r = await fetch(
      "https://api-inference.huggingface.co/models/google/flan-t5-small",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },  
        body: JSON.stringify({ inputs: "Say WORKING" }),
      }
    );

    const text = await r.text(); // keep raw to show JSON vs HTML
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("running", PORT));