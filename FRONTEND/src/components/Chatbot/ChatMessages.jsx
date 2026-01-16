import React from 'react';
import MessageBubble from './MessageBubble';
import Loader from './Loader';

const ChatMessages = ({ messages, isLoading, messagesEndRef, onButtonClick }) => {
  return (
    <div className="chat-messages">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          onButtonClick={onButtonClick}
        />
      ))}
      {isLoading && <Loader />}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessages;