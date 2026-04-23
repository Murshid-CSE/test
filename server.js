// What: Production-grade HF proxy
// Why: Handles free-tier issues, retries, timeouts, non-JSON safely

import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const HF_TOKEN = process.env.HF_TOKEN;

// Stable models
const MODELS = [
  "distilbert-base-uncased-finetuned-sst-2-english",
  "gpt2"
];

// Config
const MAX_RETRIES = 3;
const TIMEOUT = 15000;

// Delay helper
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Fetch with timeout
const fetchWithTimeout = async (url, options, timeout) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

// Health
app.get("/", (req, res) => res.send("OK"));

// Main endpoint
app.post("/test-hf", async (req, res) => {
  const inputText = req.body?.input || "I love AI";

  for (let model of MODELS) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Trying ${model} (attempt ${attempt})`);

        const response = await fetchWithTimeout(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${HF_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: inputText }),
          },
          TIMEOUT
        );

        let data;

        // SAFE JSON parsing
        try {
          data = await response.json();
        } catch {
          console.log("Non-JSON response from HF");
          continue;
        }

        // Cold start handling
        if (data.error && data.error.includes("loading")) {
          console.log("Model loading... waiting");
          await delay(4000);
          continue;
        }

        // Other HF errors
        if (data.error) {
          console.log("HF error:", data.error);
          break;
        }

        // SUCCESS
        console.log("HF SUCCESS:", data);

        return res.json({
          success: true,
          model,
          attempt,
          input: inputText,
          output: data,
        });

      } catch (err) {
        console.log("Request error:", err.message);

        if (attempt === MAX_RETRIES) break;
        await delay(2000);
      }
    }
  }

  return res.status(500).json({
    success: false,
    error: "All models failed after retries",
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("running", PORT));