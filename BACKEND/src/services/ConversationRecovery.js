/**
 * Smart Conversation Recovery Service
 * Handles interruptions, corrections, context switches, and invalid inputs
 */

class ConversationRecovery {
  constructor() {
    // Patterns for detecting user intentions
    this.correctionPatterns = [
      /actually|wait|no|sorry|mistake|wrong|change|correct|update|modify/i,
      /i meant|i mean|let me|instead/i,
      /not\s+(\w+),?\s+(?:it's|its)\s+(\w+)/i,  // "not X, it's Y"
      /change\s+(?:that|it|the)\s+to\s+(\w+)/i  // "change that to X"
    ];

    this.goBackPatterns = [
      /go back|previous|back to|return to|cancel that|undo/i,
      /start over|restart|begin again|from the beginning/i
    ];

    this.clarificationPatterns = [
      /what\s+(?:do you mean|did you say|was that)/i,
      /can you repeat|say that again|pardon|sorry\?/i,
      /i don't understand|confused|not sure/i
    ];

    this.contextSwitchPatterns = [
      /wait,?\s+(?:first|before that)/i,
      /quick question|by the way|oh,?\s+(?:also|and)/i,
      /let me ask|i need to know|tell me/i
    ];

    // Appointment field mappings
    this.fieldMappings = {
      name: ['name', 'owner', 'my name', 'full name'],
      pet: ['pet', 'pet name', 'animal', 'dog', 'cat', 'pet\'s name'],
      phone: ['phone', 'number', 'contact', 'mobile', 'cell'],
      date: ['date', 'time', 'when', 'appointment', 'schedule']
    };

    // Common typos and corrections
    this.typoCorrections = {
      phone: {
        patterns: [
          { regex: /^(\d{3})(\d{3})(\d{4})$/, format: '$1-$2-$3' },
          { regex: /^(\d{10})$/, format: (match) => `${match.substr(0,3)}-${match.substr(3,3)}-${match.substr(6,4)}` }
        ]
      },
      date: {
        tomorrow: () => {
          const date = new Date();
          date.setDate(date.getDate() + 1);
          return date;
        },
        'next week': () => {
          const date = new Date();
          date.setDate(date.getDate() + 7);
          return date;
        }
      }
    };

    // Confidence thresholds
    this.confidenceThreshold = 0.7;
  }

  /**
   * Main recovery handler
   */
  async handleRecovery(message, conversationState, appointmentData) {
    // Detect what type of recovery is needed
    const recoveryType = this.detectRecoveryType(message);

    switch (recoveryType) {
      case 'correction':
        return this.handleCorrection(message, conversationState, appointmentData);

      case 'go_back':
        return this.handleGoBack(conversationState, appointmentData);

      case 'clarification':
        return this.handleClarification(conversationState, appointmentData);

      case 'context_switch':
        return this.handleContextSwitch(message, conversationState, appointmentData);

      case 'invalid_input':
        return this.handleInvalidInput(message, conversationState, appointmentData);

      default:
        return null; // No recovery needed
    }
  }

  /**
   * Detect what type of recovery is needed
   */
  detectRecoveryType(message) {
    if (this.matchesPatterns(message, this.correctionPatterns)) {
      return 'correction';
    }
    if (this.matchesPatterns(message, this.goBackPatterns)) {
      return 'go_back';
    }
    if (this.matchesPatterns(message, this.clarificationPatterns)) {
      return 'clarification';
    }
    if (this.matchesPatterns(message, this.contextSwitchPatterns)) {
      return 'context_switch';
    }

    // Check if input is invalid for current state
    if (this.isInvalidForState(message)) {
      return 'invalid_input';
    }

    return null;
  }

  /**
   * Handle corrections (e.g., "Actually, my name is John, not Jon")
   */
  handleCorrection(message, conversationState, appointmentData) {
    // Extract what field they're correcting
    const field = this.detectFieldBeingCorrected(message, appointmentData);

    if (!field) {
      return {
        message: "What would you like to correct? Your name, pet's name, phone number, or appointment time?",
        action: 'clarify_correction',
        suggestedActions: [
          { label: 'Name', value: 'correct_name' },
          { label: 'Pet Name', value: 'correct_pet' },
          { label: 'Phone', value: 'correct_phone' },
          { label: 'Date/Time', value: 'correct_date' }
        ]
      };
    }

    // Extract the new value
    const newValue = this.extractCorrectedValue(message, field);

    if (!newValue) {
      return {
        message: `I couldn't understand the new ${field}. Could you please provide just the ${field}?`,
        action: 'request_correction_value',
        field: field
      };
    }

    // Apply the correction
    const updatedData = { ...appointmentData };
    updatedData[field] = newValue;

    return {
      message: `Got it! I've updated your ${field} to "${newValue}". Is this correct?`,
      action: 'correction_applied',
      updatedData: updatedData,
      confirmationRequired: true
    };
  }

  /**
   * Handle go back requests
   */
  handleGoBack(conversationState, appointmentData) {
    const previousState = this.getPreviousState(conversationState);

    if (!previousState) {
      return {
        message: "Would you like to start over with booking a new appointment?",
        action: 'confirm_restart',
        suggestedActions: [
          { label: 'Yes, start over', value: 'restart' },
          { label: 'No, continue', value: 'continue' }
        ]
      };
    }

    // Remove the last collected field
    const fieldToRemove = this.getFieldForState(conversationState);
    const updatedData = { ...appointmentData };
    delete updatedData[fieldToRemove];

    return {
      message: `Let's go back. ${this.getQuestionForState(previousState)}`,
      action: 'went_back',
      newState: previousState,
      updatedData: updatedData
    };
  }

  /**
   * Handle clarification requests
   */
  handleClarification(conversationState, appointmentData) {
    const currentQuestion = this.getQuestionForState(conversationState);
    const example = this.getExampleForState(conversationState);

    return {
      message: `${currentQuestion}\n\nFor example: ${example}`,
      action: 'clarification_provided',
      helpText: this.getHelpTextForState(conversationState),
      suggestedValues: this.getSuggestedValuesForState(conversationState)
    };
  }

  /**
   * Handle context switches
   */
  handleContextSwitch(message, conversationState, appointmentData) {
    // Save current context
    const savedContext = {
      state: conversationState,
      data: appointmentData,
      timestamp: Date.now()
    };

    return {
      message: "I'll help with that question first, then we can continue with your appointment booking.",
      action: 'context_switched',
      savedContext: savedContext,
      processAsNormalQuery: true
    };
  }

  /**
   * Handle invalid inputs
   */
  handleInvalidInput(message, conversationState, appointmentData) {
    const validation = this.validateInputForState(message, conversationState);

    if (!validation.valid) {
      // Try to extract valid parts
      const extracted = this.extractValidParts(message, conversationState);

      if (extracted) {
        return {
          message: `I think you meant "${extracted}". Is that correct?`,
          action: 'suggest_correction',
          suggestedValue: extracted,
          confirmationRequired: true
        };
      }

      // Provide specific help based on the validation error
      return {
        message: validation.helpMessage,
        action: 'validation_error',
        error: validation.error,
        examples: validation.examples,
        suggestedActions: validation.suggestedActions
      };
    }

    return null;
  }

  /**
   * Detect which field is being corrected
   */
  detectFieldBeingCorrected(message, appointmentData) {
    const lowerMessage = message.toLowerCase();

    for (const [field, keywords] of Object.entries(this.fieldMappings)) {
      for (const keyword of keywords) {
        if (lowerMessage.includes(keyword)) {
          return field;
        }
      }
    }

    // Try to infer from context
    if (appointmentData.ownerName && message.includes(appointmentData.ownerName)) {
      return 'name';
    }
    if (appointmentData.petName && message.includes(appointmentData.petName)) {
      return 'pet';
    }

    return null;
  }

  /**
   * Extract corrected value from message
   */
  extractCorrectedValue(message, field) {
    const patterns = {
      name: /(?:it's|its|is|name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      pet: /(?:it's|its|is|named?)\s+([A-Z][a-z]+)/i,
      phone: /(\d{3}[-.]?\d{3}[-.]?\d{4})/,
      date: /(?:change to|make it|schedule for)\s+(.+)/i
    };

    const pattern = patterns[field];
    if (!pattern) return null;

    const match = message.match(pattern);
    return match ? match[1].trim() : null;
  }

  /**
   * Validate input for current state
   */
  validateInputForState(message, state) {
    const validators = {
      ASK_OWNER_NAME: (input) => {
        if (input.length < 2) {
          return {
            valid: false,
            error: 'too_short',
            helpMessage: 'Please provide your full name (at least 2 characters).',
            examples: ['John Smith', 'Jane Doe', 'Dr. Robert Johnson']
          };
        }
        if (!/^[a-zA-Z\s'-]+$/.test(input)) {
          return {
            valid: false,
            error: 'invalid_characters',
            helpMessage: 'Names should only contain letters, spaces, hyphens, and apostrophes.',
            examples: ['Mary O\'Brien', 'Jean-Paul Smith']
          };
        }
        return { valid: true };
      },

      ASK_PET_NAME: (input) => {
        if (input.length < 1) {
          return {
            valid: false,
            error: 'too_short',
            helpMessage: 'Please provide your pet\'s name.',
            examples: ['Buddy', 'Max', 'Luna', 'Charlie']
          };
        }
        return { valid: true };
      },

      ASK_PHONE: (input) => {
        const cleaned = input.replace(/\D/g, '');
        if (cleaned.length < 10) {
          return {
            valid: false,
            error: 'invalid_phone',
            helpMessage: 'Please provide a valid 10-digit phone number.',
            examples: ['555-123-4567', '(555) 123-4567', '5551234567']
          };
        }
        return { valid: true };
      },

      ASK_DATE_TIME: (input) => {
        const date = new Date(input);
        if (isNaN(date.getTime())) {
          return {
            valid: false,
            error: 'invalid_date',
            helpMessage: 'Please provide a valid date and time.',
            examples: ['tomorrow at 2pm', 'next Monday at 10:30am', 'January 20 at 3pm'],
            suggestedActions: [
              { label: 'Tomorrow morning', value: 'tomorrow 9am' },
              { label: 'Tomorrow afternoon', value: 'tomorrow 2pm' },
              { label: 'Next week', value: 'next Monday 10am' }
            ]
          };
        }
        if (date <= new Date()) {
          return {
            valid: false,
            error: 'past_date',
            helpMessage: 'Please select a future date and time.',
            examples: ['tomorrow at 2pm', 'next week Monday at 10am']
          };
        }
        return { valid: true };
      }
    };

    const validator = validators[state];
    return validator ? validator(message) : { valid: true };
  }

  /**
   * Extract valid parts from invalid input
   */
  extractValidParts(message, state) {
    const extractors = {
      ASK_PHONE: (input) => {
        const digits = input.replace(/\D/g, '');
        if (digits.length === 10) {
          return `${digits.substr(0,3)}-${digits.substr(3,3)}-${digits.substr(6,4)}`;
        }
        return null;
      },

      ASK_DATE_TIME: (input) => {
        // Try to parse common informal inputs
        const informal = {
          'tmrw': 'tomorrow',
          'tmr': 'tomorrow',
          'tom': 'tomorrow',
          'nxt': 'next'
        };

        let processed = input.toLowerCase();
        for (const [short, full] of Object.entries(informal)) {
          processed = processed.replace(short, full);
        }

        // Try to extract time
        const timeMatch = processed.match(/(\d{1,2})\s*(?::|\.)?(\d{2})?\s*(am|pm)?/i);
        if (timeMatch) {
          const hour = parseInt(timeMatch[1]);
          const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          const ampm = timeMatch[3] || (hour < 8 ? 'pm' : 'am');
          return `tomorrow at ${hour}:${minute.toString().padStart(2, '0')} ${ampm}`;
        }

        return null;
      }
    };

    const extractor = extractors[state];
    return extractor ? extractor(message) : null;
  }

  /**
   * Get previous state in the flow
   */
  getPreviousState(currentState) {
    const flow = [
      'ASK_OWNER_NAME',
      'ASK_PET_NAME',
      'ASK_PHONE',
      'ASK_DATE_TIME',
      'CONFIRMATION'
    ];

    const currentIndex = flow.indexOf(currentState);
    return currentIndex > 0 ? flow[currentIndex - 1] : null;
  }

  /**
   * Get field name for a state
   */
  getFieldForState(state) {
    const mapping = {
      'ASK_OWNER_NAME': 'ownerName',
      'ASK_PET_NAME': 'petName',
      'ASK_PHONE': 'phone',
      'ASK_DATE_TIME': 'preferredDateTime'
    };
    return mapping[state];
  }

  /**
   * Get question for a state
   */
  getQuestionForState(state) {
    const questions = {
      'ASK_OWNER_NAME': 'What is your full name?',
      'ASK_PET_NAME': 'What is your pet\'s name?',
      'ASK_PHONE': 'What is the best phone number to reach you?',
      'ASK_DATE_TIME': 'When would you like to schedule the appointment?'
    };
    return questions[state];
  }

  /**
   * Get example for a state
   */
  getExampleForState(state) {
    const examples = {
      'ASK_OWNER_NAME': 'John Smith',
      'ASK_PET_NAME': 'Buddy',
      'ASK_PHONE': '555-123-4567',
      'ASK_DATE_TIME': 'tomorrow at 2:30 PM'
    };
    return examples[state];
  }

  /**
   * Get help text for a state
   */
  getHelpTextForState(state) {
    const helpTexts = {
      'ASK_OWNER_NAME': 'Please provide your first and last name. This helps us identify your appointment.',
      'ASK_PET_NAME': 'Please tell us your pet\'s name. If you have multiple pets, provide the name of the pet who needs the appointment.',
      'ASK_PHONE': 'Please provide a phone number where we can reach you. Include area code (10 digits).',
      'ASK_DATE_TIME': 'Please suggest a date and time that works for you. We\'re open Monday-Friday 9am-6pm, Saturday 9am-2pm.'
    };
    return helpTexts[state];
  }

  /**
   * Get suggested values for a state
   */
  getSuggestedValuesForState(state) {
    if (state === 'ASK_DATE_TIME') {
      const suggestions = [];
      const now = new Date();

      // Tomorrow slots
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      suggestions.push(
        { label: 'Tomorrow 10:00 AM', value: `${tomorrow.toDateString()} 10:00 AM` },
        { label: 'Tomorrow 2:00 PM', value: `${tomorrow.toDateString()} 2:00 PM` }
      );

      // Next week
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      suggestions.push(
        { label: 'Next week', value: `${nextWeek.toDateString()} 10:00 AM` }
      );

      return suggestions;
    }
    return [];
  }

  /**
   * Check if message matches any patterns
   */
  matchesPatterns(message, patterns) {
    return patterns.some(pattern => pattern.test(message));
  }

  /**
   * Check if input is invalid for current state
   */
  isInvalidForState(message) {
    // This would be enhanced with more sophisticated validation
    return false; // Placeholder
  }

  /**
   * Calculate confidence score for interpretation
   */
  calculateConfidence(input, expectedType) {
    // Implement confidence scoring algorithm
    let confidence = 0.5; // Base confidence

    // Adjust based on input characteristics
    if (expectedType === 'phone' && /\d{10}/.test(input.replace(/\D/g, ''))) {
      confidence += 0.3;
    }
    if (expectedType === 'name' && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(input)) {
      confidence += 0.3;
    }

    return Math.min(confidence, 1.0);
  }
}

export default new ConversationRecovery();