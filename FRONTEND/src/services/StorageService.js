// Storage Service for managing local appointment and user data
class StorageService {
  constructor() {
    this.STORAGE_KEYS = {
      USER_PROFILE: 'vet-chatbot-user-profile',
      APPOINTMENTS: 'vet-chatbot-appointments',
      CHAT_HISTORY: 'vet-chatbot-chat-history',
      SESSION_DATA: 'vet-chatbot-session-data'
    };
  }

  // User Profile Management
  saveUserProfile(profile) {
    try {
      const existingProfile = this.getUserProfile() || {};
      const updatedProfile = {
        ...existingProfile,
        ...profile,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.STORAGE_KEYS.USER_PROFILE, JSON.stringify(updatedProfile));
      return updatedProfile;
    } catch (error) {
      console.error('Error saving user profile:', error);
      return null;
    }
  }

  getUserProfile() {
    try {
      const profile = localStorage.getItem(this.STORAGE_KEYS.USER_PROFILE);
      return profile ? JSON.parse(profile) : null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  // Appointment Management
  saveAppointment(appointment) {
    try {
      const appointments = this.getAppointments();
      const newAppointment = {
        ...appointment,
        id: appointment.id || `apt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: appointment.createdAt || new Date().toISOString(),
        status: appointment.status || 'pending'
      };

      appointments.push(newAppointment);
      localStorage.setItem(this.STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));

      // Also update user profile with latest contact info
      this.saveUserProfile({
        ownerName: appointment.ownerName,
        email: appointment.email,
        phone: appointment.fullPhoneNumber,
        petName: appointment.petName,
        petType: appointment.petType
      });

      return newAppointment;
    } catch (error) {
      console.error('Error saving appointment:', error);
      return null;
    }
  }

  getAppointments() {
    try {
      const appointments = localStorage.getItem(this.STORAGE_KEYS.APPOINTMENTS);
      return appointments ? JSON.parse(appointments) : [];
    } catch (error) {
      console.error('Error getting appointments:', error);
      return [];
    }
  }

  getUpcomingAppointments() {
    const appointments = this.getAppointments();
    const now = new Date();
    return appointments.filter(apt => {
      const aptDate = new Date(`${apt.appointmentDate} ${apt.appointmentTime}`);
      return aptDate > now && apt.status !== 'cancelled';
    }).sort((a, b) => {
      const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`);
      const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`);
      return dateA - dateB;
    });
  }

  getPastAppointments() {
    const appointments = this.getAppointments();
    const now = new Date();
    return appointments.filter(apt => {
      const aptDate = new Date(`${apt.appointmentDate} ${apt.appointmentTime}`);
      return aptDate <= now || apt.status === 'completed';
    }).sort((a, b) => {
      const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`);
      const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`);
      return dateB - dateA; // Most recent first
    });
  }

  updateAppointmentStatus(appointmentId, status) {
    try {
      const appointments = this.getAppointments();
      const index = appointments.findIndex(apt => apt.id === appointmentId);

      if (index !== -1) {
        appointments[index].status = status;
        appointments[index].updatedAt = new Date().toISOString();
        localStorage.setItem(this.STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
        return appointments[index];
      }
      return null;
    } catch (error) {
      console.error('Error updating appointment status:', error);
      return null;
    }
  }

  cancelAppointment(appointmentId) {
    return this.updateAppointmentStatus(appointmentId, 'cancelled');
  }

  // Chat History Management
  saveChatMessage(message) {
    try {
      const history = this.getChatHistory();
      history.push({
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      });

      // Keep only last 100 messages to avoid localStorage limits
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }

      localStorage.setItem(this.STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(history));
      return true;
    } catch (error) {
      console.error('Error saving chat message:', error);
      return false;
    }
  }

  getChatHistory() {
    try {
      const history = localStorage.getItem(this.STORAGE_KEYS.CHAT_HISTORY);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Error getting chat history:', error);
      return [];
    }
  }

  // Session Data Management
  saveSessionData(data) {
    try {
      const sessionData = this.getSessionData() || {};
      const updatedData = {
        ...sessionData,
        ...data,
        lastActivity: new Date().toISOString()
      };
      localStorage.setItem(this.STORAGE_KEYS.SESSION_DATA, JSON.stringify(updatedData));
      return updatedData;
    } catch (error) {
      console.error('Error saving session data:', error);
      return null;
    }
  }

  getSessionData() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.SESSION_DATA);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting session data:', error);
      return null;
    }
  }

  // Context Generation for AI
  getContextForAI() {
    const profile = this.getUserProfile();
    const appointments = this.getAppointments();
    const upcomingAppointments = this.getUpcomingAppointments();
    const recentHistory = this.getChatHistory().slice(-10); // Last 10 messages

    return {
      userProfile: profile,
      appointments: {
        total: appointments.length,
        upcoming: upcomingAppointments.length,
        recent: appointments.slice(-3), // Last 3 appointments
        next: upcomingAppointments[0] || null
      },
      recentConversation: recentHistory,
      sessionData: this.getSessionData()
    };
  }

  // Search Appointments
  searchAppointments(query) {
    const appointments = this.getAppointments();
    const searchTerm = query.toLowerCase();

    return appointments.filter(apt => {
      return (
        apt.ownerName?.toLowerCase().includes(searchTerm) ||
        apt.petName?.toLowerCase().includes(searchTerm) ||
        apt.reason?.toLowerCase().includes(searchTerm) ||
        apt.appointmentDate?.includes(searchTerm) ||
        apt.status?.toLowerCase().includes(searchTerm)
      );
    });
  }

  // Clear All Data
  clearAllData() {
    Object.values(this.STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  // Export Data (for backup)
  exportData() {
    return {
      profile: this.getUserProfile(),
      appointments: this.getAppointments(),
      chatHistory: this.getChatHistory(),
      sessionData: this.getSessionData(),
      exportedAt: new Date().toISOString()
    };
  }

  // Import Data (for restore)
  importData(data) {
    try {
      if (data.profile) {
        localStorage.setItem(this.STORAGE_KEYS.USER_PROFILE, JSON.stringify(data.profile));
      }
      if (data.appointments) {
        localStorage.setItem(this.STORAGE_KEYS.APPOINTMENTS, JSON.stringify(data.appointments));
      }
      if (data.chatHistory) {
        localStorage.setItem(this.STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(data.chatHistory));
      }
      if (data.sessionData) {
        localStorage.setItem(this.STORAGE_KEYS.SESSION_DATA, JSON.stringify(data.sessionData));
      }
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }
}

export default new StorageService();