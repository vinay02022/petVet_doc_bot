import React from 'react';

const ChatHeader = ({ onClose, onClear }) => {
  return (
    <div className="chat-header">
      <div className="chat-header-title">
        <span className="chat-header-icon">🐾</span>
        <span>Veterinary Assistant</span>
      </div>
      <div className="chat-header-actions">
        <button
          className="chat-header-button"
          onClick={onClear}
          title="Clear chat"
          aria-label="Clear chat"
        >
          🗑️
        </button>
        <button
          className="chat-header-button"
          onClick={onClose}
          title="Minimize chat"
          aria-label="Minimize chat"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;