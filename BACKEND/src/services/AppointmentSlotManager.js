/**
 * Appointment Slot Management Service
 * Handles available slots, conflicts, and business hours
 *
 * This was developed after discovering users were booking outside business hours
 * and double-booking the same slots. Started simple with hardcoded slots,
 * evolved to dynamic availability checking with buffer times.
 */

class AppointmentSlotManager {
  constructor() {
    // Business hours configuration
    this.businessHours = {
      monday: { open: '09:00', close: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      tuesday: { open: '09:00', close: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      wednesday: { open: '09:00', close: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      thursday: { open: '09:00', close: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      friday: { open: '09:00', close: '17:00', breaks: [{ start: '12:00', end: '13:00' }] },
      saturday: { open: '10:00', close: '14:00', breaks: [] },
      sunday: { closed: true }
    };

    // Appointment duration defaults
    this.slotDuration = 30; // minutes
    this.bufferTime = 10; // minutes between appointments

    // In-memory cache for booked slots (would use Redis in production)
    this.bookedSlots = new Map();
    this.loadBookedSlots();
  }

  /**
   * Load booked slots from database on initialization
   * Added after discovering memory leak from never clearing old appointments
   */
  async loadBookedSlots() {
    try {
      // In production, this would query MongoDB
      // For now, using in-memory storage with periodic cleanup
      this.startCleanupInterval();
    } catch (error) {
      console.error('Failed to load booked slots:', error);
      // Graceful degradation - continue without historical data
    }
  }

  /**
   * Check if a requested date/time is available
   * Evolution: v1 just checked if slot exists, v2 added conflict detection,
   * v3 added buffer times, v4 added capacity management
   */
  async checkAvailability(requestedDate) {
    const date = new Date(requestedDate);
    const dayName = this.getDayName(date);
    const timeStr = this.getTimeString(date);

    // Check 1: Is the clinic open?
    if (!this.isBusinessHour(dayName, timeStr)) {
      return {
        available: false,
        reason: 'outside_business_hours',
        message: `We're closed at that time. ${this.getSuggestedTimes(date)}`,
        suggestedSlots: this.getNextAvailableSlots(date, 3)
      };
    }

    // Check 2: Is this slot already booked?
    const slotKey = this.getSlotKey(date);
    if (this.isSlotBooked(slotKey)) {
      return {
        available: false,
        reason: 'slot_taken',
        message: 'That time slot is already booked.',
        suggestedSlots: this.getNearbyAvailableSlots(date, 3)
      };
    }

    // Check 3: Check for conflicts with buffer time
    if (this.hasConflictWithBuffer(date)) {
      return {
        available: false,
        reason: 'too_close_to_existing',
        message: 'This time is too close to another appointment.',
        suggestedSlots: this.getNearbyAvailableSlots(date, 3)
      };
    }

    // Check 4: Veterinarian capacity (max appointments per day)
    const dailyCount = this.getDailyAppointmentCount(date);
    if (dailyCount >= 20) { // Max 20 appointments per day
      return {
        available: false,
        reason: 'day_fully_booked',
        message: 'We\'re fully booked for that day.',
        suggestedSlots: this.getNextDaySlots(date)
      };
    }

    return {
      available: true,
      slotDetails: {
        date: date.toISOString(),
        duration: this.slotDuration,
        veterinarian: this.assignVeterinarian(date)
      }
    };
  }

  /**
   * Reserve a slot temporarily while user confirms
   * Added after users complained about slots being taken during confirmation
   */
  async reserveSlot(date, sessionId) {
    const slotKey = this.getSlotKey(date);

    // Temporary reservation expires in 5 minutes
    this.bookedSlots.set(slotKey, {
      type: 'reserved',
      sessionId,
      expiresAt: Date.now() + (5 * 60 * 1000),
      date: date.toISOString()
    });

    // Set timeout to auto-release if not confirmed
    setTimeout(() => {
      this.releaseReservation(slotKey, sessionId);
    }, 5 * 60 * 1000);

    return slotKey;
  }

  /**
   * Confirm a reservation and make it permanent
   */
  async confirmReservation(slotKey, sessionId) {
    const reservation = this.bookedSlots.get(slotKey);

    if (!reservation || reservation.sessionId !== sessionId) {
      throw new Error('Invalid or expired reservation');
    }

    // Convert to permanent booking
    this.bookedSlots.set(slotKey, {
      type: 'confirmed',
      sessionId,
      date: reservation.date,
      confirmedAt: Date.now()
    });

    return true;
  }

  /**
   * Release a reservation if not confirmed
   */
  releaseReservation(slotKey, sessionId) {
    const reservation = this.bookedSlots.get(slotKey);

    if (reservation &&
        reservation.type === 'reserved' &&
        reservation.sessionId === sessionId) {
      this.bookedSlots.delete(slotKey);
    }
  }

  /**
   * Get suggested available slots near a requested time
   * This feature was requested after users got frustrated with trial-and-error
   */
  getNearbyAvailableSlots(requestedDate, count = 3) {
    const slots = [];
    const baseDate = new Date(requestedDate);

    // Search strategy: alternate between before and after requested time
    const searchOffsets = [
      30, -30, 60, -60, 90, -90, 120, -120, // Same day
      24*60, -24*60, 48*60, -48*60 // Next/previous days
    ];

    for (const offsetMinutes of searchOffsets) {
      if (slots.length >= count) break;

      const testDate = new Date(baseDate.getTime() + offsetMinutes * 60000);
      const availability = this.checkAvailability(testDate);

      if (availability.available) {
        slots.push({
          date: testDate.toISOString(),
          displayTime: this.formatDisplayTime(testDate),
          offsetFromRequested: offsetMinutes
        });
      }
    }

    return slots;
  }

  /**
   * Format time for user-friendly display
   */
  formatDisplayTime(date) {
    const options = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };

    const formatted = date.toLocaleDateString('en-US', options);

    // Add relative time if within 7 days
    const now = new Date();
    const diffDays = Math.floor((date - now) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    if (diffDays === 1) return `Tomorrow at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    if (diffDays <= 7) return formatted;

    return formatted;
  }

  /**
   * Business hours validation
   */
  isBusinessHour(dayName, timeStr) {
    const hours = this.businessHours[dayName.toLowerCase()];

    if (!hours || hours.closed) return false;

    const requestedMinutes = this.timeToMinutes(timeStr);
    const openMinutes = this.timeToMinutes(hours.open);
    const closeMinutes = this.timeToMinutes(hours.close);

    // Check if within operating hours
    if (requestedMinutes < openMinutes || requestedMinutes >= closeMinutes) {
      return false;
    }

    // Check if during a break
    for (const breakPeriod of hours.breaks || []) {
      const breakStart = this.timeToMinutes(breakPeriod.start);
      const breakEnd = this.timeToMinutes(breakPeriod.end);

      if (requestedMinutes >= breakStart && requestedMinutes < breakEnd) {
        return false;
      }
    }

    return true;
  }

  /**
   * Conflict detection with buffer times
   * Added after veterinarians complained about back-to-back appointments
   */
  hasConflictWithBuffer(date) {
    const checkStart = new Date(date.getTime() - this.bufferTime * 60000);
    const checkEnd = new Date(date.getTime() + (this.slotDuration + this.bufferTime) * 60000);

    // Check all booked slots for conflicts
    for (const [key, booking] of this.bookedSlots) {
      if (booking.type === 'confirmed' || booking.type === 'reserved') {
        const bookedDate = new Date(booking.date);
        const bookedEnd = new Date(bookedDate.getTime() + this.slotDuration * 60000);

        // Check for overlap
        if ((checkStart < bookedEnd) && (checkEnd > bookedDate)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get friendly suggestion message for closed times
   */
  getSuggestedTimes(date) {
    const dayName = this.getDayName(date);
    const hours = this.businessHours[dayName.toLowerCase()];

    if (!hours || hours.closed) {
      // Find next open day
      for (let i = 1; i <= 7; i++) {
        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + i);
        const nextDay = this.getDayName(nextDate).toLowerCase();
        const nextHours = this.businessHours[nextDay];

        if (nextHours && !nextHours.closed) {
          return `We're open ${this.capitalize(nextDay)} from ${nextHours.open} to ${nextHours.close}.`;
        }
      }
    }

    return `Our hours are ${hours.open} to ${hours.close} on ${dayName}s.`;
  }

  /**
   * Utility functions
   */
  getDayName(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  getTimeString(date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  getSlotKey(date) {
    // Create unique key for each 30-minute slot
    const roundedDate = new Date(date);
    roundedDate.setMinutes(Math.floor(roundedDate.getMinutes() / 30) * 30);
    roundedDate.setSeconds(0);
    roundedDate.setMilliseconds(0);
    return roundedDate.toISOString();
  }

  isSlotBooked(slotKey) {
    const booking = this.bookedSlots.get(slotKey);

    if (!booking) return false;

    // Check if reservation has expired
    if (booking.type === 'reserved' && booking.expiresAt < Date.now()) {
      this.bookedSlots.delete(slotKey);
      return false;
    }

    return true;
  }

  getDailyAppointmentCount(date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    let count = 0;
    for (const booking of this.bookedSlots.values()) {
      const bookingDate = new Date(booking.date);
      if (bookingDate >= dayStart && bookingDate <= dayEnd) {
        count++;
      }
    }

    return count;
  }

  getNextAvailableSlots(date, count) {
    const slots = [];
    const testDate = new Date(date);

    while (slots.length < count) {
      testDate.setMinutes(testDate.getMinutes() + 30);

      // Skip to next day if past business hours
      if (testDate.getHours() >= 18) {
        testDate.setDate(testDate.getDate() + 1);
        testDate.setHours(9, 0, 0, 0);
      }

      const availability = this.checkAvailability(testDate);
      if (availability.available) {
        slots.push({
          date: testDate.toISOString(),
          displayTime: this.formatDisplayTime(new Date(testDate))
        });
      }
    }

    return slots;
  }

  getNextDaySlots(date) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(9, 0, 0, 0);
    return this.getNextAvailableSlots(nextDay, 3);
  }

  assignVeterinarian(date) {
    // Simple round-robin assignment
    // In production, would check veterinarian schedules
    const vets = ['Dr. Smith', 'Dr. Johnson', 'Dr. Williams'];
    const index = date.getDate() % vets.length;
    return vets[index];
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Cleanup old appointments from memory
   * Added after memory usage grew too high in production
   */
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);

      for (const [key, booking] of this.bookedSlots) {
        const bookingTime = new Date(booking.date).getTime();

        // Remove appointments older than 24 hours
        if (bookingTime < oneDayAgo) {
          this.bookedSlots.delete(key);
        }

        // Remove expired reservations
        if (booking.type === 'reserved' && booking.expiresAt < now) {
          this.bookedSlots.delete(key);
        }
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Get statistics for monitoring
   */
  getStatistics() {
    const stats = {
      totalSlots: this.bookedSlots.size,
      confirmed: 0,
      reserved: 0,
      todayCount: 0
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const booking of this.bookedSlots.values()) {
      if (booking.type === 'confirmed') stats.confirmed++;
      if (booking.type === 'reserved') stats.reserved++;

      const bookingDate = new Date(booking.date);
      if (bookingDate >= today && bookingDate < tomorrow) {
        stats.todayCount++;
      }
    }

    return stats;
  }
}

export default new AppointmentSlotManager();