(function() {
  // Configuration
  const CHATBOT_URL = 'http://localhost:5173'; // Change this to your deployed frontend URL
  const CONTAINER_ID = 'vet-chatbot-container';

  // Create and inject the chatbot
  function initChatbot() {
    // Check if container already exists
    if (document.getElementById(CONTAINER_ID)) {
      console.warn('Veterinary Chatbot is already initialized');
      return;
    }

    // Create container div
    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.style.cssText = `
      position: fixed;
      bottom: 0;
      right: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    `;

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = CHATBOT_URL;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      background: transparent;
    `;
    iframe.allow = 'storage-access';

    // Add iframe to container
    container.appendChild(iframe);

    // Add container to body
    document.body.appendChild(container);

    // Pass configuration to iframe if available
    if (window.VetChatbotConfig) {
      iframe.onload = function() {
        try {
          iframe.contentWindow.postMessage({
            type: 'VET_CHATBOT_CONFIG',
            config: window.VetChatbotConfig
          }, CHATBOT_URL);
        } catch (error) {
          console.error('Failed to send config to chatbot:', error);
        }
      };
    }

    // Make only the chatbot area clickable
    iframe.onload = function() {
      // Allow pointer events only on the actual chatbot widget area
      container.style.pointerEvents = 'auto';

      // Listen for messages from the iframe to handle widget state
      window.addEventListener('message', function(event) {
        if (event.origin !== CHATBOT_URL) return;

        if (event.data.type === 'CHATBOT_RESIZE') {
          // Handle resize events if needed
          if (event.data.isOpen) {
            container.style.pointerEvents = 'auto';
          }
        }
      });
    };
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }

  // Expose global function for manual initialization
  window.VetChatbot = {
    init: initChatbot,
    destroy: function() {
      const container = document.getElementById(CONTAINER_ID);
      if (container) {
        container.remove();
      }
    }
  };
})();