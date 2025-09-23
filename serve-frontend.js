const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'frontend/build')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Frontend server is running on port ${PORT}`);
  console.log(`🌐 Frontend URL: http://localhost:${PORT}`);
  console.log(`🔗 Backend URL: http://localhost:3001`);
});