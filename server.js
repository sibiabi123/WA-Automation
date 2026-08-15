// server.js - Express web server + REST API
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import wa from './lib/whatsapp.js';
import { syncSchedules, sendTestMessage, computeScheduleInfo } from './lib/scheduler.js';
import {
  getSchedules, addSchedule, updateSchedule, deleteSchedule, getLogs
} from './lib/storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── API ROUTES ─────────────────────────────────────────────────────────────

// WhatsApp status & statistics
app.get('/api/status', (req, res) => {
  const status = wa.getStatus();
  const rawSchedules = getSchedules();
  const todayLogs = getLogs(500).filter(l => {
    const d = new Date(l.timestamp);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  res.json({
    ...status,
    stats: {
      total: rawSchedules.length,
      active: rawSchedules.filter(s => s.enabled).length,
      sentToday: todayLogs.filter(l => l.status === 'sent' || l.status === 'sent (test)').length,
      failedToday: todayLogs.filter(l => l.status.includes('failed')).length,
    }
  });
});

// List all schedules (enriched with computed summary and cron)
app.get('/api/schedules', (req, res) => {
  const raw = getSchedules();
  const enriched = raw.map(s => computeScheduleInfo(s));
  res.json(enriched);
});

// Create a new schedule
app.post('/api/schedules', (req, res) => {
  const { name, to, countryCode = '91', message, repeatType = 'daily', time = '09:00', amPm = 'AM', date, daysOfWeek = [1], cron, enabled = true } = req.body;
  
  if (!name || !to || !message) {
    return res.status(400).json({ error: 'Name, phone number, and message are required.' });
  }

  const computed = computeScheduleInfo({
    name, to, countryCode, message, repeatType, time, amPm, date, daysOfWeek, cron, enabled
  });

  const schedule = addSchedule(computed);
  syncSchedules();
  res.status(201).json(computeScheduleInfo(schedule));
});

// Update a schedule
app.put('/api/schedules/:id', (req, res) => {
  const updated = updateSchedule(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Schedule not found' });
  
  const recomputed = updateSchedule(req.params.id, computeScheduleInfo(updated));
  syncSchedules();
  res.json(recomputed);
});

// Delete a schedule
app.delete('/api/schedules/:id', (req, res) => {
  const ok = deleteSchedule(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Schedule not found' });
  syncSchedules();
  res.json({ success: true });
});

// Instantly test a schedule
app.post('/api/schedules/:id/test', async (req, res) => {
  const schedules = getSchedules();
  const schedule = schedules.find(s => s.id === req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

  try {
    const result = await sendTestMessage(schedule);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get activity logs
app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(getLogs(limit));
});

// ─── START ───────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`\n🚀 SKEDit WhatsApp Automation running at http://localhost:${PORT}\n`);

  await wa.connect();

  wa.on('state_change', ({ state }) => {
    if (state === 'connected') {
      console.log('🗓️ Syncing active schedules...');
      syncSchedules();
    }
  });
});
