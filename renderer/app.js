
import * as THREE from '../node_modules/three/build/three.module.js';

const { Muxer, ArrayBufferTarget } = window.Mp4Muxer;

const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');
const promptsInput = document.getElementById('promptsInput');
const resolutionSelect = document.getElementById('resolutionSelect');
const fpsSelect = document.getElementById('fpsSelect');
const bitrateSelect = document.getElementById('bitrateSelect');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const loadSampleBtn = document.getElementById('loadSampleBtn');
const clearBtn = document.getElementById('clearBtn');
const chooseFolderBtn = document.getElementById('chooseFolderBtn');
const openFolderBtn = document.getElementById('openFolderBtn');
const folderDisplay = document.getElementById('folderDisplay');
const apiStatus = document.getElementById('apiStatus');
const statusText = document.getElementById('statusText');
const frameText = document.getElementById('frameText');
const progressBar = document.getElementById('progressBar');
const logBox = document.getElementById('logBox');

const SAMPLE_PROMPTS = [
  "Luxury molten golden fluid wave with shimmering stardust particles on obsidian black background",
  "Cyberpunk neon cyan and magenta plexus network with pulsing data nodes and digital HUD grid",
  "Modern corporate smooth gradient silk ribbon waves with deep violet and electric indigo lighting",
  "Bioluminescent deep sea aquatic caustics with floating glowing teal organic plankton and sunbeams",
  "Hyperspace sci-fi warp starfield tunnel with high-velocity radial streaks and energy shockwaves",
  "Sacred geometric kaleidoscopic mandala with crystal prism reflections and chromatic aberration",
  "Quantum neural synapse particle network with glowing electrical impulses and energy conduits",
  "Abstract liquid glass chromatic spheres floating and refracting iridescent pastel light",
  "Glowing emerald green binary matrix digital rain with holographic cybernetic scanlines",
  "Imperial gold and royal blue geometric art deco ornamental lines expanding seamlessly"
];

let outputFolder = '';
let shouldStop = false;

function log(message, type = '') {
  const div = document.createElement('div');
  if (type) div.className = 'log-' + type;
  div.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
  logBox.appendChild(div);
  logBox.scrollTop = logBox.scrollHeight;
}

function compileLoopCode(codeStr) {
  let clean = codeStr.trim();

  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:javascript|js)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  const fn = new Function('"use strict"; return (' + clean + ');');
  const inst = fn();

  if (!inst || typeof inst.render !== 'function') {
    throw new Error('Generated script did not return a valid render() function');
  }

  return inst;
}

async function render4KMp4Buffer(code, width, height, fps, bitrateMbps) {
  const duration = 15.0;
  const totalFrames = Math.round(duration * fps);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const compiled = compileLoopCode(code);

  if (compiled.init) {
    compiled.init(canvas, ctx, width, height, THREE);
  }

  const target = new ArrayBufferTarget();

  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory',
  });

  let encErr = null;

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encErr = e; },
  });

  const is4K = width > 1920 || height > 1920;

  const codecs = is4K
    ? ['avc1.640033', 'avc1.640034', 'avc1.4d0033', 'avc1.420033']
    : ['avc1.64002a', 'avc1.640028', 'avc1.4d002a'];

  let chosenConfig = null;

  for (const codec of codecs) {
    const cfg = {
      codec,
      width,
      height,
      bitrate: bitrateMbps * 1_000_000,
      framerate: fps,
      hardwareAcceleration: 'prefer-hardware',
    };

    try {
      const sup = await VideoEncoder.isConfigSupported(cfg);

      if (sup && sup.supported) {
        chosenConfig = cfg;
        break;
      }
    } catch {}
  }

  if (!chosenConfig) {
    chosenConfig = {
      codec: is4K ? 'avc1.640033' : 'avc1.640028',
      width,
      height,
      bitrate: bitrateMbps * 1_000_000,
      framerate: fps
    };
  }

  encoder.configure(chosenConfig);

  for (let f = 0; f < totalFrames; f++) {
    if (shouldStop) throw new Error('Stopped by user');
    if (encErr) throw encErr;

    while (encoder.encodeQueueSize > 8) {
      await new Promise((r) => setTimeout(r, 15));
      if (encErr) throw encErr;
    }

    const timeSec = (f / totalFrames) * duration;
    const progress = (f / totalFrames) % 1.0;

    compiled.render(canvas, ctx, width, height, progress, timeSec, THREE);

    const vFrame = new VideoFrame(canvas, {
      timestamp: Math.round((f / fps) * 1_000_000),
      duration: Math.round((1 / fps) * 1_000_000),
    });

    encoder.encode(vFrame, {
      keyFrame: f === 0 || f % (fps * 2) === 0
    });

    vFrame.close();

    if (f % 5 === 0 || f === totalFrames - 1) {
      previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

      previewCtx.drawImage(
        canvas,
        0,
        0,
        previewCanvas.width,
        previewCanvas.height
      );

      const pct = Math.round(((f + 1) / totalFrames) * 100);

      progressBar.style.width = pct + '%';

      frameText.textContent =
        'Frame ' + (f + 1) + ' / ' + totalFrames + ' (' + pct + '%)';

      await new Promise((r) => setTimeout(r, 0));
    }
  }

  await encoder.flush();
  encoder.close();
  muxer.finalize();

  if (compiled.destroy) compiled.destroy();

  return target.buffer;
}

async function init() {
  const st = await window.desktopAPI.getStatus();

  outputFolder = st.defaultOutputDir;
  folderDisplay.textContent = outputFolder;

  promptsInput.value = SAMPLE_PROMPTS.slice(0, 3).join('\n');

  if (st.hasApiKey) {
    apiStatus.textContent = st.keyCount > 1
      ? st.keyCount + ' Gemini Keys Loaded (Auto-Rotation ON)'
      : 'Gemini API Key Ready';

    apiStatus.className = 'status-pill status-ok';

    log(
      'Desktop Studio Ready (' + st.keyCount + ' key(s)). Default: ' +
      st.defaults.width + 'x' + st.defaults.height +
      ' @ ' + st.defaults.fps + ' FPS.',
      'ok'
    );
  } else {
    apiStatus.textContent = 'Missing GEMINI_API_KEYS in .env';
    apiStatus.className = 'status-pill status-err';

    log(
      'Create a .env file next to the .exe with GEMINI_API_KEYS=key1,key2,... and restart!',
      'err'
    );
  }
}

chooseFolderBtn.onclick = async () => {
  const picked = await window.desktopAPI.selectFolder();

  if (picked) {
    outputFolder = picked;
    folderDisplay.textContent = picked;

    log('Output folder changed to: ' + picked, 'warn');
  }
};

openFolderBtn.onclick = () => window.desktopAPI.openFolder(outputFolder);

loadSampleBtn.onclick = () => {
  promptsInput.value = SAMPLE_PROMPTS.join('\n');
};

clearBtn.onclick = () => {
  promptsInput.value = '';
};

stopBtn.onclick = () => {
  shouldStop = true;
  log('Stopping after current step...', 'warn');
};

startBtn.onclick = async () => {
  const prompts = promptsInput.value
    .split('\n')
    .map((s) => s.trim().replace(/^\d+[\.\)\-]\s*/, ''))
    .filter(Boolean);

  if (prompts.length === 0) {
    log('Please enter at least 1 prompt.', 'err');
    return;
  }

  const [width, height] = resolutionSelect.value.split('x').map(Number);
  const fps = Number(fpsSelect.value);
  const bitrateMbps = Number(bitrateSelect.value);

  shouldStop = false;

  startBtn.disabled = true;
  stopBtn.disabled = false;

  const csvRows = ['Filename,Title,Keywords,Category'];

  for (let i = 0; i < prompts.length; i++) {
    if (shouldStop) break;

    const prompt = prompts[i];

    statusText.textContent =
      'Video ' + (i + 1) + '/' + prompts.length + ': Calling Gemini AI...';

    progressBar.style.width = '3%';

    log(
      '[' + (i + 1) + '/' + prompts.length +
      '] Generating 15s code via Gemini AI: ' + prompt
    );

    try {
      const data = await window.desktopAPI.generateLoop({
        prompt,
        engine: 'canvas2d',
        width,
        height
      });

      const title = data.title || ('AdobeStock_Loop_' + (i + 1));

      const slug = title
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .slice(0, 40);

      const fileName =
        String(i + 1).padStart(2, '0') + '_' +
        slug + '_' + width + 'x' + height + '_' + fps + 'fps.mp4';

      statusText.textContent =
        'Video ' + (i + 1) + '/' + prompts.length +
        ': Rendering ' + width + 'x' + height + ' @ ' + fps + ' FPS...';

      const arrayBuffer = await render4KMp4Buffer(
        data.code,
        width,
        height,
        fps,
        bitrateMbps
      );

      const saved = await window.desktopAPI.saveMp4({
        folderPath: outputFolder,
        fileName,
        buffer: arrayBuffer,
      });

      const mb = (saved.bytes / (1024 * 1024)).toFixed(1);

      log('SAVED: ' + fileName + ' (' + mb + ' MB)', 'ok');

      const keywordsStr = Array.isArray(data.keywords)
        ? data.keywords.join(', ')
        : '';

      csvRows.push(
        '"' + fileName + '","' +
        title.replace(/"/g, '""') + '","' +
        keywordsStr.replace(/"/g, '""') + '","' +
        (data.category || 'Backgrounds/Abstract') + '"'
      );

    } catch (err) {
      log('ERROR on video #' + (i + 1) + ': ' + err.message, 'err');
    }
  }

  if (csvRows.length > 1) {
    await window.desktopAPI.saveCsv({
      folderPath: outputFolder,
      fileName: 'AdobeStock_4K_Metadata.csv',
      content: csvRows.join('\r\n'),
    });

    log('Saved AdobeStock_4K_Metadata.csv in output folder!', 'ok');
  }

  statusText.textContent = shouldStop
    ? 'Stopped by user.'
    : 'All videos completed!';

  startBtn.disabled = false;
  stopBtn.disabled = true;
};

init();
