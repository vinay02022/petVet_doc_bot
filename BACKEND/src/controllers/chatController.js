import Conversation from '../models/Conversation.js';
import Appointment from '../models/Appointment.js';
import GeminiService from '../services/GeminiService.js';
import AppointmentService from '../services/AppointmentService.js';
import AppointmentSlotManager from '../services/AppointmentSlotManager.js';
import CacheService from '../services/CacheService.js';
import AnalyticsService from '../services/AnalyticsService.js';
import { v4 as uuidv4 } from 'uuid';

class ChatController {
  async handleMessage(req, res) {
    try {
      const { message, sessionId: providedSessionId, context } = req.body;

      // Validate input
      if (!message || message.trim().length === 0) {
        return res.status(400).json({
          error: 'Message is required'
        });
      }

      // Generate or use provided session ID
      const sessionId = providedSessionId || uuidv4();

      // Get or create conversation
      let conversation = await Conversation.findOne({ sessionId });

      if (!conversation) {
        conversation = new Conversation({
          sessionId,
          context: context || {},
          messages: [],
          appointmentState: 'NONE',
          appointmentData: {}
        });
      } else if (context && !conversation.context.userId) {
        // Update context if provided and not already set
        conversation.context = { ...conversation.context, ...context };
      }

      // Add user message to conversation
      conversation.messages.push({
        role: 'user',
        content: message
      });

      // Check if user wants to cancel appointment booking
      if (conversation.appointmentState !== 'NONE' &&
          conversation.appointmentState !== 'COMPLETED' &&
          AppointmentService.detectCancelIntent(message)) {
        conversation.appointmentState = 'NONE';
        conversation.appointmentData = {};

        const cancelMessage = 'Appointment booking cancelled. How else can I help you with your pet\'s needs?';
        conversation.messages.push({
          role: 'bot',
          content: cancelMessage
        });

        await conversation.save();

        return res.json({
          sessionId,
          message: cancelMessage,
          appointmentState: 'NONE'
        });
      }

      let botResponse;
      let newAppointmentState = conversation.appointmentState;

      // Check if we're in appointment booking flow
      if (conversation.appointmentState !== 'NONE') {
        console.log('Current appointment state:', conversation.appointmentState);
        console.log('Current appointment data before processing:', conversation.appointmentData);

        // Special handling for COMPLETED state (waiting for yes/no confirmation)
        if (conversation.appointmentState === 'COMPLETED') {
          const lowerMessage = message.toLowerCase().trim();
          if (lowerMessage === 'yes' || lowerMessage === 'confirm' || lowerMessage === 'y') {
            // Confirm the slot reservation
            if (conversation.appointmentData.slotKey) {
              await AppointmentSlotManager.confirmReservation(
                conversation.appointmentData.slotKey,
                sessionId
              );
            }

            // Save appointment to database
            console.log('Saving appointment with data:', conversation.appointmentData);
            const appointment = new Appointment({
              sessionId,
              ...conversation.appointmentData
            });
            await appointment.save();
            console.log('Appointment saved successfully!');

            // Track analytics
            AnalyticsService.trackSession(sessionId, 'appointment_complete');

            conversation.appointmentState = 'NONE';
            botResponse = 'Your appointment has been successfully booked! We\'ll contact you shortly to confirm. Is there anything else I can help you with?';
          } else if (lowerMessage === 'no' || lowerMessage === 'cancel' || lowerMessage === 'n') {
            conversation.appointmentState = 'NONE';
            conversation.appointmentData = {};
            botResponse = 'Appointment booking cancelled. How can I help you with your pet\'s needs?';
          } else {
            botResponse = 'Please type "yes" to confirm or "no" to start over.';
          }
        } else {
          // Process appointment booking response for other states
          const bookingResponse = AppointmentService.processBookingResponse(
            conversation.appointmentState,
            message,
            conversation.appointmentData
          );

          if (!bookingResponse.isValid) {
            // Invalid input, ask again
            botResponse = bookingResponse.errorMessage;
          } else {
            // Valid input, move to next state
            conversation.appointmentData = bookingResponse.data;
            console.log('Appointment data after processing:', conversation.appointmentData);

            // If we just collected the date/time, check availability
            if (conversation.appointmentState === 'CONFIRMATION' && bookingResponse.data.appointmentDate) {
              const availability = await AppointmentSlotManager.checkAvailability(bookingResponse.data.appointmentDate);

              if (!availability.available) {
                // Slot not available, suggest alternatives
                let suggestionMessage = `${availability.message}`;
                if (availability.suggestedSlots && availability.suggestedSlots.length > 0) {
                  suggestionMessage += '\n\nAvailable times nearby:';
                  availability.suggestedSlots.forEach(slot => {
                    suggestionMessage += `\n- ${slot.displayTime}`;
                  });
                  suggestionMessage += '\n\nPlease choose one of these times or suggest another.';
                }
                botResponse = suggestionMessage;
                // Stay in the same state to ask for date/time again
                newAppointmentState = conversation.appointmentState;
              } else {
                // Reserve the slot temporarily
                const slotKey = await AppointmentSlotManager.reserveSlot(
                  bookingResponse.data.appointmentDate,
                  sessionId
                );
                conversation.appointmentData.slotKey = slotKey;

                // Get next question (confirmation)
                const nextQuestion = AppointmentService.getNextQuestion(conversation.appointmentState, conversation.appointmentData);
                botResponse = nextQuestion.message;
                newAppointmentState = nextQuestion.nextState;
                conversation.appointmentState = newAppointmentState;
              }
            } else {
              // Get next question based on the current state
              const nextQuestion = AppointmentService.getNextQuestion(conversation.appointmentState, conversation.appointmentData);
              botResponse = nextQuestion.message;
              newAppointmentState = nextQuestion.nextState;
              conversation.appointmentState = newAppointmentState;
            }
            console.log('Moving to new state:', newAppointmentState);
          }
        }
      }
      // Check if user wants to book an appointment
      else if (AppointmentService.detectBookingIntent(message)) {
        console.log('APPOINTMENT BOOKING DETECTED for message:', message);
        // Start appointment booking flow
        const firstQuestion = AppointmentService.getNextQuestion('ASK_OWNER_NAME');
        botResponse = firstQuestion.message;
        newAppointmentState = firstQuestion.nextState;
        conversation.appointmentState = newAppointmentState;
      }
      // Regular veterinary Q&A
      else {
        // Track analytics
        AnalyticsService.trackSession(sessionId, 'message', { message });

        // Check cache for similar questions first
        const cachedResponse = CacheService.findSimilar(message);

        if (cachedResponse) {
          console.log('Using cached response for similar question');
          botResponse = cachedResponse;
        } else {
          // Get conversation history for context (last 10 messages)
          const history = conversation.messages.slice(-10);

          // Generate AI response with caching
          const aiResponse = await CacheService.get(
            { message, history, context },
            async () => {
              const response = await GeminiService.generateResponse(message, history, context);
              // Track API call for analytics
              AnalyticsService.trackGeminiCall(
                message.length,
                response.message.length,
                response.duration || 0
              );
              return response;
            },
            { ttl: 3600000 } // Cache for 1 hour
          );

          botResponse = aiResponse.message;
        }
      }

      // Add bot response to conversation
      conversation.messages.push({
        role: 'bot',
        content: botResponse
      });

      // Save conversation
      await conversation.save();

      // Send response
      res.json({
        sessionId,
        message: botResponse,
        appointmentState: newAppointmentState
      });

    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({
        error: 'An error occurred while processing your message. Please try again.'
      });
    }
  }

  async getConversation(req, res) {
    try {
      const { sessionId } = req.params;

      const conversation = await Conversation.findOne({ sessionId });

      if (!conversation) {
        return res.status(404).json({
          error: 'Conversation not found'
        });
      }

      res.json({
        sessionId: conversation.sessionId,
        messages: conversation.messages,
        context: conversation.context,
        appointmentState: conversation.appointmentState
      });

    } catch (error) {
      console.error('Get conversation error:', error);
      res.status(500).json({
        error: 'Failed to retrieve conversation'
      });
    }
  }
}

export default new ChatController();