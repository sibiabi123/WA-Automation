# 🚀 SKEDit Clone - WhatsApp Automation & Scheduler Web App

Full-featured SKEDit Web Application clone for WhatsApp daily/weekly messaging automation with real-time UI, time picker, AM/PM toggle, day-of-week selection, country code support, QR pairing, and live execution history.

---

## 🌟 Key SKEDit Features

- **📱 In-Browser QR Pairing**: Link WhatsApp directly in your browser.
- **⏰ Custom Time Picker**: Hours (`01`-`12`), Minutes (`00`-`59`), and **AM / PM** toggle.
- **🔄 Flexible Repeat Frequencies**:
  - 🔄 **Daily**: Every day at specified time (e.g., `11:05 AM`).
  - 📅 **Weekly**: Pick specific days (e.g., `Mon, Wed, Fri` at `06:30 PM`).
  - 🔂 **Once**: Specific date & time.
  - 📆 **Monthly**: Specific day of every month.
  - ⚙️ **Custom Cron**: For power users.
- **🇮🇳 Country Code Picker**: Pre-formats recipient numbers automatically.
- **📊 Real-time Dashboard**: Live status badges, test trigger (▶ Send Now), and activity logs.

---

## ⚡ Local Quick Start

```bash
# 1. Clone repository
git clone https://github.com/sibiabi123/WA-Automation.git
cd WA-Automation

# 2. Install dependencies
npm install

# 3. Start server
npm start
```

Open **`http://localhost:3000`** in your browser!

---

## 🌐 Deploy to Vercel

### Step 1: Push code to your GitHub repo
```bash
git push -u origin main
```
*(If prompted, enter your GitHub Personal Access Token or credentials)*

### Step 2: Deploy on Vercel
1. Go to [Vercel New Project](https://vercel.com/new).
2. Select your repository: **`sibiabi123/WA-Automation`**.
3. Click **Deploy**. Vercel will automatically detect `vercel.json` and deploy your website!

---

## ☁️ 24/7 Host Deployment (Render / Railway / VPS)

Because WhatsApp Web requires a persistent WebSocket connection to trigger scheduled messages 24/7:

### Option A: Render.com (Free)
1. Go to [Render Dashboard](https://dashboard.render.com/) → **New Web Service**.
2. Connect your GitHub repo `sibiabi123/WA-Automation`.
3. Set **Start Command**: `npm start`.
4. Click **Create Web Service**.

### Option B: Local 24/7 PM2 Daemon
```bash
npm install -g pm2
pm2 start server.js --name "skedit-wa"
pm2 save
pm2 startup
```

---

## 🛠️ API Reference

- `GET /api/status` - Connection state & QR Data URL
- `GET /api/schedules` - List all schedules with computed summaries
- `POST /api/schedules` - Create a schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule
- `POST /api/schedules/:id/test` - Trigger instant test send
- `GET /api/logs` - Execution log history
