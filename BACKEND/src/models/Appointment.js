import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  ownerName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: false  // Not required for chat-based booking
  },
  petName: {
    type: String,
    required: true
  },
  petType: {
    type: String,
    enum: ['dog', 'cat', 'bird', 'rabbit', 'hamster', 'other'],
    default: 'dog'
  },
  phone: {
    type: String,
    required: true
  },
  appointmentDate: {
    type: String,
    required: false  // Not required for chat-based booking
  },
  appointmentTime: {
    type: String,
    required: false  // Not required for chat-based booking
  },
  preferredDateTime: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: false,  // Not required for chat-based booking
    default: 'General consultation'
  },
  urgency: {
    type: String,
    enum: ['normal', 'moderate', 'urgent'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;