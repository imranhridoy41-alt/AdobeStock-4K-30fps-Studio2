================================================================
  AdobeStock 4K 30fps Studio — 4K 30 FPS Gemini Loop Video Studio (.EXE Kit)
================================================================

FEATURES:
- Powered by Google Gemini API (gemini-3.8-flash) via @google/genai
- Renders 15-second mathematically seamless loops at 4K UHD (3840x2160) @ 30 FPS (450 frames)
- Hardware-accelerated H.264 High Profile Level 5.1 MP4 output (35 Mbps)
- Batch 1 to 50 prompts -> auto-saves MP4 files directly to your Windows folder!
- Auto-generates AdobeStock_4K_Metadata.csv with titles & 50 keywords.

----------------------------------------------------------------
METHOD 1: BUILD .EXE ON YOUR WINDOWS PC (1-CLICK, 2 MINUTES)
----------------------------------------------------------------
1. Extract this ZIP folder anywhere on your PC.
2. Make sure Node.js LTS is installed (https://nodejs.org).
3. Rename ".env.example" to ".env" and put your Gemini API key:
      GEMINI_API_KEY=your_actual_gemini_api_key
4. Double-click "2_BUILD_WINDOWS_EXE.bat".
5. When finished, the "dist" folder will open automatically containing:
      AdobeStock-4K-30fps-Studio.exe
6. Copy your ".env" file into the same folder as the .exe and double-click the .exe!

(Want to run immediately without building .exe? Just double-click "1_RUN_DESKTOP_APP.bat")

----------------------------------------------------------------
METHOD 2: BUILD .EXE IN THE CLOUD VIA GITHUB (NO NODE.JS NEEDED)
----------------------------------------------------------------
1. Create a free GitHub repository and upload all files from this ZIP.
2. Go to the "Actions" tab in GitHub and run "Build Windows 4K Loop Studio EXE".
3. Download the compiled "AdobeStock-4K-30fps-Studio.exe" directly from Artifacts!
