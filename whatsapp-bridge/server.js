const express = require('express');
const cors = require('cors');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');

// Global handlers to prevent unhandled rejections from crashing the bridge
process.on('uncaughtException', (err) => {
  console.warn('⚠️ Process caught uncaughtException (handled):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.warn('⚠️ Process caught unhandledRejection (handled):', reason?.message || reason);
});

// Safe wrapper for LocalAuth on Windows to gracefully ignore EBUSY errors on logout
class SafeLocalAuth extends LocalAuth {
  async logout() {
    try {
      if (this.userDataDir) {
        await fs.promises
          .rm(this.userDataDir, {
            recursive: true,
            force: true,
            maxRetries: 3,
          })
          .catch((e) => {
            console.warn('LocalAuth logout note (session locked by process, skipped delete):', e.message);
          });
      }
    } catch (err) {
      console.warn('LocalAuth logout handled error:', err.message);
    }
  }
}

// Kill orphaned headless Chrome/Edge processes holding the .wwebjs_auth session lock
function terminateOrphanedWwebjsBrowser() {
  if (process.platform === 'win32') {
    // 1. Fast CIM / WMI query targeting only chrome/edge processes with headless or wwebjs_auth
    try {
      const { execSync } = require('child_process');
      execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "$procs = Get-CimInstance Win32_Process -Filter \\"Name = 'chrome.exe' OR Name = 'msedge.exe'\\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*headless*' -or $_.CommandLine -like '*wwebjs_auth*' -or $_.CommandLine -like '*whatsapp-bridge*' }; if ($procs) { $procs | Stop-Process -Force -ErrorAction SilentlyContinue }"`,
        { timeout: 5000, stdio: 'ignore' }
      );
      console.log('🧹 Cleaned up any orphaned WhatsApp Chrome background processes via PowerShell.');
    } catch (e) {
      // Non-fatal if no process or command timeout
    }

    // 2. WMIC fallback for Windows environments where PowerShell command line access is restricted
    try {
      const { execSync } = require('child_process');
      execSync(
        `wmic process where "name='chrome.exe' and (commandline like '%%headless%%' or commandline like '%%wwebjs_auth%%' or commandline like '%%whatsapp-bridge%%')" call terminate`,
        { timeout: 4000, stdio: 'ignore' }
      );
    } catch (e) {}

    try {
      const { execSync } = require('child_process');
      execSync(
        `wmic process where "name='msedge.exe' and (commandline like '%%headless%%' or commandline like '%%wwebjs_auth%%' or commandline like '%%whatsapp-bridge%%')" call terminate`,
        { timeout: 4000, stdio: 'ignore' }
      );
    } catch (e) {}
  }
}

// Delete stale lock files that Chromium leaves behind if terminated abruptly
function cleanupStaleSessionLocks() {
  const authDir = path.join(__dirname, '.wwebjs_auth');
  if (!fs.existsSync(authDir)) return;

  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile', 'DevToolsActivePort'];

  function removeLocksInDir(dir, depth = 0) {
    if (depth > 3) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          removeLocksInDir(full, depth + 1);
        } else if (lockFiles.includes(entry.name)) {
          try {
            fs.unlinkSync(full);
            console.log(`🧹 Removed stale browser lock: ${full}`);
          } catch (e) {
            // Process may still be holding handle
          }
        }
      }
    } catch (e) {}
  }

  removeLocksInDir(authDir);
}

const app = express();
const PORT = process.env.PORT || process.env.WHATSAPP_PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

let client = null;
let clientReady = false;
let latestQrText = null;
let latestQrImage = null;
let clientInfo = null;
let stepStatus = 'Initializing Chromium browser...';
let lastError = null;
let isResetting = false;

// Incoming order queue (Holds overnight orders for local PC sync)
let incomingOrdersQueue = [];

// Fallback WhatsApp Web version if dynamic lookup fails
const FALLBACK_WA_VERSION = '2.3000.1051690951-alpha';
let currentWaVersion = FALLBACK_WA_VERSION;

// Dynamically fetch current active WhatsApp Web version from WPPConnect repository
async function resolveLatestWaVersion() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://raw.githubusercontent.com/wppconnect-team/wa-version/main/versions.json', {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.currentVersion) {
        console.log(`[WhatsApp] Dynamically resolved latest Web Version: ${data.currentVersion}`);
        currentWaVersion = data.currentVersion;
        return data.currentVersion;
      }
    }
  } catch (err) {
    console.warn(`[WhatsApp] Web version lookup note: ${err.message}. Using stable version: ${FALLBACK_WA_VERSION}`);
  }
  currentWaVersion = FALLBACK_WA_VERSION;
  return FALLBACK_WA_VERSION;
}

function getBrowserExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const possiblePaths = [
    // Linux / Docker / Render
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`Using system browser at: ${p}`);
      return p;
    }
  }
  return undefined;
}

// Determine Chrome path and Puppeteer flags
function getPuppeteerArgs() {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-extensions',
  ];
  const executablePath = getBrowserExecutablePath();
  const config = {
    headless: true,
    args,
  };
  if (executablePath) {
    config.executablePath = executablePath;
  }
  return config;
}

// Factory to create a WhatsApp Client instance with SafeLocalAuth
function createClient(version, customClientId) {
  const targetVersion = version || currentWaVersion || FALLBACK_WA_VERSION;
  console.log(`[WhatsApp] Initializing WhatsApp Web Client with version: ${targetVersion}`);

  const authOptions = {
    dataPath: path.join(__dirname, '.wwebjs_auth'),
  };
  if (customClientId) {
    authOptions.clientId = customClientId;
  }

  const newClient = new Client({
    authStrategy: new SafeLocalAuth(authOptions),
    webVersionCache: {
      type: 'remote',
      remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${targetVersion}.html`,
    },
    puppeteer: {
      ...getPuppeteerArgs(),
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    },
  });

  attachClientListeners(newClient);
  return newClient;
}

// Attach all WhatsApp event listeners
function attachClientListeners(targetClient) {
  targetClient.on('loading_screen', (percent, message) => {
    stepStatus = `Loading WhatsApp Web: ${percent}% (${message || 'syncing'})`;
    console.log(`⏳ ${stepStatus}`);
  });

  targetClient.on('qr', async (qr) => {
    latestQrText = qr;
    clientReady = false;
    clientInfo = null;
    stepStatus = 'QR Code Ready for Scanning';

    try {
      latestQrImage = await QRCode.toDataURL(qr);
    } catch (err) {
      console.error('Failed to generate QR data URL:', err);
    }

    console.log('\n======================================================');
    console.log('📱 SCAN THIS QR CODE IN WHATSAPP TO CONNECT:');
    console.log('(WhatsApp > Linked Devices > Link a Device)');
    console.log('Or open in your browser: http://localhost:' + PORT + '/qr');
    console.log('======================================================\n');
    qrcodeTerminal.generate(qr, { small: true });
  });

  targetClient.on('ready', () => {
    clientReady = true;
    latestQrText = null;
    latestQrImage = null;
    clientInfo = targetClient.info;
    stepStatus = 'Connected & Active';

    console.log('\n======================================================');
    console.log('✅ ZAMZAM FOODS WHATSAPP BRIDGE IS CONNECTED & READY!');
    console.log(`Connected Number: ${targetClient.info?.wid?.user || 'Active'}`);
    console.log(`Push Name: ${targetClient.info?.pushname || 'Zamzam'}`);
    console.log('======================================================\n');
  });

  targetClient.on('authenticated', () => {
    stepStatus = 'Authenticated. Finalizing session...';
    console.log('🔐 WhatsApp Session authenticated successfully.');
  });

  targetClient.on('auth_failure', (msg) => {
    lastError = `Authentication failure: ${msg}`;
    stepStatus = 'Auth Failed';
    console.error('❌ WhatsApp Authentication failure:', msg);
    clientReady = false;
  });

  targetClient.on('disconnected', async (reason) => {
    stepStatus = `Disconnected: ${reason}`;
    console.warn('⚠️ WhatsApp client disconnected:', reason);
    clientReady = false;
    latestQrText = null;
    latestQrImage = null;
    clientInfo = null;

    if (reason === 'LOGOUT') {
      console.log('🔄 Session logged out. Auto-recovering fresh session in 3s...');
      setTimeout(async () => {
        try {
          await resetWhatsAppSession();
        } catch (e) {
          console.error('Error during auto-reset after logout:', e.message);
        }
      }, 3000);
    }
  });

  // Incoming message listener (Receives 24/7 orders and queues for local PC)
  targetClient.on('message', async (msg) => {
    try {
      const sender = msg.from; // e.g. 919847012345@c.us
      const text = msg.body || '';
      console.log(`📩 Incoming WhatsApp from ${sender}: ${text}`);

      const cleanPhone = sender.replace(/\D/g, '');
      const orderData = {
        id: Date.now().toString(),
        sender,
        phone: cleanPhone,
        message: text,
        timestamp: new Date().toISOString(),
        receivedAt: new Date().toLocaleTimeString('en-IN'),
      };

      // Store in memory queue for local PC pickup
      incomingOrdersQueue.unshift(orderData);
      if (incomingOrdersQueue.length > 500) incomingOrdersQueue.pop();

      // Auto-reply if message looks like an order template
      const lower = text.toLowerCase();
      if (lower.includes('order') || lower.includes('porotta') || lower.includes('chapathi') || text.includes('1.')) {
        await msg.reply('✅ *Zamzam Foods Order Received!*\nThank you. Your daily order is recorded and is being prepared for dispatch.');
      }
    } catch (err) {
      console.error('Error in message listener:', err);
    }
  });
}

// Helper to detect if standard session directory is held by another process
function isSessionDirectoryLocked() {
  const sessionPath = path.join(__dirname, '.wwebjs_auth', 'session');
  if (!fs.existsSync(sessionPath)) return false;

  const lockFiles = ['DevToolsActivePort', 'SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile'];
  for (const f of lockFiles) {
    const full = path.join(sessionPath, f);
    if (fs.existsSync(full)) {
      try {
        fs.unlinkSync(full);
      } catch (e) {
        return true;
      }
    }
  }
  return false;
}

// Function to start client session with automatic recovery from zombie browser locks
async function startClientSession(forceFreshSession = false) {
  cleanupStaleSessionLocks();
  const targetVer = await resolveLatestWaVersion();
  const isLocked = !forceFreshSession && isSessionDirectoryLocked();
  const customClientId = (forceFreshSession || isLocked) ? 'session_' + Date.now() : undefined;
  if (isLocked) {
    console.warn('⚠️ Stale browser lock detected on standard session. Instantly launching with clean isolated session directory to bypass lock!');
  }
  client = createClient(targetVer, customClientId);
  stepStatus = 'Starting Chromium browser & preparing WhatsApp Web...';

  try {
    await client.initialize();
  } catch (err) {
    const errMsg = err?.message || String(err);
    console.error('❌ Error initializing WhatsApp client:', errMsg);

    // Auto-heal if browser is already running or directory locked
    if (errMsg.includes('The browser is already running') || errMsg.includes('userDataDir')) {
      console.log('🔄 Browser lock detected. Auto-clearing zombie processes and retrying in 2s...');
      stepStatus = 'Stale browser lock detected. Clearing and auto-retrying...';
      terminateOrphanedWwebjsBrowser();
      await new Promise((r) => setTimeout(r, 2000));
      cleanupStaleSessionLocks();

      try {
        if (client) {
          await client.destroy().catch(() => {});
        }
        client = createClient(targetVer);
        await client.initialize();
        return;
      } catch (retryErr) {
        console.warn('⚠️ Standard session folder locked by system. Falling back to fresh session to unblock QR generation...');
        stepStatus = 'Generating fresh session QR...';
        try {
          if (client) {
            await client.destroy().catch(() => {});
          }
          client = createClient(targetVer, 'session_' + Date.now());
          await client.initialize();
          return;
        } catch (freshErr) {
          lastError = freshErr?.message || String(freshErr);
          stepStatus = `Init Error: ${lastError}`;
          console.error('❌ Fresh session retry failed:', freshErr);
          return;
        }
      }
    }

    lastError = errMsg;
    stepStatus = `Init Error: ${lastError}`;
  }
}

// Function to cleanly reset WhatsApp session (destroys client, clears cache, creates fresh instance)
async function resetWhatsAppSession() {
  if (isResetting) return;
  isResetting = true;

  console.log('🔄 Performing complete WhatsApp session reset...');
  stepStatus = 'Resetting WhatsApp session...';
  lastError = null;
  clientReady = false;
  latestQrText = null;
  latestQrImage = null;
  clientInfo = null;

  if (client) {
    try {
      await client.destroy();
      console.log('✅ Previous client destroyed.');
    } catch (err) {
      console.warn('Warning during client destroy:', err.message);
    }
    client = null;
  }

  // Force-kill any orphaned headless Chrome/Edge processes locking .wwebjs_auth
  terminateOrphanedWwebjsBrowser();
  await new Promise((r) => setTimeout(r, 1500));
  cleanupStaleSessionLocks();

  // Remove .wwebjs_auth directory safely
  const authPath = path.join(__dirname, '.wwebjs_auth');
  if (fs.existsSync(authPath)) {
    try {
      fs.rmSync(authPath, { recursive: true, force: true, maxRetries: 3 });
      console.log('🗑️ .wwebjs_auth deleted successfully.');
    } catch (rmErr) {
      console.warn('Note: .wwebjs_auth locked, continuing with clean session reset.');
    }
  }

  await startClientSession(true);
  isResetting = false;
}

// Helper: Format phone number into WhatsApp chatId
function formatChatId(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) {
    digits = `91${digits}`; // Default to India 91 for 10-digit numbers
  }
  return `${digits}@c.us`;
}

// API Routes

// QR and Dashboard Web Page renderer
function renderQrPage(req, res) {
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.status(200).json({
      status: 'ok',
      connected: clientReady,
      hasQr: Boolean(latestQrImage),
      stepStatus,
    });
  }

  if (clientReady) {
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Zamzam WhatsApp Bridge</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #fff; text-align: center; padding: 20px; }
            .box { background: #1e293b; padding: 2.5rem; border-radius: 16px; border: 1px solid #334155; max-width: 460px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
            h2 { color: #22c55e; margin-top: 0; }
            .btn-reset { display: inline-block; margin-top: 15px; padding: 8px 16px; background: #334155; color: #94a3b8; text-decoration: none; border-radius: 8px; font-size: 0.85rem; border: 1px solid #475569; }
            .btn-reset:hover { background: #475569; color: #fff; }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>✅ WhatsApp Connected</h2>
            <p>Your WhatsApp session is active and ready to send bills automatically.</p>
            <p><strong>Connected Number:</strong> ${client?.info?.wid?.user || 'Active'}</p>
            <p><strong>Push Name:</strong> ${client?.info?.pushname || 'Zamzam'}</p>
            <hr style="border: 0; border-top: 1px solid #334155; margin: 1.5rem 0;" />
            <a href="/reset" class="btn-reset" onclick="return confirm('Do you want to log out and re-link WhatsApp with a new QR code?');">🔄 Re-link Another WhatsApp Number</a>
          </div>
        </body>
      </html>
    `);
  }

  if (!latestQrImage) {
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Zamzam WhatsApp Bridge</title>
          <meta http-equiv="refresh" content="3">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #fff; text-align: center; padding: 20px; }
            .box { background: #1e293b; padding: 2.5rem; border-radius: 16px; border: 1px solid #334155; max-width: 440px; }
            .status-badge { display: inline-block; padding: 6px 14px; background: #334155; border-radius: 999px; font-size: 0.85rem; color: #38bdf8; margin: 10px 0; font-family: monospace; }
            .spinner { width: 36px; height: 36px; border: 3px solid #334155; border-top-color: #38bdf8; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
            @keyframes spin { to { transform: rotate(360deg); } }
            .btn-reset { display: inline-block; margin-top: 15px; padding: 8px 16px; background: #dc2626; color: #fff; text-decoration: none; border-radius: 8px; font-size: 0.85rem; }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="spinner"></div>
            <h2 style="margin: 0;">⏳ Generating QR Code...</h2>
            <div class="status-badge">${stepStatus}</div>
            <p style="color: #94a3b8; font-size: 0.9rem;">Starting Chromium browser & preparing WhatsApp Web.<br/>This page will auto-refresh every 3s.</p>
            ${lastError ? `<p style="color: #f87171; font-size: 0.8rem; background: #450a0a; padding: 8px; border-radius: 8px;">⚠️ ${lastError}</p>` : ''}
            <div style="margin-top: 20px;">
              <a href="/reset" class="btn-reset" onclick="return confirm('Reset WhatsApp browser session completely?');">🔄 Force Reset Session</a>
            </div>
          </div>
        </body>
      </html>
    `);
  }

  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Zamzam WhatsApp Bridge - Scan QR</title>
        <meta http-equiv="refresh" content="15">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #fff; text-align: center; padding: 20px 10px; }
          .box { background: #1e293b; padding: 2rem; border-radius: 16px; border: 1px solid #334155; max-width: 440px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
          img { background: #fff; padding: 12px; border-radius: 12px; margin: 1rem 0; width: 260px; height: 260px; }
          p { color: #94a3b8; font-size: 0.9rem; line-height: 1.4; }
          ol { text-align: left; font-size: 0.85rem; color: #cbd5e1; padding-left: 1.2rem; }
          .trouble-box { margin-top: 1.2rem; padding: 12px; background: #0f172a; border-radius: 8px; border: 1px solid #334155; font-size: 0.82rem; color: #94a3b8; text-align: left; }
          .btn-reset { display: inline-block; margin-top: 10px; padding: 8px 16px; background: #ef4444; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 0.82rem; }
          .btn-reset:hover { background: #dc2626; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2 style="margin: 0 0 0.5rem 0;">📱 Link WhatsApp</h2>
          <p>Scan this QR code using WhatsApp on your primary phone:</p>
          <img src="${latestQrImage}" alt="WhatsApp QR Code" />
          <ol>
            <li>Open WhatsApp on your phone</li>
            <li>Tap <b>Linked Devices</b> (or 3 dots &gt; Linked Devices)</li>
            <li>Tap <b>Link a Device</b> and point camera here</li>
          </ol>
          <div class="trouble-box">
            <strong style="color: #fbbf24;">⚠️ Phone says "Can't link new devices right now"?</strong>
            <ul style="padding-left: 1.2rem; margin: 6px 0;">
              <li>Check <b>Linked Devices</b> on your phone: if 4 devices are already linked, or old sessions exist, tap them and <b>Log Out</b>.</li>
              <li>Make sure WhatsApp on your phone is updated in Play Store / App Store.</li>
              <li>If you tried scanning many times quickly, WhatsApp may enforce a 10-15 minute security cooldown.</li>
            </ul>
            <div style="text-align: center;">
              <a href="/reset" class="btn-reset" onclick="return confirm('Clear session cache and regenerate a brand-new QR code?');">🔄 Reset Session & Get New QR</a>
            </div>
          </div>
        </div>
      </body>
    </html>
  `);
}

// 0. Root & QR routes
app.get('/', renderQrPage);
app.get('/qr', renderQrPage);

// 0b. Session reset routes
app.get('/reset', async (req, res) => {
  try {
    await resetWhatsAppSession();
    res.redirect('/qr');
  } catch (err) {
    res.status(500).send(`Failed to reset session: ${err.message}`);
  }
});

app.post('/api/reset', async (req, res) => {
  try {
    await resetWhatsAppSession();
    res.json({ success: true, message: 'WhatsApp session reset initiated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 0c. UptimeRobot Health Check (Keeps Render service awake 24/7)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connected: clientReady,
    uptimeSeconds: Math.floor(process.uptime()),
    pendingOrdersCount: incomingOrdersQueue.length,
    timestamp: new Date().toISOString(),
  });
});

// 1. Status Check
app.get('/status', (req, res) => {
  res.json({
    connected: clientReady,
    hasQr: Boolean(latestQrImage),
    stepStatus,
    lastError,
    pendingOrdersCount: incomingOrdersQueue.length,
    waVersion: currentWaVersion,
    info: clientInfo
      ? {
          phone: clientInfo.wid?.user,
          name: clientInfo.pushname,
        }
      : null,
  });
});

// 1b. Order Queue Sync for Local PC
app.get('/api/orders/pending', (req, res) => {
  res.json({
    count: incomingOrdersQueue.length,
    orders: incomingOrdersQueue,
  });
});

app.post('/api/orders/clear', (req, res) => {
  const count = incomingOrdersQueue.length;
  incomingOrdersQueue = [];
  res.json({ success: true, cleared: count });
});

// 3. Send File (PDF or Image)
app.post('/send-file', async (req, res) => {
  try {
    const { phone, base64, filename, mimetype, caption } = req.body;

    if (!clientReady || !client) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp Bridge is not connected yet. Please scan the QR code at /qr first.',
      });
    }

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required.' });
    }

    if (!base64) {
      return res.status(400).json({ success: false, error: 'File base64 data is required.' });
    }

    const chatId = formatChatId(phone);
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'Invalid phone number.' });
    }

    // Clean base64 string if it contains data URL prefix
    let cleanBase64 = base64;
    let resolvedMime = mimetype || 'application/pdf';

    if (base64.startsWith('data:')) {
      const parts = base64.split(';base64,');
      resolvedMime = parts[0].replace('data:', '');
      cleanBase64 = parts[1];
    }

    const media = new MessageMedia(
      resolvedMime,
      cleanBase64,
      filename || (resolvedMime.includes('image') ? 'Invoice.jpg' : 'Invoice.pdf')
    );

    console.log(`📤 Sending file to ${chatId} (${filename || 'Invoice'})...`);

    const sentMessage = await client.sendMessage(chatId, media, {
      caption: caption || '',
      sendMediaAsDocument: resolvedMime.includes('pdf'), // Send PDFs as documents
    });

    const msgId = sentMessage?.id?._serialized || sentMessage?.id?.id || 'sent_' + Date.now();
    console.log(`✅ File sent successfully to ${chatId}! Message ID: ${msgId}`);

    res.json({
      success: true,
      messageId: msgId,
      phone: chatId,
    });
  } catch (error) {
    console.error('❌ Error sending WhatsApp file:', error);
    const errMsg = error.message || String(error);
    if (errMsg.includes('detached Frame') || errMsg.includes('Session closed') || errMsg.includes('Execution context was destroyed')) {
      console.warn('🔄 Detached frame or stale browser detected. Auto-reloading client...');
      clientReady = false;
      if (client) {
        client.initialize().catch((e) => console.error('Auto-reinit error:', e));
      }
    }
    res.status(500).json({
      success: false,
      error: errMsg || 'Failed to send WhatsApp message.',
    });
  }
});

// 4. Send Plain Text Message
app.post('/send-text', async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!clientReady || !client) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp Bridge is not connected yet.',
      });
    }

    const chatId = formatChatId(phone);
    if (!chatId || !message) {
      return res.status(400).json({ success: false, error: 'Phone and message are required.' });
    }

    const sentMessage = await client.sendMessage(chatId, message);
    const msgId = sentMessage?.id?._serialized || sentMessage?.id?.id || 'sent_' + Date.now();
    res.json({ success: true, messageId: msgId });
  } catch (error) {
    console.error('❌ Error sending WhatsApp text:', error);
    const errMsg = error.message || String(error);
    if (errMsg.includes('detached Frame') || errMsg.includes('Session closed') || errMsg.includes('Execution context was destroyed')) {
      console.warn('🔄 Detached frame or stale browser detected. Auto-reloading client...');
      clientReady = false;
      if (client) {
        client.initialize().catch((e) => console.error('Auto-reinit error:', e));
      }
    }
    res.status(500).json({ success: false, error: errMsg });
  }
});

// Start Express server and initialize WhatsApp client
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Zamzam WhatsApp Bridge running at: http://localhost:${PORT}`);
  console.log(`📱 QR Code Web Page: http://localhost:${PORT}/qr`);
  console.log(`🔍 Status Check: http://localhost:${PORT}/status`);
  console.log(`🔄 Session Reset: http://localhost:${PORT}/reset`);
  console.log(`======================================================\n`);

  console.log('⏳ Starting WhatsApp Web browser session...');
  terminateOrphanedWwebjsBrowser();
  cleanupStaleSessionLocks();
  startClientSession();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️ [WhatsApp Bridge] Port ${PORT} is already in use by an active instance. Exiting secondary process to prevent conflicts.`);
    process.exit(0);
  }
});
