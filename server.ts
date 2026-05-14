import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Config endpoint to inform client of active features
  app.get("/api/config", (req, res) => {
    res.json({
      hasNvidia: !!process.env.NVIDIA_API_KEY,
    });
  });

  // NVIDIA NIM Proxy
  app.post("/api/nvidia", async (req, res) => {
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    if (!nvidiaKey) {
      console.warn("NVIDIA_API_KEY is missing from environment variables.");
      return res.status(500).json({ error: "NVIDIA_API_KEY not configured on server" });
    }
    console.log("NVIDIA Proxy: Target URL: https://integrate.api.nvidia.com/v1/chat/completions");
    console.log("NVIDIA Proxy: Request Body:", JSON.stringify(req.body));

    try {
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${nvidiaKey}`,
        },
        body: JSON.stringify(req.body),
      });

      console.log("NVIDIA Proxy: Response Status:", response.status);
      const responseText = await response.text();
      console.log("NVIDIA Proxy: Raw Response Preview:", responseText.substring(0, 200));
      try {
        const data = JSON.parse(responseText);
        res.status(response.status).json(data);
      } catch (parseError) {
        console.error("NVIDIA Response Parsing Failed. Raw response:", responseText);
        res.status(response.status).send(responseText);
      }
    } catch (error: any) {
      console.error("NVIDIA Proxy Error:", error);
      res.status(500).json({ error: error.message });
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
