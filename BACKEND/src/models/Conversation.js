import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'bot'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const conversationSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  context: {
    userId: String,
    userName: String,
    petName: String,
    source: String
  },
  messages: [messageSchema],
  appointmentState: {
    type: String,
    enum: ['NONE', 'ASK_OWNER_NAME', 'ASK_PET_NAME', 'ASK_PHONE', 'ASK_DATE_TIME', 'CONFIRMATION', 'COMPLETED'],
    default: 'NONE'
  },
  appointmentData: {
    ownerName: String,
    petName: String,
    phone: String,
    preferredDateTime: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp on save
conversationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;