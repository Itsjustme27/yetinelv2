# Quick Start Guide - Mini SIEM Dashboard

## Installation Methods

### Method 1: Using Create React App (Full Setup)

```bash
# 1. Create a new React app
npx create-react-app mini-siem-dashboard
cd mini-siem-dashboard

# 2. Install lucide-react icons
npm install lucide-react

# 3. Replace src/App.js with the mini-siem.jsx content
# Copy the content from mini-siem.jsx to src/App.js

# 4. Update src/index.js to import from App.js
# Make sure it has: import App from './App';

# 5. Start the development server
npm start
```

The app will open at http://localhost:3000

### Method 2: Quick Test in Online Editor

**CodeSandbox:**
1. Go to https://codesandbox.io/s/new
2. Choose "React" template
3. Install `lucide-react` in Dependencies
4. Paste the mini-siem.jsx code into App.js
5. Click "Preview"

**StackBlitz:**
1. Go to https://stackblitz.com/edit/react
2. Install `lucide-react` 
3. Replace App.js content with mini-siem.jsx
4. View instantly in the preview pane

### Method 3: Single HTML File (No Build Required)

If you prefer a simple HTML file without npm:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Mini SIEM</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    // Paste the mini-siem.jsx code here
    // Then add at the bottom:
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<MiniSIEM />);
  </script>
</body>
</html>
```

## Project Structure

```
mini-siem-dashboard/
├── public/
│   └── index.html
├── src/
│   ├── App.jsx          (mini-siem.jsx content goes here)
│   └── index.js
├── package.json
└── README.md
```

## Features to Test

Once running, try these features:

1. **Real-time Monitoring**: Watch events appear every 3 seconds
2. **Pause/Resume**: Click the button in the header
3. **Navigate Tabs**: Dashboard, Events, Alerts, Endpoints, Analytics
4. **Event Details**: Click any event row to see full details
5. **Close Alerts**: Mark alerts as resolved
6. **Critical Events**: Watch for red-colored critical events

## Troubleshooting

**Issue: Module not found 'lucide-react'**
```bash
npm install lucide-react
```

**Issue: Port 3000 already in use**
```bash
# The app will prompt to use a different port, press Y
# Or specify a different port:
PORT=3001 npm start
```

**Issue: Slow performance**
- This is normal with many events
- Try pausing monitoring to reduce CPU usage

## Live Demo Options

Deploy your SIEM dashboard online for free:

**Vercel:**
```bash
npm install -g vercel
vercel
```

**Netlify:**
```bash
npm run build
# Drag and drop the 'build' folder to netlify.com/drop
```

**GitHub Pages:**
```bash
npm install --save-dev gh-pages
# Add to package.json scripts:
# "predeploy": "npm run build",
# "deploy": "gh-pages -d build"
npm run deploy
```

## System Requirements

- Node.js 16+ 
- npm 7+
- Modern browser (Chrome, Firefox, Safari, Edge)
- 4GB RAM recommended

## Next Steps

1. Customize the color scheme
2. Add more event types
3. Implement data persistence
4. Add export functionality
5. Create user authentication (demo)
6. Add more analytics visualizations

Enjoy your SIEM dashboard! 🛡️
