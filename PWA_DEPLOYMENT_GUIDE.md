# PWA Setup & Vercel Deployment Guide

## 📱 Progressive Web App (PWA) Features

FCalendar is now a fully functional PWA that can be installed on any device like a native app.

### Features Included:
- ✅ Offline functionality with Service Worker
- ✅ Install to home screen (iOS & Android)
- ✅ App-like experience with standalone display
- ✅ Custom app icons and splash screens
- ✅ Fast loading with intelligent caching
- ✅ Auto-update notifications

## 🎨 Icon Setup

### Option 1: Generate Icons Automatically (Recommended)

1. Install sharp (optional but recommended):
```bash
npm install --save-dev sharp
```

2. Generate all required icon sizes:
```bash
npm run generate-icons
```

### Option 2: Generate Icons Online

1. Visit https://realfavicongenerator.net/ or https://www.pwabuilder.com/imageGenerator
2. Upload `public/icon.svg`
3. Download all generated icons
4. Place them in the `public/` folder

### Option 3: Use Your Own Icons

Create PNG files in these sizes and place them in `public/`:
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png (minimum required)
- icon-384x384.png
- icon-512x512.png (recommended)

## 📸 Screenshots (Optional)

For better app store listing, add screenshots:
- `public/screenshot-mobile.png` - 540x720px (mobile view)
- `public/screenshot-desktop.png` - 1920x1080px (desktop view)

## 🚀 Vercel Deployment

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/FCalendar)

### Manual Deployment

1. **Install Vercel CLI** (if not already installed):
```bash
npm install -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Deploy**:
```bash
vercel
```

4. **Deploy to Production**:
```bash
vercel --prod
```

### GitHub Integration (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will automatically detect Vite configuration
5. Click "Deploy"

**Automatic Deployments:**
- Every push to `main` branch → Production deployment
- Every push to other branches → Preview deployment

## ⚙️ Vercel Configuration

The `vercel.json` file includes:
- ✅ SPA routing configuration
- ✅ Service Worker headers
- ✅ Security headers
- ✅ Manifest headers

## 🔧 Environment Variables (if needed)

In Vercel Dashboard → Project Settings → Environment Variables:

```
# Example variables (add if you have any)
VITE_API_URL=https://api.example.com
VITE_MAP_API_KEY=your_map_api_key
```

## 📱 Testing PWA

### Desktop (Chrome/Edge)
1. Run the app: `npm run dev` or deploy to Vercel
2. Open DevTools (F12) → Application tab → Service Workers
3. Check "Offline" to test offline functionality
4. In address bar, look for install icon (+) to install as PWA

### Mobile (iOS)
1. Open in Safari
2. Tap Share button
3. Tap "Add to Home Screen"
4. App will appear on home screen

### Mobile (Android)
1. Open in Chrome
2. Tap menu (⋮)
3. Tap "Install app" or "Add to Home Screen"
4. App will appear in app drawer

## 🔍 Verification

After deployment, verify PWA setup:
1. Visit: https://www.pwabuilder.com/
2. Enter your Vercel URL
3. Check PWA score and recommendations

Or use Lighthouse in Chrome DevTools:
1. Open DevTools (F12)
2. Go to "Lighthouse" tab
3. Select "Progressive Web App"
4. Click "Generate report"

## 📊 Custom Domain (Optional)

In Vercel Dashboard:
1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. SSL certificate is automatically provisioned

## 🔄 Updating the App

1. Make changes to your code
2. Commit and push to GitHub:
```bash
git add .
git commit -m "Your update message"
git push origin main
```
3. Vercel automatically deploys updates
4. Service Worker will prompt users to refresh for new version

## 🐛 Troubleshooting

### Service Worker not loading
- Check browser console for errors
- Ensure HTTPS (required for Service Workers)
- Clear browser cache and reload

### Icons not showing
- Verify icon files exist in `public/` folder
- Check `manifest.json` paths are correct
- Clear browser cache

### App not installable
- Must be served over HTTPS
- Requires valid manifest.json
- Requires service worker
- Check Lighthouse PWA audit for issues

## 📚 Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Vercel Documentation](https://vercel.com/docs)
- [Service Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
