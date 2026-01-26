/**
 * FReD Theme Toggle
 *
 * Handles dark/light mode switching with localStorage persistence
 * and system preference detection
 */

window.FReD = window.FReD || {};

FReD.themeToggle = {
  storageKey: 'fred-theme',

  /**
   * Initialize theme based on stored preference or system preference
   */
  init() {
    const stored = localStorage.getItem(this.storageKey);

    if (stored) {
      this.setTheme(stored);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setTheme(prefersDark ? 'dark' : 'light');
    }

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(this.storageKey)) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });

    // Setup toggle buttons
    this.setupToggleButtons();
  },

  /**
   * Set the theme
   */
  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.storageKey, theme);

    // Dispatch event for charts to re-render
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  },

  /**
   * Get current theme
   */
  getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  },

  /**
   * Toggle between light and dark
   */
  toggle() {
    const current = this.getTheme();
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  },

  /**
   * Setup click handlers for toggle buttons
   */
  setupToggleButtons() {
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.addEventListener('click', () => this.toggle());
    });
  },

  /**
   * Check if currently dark mode
   */
  isDark() {
    return this.getTheme() === 'dark';
  },

  /**
   * Get Plotly layout colors for current theme
   * Use this when creating/updating Plotly charts
   */
  getPlotlyLayout() {
    const isDark = this.isDark();

    return {
      paper_bgcolor: isDark ? '#1E293B' : '#FFFFFF',
      plot_bgcolor: isDark ? '#1E293B' : '#FFFFFF',
      font: {
        color: isDark ? '#F1F5F9' : '#212529'
      },
      xaxis: {
        gridcolor: isDark ? '#334155' : '#E5E3D8',
        linecolor: isDark ? '#334155' : '#E5E3D8',
        tickcolor: isDark ? '#334155' : '#E5E3D8',
        zerolinecolor: isDark ? '#475569' : '#D5D3C8'
      },
      yaxis: {
        gridcolor: isDark ? '#334155' : '#E5E3D8',
        linecolor: isDark ? '#334155' : '#E5E3D8',
        tickcolor: isDark ? '#334155' : '#E5E3D8',
        zerolinecolor: isDark ? '#475569' : '#D5D3C8'
      },
      legend: {
        bgcolor: 'transparent',
        font: {
          color: isDark ? '#CBD5E1' : '#212529'
        }
      }
    };
  },

  /**
   * Merge theme layout with custom layout
   */
  mergeLayout(customLayout) {
    const themeLayout = this.getPlotlyLayout();

    return {
      ...customLayout,
      paper_bgcolor: themeLayout.paper_bgcolor,
      plot_bgcolor: themeLayout.plot_bgcolor,
      font: { ...customLayout.font, ...themeLayout.font },
      xaxis: { ...customLayout.xaxis, ...themeLayout.xaxis },
      yaxis: { ...customLayout.yaxis, ...themeLayout.yaxis },
      legend: { ...customLayout.legend, ...themeLayout.legend }
    };
  }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => FReD.themeToggle.init());
} else {
  FReD.themeToggle.init();
}

window.FReD = FReD;
