# Keeping Your Render Server Awake

## Problem
Render's free tier automatically spins down your web service after 15 minutes of inactivity. This causes the first request after sleeping to take 30-50 seconds while the server restarts.

## Solutions Implemented

### 1. Self-Ping Service (Built-in)
We've added a self-ping service that automatically pings the server every 5 minutes when deployed to production. This is already configured in the code.

**Features:**
- Automatically starts when `NODE_ENV=production` or on Render
- Pings `/health` endpoint every 5 minutes
- Tracks ping statistics and errors
- Visible in health endpoint response

### 2. External Monitoring with UptimeRobot (Recommended)

UptimeRobot is a free service that monitors your website and can keep it awake by pinging it regularly.

#### Setup Instructions:

1. **Sign up for UptimeRobot (Free)**
   - Go to https://uptimerobot.com
   - Create a free account (supports up to 50 monitors)

2. **Create a New Monitor**
   - Click "Add New Monitor"
   - Configure as follows:
     ```
     Monitor Type: HTTP(s)
     Friendly Name: Veterinary Chatbot API
     URL: https://your-render-url.onrender.com/health
     Monitoring Interval: 5 minutes (free tier minimum)
     ```

3. **Configure Alert Settings (Optional)**
   - Add your email for downtime notifications
   - Set up webhook notifications if needed

4. **Activate the Monitor**
   - Click "Create Monitor"
   - The service will start pinging your server immediately

### 3. Alternative Services

If UptimeRobot doesn't work for you, here are alternatives:

#### **Cron-job.org** (Free)
- Website: https://cron-job.org
- Allows scheduling HTTP requests
- Minimum interval: 1 minute
- Setup:
  1. Create account
  2. Add new cron job
  3. Set URL to `https://your-url.onrender.com/health`
  4. Set execution to every 5 minutes: `*/5 * * * *`

#### **Better Uptime** (Free tier available)
- Website: https://betteruptime.com
- 10 monitors on free tier
- 3-minute check intervals
- Includes status page

#### **Pingdom** (Free tier)
- Website: https://www.pingdom.com
- 1 monitor on free tier
- 1-minute intervals
- Professional monitoring features

### 4. GitHub Actions (Advanced)

Create `.github/workflows/keep-alive.yml`:

```yaml
name: Keep Server Alive

on:
  schedule:
    - cron: '*/14 * * * *' # Every 14 minutes

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping server
        run: |
          curl https://your-render-url.onrender.com/health
```

## Verification

To verify the keep-alive mechanism is working:

1. **Check Health Endpoint**
   ```bash
   curl https://your-url.onrender.com/health
   ```

   Look for the `selfPing` section:
   ```json
   {
     "selfPing": {
       "isRunning": true,
       "pingCount": 12,
       "lastPingTime": "2024-01-15T10:30:00.000Z"
     }
   }
   ```

2. **Check Render Dashboard**
   - Go to your service dashboard on Render
   - Check the metrics graph
   - You should see regular activity every 5 minutes

3. **Monitor Response Times**
   - First request after deploy: 30-50 seconds (normal)
   - Subsequent requests: <500ms (server is awake)
   - If using keep-alive: Always <500ms

## Environment Variables

Add these to your Render service:

```env
# Required for self-ping
RENDER_EXTERNAL_URL=https://your-service.onrender.com

# Or use generic SERVER_URL
SERVER_URL=https://your-service.onrender.com
```

## Troubleshooting

### Server still sleeping?
1. Check if self-ping is running: GET `/health`
2. Verify environment variables are set
3. Check UptimeRobot dashboard for ping history
4. Look at Render logs for ping attempts

### Too many pings?
- Adjust ping interval in SelfPingService.js
- Change UptimeRobot interval (5 min is recommended)

### Rate limiting issues?
- The health endpoint bypasses rate limiting
- External monitors use different IPs each time

## Cost Considerations

### Free Options
- **UptimeRobot**: 50 monitors, 5-min intervals
- **Cron-job.org**: Unlimited jobs, 1-min minimum
- **Self-ping**: No external service needed

### When to Upgrade
Consider Render's paid tier ($7/month) if:
- You need 100% uptime guarantee
- Response time is critical
- You have many concurrent users
- You need more than 512MB RAM

## Note on Render's Policy

Render allows keep-alive pings on free tier. From their documentation:
> "You may use external services to prevent your free web service from spinning down due to inactivity."

This is a common and accepted practice for free tier services.