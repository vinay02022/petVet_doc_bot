class AppointmentService {
  // Check if user wants to book an appointment
  detectBookingIntent(message) {
    const bookingPhrases = [
      'book an appointment',
      'book appointment',
      'schedule appointment',
      'make appointment',
      'book a visit',
      'schedule a visit',
      'see a vet',
      'visit vet',
      'need appointment',
      'want appointment',
      'appointment please',
      'book consultation',
      'schedule consultation',
      'need to see vet',
      'want to see vet',
      'i want to book',
      'i need to book',
      'can i book',
      'like to book',
      'make a booking',
      'schedule vet'
    ];

    const lowerMessage = message.toLowerCase();
    const isBooking = bookingPhrases.some(phrase => lowerMessage.includes(phrase));
    console.log('Checking booking intent for:', message);
    console.log('Lowercase message:', lowerMessage);
    console.log('Is booking intent?', isBooking);
    return isBooking;
  }

  // Get the next question based on current state
  getNextQuestion(state, appointmentData = {}) {
    switch (state) {
      case 'ASK_OWNER_NAME':
        return {
          message: 'Great! I\'ll help you book an appointment. May I have your full name, please?',
          nextState: 'ASK_PET_NAME'
        };

      case 'ASK_PET_NAME':
        return {
          message: 'Thank you! What\'s your pet\'s name?',
          nextState: 'ASK_PHONE'
        };

      case 'ASK_PHONE':
        return {
          message: 'What\'s the best phone number to reach you at?',
          nextState: 'ASK_DATE_TIME'
        };

      case 'ASK_DATE_TIME':
        return {
          message: 'When would you prefer to schedule the appointment? Please provide a future date and time (e.g., "tomorrow at 2pm", "next Monday at 10:30am", or "January 20, 2026 at 3pm").',
          nextState: 'CONFIRMATION'
        };

      case 'CONFIRMATION':
        return {
          message: this.getConfirmationMessage(appointmentData),
          nextState: 'COMPLETED'
        };

      case 'COMPLETED':
        return {
          message: 'Your appointment has been successfully booked! We\'ll contact you shortly to confirm. Is there anything else I can help you with?',
          nextState: 'NONE'
        };

      default:
        return null;
    }
  }

  // Generate confirmation message
  getConfirmationMessage(data) {
    return `Perfect! Let me confirm your appointment details:

Owner Name: ${data.ownerName}
Pet Name: ${data.petName}
Phone: ${data.phone}
Preferred Date/Time: ${data.preferredDateTime}

Is this information correct? (Type 'yes' to confirm or 'no' to start over)`;
  }

  // Validate phone number (basic validation)
  validatePhone(phone) {
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');

    // Check if it's exactly 10 digits
    if (cleaned.length !== 10) {
      return {
        valid: false,
        message: 'Please provide a valid 10-digit phone number.'
      };
    }

    return {
      valid: true,
      cleaned: cleaned
    };
  }

  // Validate date and time
  validateDateTime(dateTimeStr) {
    try {
      let inputDate;
      const now = new Date();
      const lowerStr = dateTimeStr.toLowerCase().trim();

      // Parse natural language dates
      if (lowerStr.includes('tomorrow')) {
        inputDate = new Date();
        inputDate.setDate(inputDate.getDate() + 1);

        // Extract time if provided
        const timeMatch = lowerStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          const meridiem = timeMatch[3].toLowerCase();

          if (meridiem === 'pm' && hours !== 12) hours += 12;
          if (meridiem === 'am' && hours === 12) hours = 0;

          inputDate.setHours(hours, minutes, 0, 0);
        } else {
          inputDate.setHours(10, 0, 0, 0); // Default to 10 AM
        }
      }
      else if (lowerStr.includes('next')) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        let targetDay = -1;

        // Find which day is mentioned
        for (let i = 0; i < days.length; i++) {
          if (lowerStr.includes(days[i])) {
            targetDay = i;
            break;
          }
        }

        if (targetDay !== -1) {
          inputDate = new Date();
          const currentDay = inputDate.getDay();
          let daysToAdd = targetDay - currentDay;
          if (daysToAdd <= 0) daysToAdd += 7; // Next week
          inputDate.setDate(inputDate.getDate() + daysToAdd);

          // Extract time if provided
          const timeMatch = lowerStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
          if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const meridiem = timeMatch[3].toLowerCase();

            if (meridiem === 'pm' && hours !== 12) hours += 12;
            if (meridiem === 'am' && hours === 12) hours = 0;

            inputDate.setHours(hours, minutes, 0, 0);
          } else {
            inputDate.setHours(10, 0, 0, 0); // Default to 10 AM
          }
        } else {
          // Try parsing as regular date
          inputDate = new Date(dateTimeStr);
        }
      }
      else if (lowerStr.includes('today')) {
        inputDate = new Date();

        // Extract time if provided
        const timeMatch = lowerStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          const meridiem = timeMatch[3].toLowerCase();

          if (meridiem === 'pm' && hours !== 12) hours += 12;
          if (meridiem === 'am' && hours === 12) hours = 0;

          inputDate.setHours(hours, minutes, 0, 0);
        } else {
          inputDate.setHours(inputDate.getHours() + 2, 0, 0, 0); // 2 hours from now
        }
      }
      else {
        // Try to parse various date formats
        inputDate = new Date(dateTimeStr);
      }

      // Check if date is valid
      if (!inputDate || isNaN(inputDate.getTime())) {
        return {
          valid: false,
          message: 'Please provide a valid date and time (e.g., "tomorrow at 2pm", "next Monday at 10:30am", "January 20 at 3pm").'
        };
      }

      // Check if date is in the past
      if (inputDate <= now) {
        return {
          valid: false,
          message: 'Please select a future date and time. Appointments cannot be booked for past dates or times.'
        };
      }

      // Check if date is too far in the future (optional: limit to 6 months)
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

      if (inputDate > sixMonthsFromNow) {
        return {
          valid: false,
          message: 'Appointments can only be scheduled up to 6 months in advance. Please choose an earlier date.'
        };
      }

      // Format the date nicely for confirmation
      const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      };
      const formattedDate = inputDate.toLocaleDateString('en-US', options);

      return {
        valid: true,
        date: inputDate,
        formatted: formattedDate
      };
    } catch (error) {
      return {
        valid: false,
        message: 'Please provide a valid date and time format.'
      };
    }
  }

  // Process user response during booking flow
  processBookingResponse(state, userMessage, appointmentData) {
    console.log('Processing booking response for state:', state);
    console.log('Current appointment data:', appointmentData);
    console.log('User message:', userMessage);

    const response = {
      data: { ...appointmentData },
      isValid: true,
      errorMessage: null
    };

    // We process based on what we're ASKING for, not what we just got
    // The state tells us what question we asked the user
    switch (state) {
      case 'ASK_PET_NAME':
        // We asked for owner name, so this response is the owner name
        if (userMessage.trim().length < 2) {
          response.isValid = false;
          response.errorMessage = 'Please provide a valid name.';
        } else {
          response.data.ownerName = userMessage.trim();
        }
        break;

      case 'ASK_PHONE':
        // We asked for pet name, so this response is the pet name
        if (userMessage.trim().length < 1) {
          response.isValid = false;
          response.errorMessage = 'Please provide your pet\'s name.';
        } else {
          response.data.petName = userMessage.trim();
        }
        break;

      case 'ASK_DATE_TIME':
        // We asked for phone, so this response is the phone
        const phoneValidation = this.validatePhone(userMessage);
        if (!phoneValidation.valid) {
          response.isValid = false;
          response.errorMessage = phoneValidation.message;
        } else {
          response.data.phone = phoneValidation.cleaned;
        }
        break;

      case 'CONFIRMATION':
        // We asked for date/time, so this response is the date/time
        const dateTimeInput = userMessage.trim();

        if (dateTimeInput.length < 3) {
          response.isValid = false;
          response.errorMessage = 'Please provide a preferred date and time.';
        } else {
          // Validate the date and time
          const dateValidation = this.validateDateTime(dateTimeInput);

          if (!dateValidation.valid) {
            response.isValid = false;
            response.errorMessage = dateValidation.message;
          } else {
            // Store both the original input and formatted date
            response.data.preferredDateTime = dateValidation.formatted;
            response.data.appointmentDate = dateValidation.date;
          }
        }
        break;

      case 'COMPLETED':
        // We're asking for confirmation (yes/no)
        const lowerMessage = userMessage.toLowerCase().trim();
        if (lowerMessage === 'yes' || lowerMessage === 'confirm' || lowerMessage === 'y') {
          response.confirmed = true;
        } else if (lowerMessage === 'no' || lowerMessage === 'cancel' || lowerMessage === 'n') {
          response.cancelled = true;
          response.data = {}; // Reset data
        } else {
          response.isValid = false;
          response.errorMessage = 'Please type "yes" to confirm or "no" to start over.';
        }
        break;
    }

    console.log('Response after processing:', response);
    return response;
  }

  // Check if user wants to cancel booking
  detectCancelIntent(message) {
    const cancelPhrases = ['cancel', 'stop', 'nevermind', 'forget it', 'exit'];
    const lowerMessage = message.toLowerCase();
    return cancelPhrases.some(phrase => lowerMessage.includes(phrase));
  }
}

export default new AppointmentService();