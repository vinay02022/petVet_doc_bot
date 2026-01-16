# Veterinary Chatbot SDK

A production-ready, embeddable chatbot SDK for veterinary clinics that provides AI-powered pet care assistance and appointment booking capabilities.

## Features

- **AI-Powered Responses**: Uses Google Gemini API for intelligent veterinary Q&A
- **Appointment Booking**: Conversational flow for scheduling vet appointments
- **Easy Integration**: Single script tag embedding for any website
- **Session Management**: Persistent conversations across page refreshes
- **Context Support**: Optional configuration for personalized experiences
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Clean Architecture**: Separated concerns with MVC pattern

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Website       │────▶│   Chatbot SDK   │────▶│   Backend API   │
│   (Any Site)    │     │   (React UI)    │     │   (Node.js)     │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                              ┌─────────────────────┐
                                              │                     │
                                              │   External Services │
                                              │   - MongoDB         │
                                              │   - Google Gemini   │
                                              │                     │
                                              └─────────────────────┘
```

## Project Structure

```
veterinary-chatbot/
├── BACKEND/                 # Node.js Express API
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── models/          # MongoDB schemas
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── app.js           # Express configuration
│   │   └── server.js        # Server entry point
│   ├── .env                 # Environment variables
│   └── package.json
│
├── FRONTEND/                # React chat interface
│   ├── src/
│   │   ├── components/      # React components
│   │   │   └── Chatbot/     # Chat UI components
│   │   ├── App.jsx          # Main app component
│   │   └── main.jsx         # React entry point
│   └── package.json
│
├── SDK/                     # Embeddable scripts
│   ├── chatbot.js           # Iframe-based SDK
│   ├── chatbot-standalone.js # Direct embed SDK
│   └── test.html            # SDK test page
│
└── README.md
```

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- Google Gemini API Key ([Get it here](https://makersuite.google.com/app/apikey))

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/veterinary-chatbot.git
cd veterinary-chatbot
```

### 2. Backend Setup

```bash
cd BACKEND
npm install

# Create .env file with your credentials
cp .env.example .env
# Edit .env and add your Gemini API key and MongoDB URI
```

### 3. Frontend Setup

```bash
cd FRONTEND
npm install
```

### 4. Start MongoDB

```bash
# If using local MongoDB
mongod

# Or use MongoDB Atlas cloud service
```

### 5. Run the Application

**Backend (Terminal 1):**
```bash
cd BACKEND
npm run dev
# Server runs on http://localhost:5000
```

**Frontend (Terminal 2):**
```bash
cd FRONTEND
npm run dev
# UI runs on http://localhost:5173
```

## SDK Integration

### Basic Integration

Add this single line to any website:

```html
<script src="https://your-domain.com/chatbot.js"></script>
```

### With Configuration

Pass context data for personalized experience:

```html
<script>
  window.VetChatbotConfig = {
    userId: "user_123",
    userName: "John Doe",
    petName: "Buddy",
    source: "marketing-website"
  };
</script>
<script src="https://your-domain.com/chatbot.js"></script>
```

### Programmatic Control

```javascript
// Open chatbot
VetChatbot.open();

// Close chatbot
VetChatbot.close();

// Destroy chatbot
VetChatbot.destroy();

// Re-initialize
VetChatbot.init();
```

## API Endpoints

### Chat Endpoint
- **POST** `/api/chat` - Send message and receive AI response
  ```json
  {
    "message": "What vaccines does my puppy need?",
    "sessionId": "optional_session_id",
    "context": { "userId": "123", "petName": "Max" }
  }
  ```

### Appointment Endpoints
- **POST** `/api/appointments` - Create appointment
- **GET** `/api/appointments` - List appointments
- **GET** `/api/appointments/:id` - Get specific appointment
- **PATCH** `/api/appointments/:id/status` - Update status

### Conversation History
- **GET** `/api/chat/:sessionId` - Retrieve conversation history

## Key Design Decisions

### 1. Separation of Concerns
- **Controllers**: Handle HTTP requests/responses
- **Services**: Business logic and external API integration
- **Models**: Data structure and validation
- **Routes**: Endpoint definitions

### 2. Rule-Based Appointment Booking
- Deterministic flow instead of AI-driven to ensure reliability
- State machine approach for predictable user experience
- Clear validation at each step

### 3. Session Management
- UUID-based sessions without user authentication
- LocalStorage for client-side persistence
- MongoDB for server-side conversation storage

### 4. Veterinary-Only Responses
- Strict system prompt to limit AI responses
- Keyword detection for veterinary topics
- Polite rejection of off-topic questions

## Trade-offs & Assumptions

### Trade-offs Made
1. **Iframe vs Direct Embed**: Chose both options - iframe for isolation, direct for performance
2. **Session Storage**: LocalStorage over cookies for simplicity
3. **Validation**: Basic validation to avoid over-engineering
4. **UI Framework**: React for component reusability despite bundle size

### Assumptions
1. Users have modern browsers with JavaScript enabled
2. MongoDB is accessible (local or cloud)
3. Gemini API has reasonable latency
4. Single language support (English) is sufficient
5. No authentication required for chat access

## Security Considerations

- Environment variables for sensitive data
- CORS configuration for API access
- Input sanitization and validation
- Rate limiting (to be implemented)
- HTTPS recommended for production

## Future Improvements

1. **Enhanced Features**
   - Multi-language support
   - Voice input/output
   - Rich media messages (images, videos)
   - Email/SMS appointment confirmations

2. **Technical Improvements**
   - WebSocket for real-time messaging
   - Redis for session caching
   - Rate limiting and DDoS protection
   - Comprehensive test suite
   - CI/CD pipeline

3. **Business Features**
   - Admin dashboard for appointments
   - Analytics and conversation insights
   - Integration with clinic management systems
   - Custom AI training for specific clinics

## Testing

### Manual Testing Checklist

- [ ] Chatbot loads on various websites
- [ ] Veterinary questions receive appropriate responses
- [ ] Non-veterinary questions are politely rejected
- [ ] Appointment booking flow completes successfully
- [ ] Cancel appointment during booking works
- [ ] Session persists across page refreshes
- [ ] Mobile responsive design works
- [ ] Error states handle gracefully

### Test Scenarios

1. **Basic Q&A**: "What vaccines does my puppy need?"
2. **Appointment Booking**: "I want to book an appointment"
3. **Context Persistence**: Refresh page mid-conversation
4. **Error Handling**: Disconnect network during chat
5. **Input Validation**: Enter invalid phone number

## Deployment

### Backend Deployment (Example with Heroku)

```bash
# Add Heroku remote
heroku create your-app-name

# Set environment variables
heroku config:set GEMINI_API_KEY=your_key
heroku config:set MONGODB_URI=your_mongodb_uri

# Deploy
git push heroku main
```

### Frontend Deployment (Example with Vercel)

```bash
# Build production bundle
cd FRONTEND
npm run build

# Deploy to Vercel
vercel --prod
```

### SDK Distribution

1. Host the SDK file on a CDN
2. Update the API URLs in SDK files
3. Provide integration documentation

## Troubleshooting

### Common Issues

1. **Chatbot doesn't appear**
   - Check console for JavaScript errors
   - Verify SDK script is loading
   - Check CORS settings

2. **API Connection Failed**
   - Verify backend is running
   - Check API URL in frontend config
   - Ensure MongoDB is connected

3. **Gemini API Errors**
   - Verify API key is valid
   - Check API quota limits
   - Review system prompt formatting

## License

MIT License - See LICENSE file for details

## Support

For issues or questions:
- Create an issue on GitHub
- Contact: support@veterinarychatbot.com

## Acknowledgments

- Google Gemini API for AI capabilities
- React team for the UI framework
- MongoDB for database solution
- Express.js for backend framework

---

Built with care for pet health and veterinary practices.