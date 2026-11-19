
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell
} = require('electron');

const path = require('path');
const fs = require('fs');
const os = require('os');
const dotenv = require('dotenv');

// ==========================================
// 1. LOAD ENVIRONMENT VARIABLES
// ==========================================

const candidateEnvPaths = [
  process.env.PORTABLE_EXECUTABLE_DIR
    ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, '.env')
    : null,

  path.join(path.dirname(process.execPath), '.env'),
  path.join(__dirname, '.env'),
  path.join(process.cwd(), '.env')
].filter(Boolean);

let envLoaded = false;

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('Environment loaded:', envPath);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('No .env file found.');
}

// ==========================================
// 2. GEMINI SYSTEM INSTRUCTION
// ==========================================

const LOOP_SYSTEM_INSTRUCTION = `
You are an elite creative technologist and generative
motion graphics artist specializing in 4K 30 FPS
commercial stock footage loops for Adobe Stock.

Generate high-performance JavaScript code that renders
a mathematically seamless 15-second visual loop
on an HTML5 Canvas.

STRICT TECHNICAL RULES:

1. Duration T = 15 seconds.
2. Use normalized progress from 0 to 1.
3. Start and end frames must be mathematically identical.
4. Use cyclical sine and cosine functions.
5. Scale effects proportionally to canvas dimensions.
6. Return an object containing:

{
  init(canvas, ctx, width, height, THREE) {},
  render(canvas, ctx, width, height, progress, timeInSeconds, THREE) {},
  destroy() {}
}

Return valid JavaScript code inside JSON.
`;

// ==========================================
// 3. GEMINI API KEY MANAGEMENT
// ==========================================

function loadAllApiKeys() {
  const keys = [];

  if (process.env.GEMINI_API_KEYS) {
    const multipleKeys = process.env.GEMINI_API_KEYS
      .split(/[,\s]+/)
      .map(key => key.trim())
      .filter(Boolean);

    keys.push(...multipleKeys);
  }

  for (let i = 1; i <= 50; i++) {
    const value = process.env['GEMINI_API_KEY_' + i];

    if (value && value.trim()) {
      keys.push(value.trim());
    }
  }

  if (process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY.trim());
  }

  return [...new Set(
    keys.filter(key =>
      key &&
      !key.includes('YOUR_GEMINI_API_KEY')
    )
  )];
}

let apiKeysPool = loadAllApiKeys();
let currentKeyIndex = 0;
let cachedGenAIModule = null;

// ==========================================
// 4. GEMINI API WITH KEY ROTATION
// ==========================================

async function callGeminiWithRotation(userPrompt) {

  apiKeysPool = loadAllApiKeys();

  if (apiKeysPool.length === 0) {
    throw new Error(
      'No Gemini API keys found. ' +
      'Create a .env file next to the EXE with ' +
      'GEMINI_API_KEYS=your_api_key'
    );
  }

  if (!cachedGenAIModule) {
    cachedGenAIModule = await import('@google/genai');
  }

  const GoogleGenAI = cachedGenAIModule.GoogleGenAI;

  if (!GoogleGenAI) {
    throw new Error('GoogleGenAI module could not be loaded.');
  }

  let lastError = null;

  const totalKeys = apiKeysPool.length;

  for (let attempt = 0; attempt < totalKeys; attempt++) {

    const idx = (currentKeyIndex + attempt) % totalKeys;

    const activeKey = apiKeysPool[idx];

    try {

      const ai = new GoogleGenAI({
        apiKey: activeKey
      });

      const response = await ai.models.generateContent({

        model: 'gemini-3.8-flash',

        contents: userPrompt,

        config: {
          systemInstruction: LOOP_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json'
        }

      });

      currentKeyIndex = (idx + 1) % totalKeys;

      const responseText = response.text;

      if (!responseText) {
        throw new Error('Gemini returned an empty response.');
      }

      return {
        text: responseText,
        usedKeyNumber: idx + 1,
        totalKeys
      };

    } catch (err) {

      lastError = err;

      console.error(
        `Gemini API Key #${idx + 1} failed:`,
        err.message
      );

    }
  }

  throw new Error(
    'All Gemini API keys failed. Last error: ' +
    (lastError?.message || 'Unknown API error')
  );
}

// ==========================================
// 5. OUTPUT DIRECTORY
// ==========================================

function getDefaultOutputDir() {

  const dir = path.join(
    app.getPath('desktop'),
    'AdobeStock_4K_30fps_Loops'
  );

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
}

// ==========================================
// 6. CREATE ELECTRON WINDOW
// ==========================================

let mainWindow = null;

function createWindow() {

  mainWindow = new BrowserWindow({

    width: 1360,
    height: 880,

    minWidth: 1024,
    minHeight: 700,

    backgroundColor: '#09090b',

    title: 'AdobeStock 4K 30fps Studio',

    show: false,

    webPreferences: {

      preload: path.join(__dirname, 'preload.js'),

      contextIsolation: true,

      nodeIntegration: false,

      sandbox: false,

      backgroundThrottling: false

    }

  });

  mainWindow.setMenuBarVisibility(false);

  const htmlPath = path.join(
    __dirname,
    'renderer',
    'index.html'
  );

  console.log('Loading renderer:', htmlPath);

  mainWindow.webContents.on('did-fail-load', (
    event,
    errorCode,
    errorDescription,
    validatedURL
  ) => {

    console.error('Renderer failed to load:', {
      errorCode,
      errorDescription,
      validatedURL
    });

  });

  mainWindow.webContents.on('render-process-gone', (
    event,
    details
  ) => {

    console.error('Renderer process crashed:', details);

  });

  mainWindow.webContents.on('console-message', (
    event,
    details
  ) => {

    console.log(
      'Renderer console:',
      details.message
    );

  });

  mainWindow.once('ready-to-show', () => {

    mainWindow.show();

  });

  mainWindow.loadFile(htmlPath).catch(err => {

    console.error('HTML loading error:', err);

    dialog.showErrorBox(
      'Application Loading Error',
      'Could not load renderer/index.html\n\n' +
      err.message
    );

  });

  mainWindow.on('closed', () => {

    mainWindow = null;

  });

}

// ==========================================
// 7. APP INITIALIZATION
// ==========================================

app.whenReady().then(() => {

  createWindow();

  app.on('activate', () => {

    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }

  });

}).catch(err => {

  console.error('Electron initialization failed:', err);

});

app.on('window-all-closed', () => {

  if (process.platform !== 'darwin') {
    app.quit();
  }

});

// ==========================================
// 8. APP STATUS
// ==========================================

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

      bitrateMbps: 35

    }

  };

});

// ==========================================
// 9. SELECT OUTPUT FOLDER
// ==========================================

ipcMain.handle('dialog:select-folder', async () => {

  const res = await dialog.showOpenDialog(mainWindow, {

    properties: [
      'openDirectory',
      'createDirectory'
    ],

    title: 'Select Output Folder for 4K MP4 Loops'

  });

  if (res.canceled || !res.filePaths[0]) {
    return null;
  }

  return res.filePaths[0];

});

// ==========================================
// 10. OPEN OUTPUT FOLDER
// ==========================================

ipcMain.handle('fs:open-folder', async (_event, folderPath) => {

  const target = folderPath || getDefaultOutputDir();

  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const error = await shell.openPath(target);

  if (error) {
    throw new Error(error);
  }

  return true;

});

// ==========================================
// 11. SAVE MP4 VIDEO
// ==========================================

ipcMain.handle(
  'fs:save-mp4',
  async (_event, { folderPath, fileName, buffer }) => {

    if (!fileName || !buffer) {
      throw new Error('Invalid MP4 save request.');
    }

    const targetDir = folderPath || getDefaultOutputDir();

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const safeFileName = path.basename(fileName);

    const fullPath = path.join(
      targetDir,
      safeFileName
    );

    const videoBuffer = Buffer.from(buffer);

    fs.writeFileSync(fullPath, videoBuffer);

    return {
      fullPath,
      bytes: videoBuffer.length
    };

  }
);

// ==========================================
// 12. SAVE CSV METADATA
// ==========================================

ipcMain.handle(
  'fs:save-csv',
  async (_event, { folderPath, fileName, content }) => {

    if (!fileName || typeof content !== 'string') {
      throw new Error('Invalid CSV save request.');
    }

    const targetDir = folderPath || getDefaultOutputDir();

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const safeFileName = path.basename(fileName);

    const fullPath = path.join(
      targetDir,
      safeFileName
    );

    fs.writeFileSync(
      fullPath,
      content,
      'utf8'
    );

    return {
      fullPath
    };

  }
);

// ==========================================
// 13. GEMINI VIDEO CODE GENERATION
// ==========================================

ipcMain.handle(
  'gemini:generate-loop',
  async (_event, {
    prompt,
    engine,
    width,
    height
  }) => {

    if (!prompt || !prompt.trim()) {
      throw new Error('Video prompt cannot be empty.');
    }

    const userPrompt = `

Generate a 15-second seamless commercial
Adobe Stock video loop.

Prompt:
${prompt}

Engine:
${engine || 'canvas2d'}

Target Resolution:
${width || 3840}x${height || 2160}

Respond ONLY in valid JSON:

{
  "title": "Short commercial stock title (4-8 words)",

  "category": "Backgrounds/Abstract",

  "keywords": [
    "loop",
    "seamless",
    "4k",
    "abstract",
    "motion graphics",
    "background",
    "15 seconds"
  ],

  "code": "({ init(canvas, ctx, width, height, THREE) {}, render(canvas, ctx, width, height, progress, timeInSeconds, THREE) {}, destroy() {} })"
}

Ensure 40-50 commercial stock keywords.

Ensure mathematically identical start and end frames.

Return valid JSON only.

`;

    const result = await callGeminiWithRotation(userPrompt);

    let raw = result.text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed;

    try {

      parsed = JSON.parse(raw);

    } catch (err) {

      console.error('Gemini JSON parsing failed:', raw);

      throw new Error(
        'Gemini returned invalid JSON: ' + err.message
      );

    }

    if (!parsed.code) {
      throw new Error('Gemini response does not contain video code.');
    }

    parsed._usedKeyNumber = result.usedKeyNumber;

    parsed._totalKeys = result.totalKeys;

    return parsed;

  }
);

// ==========================================
// 14. ERROR LOGGING
// ==========================================

process.on('uncaughtException', err => {

  console.error('Uncaught Exception:', err);

});

process.on('unhandledRejection', reason => {

  console.error('Unhandled Rejection:', reason);

});

console.log('AdobeStock 4K 30fps Studio Main Process Ready.');
