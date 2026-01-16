import express from 'express';
import chatController from '../controllers/chatController.js';

const router = express.Router();

// POST /api/chat - Send a message and get response
router.post('/', chatController.handleMessage);

// GET /api/chat/:sessionId - Get conversation history
router.get('/:sessionId', chatController.getConversation);

export default router;