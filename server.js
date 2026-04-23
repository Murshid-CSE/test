// What: Stable HF proxy with retry + proper handling
// Why: Fix model loading, free-tier issues, and unreliable responses

import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const HF_TOKEN = process.env.HF_TOKEN;

// Use stable models
const MODELS = [
  "distilbert-base-uncased-finetuned-sst-2-english", // fast + reliable
  "gpt2" // fallback
];

// Retry helper
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Health check
app.get("/", (req, res) => {
  res.send("OK");
});

// Main endpoint
app.post("/test-hf", async (req, res) => {
  const inputText = req.body?.input || "I love AI";

  for (let model of MODELS) {
    try {
      console.log("Trying model:", model);

      const response = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: inputText }),
        }
      );

      const data = await response.json();

      // Model loading case (VERY COMMON)
      if (data.error && data.error.includes("loading")) {
        console.log("Model loading... retrying");
        await delay(5000); // wait 5s
        continue;
      }

      // Any other HF error
      if (data.error) {
        console.log("HF error:", data.error);
        continue;
      }

      return res.json({
        success: true,
        model,
        input: inputText,
        output: data,
      });

    } catch (err) {
      console.log("Error:", err.message);
      continue;
    }
  }

  return res.status(500).json({
    success: false,
    error: "All models failed. Check HF token or wait for model loading.",
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("running", PORT));