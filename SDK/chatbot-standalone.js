/**
 * Veterinary Chatbot SDK - Standalone Version
 *
 * This version creates the chatbot UI directly in the host page
 * without using an iframe. For production, you would bundle the
 * React app and include it here.
 *
 * Usage:
 * <script src="chatbot-standalone.js"></script>
 *
 * Or with configuration:
 * <script>
 *   window.VetChatbotConfig = {
 *     userId: "user_123",
 *     userName: "John Doe",
 *     petName: "Buddy",
 *     source: "marketing-website"
 *   };
 * </script>
 * <script src="chatbot-standalone.js"></script>
 */

(function() {
  'use strict';

  // Configuration
  const API_URL = 'http://localhost:5000'; // Backend API URL
  const STORAGE_KEY = 'vet-chatbot-session';

  // Chatbot state
  let state = {
    isOpen: false,
    messages: [],
    sessionId: null,
    isLoading: false,
    appointmentState: 'NONE'
  };

  // Initialize chatbot
  function init() {
    // Check if already initialized
    if (document.getElementById('vet-chatbot-widget')) {
      console.warn('Veterinary Chatbot is already initialized');
      return;
    }

    // Load or generate session ID
    state.sessionId = localStorage.getItem(STORAGE_KEY) || generateSessionId();
    localStorage.setItem(STORAGE_KEY, state.sessionId);

    // Create and inject styles
    injectStyles();

    // Create chatbot HTML
    createChatbotHTML();

    // Add event listeners
    addEventListeners();

    // Add welcome message
    addMessage('bot', 'Hello! I\'m your veterinary assistant. I can help you with pet care questions or book an appointment. How can I assist you today?');

    // Load conversation history
    loadConversationHistory();
  }

  // Generate unique session ID
  function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Inject CSS styles
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #vet-chatbot-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        z-index: 9999;
      }

      #vet-chatbot-toggle {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.3s ease;
      }

      #vet-chatbot-toggle:hover {
        transform: scale(1.1);
      }

      #vet-chatbot-toggle svg {
        width: 28px;
        height: 28px;
        fill: white;
      }

      #vet-chatbot-window {
        position: absolute;
        bottom: 70px;
        right: 0;
        width: 380px;
        height: 600px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 5px 25px rgba(0,0,0,0.15);
        display: flex;
        flex-direction: column;
        animation: slideUp 0.3s ease;
      }

      #vet-chatbot-window.hidden {
        display: none;
      }

      .vet-chatbot-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        color: white;
        border-radius: 12px 12px 0 0;
      }

      .vet-chatbot-title {
        font-weight: 600;
        font-size: 16px;
      }

      .vet-chatbot-close {
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        font-size: 20px;
      }

      .vet-chatbot-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: #f9f9f9;
      }

      .vet-chatbot-message {
        margin-bottom: 12px;
        display: flex;
        animation: fadeIn 0.3s ease;
      }

      .vet-chatbot-message.user {
        justify-content: flex-end;
      }

      .vet-chatbot-message.bot {
        justify-content: flex-start;
      }

      .vet-chatbot-bubble {
        max-width: 70%;
        padding: 10px 14px;
        border-radius: 18px;
        word-wrap: break-word;
        white-space: pre-wrap;
        line-height: 1.4;
        font-size: 14px;
      }

      .vet-chatbot-message.user .vet-chatbot-bubble {
        background: #4CAF50;
        color: white;
        border-bottom-right-radius: 4px;
      }

      .vet-chatbot-message.bot .vet-chatbot-bubble {
        background: white;
        color: #333;
        border-bottom-left-radius: 4px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }

      .vet-chatbot-input-container {
        display: flex;
        gap: 8px;
        padding: 12px;
        background: white;
        border-top: 1px solid #e0e0e0;
        border-radius: 0 0 12px 12px;
      }

      .vet-chatbot-input {
        flex: 1;
        padding: 10px 14px;
        border: 1px solid #ddd;
        border-radius: 24px;
        font-size: 14px;
        outline: none;
      }

      .vet-chatbot-input:focus {
        border-color: #4CAF50;
      }

      .vet-chatbot-send {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: none;
        background: #4CAF50;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .vet-chatbot-send:hover {
        background: #45a049;
      }

      .vet-chatbot-send:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      .vet-chatbot-loader {
        display: flex;
        gap: 4px;
        padding: 10px 14px;
        background: white;
        border-radius: 18px;
        width: fit-content;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }

      .vet-chatbot-loader span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #999;
        animation: pulse 1.4s infinite ease-in-out;
      }

      .vet-chatbot-loader span:nth-child(2) {
        animation-delay: 0.16s;
      }

      .vet-chatbot-loader span:nth-child(3) {
        animation-delay: 0.32s;
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes pulse {
        0%, 80%, 100% {
          transform: scale(0.8);
          opacity: 0.5;
        }
        40% {
          transform: scale(1);
          opacity: 1;
        }
      }

      @media (max-width: 480px) {
        #vet-chatbot-window {
          width: 100vw;
          height: 100vh;
          bottom: 0;
          right: 0;
          border-radius: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Create chatbot HTML structure
  function createChatbotHTML() {
    const widget = document.createElement('div');
    widget.id = 'vet-chatbot-widget';
    widget.innerHTML = `
      <button id="vet-chatbot-toggle">
        <svg viewBox="0 0 24 24">
          <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/>
        </svg>
      </button>
      <div id="vet-chatbot-window" class="hidden">
        <div class="vet-chatbot-header">
          <div class="vet-chatbot-title">🐾 Veterinary Assistant</div>
          <button class="vet-chatbot-close">✕</button>
        </div>
        <div class="vet-chatbot-messages" id="vet-chatbot-messages"></div>
        <div class="vet-chatbot-input-container">
          <input
            type="text"
            class="vet-chatbot-input"
            id="vet-chatbot-input"
            placeholder="Ask about pet care or book an appointment..."
          />
          <button class="vet-chatbot-send" id="vet-chatbot-send">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M2.01 21L23 12 2.01 3 2 10L17 12L2 14L2.01 21Z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(widget);
  }

  // Add event listeners
  function addEventListeners() {
    const toggle = document.getElementById('vet-chatbot-toggle');
    const window = document.getElementById('vet-chatbot-window');
    const close = document.querySelector('.vet-chatbot-close');
    const input = document.getElementById('vet-chatbot-input');
    const send = document.getElementById('vet-chatbot-send');

    toggle.addEventListener('click', () => {
      state.isOpen = !state.isOpen;
      window.classList.toggle('hidden');
      toggle.style.display = state.isOpen ? 'none' : 'flex';
      if (state.isOpen) {
        input.focus();
      }
    });

    close.addEventListener('click', () => {
      state.isOpen = false;
      window.classList.add('hidden');
      toggle.style.display = 'flex';
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    send.addEventListener('click', sendMessage);
  }

  // Send message to API
  async function sendMessage() {
    const input = document.getElementById('vet-chatbot-input');
    const message = input.value.trim();

    if (!message || state.isLoading) return;

    // Clear input
    input.value = '';

    // Add user message
    addMessage('user', message);

    // Show loading
    showLoader();

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId: state.sessionId,
          context: window.VetChatbotConfig || {}
        })
      });

      const data = await response.json();

      if (response.ok) {
        hideLoader();
        addMessage('bot', data.message);
        state.appointmentState = data.appointmentState || 'NONE';
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      hideLoader();
      addMessage('bot', 'I apologize, but I\'m having trouble connecting right now. Please try again later.');
    }
  }

  // Add message to chat
  function addMessage(role, content) {
    const messagesContainer = document.getElementById('vet-chatbot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `vet-chatbot-message ${role}`;

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'vet-chatbot-bubble';
    bubbleDiv.textContent = content;

    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Update state
    state.messages.push({ role, content, timestamp: new Date() });
  }

  // Show loading indicator
  function showLoader() {
    state.isLoading = true;
    const messagesContainer = document.getElementById('vet-chatbot-messages');
    const loader = document.createElement('div');
    loader.id = 'vet-chatbot-loader-container';
    loader.className = 'vet-chatbot-message bot';
    loader.innerHTML = `
      <div class="vet-chatbot-loader">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    messagesContainer.appendChild(loader);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Disable input
    document.getElementById('vet-chatbot-send').disabled = true;
  }

  // Hide loading indicator
  function hideLoader() {
    state.isLoading = false;
    const loader = document.getElementById('vet-chatbot-loader-container');
    if (loader) {
      loader.remove();
    }
    // Enable input
    document.getElementById('vet-chatbot-send').disabled = false;
  }

  // Load conversation history
  async function loadConversationHistory() {
    try {
      const response = await fetch(`${API_URL}/api/chat/${state.sessionId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          const messagesContainer = document.getElementById('vet-chatbot-messages');
          messagesContainer.innerHTML = ''; // Clear welcome message

          data.messages.forEach(msg => {
            addMessage(msg.role, msg.content);
          });

          state.appointmentState = data.appointmentState || 'NONE';
        }
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error);
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose global API
  window.VetChatbot = {
    init: init,
    open: () => {
      document.getElementById('vet-chatbot-toggle').click();
    },
    close: () => {
      const window = document.getElementById('vet-chatbot-window');
      const toggle = document.getElementById('vet-chatbot-toggle');
      window.classList.add('hidden');
      toggle.style.display = 'flex';
      state.isOpen = false;
    },
    destroy: () => {
      const widget = document.getElementById('vet-chatbot-widget');
      if (widget) {
        widget.remove();
      }
    }
  };
})();