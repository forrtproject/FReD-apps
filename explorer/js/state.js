/**
 * FReD Explorer - URL State Management
 *
 * Handles syncing filter state with URL parameters for shareable links
 */

window.FReD = window.FReD || {};

FReD.state = {
  // Default state
  defaults: {
    source: 'All studies',
    minPower: 0.05,
    criterion: 'significance_r',
    search: '',
    tab: 'overview'
  },

  // Current state
  current: {},

  // Listeners for state changes
  listeners: [],

  /**
   * Initialize state from URL or defaults
   */
  init() {
    this.current = { ...this.defaults };
    this.loadFromURL();

    // Listen for browser back/forward
    window.addEventListener('popstate', () => {
      this.loadFromURL();
      this.notifyListeners();
    });
  },

  /**
   * Load state from URL parameters
   */
  loadFromURL() {
    const params = FReD.utils.parseQueryParams();

    if (params.source) {
      this.current.source = params.source;
    }
    if (params.power) {
      const power = parseFloat(params.power);
      if (!isNaN(power) && power >= 0.05 && power <= 0.999) {
        this.current.minPower = power;
      }
    }
    if (params.criterion && FReD.successCriteria.criteria[params.criterion]) {
      this.current.criterion = params.criterion;
    }
    if (params.search) {
      this.current.search = params.search;
    }
    if (params.tab) {
      this.current.tab = params.tab;
    }
  },

  /**
   * Save current state to URL
   */
  saveToURL() {
    const params = {};

    // Only save non-default values
    if (this.current.source !== this.defaults.source) {
      params.source = this.current.source;
    }
    if (this.current.minPower !== this.defaults.minPower) {
      params.power = this.current.minPower;
    }
    if (this.current.criterion !== this.defaults.criterion) {
      params.criterion = this.current.criterion;
    }
    if (this.current.search !== this.defaults.search) {
      params.search = this.current.search;
    }
    if (this.current.tab !== this.defaults.tab) {
      params.tab = this.current.tab;
    }

    FReD.utils.updateQueryParams(params);
  },

  /**
   * Get current state
   */
  get(key) {
    return key ? this.current[key] : { ...this.current };
  },

  /**
   * Set state value(s)
   */
  set(keyOrObj, value) {
    const changes = typeof keyOrObj === 'string'
      ? { [keyOrObj]: value }
      : keyOrObj;

    let hasChanges = false;
    Object.entries(changes).forEach(([k, v]) => {
      if (this.current[k] !== v) {
        this.current[k] = v;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.saveToURL();
      this.notifyListeners(changes);
    }
  },

  /**
   * Reset to defaults
   */
  reset() {
    this.current = { ...this.defaults };
    this.saveToURL();
    this.notifyListeners(this.defaults);
  },

  /**
   * Add state change listener
   */
  onChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  },

  /**
   * Notify all listeners of state change
   */
  notifyListeners(changes = this.current) {
    this.listeners.forEach(callback => {
      try {
        callback(changes, this.current);
      } catch (err) {
        console.error('State listener error:', err);
      }
    });
  },

  /**
   * Get shareable URL for current state
   */
  getShareableURL() {
    return window.location.href;
  }
};

window.FReD = FReD;
