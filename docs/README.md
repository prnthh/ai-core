# Pockit AICore Example

Live example showing three AI characters having a conversation.

## 🚀 Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

## 🧪 Test

```bash
npm test              # Run tests in headed mode
```

See `tests/README.md` for details.

## 🎯 What It Shows

- **Loading UI** - Absolutely positioned overlay with progress
- **Three Characters:**
  - 🤖 RoboTech (logical & technical)
  - 🎨 ArtSoul (creative & imaginative)  
  - 🌟 StarWise (philosophical & curious)
- **Auto-conversation** - Characters take turns discussing random topics
- **Web Worker** - Shows proper worker implementation using `../lib/`

## 📁 Files

- `index.html` - Main page with styles and UI
- `main.js` - App logic and character system
- `worker.js` - Web Worker using AICore library
- `vite.config.js` - Vite setup
- `package.json` - Dependencies

## 💡 How It Works

1. Worker loads `qwen3-0.6b` model (fast, small)
2. Loading overlay shows progress
3. Once ready, click "Start Conversation"
4. Three characters discuss random topics (creativity, consciousness, etc.)
5. Each character responds based on their personality
6. Conversation continues for 9 exchanges

## 🎨 Usage Example

This demonstrates:
- ✅ Importing from `../lib/`
- ✅ Web Worker pattern
- ✅ Streaming responses
- ✅ Loading states
- ✅ Clean UI

Copy and adapt for your project!
