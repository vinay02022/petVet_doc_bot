// Load environment variables FIRST
import './loadEnv.js';

import mongoose from 'mongoose';
import app from './app.js';
import selfPingService from './services/SelfPingService.js';

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/veterinary-chatbot';

// MongoDB connection - Don't exit on failure to allow testing
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  console.log('Continuing without MongoDB for testing purposes...');
});

// Start server regardless of MongoDB status
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);

  // Start self-ping service to keep Render server awake
  selfPingService.start();
});