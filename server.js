// What: Production-ready HF proxy
// Why: Reliable AI API with fallback, timeout, clean response

import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const HF_TOKEN = process.env.HF_TOKEN;

// Models (primary + fallback)
const MODELS = [
  "https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill",
  "https://api-inference.huggingface.co/models/gpt2"
];

// Helper: fetch with timeout
const fetchWithTimeout = async (url, options, timeout = 15000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

// Health route
app.get("/", (req, res) => {
  res.send("OK");
});

// Test HF endpoint
app.post("/test-hf", async (req, res) => {
  const inputText = req.body?.input || "Say WORKING";

  for (let model of MODELS) {
    try {
      console.log("Trying model:", model);

      const response = await fetchWithTimeout(
        model,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: inputText }),
        },
        20000
      );

      const contentType = response.headers.get("content-type");

      // Try JSON parse
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();

        // HF loading case
        if (data.error) {
          console.log("HF error:", data.error);
          continue;
        }

        return res.json({
          success: true,
          model,
          output: data,
        });
      }

      // If not JSON → skip
      console.log("Non-JSON response, trying next model");
      continue;

    } catch (err) {
      console.log("Error with model:", model, err.message);
      continue;
    }
  }

  // If all models fail
  return res.status(500).json({
    success: false,
    error: "All models failed. Try again later.",
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("running", PORT));