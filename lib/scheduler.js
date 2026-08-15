// lib/scheduler.js - SKEDit-style scheduling engine
import cron from 'node-cron';
import wa, { formatJid } from './whatsapp.js';
import { getSchedules, updateSchedule, addLog } from './storage.js';

const activeCrons = new Map(); // scheduleId -> cron.ScheduledTask

export function computeScheduleInfo(s) {
  let [hoursStr, minsStr] = (s.time || '09:00').split(':');
  let hour = parseInt(hoursStr, 10) || 9;
  let minute = parseInt(minsStr, 10) || 0;
  const amPm = (s.amPm || 'AM').toUpperCase();

  // Convert to 24-hour format
  if (amPm === 'PM' && hour < 12) hour += 12;
  if (amPm === 'AM' && hour === 12) hour = 0;

  const repeatType = s.repeatType || 'daily';
  let cronStr = '';
  let summaryStr = '';

  const formattedTime = `${s.time || '09:00'} ${amPm}`;

  if (repeatType === 'custom_cron') {
    cronStr = s.cron || '0 9 * * *';
    summaryStr = `Custom Cron: ${cronStr}`;
  } else if (repeatType === 'once') {
    const dateObj = new Date(s.date || new Date().toISOString().split('T')[0]);
    const dayOfMonth = dateObj.getDate() || 1;
    const month = (dateObj.getMonth() + 1) || 1;
    cronStr = `${minute} ${hour} ${dayOfMonth} ${month} *`;
    summaryStr = `Once on ${s.date || 'today'} at ${formattedTime}`;
  } else if (repeatType === 'daily') {
    cronStr = `${minute} ${hour} * * *`;
    summaryStr = `Every day at ${formattedTime}`;
  } else if (repeatType === 'weekly') {
    const days = (s.daysOfWeek && s.daysOfWeek.length > 0) ? s.daysOfWeek : [1];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const selectedNames = days.map(d => dayNames[d]).join(', ');
    cronStr = `${minute} ${hour} * * ${days.join(',')}`;
    summaryStr = `Every week on (${selectedNames}) at ${formattedTime}`;
  } else if (repeatType === 'monthly') {
    const dateObj = new Date(s.date || new Date().toISOString().split('T')[0]);
    const dayOfMonth = dateObj.getDate() || 1;
    cronStr = `${minute} ${hour} ${dayOfMonth} * *`;
    summaryStr = `Monthly on day ${dayOfMonth} at ${formattedTime}`;
  }

  return {
    ...s,
    cron: cronStr,
    scheduleSummary: summaryStr,
  };
}

function buildTask(schedule) {
  const computed = computeScheduleInfo(schedule);

  if (!cron.validate(computed.cron)) {
    console.warn(`⚠️ Invalid cron expression for schedule "${schedule.name}": ${computed.cron}`);
    return null;
  }

  const task = cron.schedule(computed.cron, async () => {
    console.log(`⏰ Firing schedule "${schedule.name}" [${schedule.id}] at ${new Date().toISOString()}`);
    try {
      const msg = await wa.sendMessage(schedule.to, schedule.message, schedule.countryCode);
      console.log(`✅ Sent to ${msg.formattedJid} | msgId: ${msg?.key?.id}`);

      addLog({
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        to: schedule.to,
        countryCode: schedule.countryCode,
        message: schedule.message,
        status: 'sent',
        msgId: msg?.key?.id || null,
      });

      updateSchedule(schedule.id, {
        sentCount: (schedule.sentCount || 0) + 1,
        lastSent: new Date().toISOString(),
      });

      // If 'once', disable schedule after sending
      if (schedule.repeatType === 'once') {
        updateSchedule(schedule.id, { enabled: false });
        stopSchedule(schedule.id);
      }

    } catch (err) {
      console.error(`❌ Failed to send for "${schedule.name}": ${err.message}`);
      addLog({
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        to: schedule.to,
        countryCode: schedule.countryCode,
        message: schedule.message,
        status: 'failed',
        error: err.message,
      });
    }
  }, { timezone: 'Asia/Kolkata' });

  return task;
}

export function syncSchedules() {
  const schedules = getSchedules();

  for (const [id, task] of activeCrons) {
    const found = schedules.find(s => s.id === id);
    if (!found || !found.enabled) {
      task.stop();
      activeCrons.delete(id);
      console.log(`⏹️ Stopped schedule [${id}]`);
    }
  }

  for (const schedule of schedules) {
    if (!schedule.enabled) continue;
    if (activeCrons.has(schedule.id)) continue;

    const task = buildTask(schedule);
    if (task) {
      activeCrons.set(schedule.id, task);
      const computed = computeScheduleInfo(schedule);
      console.log(`📅 Started schedule "${schedule.name}" | ${computed.scheduleSummary} | to: ${schedule.to}`);
    }
  }
}

export function stopSchedule(id) {
  if (activeCrons.has(id)) {
    activeCrons.get(id).stop();
    activeCrons.delete(id);
  }
}

export function getActiveCount() {
  return activeCrons.size;
}

export async function sendTestMessage(schedule) {
  console.log(`🧪 Test send for "${schedule.name}" to ${schedule.to}`);
  try {
    const msg = await wa.sendMessage(schedule.to, schedule.message, schedule.countryCode);
    addLog({
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      to: schedule.to,
      countryCode: schedule.countryCode,
      message: schedule.message,
      status: 'sent (test)',
      msgId: msg?.key?.id || null,
    });
    return { success: true, msgId: msg?.key?.id, formattedJid: msg.formattedJid };
  } catch (err) {
    addLog({
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      to: schedule.to,
      countryCode: schedule.countryCode,
      message: schedule.message,
      status: 'failed (test)',
      error: err.message,
    });
    throw err;
  }
}
