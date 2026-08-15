// lib/storage.js - JSON file persistence
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON(filename, fallback = []) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(filename, data) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ---- Schedules ----
export function getSchedules() {
  return readJSON('schedules.json', []);
}

export function saveSchedules(schedules) {
  writeJSON('schedules.json', schedules);
}

export function addSchedule(schedule) {
  const schedules = getSchedules();
  schedule.id = Date.now().toString();
  schedule.createdAt = new Date().toISOString();
  schedule.sentCount = 0;
  schedules.push(schedule);
  saveSchedules(schedules);
  return schedule;
}

export function updateSchedule(id, updates) {
  const schedules = getSchedules();
  const idx = schedules.findIndex(s => s.id === id);
  if (idx === -1) return null;
  schedules[idx] = { ...schedules[idx], ...updates };
  saveSchedules(schedules);
  return schedules[idx];
}

export function deleteSchedule(id) {
  const schedules = getSchedules();
  const idx = schedules.findIndex(s => s.id === id);
  if (idx === -1) return false;
  schedules.splice(idx, 1);
  saveSchedules(schedules);
  return true;
}

// ---- Logs ----
export function getLogs(limit = 100) {
  const logs = readJSON('logs.json', []);
  return logs.slice(-limit).reverse();
}

export function addLog(entry) {
  const logs = readJSON('logs.json', []);
  logs.push({
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    ...entry
  });
  if (logs.length > 500) logs.splice(0, logs.length - 500);
  writeJSON('logs.json', logs);
}
