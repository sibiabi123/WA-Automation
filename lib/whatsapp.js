// lib/whatsapp.js - Baileys multi-device WhatsApp connection manager
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FOLDER = path.join(__dirname, '..', 'auth_info');

const logger = pino({ level: 'silent' });

export function formatJid(phone, countryCode = '91') {
  let cleaned = String(phone || '').replace(/\D/g, '');
  if (!cleaned) return '';

  // Prepend country code if 10-digit number
  if (cleaned.length === 10 && countryCode) {
    const ccDigits = String(countryCode).replace(/\D/g, '');
    cleaned = `${ccDigits}${cleaned}`;
  }

  if (!cleaned.endsWith('@s.whatsapp.net')) {
    return `${cleaned}@s.whatsapp.net`;
  }
  return cleaned;
}

class WhatsAppClient extends EventEmitter {
  constructor() {
    super();
    this.sock = null;
    this.state = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
    this.qrDataURL = null;
    this.qrRaw = null;
    this.phoneNumber = null;
    this.retryCount = 0;
    this.maxRetries = 15;
  }

  async connect() {
    try {
      this.state = 'connecting';
      this.emit('state_change', { state: this.state });

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: true,
        logger,
        browser: ['SKEDit WA Automation', 'Chrome', '124.0'],
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
      });

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.state = 'qr_ready';
          this.qrRaw = qr;
          try {
            this.qrDataURL = await qrcode.toDataURL(qr, { width: 300, margin: 2 });
          } catch {
            this.qrDataURL = null;
          }
          this.emit('qr', { qrDataURL: this.qrDataURL });
          this.emit('state_change', { state: this.state });
          console.log('📱 QR Code ready – open the web dashboard to scan.');
        }

        if (connection === 'open') {
          this.state = 'connected';
          this.qrDataURL = null;
          this.qrRaw = null;
          this.retryCount = 0;
          const me = this.sock?.user;
          this.phoneNumber = me?.id ? me.id.split(':')[0].split('@')[0] : null;
          this.emit('state_change', { state: this.state, phone: this.phoneNumber });
          console.log(`✅ Connected as ${this.phoneNumber}`);
        }

        if (connection === 'close') {
          const errCode = (lastDisconnect?.error instanceof Boom)
            ? lastDisconnect.error.output?.statusCode
            : 0;

          if (errCode === DisconnectReason.loggedOut) {
            this.state = 'disconnected';
            this.emit('state_change', { state: this.state });
            console.log('❌ Logged out from WhatsApp. Delete auth_info/ to rescan.');
            return;
          }

          if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            const delay = Math.min(2000 * this.retryCount, 20000);
            console.log(`🔄 Reconnecting (${this.retryCount}/${this.maxRetries}) in ${delay / 1000}s...`);
            this.state = 'connecting';
            this.emit('state_change', { state: this.state });
            setTimeout(() => this.connect(), delay);
          } else {
            this.state = 'disconnected';
            this.emit('state_change', { state: this.state });
          }
        }
      });

      this.sock.ev.on('creds.update', saveCreds);

    } catch (err) {
      console.error('Connection error:', err.message);
      this.state = 'disconnected';
      this.emit('state_change', { state: this.state });
    }
  }

  async sendMessage(to, message, countryCode = '91') {
    if (this.state !== 'connected' || !this.sock) {
      throw new Error('WhatsApp is not connected. Please scan the QR code first.');
    }

    const jid = formatJid(to, countryCode);
    if (!jid) throw new Error('Invalid recipient phone number.');

    const result = await this.sock.sendMessage(jid, { text: message });
    return { ...result, formattedJid: jid };
  }

  getStatus() {
    return {
      state: this.state,
      qrDataURL: this.qrDataURL,
      phone: this.phoneNumber,
    };
  }

  disconnect() {
    this.maxRetries = 0;
    this.sock?.end?.();
    this.state = 'disconnected';
    this.emit('state_change', { state: this.state });
  }
}

const client = new WhatsAppClient();
export default client;
