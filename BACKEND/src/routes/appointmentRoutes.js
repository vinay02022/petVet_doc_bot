import express from 'express';
import appointmentController from '../controllers/appointmentController.js';

const router = express.Router();

// POST /api/appointments - Create a new appointment
router.post('/', appointmentController.createAppointment);

// GET /api/appointments - Get all appointments (optionally filtered by sessionId)
router.get('/', appointmentController.getAppointments);

// GET /api/appointments/:id - Get specific appointment
router.get('/:id', appointmentController.getAppointmentById);

// PATCH /api/appointments/:id/status - Update appointment status
router.patch('/:id/status', appointmentController.updateAppointmentStatus);

export default router;