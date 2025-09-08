require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is running!', port: PORT });
});

app.get('/api/geocode/progress', (req, res) => {
  res.json({ 
    pending: 0,
    completed: 0,
    failed: 0,
    total: 0
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});