import Appointment from '../models/Appointment.js';

class AppointmentController {
  async createAppointment(req, res) {
    try {
      const {
        sessionId,
        ownerName,
        email,
        petName,
        petType,
        fullPhoneNumber,
        appointmentDate,
        appointmentTime,
        appointmentDateTime,
        reason,
        urgency
      } = req.body;

      // Validate required fields
      if (!ownerName || !email || !petName || !fullPhoneNumber || !appointmentDate || !appointmentTime || !reason) {
        return res.status(400).json({
          error: 'All fields are required'
        });
      }

      // Create new appointment
      const appointment = new Appointment({
        sessionId: sessionId || 'direct-booking',
        ownerName,
        email,
        petName,
        petType: petType || 'dog',
        phone: fullPhoneNumber,
        appointmentDate,
        appointmentTime,
        preferredDateTime: appointmentDateTime || `${appointmentDate} at ${appointmentTime}`,
        reason,
        urgency: urgency || 'normal',
        status: 'pending'
      });

      // Save to database
      await appointment.save();

      res.status(201).json({
        message: 'Appointment created successfully',
        appointment: {
          id: appointment._id,
          ownerName: appointment.ownerName,
          petName: appointment.petName,
          phone: appointment.phone,
          preferredDateTime: appointment.preferredDateTime,
          status: appointment.status,
          createdAt: appointment.createdAt
        }
      });

    } catch (error) {
      console.error('Create appointment error:', error);
      res.status(500).json({
        error: 'Failed to create appointment'
      });
    }
  }

  async getAppointments(req, res) {
    try {
      const { sessionId } = req.query;

      // SECURITY FIX: Require sessionId - never return ALL appointments
      if (!sessionId) {
        return res.status(403).json({
          error: 'SessionId required for privacy. Cannot access appointments without proper session.'
        });
      }

      // Only return appointments for THIS specific session
      const appointments = await Appointment.find({ sessionId }).sort({ createdAt: -1 });

      res.json({
        appointments
      });

    } catch (error) {
      console.error('Get appointments error:', error);
      res.status(500).json({
        error: 'Failed to retrieve appointments'
      });
    }
  }

  async getAppointmentById(req, res) {
    try {
      const { id } = req.params;

      const appointment = await Appointment.findById(id);

      if (!appointment) {
        return res.status(404).json({
          error: 'Appointment not found'
        });
      }

      res.json({
        appointment
      });

    } catch (error) {
      console.error('Get appointment error:', error);
      res.status(500).json({
        error: 'Failed to retrieve appointment'
      });
    }
  }

  async updateAppointmentStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
        return res.status(400).json({
          error: 'Invalid status. Must be: pending, confirmed, or cancelled'
        });
      }

      const appointment = await Appointment.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      );

      if (!appointment) {
        return res.status(404).json({
          error: 'Appointment not found'
        });
      }

      res.json({
        message: 'Appointment status updated successfully',
        appointment
      });

    } catch (error) {
      console.error('Update appointment error:', error);
      res.status(500).json({
        error: 'Failed to update appointment'
      });
    }
  }
}

export default new AppointmentController();