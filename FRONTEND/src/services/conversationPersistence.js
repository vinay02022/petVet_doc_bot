/**
 * Conversation Persistence Service
 * Handles localStorage, IndexedDB, and cross-tab synchronization
 */

class ConversationPersistence {
  constructor() {
    this.dbName = 'VetChatDB';
    this.dbVersion = 1;
    this.db = null;
    this.syncInterval = null;
    this.initDatabase();
  }

  /**
   * Initialize IndexedDB for robust storage
   */
  async initDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Conversations store
        if (!db.objectStoreNames.contains('conversations')) {
          const store = db.createObjectStore('conversations', { keyPath: 'sessionId' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }

        // Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const store = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Appointments store
        if (!db.objectStoreNames.contains('appointments')) {
          const store = db.createObjectStore('appointments', { keyPath: 'id', autoIncrement: true });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }

        // Analytics store
        if (!db.objectStoreNames.contains('analytics')) {
          db.createObjectStore('analytics', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  /**
   * Save conversation with full context
   */
  async saveConversation(sessionId, conversation) {
    // Save to IndexedDB
    if (this.db) {
      const transaction = this.db.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');

      const enrichedConversation = {
        ...conversation,
        sessionId,
        timestamp: Date.now(),
        lastActive: new Date().toISOString(),
        deviceInfo: this.getDeviceInfo(),
        version: this.dbVersion
      };

      await store.put(enrichedConversation);
    }

    // Also save to localStorage for quick access
    const conversations = this.getLocalStorageItem('conversations') || {};
    conversations[sessionId] = conversation;
    this.setLocalStorageItem('conversations', conversations);

    // Sync across tabs
    this.broadcastUpdate('conversation', { sessionId, conversation });
  }

  /**
   * Save individual message with metadata
   */
  async saveMessage(sessionId, message) {
    // Enrich message with metadata
    const enrichedMessage = {
      ...message,
      sessionId,
      timestamp: Date.now(),
      id: `${sessionId}-${Date.now()}-${Math.random()}`,
      context: {
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        userAgent: navigator.userAgent
      }
    };

    // Save to IndexedDB
    if (this.db) {
      const transaction = this.db.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      await store.add(enrichedMessage);
    }

    // Update localStorage cache
    const messages = this.getLocalStorageItem(`messages-${sessionId}`) || [];
    messages.push(enrichedMessage);

    // Keep only last 100 messages in localStorage
    if (messages.length > 100) {
      messages.splice(0, messages.length - 100);
    }

    this.setLocalStorageItem(`messages-${sessionId}`, messages);
  }

  /**
   * Retrieve conversation with fallbacks
   */
  async getConversation(sessionId) {
    // Try IndexedDB first
    if (this.db) {
      try {
        const transaction = this.db.transaction(['conversations'], 'readonly');
        const store = transaction.objectStore('conversations');
        const request = store.get(sessionId);

        return new Promise((resolve) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => {
            // Fallback to localStorage
            const conversations = this.getLocalStorageItem('conversations') || {};
            resolve(conversations[sessionId]);
          };
        });
      } catch (error) {
        console.error('IndexedDB error:', error);
      }
    }

    // Fallback to localStorage
    const conversations = this.getLocalStorageItem('conversations') || {};
    return conversations[sessionId];
  }

  /**
   * Get all messages for a session
   */
  async getMessages(sessionId) {
    // Try IndexedDB first
    if (this.db) {
      try {
        const transaction = this.db.transaction(['messages'], 'readonly');
        const store = transaction.objectStore('messages');
        const index = store.index('sessionId');
        const request = index.getAll(sessionId);

        return new Promise((resolve) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => {
            // Fallback to localStorage
            resolve(this.getLocalStorageItem(`messages-${sessionId}`) || []);
          };
        });
      } catch (error) {
        console.error('IndexedDB error:', error);
      }
    }

    // Fallback to localStorage
    return this.getLocalStorageItem(`messages-${sessionId}`) || [];
  }

  /**
   * Smart conversation recovery
   */
  async recoverConversation(sessionId) {
    const conversation = await this.getConversation(sessionId);
    const messages = await this.getMessages(sessionId);

    if (!conversation) {
      return null;
    }

    // Check if conversation is still valid (not older than 24 hours)
    const age = Date.now() - conversation.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (age > maxAge) {
      // Archive old conversation
      await this.archiveConversation(sessionId);
      return null;
    }

    // Reconstruct conversation state
    return {
      ...conversation,
      messages,
      recovered: true,
      recoveryTimestamp: Date.now()
    };
  }

  /**
   * Archive old conversations
   */
  async archiveConversation(sessionId) {
    const conversation = await this.getConversation(sessionId);
    if (!conversation) return;

    // Save to archive
    const archives = this.getLocalStorageItem('archives') || [];
    archives.push({
      ...conversation,
      archivedAt: Date.now()
    });

    // Keep only last 10 archives
    if (archives.length > 10) {
      archives.splice(0, archives.length - 10);
    }

    this.setLocalStorageItem('archives', archives);

    // Remove from active storage
    this.removeConversation(sessionId);
  }

  /**
   * Remove conversation
   */
  async removeConversation(sessionId) {
    // Remove from IndexedDB
    if (this.db) {
      const transaction = this.db.transaction(['conversations', 'messages'], 'readwrite');
      await transaction.objectStore('conversations').delete(sessionId);

      const messageStore = transaction.objectStore('messages');
      const index = messageStore.index('sessionId');
      const request = index.openCursor(IDBKeyRange.only(sessionId));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          messageStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
    }

    // Remove from localStorage
    const conversations = this.getLocalStorageItem('conversations') || {};
    delete conversations[sessionId];
    this.setLocalStorageItem('conversations', conversations);
    localStorage.removeItem(`messages-${sessionId}`);
  }

  /**
   * Cross-tab synchronization
   */
  broadcastUpdate(type, data) {
    const channel = new BroadcastChannel('vet-chat-sync');
    channel.postMessage({
      type,
      data,
      timestamp: Date.now(),
      tabId: this.getTabId()
    });
  }

  /**
   * Listen for updates from other tabs
   */
  setupSyncListeners(callback) {
    const channel = new BroadcastChannel('vet-chat-sync');
    channel.onmessage = (event) => {
      if (event.data.tabId !== this.getTabId()) {
        callback(event.data);
      }
    };

    // Also sync on visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.syncFromStorage();
      }
    });
  }

  /**
   * Sync from storage when tab becomes active
   */
  async syncFromStorage() {
    // Implement sync logic
    const lastSync = this.getLocalStorageItem('lastSync') || 0;
    const now = Date.now();

    if (now - lastSync > 5000) { // Sync every 5 seconds max
      this.setLocalStorageItem('lastSync', now);
      // Trigger sync callbacks
      window.dispatchEvent(new CustomEvent('conversation-sync'));
    }
  }

  /**
   * Get device information for context
   */
  getDeviceInfo() {
    return {
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  /**
   * Get or create tab ID
   */
  getTabId() {
    let tabId = sessionStorage.getItem('tabId');
    if (!tabId) {
      tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('tabId', tabId);
    }
    return tabId;
  }

  /**
   * Safe localStorage operations
   */
  getLocalStorageItem(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  setLocalStorageItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      // Handle quota exceeded
      if (error.name === 'QuotaExceededError') {
        this.clearOldData();
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (retryError) {
          console.error('Still cannot save after cleanup:', retryError);
        }
      }
      return false;
    }
  }

  /**
   * Clear old data when storage is full
   */
  clearOldData() {
    const conversations = this.getLocalStorageItem('conversations') || {};
    const sorted = Object.entries(conversations)
      .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

    // Keep only recent 5 conversations
    const keep = sorted.slice(0, 5);
    const newConversations = Object.fromEntries(keep);
    this.setLocalStorageItem('conversations', newConversations);

    // Clear old message caches
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('messages-')) {
        const sessionId = key.replace('messages-', '');
        if (!newConversations[sessionId]) {
          localStorage.removeItem(key);
        }
      }
    });
  }

  /**
   * Export conversation data
   */
  async exportConversation(sessionId) {
    const conversation = await this.getConversation(sessionId);
    const messages = await this.getMessages(sessionId);

    return {
      conversation,
      messages,
      exportedAt: new Date().toISOString(),
      version: this.dbVersion
    };
  }

  /**
   * Import conversation data
   */
  async importConversation(data) {
    if (data.conversation) {
      await this.saveConversation(data.conversation.sessionId, data.conversation);
    }

    if (data.messages) {
      for (const message of data.messages) {
        await this.saveMessage(data.conversation.sessionId, message);
      }
    }
  }

  /**
   * Get conversation statistics
   */
  async getStatistics() {
    const conversations = this.getLocalStorageItem('conversations') || {};
    const totalConversations = Object.keys(conversations).length;

    let totalMessages = 0;
    let totalAppointments = 0;

    for (const sessionId in conversations) {
      const messages = await this.getMessages(sessionId);
      totalMessages += messages.length;

      if (conversations[sessionId].appointmentData) {
        totalAppointments++;
      }
    }

    return {
      totalConversations,
      totalMessages,
      totalAppointments,
      storageUsed: this.getStorageUsage(),
      lastActivity: this.getLastActivity()
    };
  }

  /**
   * Get storage usage
   */
  getStorageUsage() {
    let total = 0;
    for (const key in localStorage) {
      total += localStorage[key].length + key.length;
    }
    return (total / 1024).toFixed(2) + ' KB';
  }

  /**
   * Get last activity timestamp
   */
  getLastActivity() {
    const conversations = this.getLocalStorageItem('conversations') || {};
    let lastActivity = 0;

    for (const sessionId in conversations) {
      const timestamp = conversations[sessionId].timestamp || 0;
      if (timestamp > lastActivity) {
        lastActivity = timestamp;
      }
    }

    return lastActivity ? new Date(lastActivity).toISOString() : null;
  }
}

export default new ConversationPersistence();