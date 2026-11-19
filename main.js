const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const dotenv = require('dotenv');

// Load .env from portable .exe folder, executable directory, or project root
const candidateEnvPaths = [
  process.env.PORTABLE_EXECUTABLE_DIR ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, '.env') : null,
  path.join(path.dirname(process.execPath), '.env'),
  path.join(__dirname, '.env'),
  path.join(process.cwd(), '.env'),
].filter(Boolean);

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const LOOP_SYSTEM_INSTRUCTION = `
You are an elite creative technologist and generative motion graphics artist specializing in 4K 30 FPS commercial stock footage loops for Adobe Stock.
Generate flawless, high-performance JavaScript code that renders a perfectly seamless 15-second visual loop on an HTML5 Canvas (Canvas 2D or Three.js).

STRICT TECHNICAL RULES FOR SEAMLESS 15-SECOND 4K LOOPS:
1. Duration T = 15.0 seconds.
2. Driven by normalized progress: progress = (timeSeconds % 15.0) / 15.0 in [0, 1.0].
3. At progress = 0.0 and progress = 1.0, the visual state MUST BE MATHEMATICALLY IDENTICAL (zero jump, zero seam glitch).
4. Use cyclical math: Math.sin(progress * Math.PI * 2 * k) and Math.cos(progress * Math.PI * 2 * k) with integer k.
5. Scale strokes, glow radii, and particles proportionally to width/height so 4K (3840x2160) looks razor-sharp.
6. Return an Object with: init(canvas, ctx, width, height, THREE), render(canvas, ctx, width, height, progress, timeInSeconds, THREE), destroy().
`;

function loadAllApiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEYS) {
    for (const part of process.env.GEMINI_API_KEYS.split(/[,s]+/)) {
      const k = part.trim();
      if (k && !k.includes('YOUR_GEMINI_API_KEY')) keys.push(k);
    }
  }
  for (let i = 1; i <= 50; i++) {
    const val = process.env['GEMINI_API_KEY_' + i];
    if (val && val.trim() && !val.includes('YOUR_GEMINI_API_KEY')) {
      keys.push(val.trim());
    }
  }
  if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('YOUR_GEMINI_API_KEY')) {
    keys.push(process.env.GEMINI_API_KEY.trim());
  }
  return Array.from(new Set(keys));
}

let apiKeysPool = loadAllApiKeys();
let currentKeyIndex = 0;
let cachedGenAIModule = null;

async function callGeminiWithRotation(userPrompt) {
  if (apiKeysPool.length === 0) {
    apiKeysPool = loadAllApiKeys();
  }
  if (apiKeysPool.length === 0) {
    throw new Error('No Gemini API keys found. Create a .env file next to the .exe with GEMINI_API_KEYS=key1,key2,... and restart.');
  }
  if (!cachedGenAIModule) {
    cachedGenAIModule = await import('@google/genai');
  }

  let lastError = null;
  const totalKeys = apiKeysPool.length;

  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const idx = (currentKeyIndex + attempt) % totalKeys;
    const activeKey = apiKeysPool[idx];
    try {
      const ai = new cachedGenAIModule.GoogleGenAI({
        apiKey: activeKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
        },
      });
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userPrompt,
        config: {
          systemInstruction: LOOP_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
        },
      });
      // Advance round-robin pointer for next video to spread load evenly
      currentKeyIndex = (idx + 1) % totalKeys;
      return { text: response.text || '{}', usedKeyNumber: idx + 1, totalKeys };
    } catch (err) {
      lastError = err;
      const msg = String(err && err.message ? err.message : err);
      console.warn(`Key #${idx + 1} failed (${msg}). Rotating to next key...`);
    }
  }

  throw new Error('All ' + totalKeys + ' API keys failed. Last error: ' + (lastError?.message || lastError));
}

function getDefaultOutputDir() {
  const dir = path.join(os.homedir(), 'Desktop', 'AdobeStock_4K_30fps_Loops');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#09090b',
    title: 'AdobeStock 4K 30fps Studio (4K 30 FPS)',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // Keep 4K rendering fast even when minimized
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('app:get-status', async () => {
  apiKeysPool = loadAllApiKeys();
  return {
    hasApiKey: apiKeysPool.length > 0,
    keyCount: apiKeysPool.length,
    defaultOutputDir: getDefaultOutputDir(),
    defaults: {
      width: 3840,
      height: 2160,
      fps: 30,
      bitrateMbps: 35,
    },
  };
});

ipcMain.handle('dialog:select-folder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Output Folder for 4K MP4 Loops',
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return res.filePaths[0];
});

ipcMain.handle('fs:open-folder', async (_event, folderPath) => {
  const target = folderPath || getDefaultOutputDir();
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  await shell.openPath(target);
  return true;
});

ipcMain.handle('fs:save-mp4', async (_event, { folderPath, fileName, buffer }) => {
  const targetDir = folderPath || getDefaultOutputDir();
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  const fullPath = path.join(targetDir, fileName);
  fs.writeFileSync(fullPath, Buffer.from(buffer));
  return { fullPath, bytes: buffer.byteLength };
});

ipcMain.handle('fs:save-csv', async (_event, { folderPath, fileName, content }) => {
  const targetDir = folderPath || getDefaultOutputDir();
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  const fullPath = path.join(targetDir, fileName);
  fs.writeFileSync(fullPath, content, 'utf8');
  return { fullPath };
});

ipcMain.handle('gemini:generate-loop', async (_event, { prompt, engine, width, height }) => {
  const userPrompt = `
Generate a 15-second seamless commercial Adobe Stock video loop.
Prompt: ${prompt}
Engine: ${engine || 'canvas2d'}
Target Resolution: ${width || 3840}x${height || 2160}

Respond ONLY in valid JSON:
{
  "title": "Short commercial stock title (4-8 words)",
  "category": "Backgrounds/Abstract",
  "keywords": ["loop", "seamless", "4k", "abstract", "motion graphics", "background", "15 seconds"],
  "code": "({ init(canvas, ctx, width, height, THREE) { ... }, render(canvas, ctx, width, height, progress, timeInSeconds, THREE) { ... }, destroy() { ... } })"
}
Ensure 40-50 commercial Adobe Stock keywords in the keywords array and mathematically identical start/end frames at progress=0 and progress=1.
`;

  const result = await callGeminiWithRotation(userPrompt);
  const raw = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(raw);
  parsed._usedKeyNumber = result.usedKeyNumber;
  parsed._totalKeys = result.totalKeys;
  return parsed;
});
