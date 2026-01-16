import fetch from 'node-fetch';

/**
 * Self-Ping Service to keep Render.com free tier server awake
 *
 * Render's free tier spins down after 15 minutes of inactivity.
 * This service pings the server's own health endpoint every 5 minutes
 * to prevent it from sleeping.
 */
class SelfPingService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.pingInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
    this.pingCount = 0;
    this.lastPingTime = null;
    this.errors = [];
  }

  /**
   * Start the self-ping service
   */
  start() {
    if (this.isRunning) {
      console.log('✅ Self-ping service is already running');
      return;
    }

    // Only run in production (when deployed on Render)
    if (process.env.NODE_ENV !== 'production' && !process.env.RENDER) {
      console.log('ℹ️ Self-ping service disabled (not in production)');
      return;
    }

    const serverUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL;

    if (!serverUrl) {
      console.log('⚠️ No server URL configured for self-ping service');
      return;
    }

    console.log('🏓 Starting self-ping service...');
    console.log(`📍 Server URL: ${serverUrl}`);
    console.log(`⏰ Ping interval: ${this.pingInterval / 1000 / 60} minutes`);

    // Initial ping after 1 minute
    setTimeout(() => {
      this.ping(serverUrl);
    }, 60000);

    // Set up regular interval
    this.intervalId = setInterval(() => {
      this.ping(serverUrl);
    }, this.pingInterval);

    this.isRunning = true;
    console.log('✅ Self-ping service started successfully');
  }

  /**
   * Ping the health endpoint
   */
  async ping(serverUrl) {
    const healthUrl = `${serverUrl}/health`;

    try {
      console.log(`🏓 Pinging health endpoint: ${healthUrl}`);

      const response = await fetch(healthUrl, {
        method: 'GET',
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'SelfPingService/1.0'
        }
      });

      if (response.ok) {
        this.pingCount++;
        this.lastPingTime = new Date();
        const data = await response.json();
        console.log(`✅ Ping #${this.pingCount} successful at ${this.lastPingTime.toISOString()}`);
        console.log(`   Server status: ${data.status}, Uptime: ${Math.round(data.uptime / 60)} minutes`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`❌ Ping failed: ${error.message}`);
      this.errors.push({
        time: new Date(),
        error: error.message
      });

      // Keep only last 10 errors
      if (this.errors.length > 10) {
        this.errors.shift();
      }
    }
  }

  /**
   * Stop the self-ping service
   */
  stop() {
    if (!this.isRunning) {
      console.log('ℹ️ Self-ping service is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('🛑 Self-ping service stopped');
  }

  /**
   * Get service statistics
   */
  getStatistics() {
    return {
      isRunning: this.isRunning,
      pingCount: this.pingCount,
      lastPingTime: this.lastPingTime,
      pingInterval: `${this.pingInterval / 1000 / 60} minutes`,
      recentErrors: this.errors.slice(-5),
      errorCount: this.errors.length
    };
  }
}

// Create singleton instance
const selfPingService = new SelfPingService();

export default selfPingService;