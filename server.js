const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const cors = require('cors');
const nodemailer = require('nodemailer');

dotenv.config();

console.log('MONGO_URI:', process.env.MONGO_URI);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Email setup with nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'vesnaproperty@gmail.com',
    pass: 'xmtupkvnnggcxzmf', // Your working App Password
  },
});

// Test email on startup (still to vesnaproperty@gmail.com)
transporter.sendMail({
  from: 'vesnaproperty@gmail.com',
  to: 'vesnaproperty@gmail.com',
  subject: 'Test Email on Startup',
  text: 'Server started successfully!',
}, (err, info) => {
  if (err) console.error('Startup email error:', err);
  else console.log('Startup email sent:', info.response);
});

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

const Task = require('./models/Task');

// In-memory conversation state (use MongoDB for production)
const conversations = new Map();

app.post('/api/chat', async (req, res) => {
  const { message, sessionId = Date.now().toString() } = req.body;
  try {
    let context = conversations.get(sessionId) || {
      preferences: {},
      userEmail: null,
      userName: null,
      messages: [
        {
          role: 'system',
          content: 'You are the office manager for UStoSpain, helping Americans thrive in Spain. Engage in a friendly, conversational style based on 2025 data. If the user asks about moving or buying property, ask follow-up questions to gather details (location, bedrooms, budget) one at a time. Once you have location, bedrooms, and budget, ask: "What’s your name and email so an agent can follow up?" After getting both, confirm and say you’ll pass it to an agent. Log all messages.',
        },
        { role: 'assistant', content: 'Hi! I’m your UStoSpain office manager. How can I assist you today?' },
      ],
    };

    console.log(`Received message for session ${sessionId}: "${message}"`);
    context.messages.push({ role: 'user', content: message });

    const response = await openai.chat.completions.create({
      model: 'gmt-3.5-turbo',
      messages: context.messages,
    });

    const reply = response.choices[0].message.content;
    console.log(`Reply for session ${sessionId}: "${reply}"`);
    context.messages.push({ role: 'assistant', content: reply });

    // Parse preferences, name, and email
    if (message.match(/^\d+$/)) context.preferences.bedrooms = parseInt(message); // e.g., "4"
    if (message.match(/^\d+(\.\d+)?\s*(mlns|million|m)$/i)) context.preferences.budget = parseFloat(message) * 1000000; // e.g., "1 mln"
    if (message.includes('@')) context.userEmail = message; // Email detection
    else if (context.preferences.location && context.preferences.bedrooms && context.preferences.budget && !context.userName && !message.includes('@')) context.userName = message; // Name before email
    if (context.preferences.location === undefined && message.toLowerCase() !== 'yes' && !message.match(/^\d+$/) && !message.match(/^\d+(\.\d+)?\s*(mlns|million|m)$/i)) context.preferences.location = message; // e.g., "open"

    console.log(`Current context for session ${sessionId}:`, {
      userName: context.userName,
      userEmail: context.userEmail,
      preferences: context.preferences,
    });

    // Save task and send email when name and email are provided
    if (context.userEmail && context.userName && context.preferences.location && context.preferences.bedrooms && context.preferences.budget) {
      console.log('All details collected, proceeding to save and email:', {
        userName: context.userName,
        userEmail: context.userEmail,
        preferences: context.preferences,
      });

      const task = new Task({
        userEmail: context.userEmail,
        userName: context.userName,
        preferences: context.preferences,
      });
      await task.save();
      console.log('Task saved successfully:', task);

      // Send email to agent with HTML formatting
      transporter.sendMail({
        from: 'vesnaproperty@gmail.com',
        to: 'g7366880088@gmail.com', // Changed to agent email
        subject: 'New UStoSpain Client Request',
        text: `Client Name: ${task.userName}\nClient Email: ${task.userEmail}\nPreferences: ${JSON.stringify(task.preferences, null, 2)}`, // Plain-text fallback
        html: `
          <h1>New UStoSpain Client Request</h1>
          <p><strong>Client Name:</strong> ${task.userName}</p>
          <p><strong>Client Email:</strong> ${task.userEmail}</p>
          <p><strong>Preferences:</strong></p>
          <pre>${JSON.stringify(task.preferences, null, 2)}</pre>
          <p><strong>Received:</strong> ${new Date().toISOString()}</p>
        `,
      }, (err, info) => {
        if (err) console.error('Chat email error:', err);
        else console.log('Chat email sent:', info.response);
      });

      console.log('Task processing complete for:', task.userEmail);
      conversations.delete(sessionId); // Clear session after submission
    } else {
      console.log(`Session ${sessionId} incomplete, missing:`, {
        location: context.preferences.location ? '✓' : '✗',
        bedrooms: context.preferences.bedrooms ? '✓' : '✗',
        budget: context.preferences.budget ? '✓' : '✗',
        userName: context.userName ? '✓' : '✗',
        userEmail: context.userEmail ? '✓' : '✗',
      });
    }

    conversations.set(sessionId, context);
    res.json({ reply, sessionId });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

app.get('/api/conversations/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const context = conversations.get(sessionId);
  if (context) {
    res.json(context.messages);
  } else {
    res.status(404).json({ error: 'Conversation not found' });
  }
});

app.get('/', (req, res) => {
  console.log('GET / requested');
  res.send('Welcome to the Real Estate Platform!');
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Server startup error:', err);
});

setInterval(() => {
  console.log('Server still running...');
}, 5000);
