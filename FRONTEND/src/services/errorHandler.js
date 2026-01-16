/**
 * Production-ready error handling and retry logic
 * Handles network failures, timeouts, and API errors gracefully
 */

class ErrorHandler {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second
    this.timeout = 30000; // 30 seconds timeout
    this.errorLog = [];
    this.offlineQueue = [];
  }

  /**
   * Retry logic with exponential backoff
   */
  async retryWithBackoff(fn, retries = this.maxRetries, delay = this.retryDelay) {
    try {
      return await this.withTimeout(fn(), this.timeout);
    } catch (error) {
      if (retries === 0) {
        this.logError(error);
        throw this.enhanceError(error);
      }

      // Check if error is retryable
      if (!this.isRetryableError(error)) {
        throw this.enhanceError(error);
      }

      // Wait with exponential backoff
      await this.sleep(delay);

      // Retry with increased delay
      return this.retryWithBackoff(fn, retries - 1, delay * 2);
    }
  }

  /**
   * Add timeout to promises
   */
  withTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      )
    ]);
  }

  /**
   * Determine if error should trigger retry
   */
  isRetryableError(error) {
    // Network errors
    if (error.message.includes('NetworkError') ||
        error.message.includes('Failed to fetch')) {
      return true;
    }

    // Timeout errors
    if (error.message.includes('timeout')) {
      return true;
    }

    // Server errors (500+)
    if (error.status >= 500) {
      return true;
    }

    // Rate limiting (429)
    if (error.status === 429) {
      return true;
    }

    return false;
  }

  /**
   * Enhance error with context
   */
  enhanceError(error) {
    const enhanced = new Error(error.message);
    enhanced.originalError = error;
    enhanced.timestamp = new Date().toISOString();
    enhanced.context = {
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      url: window.location.href
    };
    return enhanced;
  }

  /**
   * Queue requests when offline
   */
  queueOfflineRequest(request) {
    this.offlineQueue.push({
      ...request,
      timestamp: Date.now(),
      retries: 0
    });

    // Save to localStorage
    localStorage.setItem('offlineQueue', JSON.stringify(this.offlineQueue));
  }

  /**
   * Process offline queue when back online
   */
  async processOfflineQueue() {
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const request of queue) {
      try {
        await this.retryWithBackoff(() =>
          fetch(request.url, request.options)
        );
      } catch (error) {
        console.error('Failed to process offline request:', error);
        // Re-queue if still failing
        if (request.retries < 3) {
          this.offlineQueue.push({
            ...request,
            retries: request.retries + 1
          });
        }
      }
    }
  }

  /**
   * Log errors for monitoring
   */
  logError(error) {
    const errorEntry = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      context: error.context || {}
    };

    this.errorLog.push(errorEntry);

    // Keep only last 100 errors
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-100);
    }

    // Save to localStorage
    localStorage.setItem('errorLog', JSON.stringify(this.errorLog));

    // Send to monitoring service (if configured)
    this.sendToMonitoring(errorEntry);
  }

  /**
   * Send errors to monitoring service
   */
  async sendToMonitoring(error) {
    // Implement integration with Sentry, LogRocket, etc.
    if (window.MONITORING_ENABLED) {
      try {
        await fetch('/api/monitoring/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(error)
        });
      } catch (e) {
        // Silently fail monitoring
      }
    }
  }

  /**
   * User-friendly error messages
   */
  getUserMessage(error) {
    // Network errors
    if (!navigator.onLine) {
      return "You're offline. Messages will be sent when connection is restored.";
    }

    if (error.status === 429) {
      return "Too many requests. Please wait a moment and try again.";
    }

    if (error.status === 500) {
      return "Server error. Our team has been notified. Please try again later.";
    }

    if (error.message.includes('timeout')) {
      return "Request took too long. Please check your connection and try again.";
    }

    // Default message
    return "Something went wrong. Please try again.";
  }

  /**
   * Helper sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle network status changes
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('Back online - processing queue');
      this.processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      console.log('Gone offline - queuing requests');
    });
  }
}

export default new ErrorHandler();