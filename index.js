const express = require('express');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const PORT = 3000;

// 🌐 Static dashboard files served from /public
app.use(express.static(path.join(__dirname, 'public')));

// 💬 WhatsApp group JID (update with your actual group)
const groupJid = '120363400332952845@g.us';

let sock; // Global socket variable

// 🔐 WhatsApp connection handler
async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', saveCreds);
  // connection.update listener here


  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected');
    } else if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log(`⚠️ Connection closed: ${reason}`);
      if (reason !== DisconnectReason.loggedOut) {
        startSock(); // try reconnecting
      } else {
        console.log('🛑 Logged out from WhatsApp');
      }
    }
  });
}

startSock();


// 📊 Real-time device status for dashboard
app.get('/status', (req, res) => {
  const { ip, name, status } = req.query;
  io.emit('updateStatus', { ip, name, status });
  console.log(`[STATUS] ${name} (${ip}) → ${status.toUpperCase()}`);
  res.send('Status received');
});


// 🚨 Failure alert route
app.get('/alert', async (req, res) => {
  const { ip, name } = req.query;
  console.log(`[ALERT] Attempting to alert for ${name} (${ip})`);

  try {
    if (sock && sock.authState?.creds) {
      await sock.sendMessage(groupJid, {
        text: `🚨 ${name} (${ip}) is offline!`
      });
      console.log('✅ Alert message sent!');
      res.send('Alert sent');
    } else {
      res.status(500).send('WhatsApp not connected');
    }
  } catch (err) {
    console.error('❌ Error sending alert:', err);
    res.status(500).send('Failed to send alert');
  }
});

// ✅ Recovery alert route
app.get('/recovery', async (req, res) => {
  const { ip, name } = req.query;
  console.log(`[RECOVERY] Attempting recovery message for ${name} (${ip})`);

  try {
    if (sock && sock.authState?.creds) {
      await sock.sendMessage(groupJid, {
        text: `✅ ${name} (${ip}) is back online!`
      });
      console.log('✅ Recovery message sent!');
      res.send('Recovery sent');
    } else {
      res.status(500).send('❌ WhatsApp not connected');
    }
  } catch (err) {
    console.error('❌ Error sending recovery:', err);
    res.status(500).send('Failed to send recovery');
  }
});

// 🚀 Start the combined HTTP + WebSocket server
http.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});