# FCalendar - Route & Calendar Management PWA

Professional route planning and calendar management application for delivery services. Built as a Progressive Web App (PWA) for installation on any device.

## ✨ Features

- 📍 **Route Management** - Create, edit, and manage delivery routes with interactive maps
- 📅 **Calendar** - Track and schedule deliveries
- 🗺️ **Plano VM** - Visual van management planning
- 🎨 **Dark/Light Mode** - Automatic theme switching
- 📱 **PWA Support** - Install as native app on any device
- 🔄 **Offline Mode** - Works without internet connection
- 💾 **Auto-save** - Track and save changes with confirmation
- 🎯 **Edit Mode** - Conditional editing with save/discard options

## 🚀 Quick Start

```bash
npm install
npm run dev
```

## 📱 PWA & Deployment

See [PWA_DEPLOYMENT_GUIDE.md](./PWA_DEPLOYMENT_GUIDE.md) for complete setup and deployment instructions.

**⚠️ Calendar Database Setup Required:**
- Calendar events require PostgreSQL database (Neon)
- See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for DATABASE_URL configuration
- Without database, events fallback to localStorage (device-only, not synced)

## 🛠️ Tech Stack

React 19 + TypeScript + Vite + Tailwind CSS + Radix UI + React Leaflet
