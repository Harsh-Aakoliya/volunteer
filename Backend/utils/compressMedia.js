/**
 * Media compression utility - compresses images and videos before storage
 * Uses sharp for images, fluent-ffmpeg for videos
 */
import path from "path";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Lazy-load heavy dependencies
let sharpLib = null;
let ffmpegLib = null;

function getSharp() {
    if (!sharpLib) sharpLib = require("sharp");
    return sharpLib;
}

function getFfmpeg() {
    if (!ffmpegLib) {
        ffmpegLib = require("fluent-ffmpeg");
        try {
            const installer = require("@ffmpeg-installer/ffmpeg");
            ffmpegLib.setFfmpegPath(installer.path);
        } catch (e) {
            console.warn("ffmpeg-installer not found, using system ffmpeg");
        }
    }
    return ffmpegLib;
}

const IMAGE_MIME_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
];

const VIDEO_MIME_TYPES = [
    "video/mp4",
    "video/quicktime", // .mov
    "video/webm",
    "video/x-msvideo",
    "video/3gpp",
];

// Image compression settings
const MAX_IMAGE_DIMENSION = 1920;
const JPEG_QUALITY = 82;
const PNG_QUALITY = 80;
const WEBP_QUALITY = 82;

// Video compression settings
const MAX_VIDEO_WIDTH = 1280;
const VIDEO_CRF = 28;
const VIDEO_PRESET = "veryfast"; // faster + less memory for large files

/**
 * Check if mime type is an image
 */
export function isImage(mimeType) {
    if (!mimeType) return false;
    const m = mimeType.toLowerCase();
    return IMAGE_MIME_TYPES.some((t) => m.startsWith(t) || m.includes(t.split("/")[1]));
}

/**
 * Check if mime type is a video
 */
export function isVideo(mimeType) {
    if (!mimeType) return false;
    const m = mimeType.toLowerCase();
    return VIDEO_MIME_TYPES.some((t) => m.startsWith(t) || m.includes(t.split("/")[1]));
}

/**
 * Check if mime type is audio - do not compress
 */
export function isAudio(mimeType) {
    return mimeType && mimeType.toLowerCase().startsWith("audio/");
}

/**
 * Compress image from buffer or file path, returns buffer
 */
export async function compressImage(inputPathOrBuffer, mimeType) {
    const s = getSharp();
    let pipeline = s(inputPathOrBuffer)
        .rotate() // Auto-rotate based on EXIF
        .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: "inside", withoutEnlargement: true });

    const mime = (mimeType || "").toLowerCase();
    if (mime.includes("png")) {
        pipeline = pipeline.png({ quality: PNG_QUALITY, compressionLevel: 9 });
    } else if (mime.includes("webp")) {
        pipeline = pipeline.webp({ quality: WEBP_QUALITY });
    } else {
        // JPEG or default
        pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
    }

    return pipeline.toBuffer();
}

/**
 * Compress video - writes to output path, returns output path
 * Optimized for large files: veryfast preset, robust filters, extra buffer
 */
export function compressVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const f = getFfmpeg();
        const cmd = f(inputPath)
            .videoCodec("libx264")
            .audioCodec("aac")
            .outputOptions([
                "-crf", String(VIDEO_CRF),
                "-preset", VIDEO_PRESET,
                "-movflags", "+faststart",
                "-b:a", "128k",
                "-max_muxing_queue_size", "9999",
                "-avoid_negative_ts", "make_zero",
                "-vf", `scale=${MAX_VIDEO_WIDTH}:-2`,
            ])
            .on("end", () => resolve(outputPath))
            .on("error", (err) => reject(err));

        // Log stderr for debugging (ffmpeg writes progress/errors there)
        cmd.on("stderr", (line) => {
            if (line.includes("Error") || line.includes("error")) {
                console.warn("[ffmpeg]", line.trim());
            }
        });

        cmd.save(outputPath);
    });
}

/**
 * Compress a file in place - modifies the file at filePath
 * Returns { success, size, mimeType } or { success: false, error }
 */
export async function compressFile(filePath, mimeType) {
    if (!fs.existsSync(filePath)) {
        return { success: false, error: "File not found" };
    }

    const mime = (mimeType || "").toLowerCase();
    if (mime.startsWith("audio/")) {
        return { success: true, size: fs.statSync(filePath).size, skipped: true };
    }
    const ext = path.extname(filePath).toLowerCase();

    try {
        if (isImage(mime) || [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
            const buffer = await compressImage(filePath, mime);
            const newExt = mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
            const newPath = filePath.replace(/\.[^.]+$/, newExt);
            fs.writeFileSync(newPath, buffer);
            if (newPath !== filePath) {
                fs.unlinkSync(filePath);
            }
            return {
                success: true,
                size: buffer.length,
                mimeType: mime.includes("png") ? "image/png" : mime.includes("webp") ? "image/webp" : "image/jpeg",
                fileName: path.basename(newPath),
            };
        }

        if (isVideo(mime) || [".mp4", ".mov", ".webm", ".avi", ".3gp"].includes(ext)) {
            const tempPath = filePath + ".compressed.mp4";
            await compressVideo(filePath, tempPath);
            const stats = fs.statSync(tempPath);
            fs.unlinkSync(filePath);
            fs.renameSync(tempPath, filePath.replace(/\.[^.]+$/, ".mp4"));
            const finalPath = filePath.replace(/\.[^.]+$/, ".mp4");
            return {
                success: true,
                size: stats.size,
                mimeType: "video/mp4",
                fileName: path.basename(finalPath),
            };
        }

        return { success: true, size: fs.statSync(filePath).size, skipped: true };
    } catch (err) {
        console.error("Compression error for", filePath, err);
        return { success: false, error: err.message };
    }
}

/**
 * Compress buffer (for base64 uploads) - returns { buffer, mimeType, size }
 */
export async function compressBuffer(buffer, mimeType, originalName) {
    const mime = (mimeType || "").toLowerCase();
    const ext = path.extname(originalName || "").toLowerCase();

    try {
        if (isImage(mime) || [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
            const out = await compressImage(buffer, mime);
            const outMime = mime.includes("png") ? "image/png" : mime.includes("webp") ? "image/webp" : "image/jpeg";
            const outExt = outMime === "image/png" ? ".png" : outMime === "image/webp" ? ".webp" : ".jpg";
            return { buffer: out, mimeType: outMime, size: out.length, extension: outExt };
        }
        // Videos from base64 - skip compression (would need temp file), return as-is
        return { buffer, mimeType: mime, size: buffer.length, skipped: true };
    } catch (err) {
        console.error("Buffer compression error:", err);
        return { buffer, mimeType: mime, size: buffer.length, skipped: true, error: err.message };
    }
}
