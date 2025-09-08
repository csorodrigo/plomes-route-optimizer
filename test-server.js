require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('Starting server...');
console.log('PORT:', PORT);
console.log('PLOOME_API_KEY exists:', !!process.env.PLOOME_API_KEY);

app.get('/', (req, res) => {
  res.json({ message: 'Server is running!' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});