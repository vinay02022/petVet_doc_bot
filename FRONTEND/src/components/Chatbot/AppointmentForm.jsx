import React, { useState, useEffect } from 'react';
import PhoneInput, { isValidPhoneNumber, parsePhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import StorageService from '../../services/StorageService';
import './AppointmentForm.css';

const AppointmentForm = ({ isOpen, onClose, onSubmit, triggerReason }) => {
  const [formData, setFormData] = useState({
    ownerName: '',
    email: '',
    petName: '',
    petType: 'dog',
    phoneNumber: '',
    appointmentDate: '',
    appointmentTime: '',
    reason: '',
    urgency: 'normal'
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Load user profile from localStorage for returning users
    const userProfile = StorageService.getUserProfile();
    if (userProfile) {
      const updates = {};

      // Pre-fill basic information
      if (userProfile.ownerName) updates.ownerName = userProfile.ownerName;
      if (userProfile.email) updates.email = userProfile.email;
      if (userProfile.petName) updates.petName = userProfile.petName;
      if (userProfile.petType) updates.petType = userProfile.petType;

      // Handle phone number (now stored as full international format)
      if (userProfile.phone) {
        updates.phoneNumber = userProfile.phone;
      }

      setFormData(prev => ({ ...prev, ...updates }));
    }

    // Pre-fill reason if triggered by health issue
    if (triggerReason) {
      setFormData(prev => ({ ...prev, reason: triggerReason }));
    }
  }, [triggerReason]);

  const validateField = (name, value) => {
    let error = '';

    switch (name) {
      case 'ownerName':
        if (!value.trim()) error = 'Owner name is required';
        else if (value.length < 2) error = 'Name must be at least 2 characters';
        break;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!value.trim()) error = 'Email is required';
        else if (!emailRegex.test(value)) error = 'Please enter a valid email';
        break;

      case 'petName':
        if (!value.trim()) error = 'Pet name is required';
        break;

      case 'phoneNumber':
        if (!value || !value.trim()) error = 'Phone number is required';
        else if (!isValidPhoneNumber(value)) {
          error = 'Please enter a valid phone number';
        }
        break;

      case 'appointmentDate':
        if (!value) error = 'Please select a date';
        else {
          const selectedDate = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selectedDate < today) error = 'Please select a future date';
        }
        break;

      case 'appointmentTime':
        if (!value) error = 'Please select a time';
        break;

      case 'reason':
        if (!value.trim()) error = 'Please describe the reason for visit';
        else if (value.length < 10) error = 'Please provide more details (at least 10 characters)';
        break;
    }

    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePhoneChange = (value) => {
    setFormData(prev => ({ ...prev, phoneNumber: value || '' }));

    // Clear error when user starts typing
    if (errors.phoneNumber) {
      setErrors(prev => ({ ...prev, phoneNumber: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all fields
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      if (key !== 'petType' && key !== 'urgency') {
        const error = validateField(key, formData[key]);
        if (error) newErrors[key] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        ...formData,
        fullPhoneNumber: formData.phoneNumber, // Already in international format
        appointmentDateTime: `${formData.appointmentDate} ${formData.appointmentTime}`
      });

      // Reset form
      setFormData({
        ownerName: '',
        email: '',
        petName: '',
        petType: 'dog',
        phoneNumber: '',
        appointmentDate: '',
        appointmentTime: '',
        reason: '',
        urgency: 'normal'
      });
      setErrors({});
      onClose();
    } catch (error) {
      console.error('Failed to submit appointment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Get tomorrow's date as minimum
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="appointment-modal-overlay" onClick={onClose}>
      <div className="appointment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Book Veterinary Appointment</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="appointment-form">
          {/* Owner Information */}
          <div className="form-section">
            <h3>Owner Information</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ownerName">Your Name *</label>
                <input
                  type="text"
                  id="ownerName"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={handleChange}
                  className={errors.ownerName ? 'error' : ''}
                  placeholder="John Doe"
                />
                {errors.ownerName && <span className="error-message">{errors.ownerName}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={errors.email ? 'error' : ''}
                  placeholder="john@example.com"
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group phone-group">
                <label>Phone Number *</label>
                <PhoneInput
                  placeholder="Enter phone number"
                  value={formData.phoneNumber}
                  onChange={handlePhoneChange}
                  defaultCountry="US"
                  international
                  countryCallingCodeEditable={false}
                  className={errors.phoneNumber ? 'phone-input-error' : 'phone-input-field'}
                />
                {errors.phoneNumber && <span className="error-message">{errors.phoneNumber}</span>}
              </div>
            </div>
          </div>

          {/* Pet Information */}
          <div className="form-section">
            <h3>Pet Information</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="petName">Pet Name *</label>
                <input
                  type="text"
                  id="petName"
                  name="petName"
                  value={formData.petName}
                  onChange={handleChange}
                  className={errors.petName ? 'error' : ''}
                  placeholder="Buddy"
                />
                {errors.petName && <span className="error-message">{errors.petName}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="petType">Pet Type *</label>
                <select
                  id="petType"
                  name="petType"
                  value={formData.petType}
                  onChange={handleChange}
                >
                  <option value="dog">🐕 Dog</option>
                  <option value="cat">🐱 Cat</option>
                  <option value="bird">🦜 Bird</option>
                  <option value="rabbit">🐰 Rabbit</option>
                  <option value="hamster">🐹 Hamster</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Appointment Details */}
          <div className="form-section">
            <h3>Appointment Details</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="appointmentDate">Preferred Date *</label>
                <input
                  type="date"
                  id="appointmentDate"
                  name="appointmentDate"
                  value={formData.appointmentDate}
                  onChange={handleChange}
                  min={minDate}
                  className={errors.appointmentDate ? 'error' : ''}
                />
                {errors.appointmentDate && <span className="error-message">{errors.appointmentDate}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="appointmentTime">Preferred Time *</label>
                <input
                  type="time"
                  id="appointmentTime"
                  name="appointmentTime"
                  value={formData.appointmentTime}
                  onChange={handleChange}
                  min="09:00"
                  max="18:00"
                  className={errors.appointmentTime ? 'error' : ''}
                />
                {errors.appointmentTime && <span className="error-message">{errors.appointmentTime}</span>}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="urgency">Urgency Level</label>
              <select
                id="urgency"
                name="urgency"
                value={formData.urgency}
                onChange={handleChange}
              >
                <option value="normal">Normal - Regular checkup</option>
                <option value="moderate">Moderate - Some symptoms</option>
                <option value="urgent">Urgent - Immediate attention needed</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="reason">Reason for Visit *</label>
              <textarea
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                className={errors.reason ? 'error' : ''}
                rows="4"
                placeholder="Please describe your pet's symptoms or the reason for this appointment..."
              />
              {errors.reason && <span className="error-message">{errors.reason}</span>}
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? 'Booking...' : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AppointmentForm;