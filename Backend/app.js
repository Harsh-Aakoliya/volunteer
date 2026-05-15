/**
 * Express app factory — separated from server.js so tests can import
 * the Express app without starting the HTTP server, sockets, or Firebase.
 */
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import apiRoutes from "./routes/index.js";
import errorHandling from "./middlewares/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(errorHandling);
  app.use("/media", express.static(path.join(process.cwd(), "media")));

  app.use("/api", apiRoutes);

  // Version endpoint
  app.get("/api/version", async (req, res) => {
    try {
      const { cacheGet } = await import("./config/redis.js");
      const versionData = await cacheGet(
        "app:version",
        () => {
          const versionPath = path.join(process.cwd(), "version.json");
          if (fs.existsSync(versionPath)) {
            return JSON.parse(fs.readFileSync(versionPath, "utf8"));
          }
          return null;
        },
        30
      );

      if (!versionData) {
        return res.status(404).json({ error: "Version file not found" });
      }
      res.json(versionData);
    } catch (error) {
      res.status(500).json({ error: "Unable to read version file" });
    }
  });

  return app;
}
