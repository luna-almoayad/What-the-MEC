import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import Twilio from 'twilio';
import morgan from 'morgan';

const app = express();

// ✅ Log every request
app.use(morgan('dev'));

// ✅ Allow requests from *any* origin (you can restrict this later)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
}));

// ✅ Parse incoming JSON
app.use(express.json());

// ✅ Twilio setup
const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM = process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM;

// ✅ Simple API key guard
app.use((req, res, next) => {
  const key = req.header('x-api-key');
  if (!process.env.API_KEY || key === process.env.API_KEY) return next();
  return res.status(401).json({ error: 'Unauthorized' });
});

// ✅ SMS endpoint
app.post('/send-sms', async (req, res) => {
  console.log('📨 Received SMS request:', req.body);

  try {
    const schema = z.object({
      to: z.string().regex(/^\+\d{7,15}$/),  // Must be E.164 (+1234567890)
      message: z.string().min(1).max(640)
    });

    const { to, message } = schema.parse(req.body);

    const params = FROM?.startsWith('MG')
      ? { to, body: message, messagingServiceSid: FROM }
      : { to, body: message, from: FROM };

    const msg = await client.messages.create(params);
    console.log('✅ Twilio queued SMS:', msg.sid);
    res.json({ sid: msg.sid, status: 'queued' });
  } catch (e) {
    console.error('❌ SMS send failed:', e.message);
    res.status(e.status || 500).json({ error: e.message || 'send failed' });
  }
});

// ✅ Listen on all interfaces
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SMS API running on port ${PORT}`);
});
