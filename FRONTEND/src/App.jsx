import React from 'react'
import ChatWidget from './components/Chatbot/ChatWidget'
import './App.css'

function App() {
  // Optional configuration that can be passed from parent/SDK
  const config = window.VetChatbotConfig || {};

  return (
    <div className="App">
      <div className="demo-page">
        <h1>PetCare AI Assistant</h1>
        <p>Experience next-generation veterinary support powered by advanced AI technology</p>

        <div className="demo-content">
          <h2>Intelligent Veterinary Support</h2>
          <ul>
            <li>24/7 AI-Powered Veterinary Expertise</li>
            <li>Instant Emergency Guidance</li>
            <li>Smart Appointment Scheduling</li>
            <li>Personalized Pet Care Recommendations</li>
          </ul>

          <h2>How Can We Help?</h2>
          <p>Our AI assistant is trained to help with:</p>
          <ul>
            <li>Pet Health Questions & Symptoms</li>
            <li>Vaccination Schedules</li>
            <li>Nutrition & Diet Guidance</li>
            <li>Behavioral Concerns</li>
            <li>Emergency Care Advice</li>
            <li>Appointment Booking</li>
          </ul>

          <h2>Start a Conversation</h2>
          <p>Click the chat button in the bottom-right corner to get started. Our AI assistant is ready to help with any pet-related questions you may have.</p>
        </div>
      </div>

      {/* Chatbot Widget with Glassmorphic Design */}
      <ChatWidget config={config} />
    </div>
  )
}

export default App