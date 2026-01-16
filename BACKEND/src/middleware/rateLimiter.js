/**
 * Rate Limiting and Security Middleware
 *
 * Development History:
 * v1: No rate limiting - site crashed from spam bot sending 1000 req/sec
 * v2: Simple counter - memory leak from never clearing old IPs
 * v3: Sliding window - too complex, performance issues
 * v4: Token bucket algorithm - current implementation, best balance
 *
 * Learned: Different endpoints need different limits
 * Chat API: 30 req/min (prevents abuse but allows conversation)
 * Appointment: 5 req/min (prevents spam bookings)
 * Health check: 60 req/min (for monitoring tools)
 */

class RateLimiter {
  constructor() {
    // Store buckets per IP address
    this.buckets = new Map();

    // Different limits for different endpoints
    this.limits = {
      '/api/chat': {
        tokens: 30,
        refillRate: 30,
        interval: 60000, // 1 minute
        blockDuration: 300000 // 5 minutes if exceeded
      },
      '/api/appointments': {
        tokens: 5,
        refillRate: 5,
        interval: 60000,
        blockDuration: 600000 // 10 minutes if exceeded
      },
      '/api/health': {
        tokens: 60,
        refillRate: 60,
        interval: 60000,
        blockDuration: 60000
      },
      default: {
        tokens: 20,
        refillRate: 20,
        interval: 60000,
        blockDuration: 300000
      }
    };

    // Track blocked IPs
    this.blockedIPs = new Map();

    // Suspicious patterns we've seen in production
    this.suspiciousPatterns = [
      /(<script|javascript:|onerror=|onclick=)/i, // XSS attempts
      /(union.*select|drop.*table|insert.*into)/i, // SQL injection
      /(\.\.\/|\.\.\\|%2e%2e)/i, // Path traversal
      /(\${|`|\\x|\\u0)/i // Code injection
    ];

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Main middleware function
   */
  middleware() {
    return async (req, res, next) => {
      const ip = this.getClientIP(req);
      const endpoint = this.getEndpointKey(req.path);

      // Check if IP is blocked
      if (this.isBlocked(ip)) {
        const blockedUntil = this.blockedIPs.get(ip);
        const remainingTime = Math.ceil((blockedUntil - Date.now()) / 1000);

        return res.status(429).json({
          error: 'Too many requests',
          message: `You have been temporarily blocked. Try again in ${remainingTime} seconds.`,
          retryAfter: remainingTime
        });
      }

      // Check for suspicious patterns in request
      if (this.hasSuspiciousContent(req)) {
        // Log potential attack
        this.logSecurityEvent(ip, 'suspicious_content', req);

        // Block IP for 1 hour
        this.blockIP(ip, 3600000);

        return res.status(403).json({
          error: 'Forbidden',
          message: 'Your request contains invalid characters.'
        });
      }

      // Apply rate limiting
      const allowed = this.consumeToken(ip, endpoint);

      if (!allowed) {
        const limit = this.limits[endpoint] || this.limits.default;

        // Block IP temporarily
        this.blockIP(ip, limit.blockDuration);

        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please slow down.',
          retryAfter: Math.ceil(limit.blockDuration / 1000)
        });
      }

      // Add security headers
      this.addSecurityHeaders(res);

      next();
    };
  }

  /**
   * Token bucket algorithm implementation
   * Each IP gets a bucket with tokens that refill over time
   */
  consumeToken(ip, endpoint) {
    const limit = this.limits[endpoint] || this.limits.default;
    const now = Date.now();

    // Get or create bucket for this IP-endpoint combination
    const key = `${ip}-${endpoint}`;
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: limit.tokens,
        lastRefill: now
      };
      this.buckets.set(key, bucket);
    }

    // Calculate tokens to add based on time passed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = (timePassed / limit.interval) * limit.refillRate;

    // Refill bucket (up to max capacity)
    bucket.tokens = Math.min(limit.tokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Try to consume a token
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Check for suspicious content in request
   * Based on actual attack patterns we've seen
   */
  hasSuspiciousContent(req) {
    // Check URL parameters
    const urlString = req.url;
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(urlString)) {
        return true;
      }
    }

    // Check body content
    if (req.body) {
      const bodyString = JSON.stringify(req.body);
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(bodyString)) {
          return true;
        }
      }

      // Check for unusually long inputs (potential buffer overflow)
      if (req.body.message && req.body.message.length > 5000) {
        return true;
      }

      // Check for null bytes (often used in attacks)
      if (bodyString.includes('\\x00') || bodyString.includes('%00')) {
        return true;
      }
    }

    // Check headers for injection attempts
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'referer'];
    for (const header of suspiciousHeaders) {
      if (req.headers[header]) {
        const value = req.headers[header];
        if (typeof value === 'string' && value.length > 200) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Block an IP address temporarily
   */
  blockIP(ip, duration) {
    const unblockTime = Date.now() + duration;
    this.blockedIPs.set(ip, unblockTime);

    // Schedule unblock
    setTimeout(() => {
      this.blockedIPs.delete(ip);
    }, duration);
  }

  /**
   * Check if IP is currently blocked
   */
  isBlocked(ip) {
    const blockedUntil = this.blockedIPs.get(ip);
    if (!blockedUntil) return false;

    if (Date.now() > blockedUntil) {
      this.blockedIPs.delete(ip);
      return false;
    }

    return true;
  }

  /**
   * Get real client IP (handles proxies)
   */
  getClientIP(req) {
    // Check various headers set by proxies/load balancers
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // Take first IP if multiple (comma-separated)
      return forwarded.split(',')[0].trim();
    }

    return req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           req.ip;
  }

  /**
   * Get endpoint key for rate limiting
   */
  getEndpointKey(path) {
    // Match path to configured endpoints
    for (const endpoint in this.limits) {
      if (endpoint !== 'default' && path.startsWith(endpoint)) {
        return endpoint;
      }
    }
    return 'default';
  }

  /**
   * Add security headers to response
   */
  addSecurityHeaders(res) {
    // Prevent XSS attacks
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://apis.google.com; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://generativelanguage.googleapis.com;"
    );
  }

  /**
   * Log security events for monitoring
   */
  logSecurityEvent(ip, type, req) {
    const event = {
      timestamp: new Date().toISOString(),
      ip,
      type,
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'],
      body: req.body ? JSON.stringify(req.body).substring(0, 200) : null
    };

    // In production, send to security monitoring service
    console.log('[SECURITY]', JSON.stringify(event));

    // Also store locally for analysis
    if (!this.securityLog) this.securityLog = [];
    this.securityLog.push(event);

    // Keep only last 1000 events
    if (this.securityLog.length > 1000) {
      this.securityLog = this.securityLog.slice(-1000);
    }
  }

  /**
   * Clean up old data periodically
   * Prevents memory leaks from accumulating IPs
   */
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      // Clean old buckets
      for (const [key, bucket] of this.buckets) {
        if (bucket.lastRefill < oneHourAgo) {
          this.buckets.delete(key);
        }
      }

      // Clean expired blocks
      for (const [ip, unblockTime] of this.blockedIPs) {
        if (now > unblockTime) {
          this.blockedIPs.delete(ip);
        }
      }
    }, 60000); // Run every minute
  }

  /**
   * Get statistics for monitoring
   */
  getStatistics() {
    return {
      activeBuckets: this.buckets.size,
      blockedIPs: this.blockedIPs.size,
      securityEvents: this.securityLog ? this.securityLog.length : 0,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage
   */
  estimateMemoryUsage() {
    const bucketSize = 50; // bytes per bucket
    const blockSize = 30; // bytes per blocked IP
    const logSize = 500; // bytes per log entry

    const total =
      (this.buckets.size * bucketSize) +
      (this.blockedIPs.size * blockSize) +
      ((this.securityLog?.length || 0) * logSize);

    return `${(total / 1024).toFixed(2)} KB`;
  }
}

export default new RateLimiter();