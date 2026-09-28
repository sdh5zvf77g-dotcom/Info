# 📖 Encyclopedia App

A fully working, mobile-first encyclopedia powered by the **live Wikipedia API**.  
Content is always up to date. Search millions of articles, read full extracts, switch languages, and install it on your phone.

## Features

- 🔍 Instant search with live suggestions
- 📄 Full article extracts + images
- 🎲 Random article
- ⭐ Today's Featured Article (English)
- 🌍 11 languages (English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Arabic, Hindi)
- 🌙 Dark / Light mode
- 📜 Search history (stored only on your device)
- 📱 Progressive Web App — installable on phone
- 🔗 Share articles

## How to run it from your phone (via GitHub)

### 1. Create a GitHub repository

1. Go to [github.com/new](https://github.com/new)
2. Name it anything (e.g. `encyclopedia-app`)
3. Make it **Public**
4. Click **Create repository**

### 2. Upload the files

**Easiest way (no Git required):**

1. On the new empty repository page, click **uploading an existing file**
2. Drag and drop **all** these files into the browser:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `manifest.json`
   - `sw.js`
   - `README.md`
3. Click **Commit changes**

**Or with Git:**

```bash
git clone https://github.com/YOUR_USERNAME/encyclopedia-app.git
cd encyclopedia-app
# copy all the files into this folder
git add .
git commit -m "Initial encyclopedia app"
git push
```

### 3. Enable GitHub Pages

1. In your repository go to **Settings → Pages**
2. Under **Source** choose **Deploy from a branch**
3. Select branch **main** (or `master`) and folder **/ (root)**
4. Click **Save**

After 1–2 minutes your app will be live at:

```
https://YOUR_USERNAME.github.io/encyclopedia-app/
```

### 4. Open it on your phone

1. Open the GitHub Pages URL in **Chrome** (Android) or **Safari** (iPhone)
2. On Android: menu → **Install app** / **Add to Home screen**
3. On iPhone: Share button → **Add to Home Screen**

It now runs like a native app, offline for the UI, and online for Wikipedia content.

## Local testing

Just open `index.html` in a browser, or run a simple static server:

```bash
npx serve .
# or
python -m http.server 8000
```

Then visit `http://localhost:8000` (or the port shown).

## Technical notes

- Pure HTML + CSS + vanilla JavaScript (no frameworks, no build step)
- All Wikipedia requests use the official MediaWiki Action API with `origin=*`
- Service worker caches the app shell for offline use
- History and theme preference are stored in `localStorage` only

## License

This app code is free to use and modify.  
Wikipedia content is licensed under [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/).
