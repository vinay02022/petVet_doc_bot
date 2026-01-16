import React, { useState, useEffect, useRef } from 'react';
import ChatHeader from './ChatHeader';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import AppointmentForm from './AppointmentForm';
import StorageService from '../../services/StorageService';
import './ChatWidget.css';

const ChatWidget = ({ config }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentReason, setAppointmentReason] = useState('');
  const [awaitingAppointmentConfirmation, setAwaitingAppointmentConfirmation] = useState(false);
  const [appointmentState, setAppointmentState] = useState('NONE');
  const [appointmentCollectionMode, setAppointmentCollectionMode] = useState('NONE'); // 'FORM', 'CHAT', 'NONE'
  const [chatAppointmentData, setChatAppointmentData] = useState({});
  const [currentAppointmentField, setCurrentAppointmentField] = useState(null);
  const messagesEndRef = useRef(null);

  // Generate or retrieve session ID
  useEffect(() => {
    const storedSessionId = localStorage.getItem('vet-chatbot-session');
    if (storedSessionId) {
      setSessionId(storedSessionId);
      loadConversationHistory(storedSessionId);
    } else {
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
      localStorage.setItem('vet-chatbot-session', newSessionId);
    }

    // Load user profile if exists
    const userProfile = StorageService.getUserProfile();

    // Add personalized welcome message
    if (messages.length === 0) {
      let welcomeContent = 'Hello! I\'m your veterinary assistant. I can help you with pet care questions or book an appointment.';

      if (userProfile && userProfile.ownerName && userProfile.petName) {
        welcomeContent = `Welcome back, ${userProfile.ownerName}! I\'m here to help with ${userProfile.petName}'s care.`;

        // Check for upcoming appointments
        const upcomingAppointments = StorageService.getUpcomingAppointments();
        if (upcomingAppointments.length > 0) {
          const nextApt = upcomingAppointments[0];
          welcomeContent += ` I see you have an appointment on ${nextApt.appointmentDate} at ${nextApt.appointmentTime}.`;
        }
      }

      welcomeContent += ' How can I assist you today?';

      setMessages([{
        id: 'welcome',
        role: 'bot',
        content: welcomeContent,
        timestamp: new Date()
      }]);
    }
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateSessionId = () => {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const loadConversationHistory = async (sessionId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/chat/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages.map((msg, index) => ({
            ...msg,
            id: `msg-${index}`,
            timestamp: new Date(msg.timestamp)
          })));
          setAppointmentState(data.appointmentState || 'NONE');
        }
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (message) => {
    if (!message.trim() || isLoading) return;

    const lowerMessage = message.toLowerCase();

    // Check for profile update commands
    if (message.includes('UPDATE_')) {
      const updates = {};
      let updateMessage = '';

      if (message.includes('UPDATE_PET_NAME:')) {
        const petName = message.split('UPDATE_PET_NAME:')[1].trim();
        updates.petName = petName;
        updateMessage = `Pet name updated to: ${petName}`;
      } else if (message.includes('UPDATE_EMAIL:')) {
        const email = message.split('UPDATE_EMAIL:')[1].trim();
        updates.email = email;
        updateMessage = `Email updated to: ${email}`;
      } else if (message.includes('UPDATE_PHONE:')) {
        const phone = message.split('UPDATE_PHONE:')[1].trim();
        updates.phone = phone;
        updateMessage = `Phone updated to: ${phone}`;
      } else if (message.includes('UPDATE_PET_TYPE:')) {
        const petType = message.split('UPDATE_PET_TYPE:')[1].trim();
        updates.petType = petType;
        updateMessage = `Pet type updated to: ${petType}`;
      } else if (message.includes('UPDATE_OWNER_NAME:')) {
        const ownerName = message.split('UPDATE_OWNER_NAME:')[1].trim();
        updates.ownerName = ownerName;
        updateMessage = `Owner name updated to: ${ownerName}`;
      }

      if (Object.keys(updates).length > 0) {
        // Save updates to localStorage
        StorageService.saveUserProfile(updates);

        // Add confirmation message
        const confirmMessage = {
          id: `msg-${Date.now()}-update`,
          role: 'bot',
          content: `✅ ${updateMessage}. Your profile has been updated successfully!`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, confirmMessage]);
        StorageService.saveChatMessage(confirmMessage);
        return;
      }
    }

    // Check if user is collecting appointment data via chat
    if (appointmentCollectionMode === 'CHAT' && currentAppointmentField) {
      handleChatAppointmentInput(message);
      return;
    }

    // Check if user is responding to appointment suggestion
    if (awaitingAppointmentConfirmation) {
      if (lowerMessage.includes('yes') || lowerMessage.includes('sure') ||
          lowerMessage.includes('ok') || lowerMessage.includes('please')) {
        setAwaitingAppointmentConfirmation(false);

        // Show options for form or chat
        const userMsg = {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: message,
          timestamp: new Date()
        };

        const optionsMessage = {
          id: `msg-${Date.now()}-options`,
          role: 'bot',
          content: 'Great! How would you like to provide your appointment details?',
          timestamp: new Date(),
          buttons: [
            {
              text: '📝 Fill Form',
              action: 'OPEN_FORM',
              style: 'primary'
            },
            {
              text: '💬 Type in Chat',
              action: 'CHAT_BOOKING',
              style: 'secondary'
            }
          ]
        };
        setMessages(prev => [...prev, userMsg, optionsMessage]);
        StorageService.saveChatMessage(userMsg);
        StorageService.saveChatMessage(optionsMessage);
        return;
      } else {
        setAwaitingAppointmentConfirmation(false);
      }
    }

    // Check for direct appointment requests
    const appointmentKeywords = ['appointment', 'book', 'schedule', 'meet', 'visit', 'consultation'];
    const isAppointmentRequest = appointmentKeywords.some(keyword => lowerMessage.includes(keyword));

    if (isAppointmentRequest && (lowerMessage.includes('want') || lowerMessage.includes('need') ||
        lowerMessage.includes('like') || lowerMessage.includes('book') || lowerMessage.includes('schedule'))) {
      // Add user message first
      const userMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date()
      };

      // Add options message with buttons
      const optionsMessage = {
        id: `msg-${Date.now()}-options`,
        role: 'bot',
        content: 'I\'ll help you book an appointment. How would you like to provide your details?',
        timestamp: new Date(),
        buttons: [
          {
            text: '📝 Fill Form',
            action: 'OPEN_FORM',
            style: 'primary'
          },
          {
            text: '💬 Type in Chat',
            action: 'CHAT_BOOKING',
            style: 'secondary'
          }
        ]
      };
      setMessages(prev => [...prev, userMessage, optionsMessage]);
      StorageService.saveChatMessage(userMessage);
      StorageService.saveChatMessage(optionsMessage);

      setAppointmentReason('');
      return;
    }

    // Add user message
    const userMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Save message to localStorage
    StorageService.saveChatMessage(userMessage);

    setIsLoading(true);

    try {
      // First, wake up the server if it's sleeping (Render free tier)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

      // Try to wake up the server with a health check first
      try {
        await fetch(`${apiUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000) // 5 second timeout for health check
        });
      } catch (healthError) {
        console.log('Server might be waking up...');
      }

      // Get context for AI from localStorage
      const aiContext = StorageService.getContextForAI();

      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId,
          context: {
            ...(config || {}),
            userProfile: aiContext.userProfile,
            appointments: aiContext.appointments,
            recentConversation: aiContext.recentConversation
          }
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Add bot response
        const botMessage = {
          id: `msg-${Date.now()}-bot`,
          role: 'bot',
          content: data.message,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);

        // Save bot response to localStorage
        StorageService.saveChatMessage(botMessage);

        // Check if bot is suggesting appointment
        const botSuggestion = data.message.toLowerCase();
        const healthIssueKeywords = ['vomit', 'sick', 'fever', 'pain', 'injury', 'bleeding',
                                     'diarrhea', 'lethargy', 'appetite', 'breathing', 'swollen'];
        const hasHealthIssue = healthIssueKeywords.some(keyword => message.toLowerCase().includes(keyword));

        if (hasHealthIssue && !awaitingAppointmentConfirmation) {
          // Add appointment suggestion
          const suggestionMessage = {
            id: `msg-${Date.now()}-suggest`,
            role: 'bot',
            content: 'I recommend scheduling an appointment with a veterinarian for proper examination. Would you like me to help you book an appointment?',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, suggestionMessage]);
          setAwaitingAppointmentConfirmation(true);
          setAppointmentReason(message);
        }
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Chat error:', error);

      // Check if it's a network/connection error
      const isNetworkError = error.message?.includes('Failed to fetch') || error.message?.includes('Network');

      const errorMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'bot',
        content: isNetworkError
          ? 'The server is waking up (this may take a few seconds on first use). Please try your message again in a moment.'
          : 'I apologize, but I\'m having trouble processing your request. Please try again.',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppointmentSubmit = async (formData) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

      // Send appointment data to backend
      const response = await fetch(`${apiUrl}/api/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          sessionId,
          createdAt: new Date()
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Save appointment to localStorage
        const savedAppointment = StorageService.saveAppointment({
          ...formData,
          id: data.appointment?.id || `apt_${Date.now()}`,
          status: 'pending'
        });

        // Add success message to chat
        const successMessage = {
          id: `msg-${Date.now()}-success`,
          role: 'bot',
          content: `Great news! Your appointment has been successfully booked for ${formData.appointmentDate} at ${formData.appointmentTime}. We'll send a confirmation to ${formData.email} and call you at ${formData.fullPhoneNumber} to confirm.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, successMessage]);
        StorageService.saveChatMessage(successMessage);

        // Reset appointment form state
        setShowAppointmentForm(false);
        setAppointmentReason('');
        setAwaitingAppointmentConfirmation(false);
        setAppointmentState('COMPLETED');
      } else {
        throw new Error(data.error || 'Failed to book appointment');
      }
    } catch (error) {
      console.error('Appointment booking error:', error);

      // Add error message to chat
      const errorMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'bot',
        content: 'I apologize, but there was an error booking your appointment. Please try again or contact us directly at (555) 123-4567.',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);

      // Keep form open so user can retry
      throw error;
    }
  };

  const handleButtonClick = (action, data) => {
    if (action === 'OPEN_FORM') {
      setShowAppointmentForm(true);
      setAppointmentCollectionMode('FORM');
      // Add confirmation message
      const msg = {
        id: `msg-${Date.now()}-form`,
        role: 'bot',
        content: 'Opening the appointment form. Please fill in your details.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, msg]);
      StorageService.saveChatMessage(msg);
    } else if (action === 'CHAT_BOOKING') {
      setAppointmentCollectionMode('CHAT');
      setChatAppointmentData({});
      startChatAppointmentCollection();
    } else if (action === 'CONFIRM_CHAT_APPOINTMENT') {
      handleConfirmChatAppointment(data);
    } else if (action === 'RESTART_BOOKING') {
      // Reset and show options again
      setChatAppointmentData({});
      setAppointmentCollectionMode('NONE');
      const msg = {
        id: `msg-${Date.now()}-restart`,
        role: 'bot',
        content: 'No problem! How would you like to provide your appointment details?',
        timestamp: new Date(),
        buttons: [
          {
            text: '📝 Fill Form',
            action: 'OPEN_FORM',
            style: 'primary'
          },
          {
            text: '💬 Type in Chat',
            action: 'CHAT_BOOKING',
            style: 'secondary'
          }
        ]
      };
      setMessages(prev => [...prev, msg]);
      StorageService.saveChatMessage(msg);
    }
  };

  const appointmentFields = [
    { key: 'ownerName', label: 'your name', validation: (v) => v && v.trim().length > 0 },
    { key: 'petName', label: 'your pet\'s name', validation: (v) => v && v.trim().length > 0 },
    { key: 'petType', label: 'type of pet (dog, cat, bird, rabbit, hamster, other)', validation: (v) => ['dog', 'cat', 'bird', 'rabbit', 'hamster', 'other'].includes(v.toLowerCase()) },
    { key: 'phone', label: 'your phone number', validation: (v) => v && v.trim().length >= 10 },
    { key: 'email', label: 'your email address', validation: (v) => !v || v.includes('@') },
    { key: 'appointmentDate', label: 'preferred date (e.g., tomorrow, next Monday, MM/DD/YYYY)', validation: (v) => v && v.trim().length > 0 },
    { key: 'appointmentTime', label: 'preferred time (e.g., 2:00 PM, morning, afternoon)', validation: (v) => v && v.trim().length > 0 },
    { key: 'reason', label: 'reason for the appointment', validation: (v) => v && v.trim().length > 0 }
  ];

  const startChatAppointmentCollection = () => {
    setCurrentAppointmentField(0);
    const firstField = appointmentFields[0];
    const msg = {
      id: `msg-${Date.now()}-field`,
      role: 'bot',
      content: `Great! Let's book your appointment. First, what is ${firstField.label}?`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, msg]);
    StorageService.saveChatMessage(msg);
  };

  const handleChatAppointmentInput = (input) => {
    const fieldIndex = currentAppointmentField;
    const field = appointmentFields[fieldIndex];

    // Add user message
    const userMsg = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    StorageService.saveChatMessage(userMsg);

    // Validate input
    let processedInput = input.trim();
    if (field.key === 'petType') {
      processedInput = processedInput.toLowerCase();
    }

    if (!field.validation(processedInput)) {
      // Invalid input, ask again
      const errorMsg = {
        id: `msg-${Date.now()}-error`,
        role: 'bot',
        content: field.key === 'email' ? 'Please provide a valid email address.' :
                 field.key === 'petType' ? 'Please specify: dog, cat, bird, rabbit, hamster, or other.' :
                 field.key === 'phone' ? 'Please provide a valid phone number (at least 10 digits).' :
                 `Please provide ${field.label}.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
      StorageService.saveChatMessage(errorMsg);
      return;
    }

    // Save the data
    const updatedData = { ...chatAppointmentData, [field.key]: processedInput };
    setChatAppointmentData(updatedData);

    // Move to next field or complete
    if (fieldIndex < appointmentFields.length - 1) {
      // Ask for next field
      const nextFieldIndex = fieldIndex + 1;
      const nextField = appointmentFields[nextFieldIndex];
      setCurrentAppointmentField(nextFieldIndex);

      const nextMsg = {
        id: `msg-${Date.now()}-next`,
        role: 'bot',
        content: `Thank you! Now, what is ${nextField.label}?`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, nextMsg]);
      StorageService.saveChatMessage(nextMsg);
    } else {
      // All fields collected, show summary
      setCurrentAppointmentField(null);
      setAppointmentCollectionMode('NONE');
      showAppointmentSummary(updatedData);
    }
  };

  const showAppointmentSummary = (data) => {
    const summaryMsg = {
      id: `msg-${Date.now()}-summary`,
      role: 'bot',
      content: `Perfect! Here's your appointment summary:\n\n📋 **Appointment Details:**\n• Owner: ${data.ownerName}\n• Pet: ${data.petName} (${data.petType})\n• Phone: ${data.phone}\n• Email: ${data.email || 'Not provided'}\n• Date: ${data.appointmentDate}\n• Time: ${data.appointmentTime}\n• Reason: ${data.reason}\n\nIs this information correct?`,
      timestamp: new Date(),
      appointmentData: data,
      buttons: [
        {
          text: '✅ Confirm Booking',
          action: 'CONFIRM_CHAT_APPOINTMENT',
          style: 'primary'
        },
        {
          text: '❌ Start Over',
          action: 'RESTART_BOOKING',
          style: 'secondary'
        }
      ]
    };
    setMessages(prev => [...prev, summaryMsg]);
    StorageService.saveChatMessage(summaryMsg);
  };

  const handleConfirmChatAppointment = async (appointmentData) => {
    setIsLoading(true);
    try {
      // Format data for backend
      const formattedData = {
        ...appointmentData,
        fullPhoneNumber: appointmentData.phone,
        appointmentDateTime: `${appointmentData.appointmentDate} at ${appointmentData.appointmentTime}`
      };

      await handleAppointmentSubmit(formattedData);
    } catch (error) {
      console.error('Error confirming appointment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([{
      id: 'welcome-new',
      role: 'bot',
      content: 'Hello! How can I help you with your pet\'s needs today?',
      timestamp: new Date()
    }]);
    setAppointmentState('NONE');
    setAppointmentCollectionMode('NONE');
    setChatAppointmentData({});
    setCurrentAppointmentField(null);

    // Generate new session
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    localStorage.setItem('vet-chatbot-session', newSessionId);
  };

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          className="chat-toggle-button"
          onClick={() => setIsOpen(true)}
          aria-label="Open chat"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                  fill="none"
                  stroke="#666666"
                  strokeWidth="1.5"/>
            <circle cx="8" cy="9.5" r="1" fill="#666666">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite"/>
            </circle>
            <circle cx="12" cy="9.5" r="1" fill="#666666">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" begin="0.3s"/>
            </circle>
            <circle cx="16" cy="9.5" r="1" fill="#666666">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" begin="0.6s"/>
            </circle>
          </svg>
        </button>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <div className="chat-widget">
          <ChatHeader
            onClose={() => setIsOpen(false)}
            onClear={handleClearChat}
          />
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            messagesEndRef={messagesEndRef}
            onButtonClick={handleButtonClick}
          />
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={isLoading}
            placeholder={
              appointmentState !== 'NONE' && appointmentState !== 'COMPLETED'
                ? 'Type your response...'
                : 'Ask about pet care or book an appointment...'
            }
          />
        </div>
      )}

      {/* Appointment Form Modal */}
      <AppointmentForm
        isOpen={showAppointmentForm}
        onClose={() => {
          setShowAppointmentForm(false);
          setAwaitingAppointmentConfirmation(false);
        }}
        onSubmit={handleAppointmentSubmit}
        triggerReason={appointmentReason}
      />
    </>
  );
};

export default ChatWidget;