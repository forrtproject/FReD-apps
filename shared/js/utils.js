/**
 * FReD Static Apps - Utility Functions
 */

window.FReD = window.FReD || {};

FReD.utils = {
  /**
   * Debounce function calls
   */
  debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Capitalize first letter
   */
  capFirstLetter(text) {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  },

  /**
   * Format number with specified decimal places
   */
  formatNumber(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    return Number(num).toFixed(decimals);
  },

  /**
   * Format p-value
   */
  formatPValue(p) {
    if (p === null || p === undefined || isNaN(p)) return 'N/A';
    if (p < 0.001) return '< .001';
    return p.toFixed(3).replace(/^0/, '');
  },

  /**
   * Extract year from reference string
   */
  extractYear(ref) {
    if (!ref) return null;
    const match = ref.match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0]) : null;
  },

  /**
   * Parse reference string into short "Author (Year)" format
   * Returns { short: "Author (Year)", full: "Full reference" }
   */
  parseReference(ref) {
    if (!ref) return { short: '', full: '' };

    // Clean up HTML entities
    const cleanRef = ref.replace(/&amp;/g, '&').replace(/<[^>]+>/g, '');

    // Extract year - look for (YYYY) pattern
    const yearMatch = cleanRef.match(/\((\d{4})\)/);
    const year = yearMatch ? yearMatch[1] : '';

    // Extract authors - everything before the year
    const beforeYear = yearMatch ? cleanRef.substring(0, yearMatch.index).trim() : cleanRef;

    // Parse author names
    // Common patterns: "LastName, F. I., & LastName2, F. I." or "LastName, F. I., LastName2, F. I., & LastName3, F. I."
    const authors = beforeYear.split(/,\s*&\s*|,\s*(?=[A-Z][a-z]+,)|\s*&\s*/);

    let shortAuthor = '';
    if (authors.length === 0 || !authors[0]) {
      // Fallback: just use first word
      shortAuthor = cleanRef.split(/\s/)[0].replace(/,$/, '');
    } else if (authors.length === 1) {
      // Single author: "LastName"
      shortAuthor = authors[0].split(',')[0].trim();
    } else if (authors.length === 2) {
      // Two authors: "LastName & LastName2"
      const a1 = authors[0].split(',')[0].trim();
      const a2 = authors[1].split(',')[0].trim();
      shortAuthor = `${a1} & ${a2}`;
    } else {
      // 3+ authors: "LastName et al."
      shortAuthor = authors[0].split(',')[0].trim() + ' et al.';
    }

    const short = year ? `${shortAuthor} (${year})` : shortAuthor;

    return { short, full: cleanRef };
  },

  /**
   * Create a reference cell with tooltip
   * @param {string} ref - The full reference string
   * @param {string} doi - Optional DOI for the reference
   * @param {string} url - Optional URL for the reference
   */
  formatReferenceCell(ref, doi, url) {
    const { short, full } = this.parseReference(ref);
    if (!short) return '';
    const escaped = this.escapeHtml(full).replace(/"/g, '&quot;');
    const link = doi ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, '')}` : (url || '');
    const linkEscaped = this.escapeHtml(link).replace(/"/g, '&quot;');
    return `<span class="ref-tooltip" data-tooltip="${escaped}" data-link="${linkEscaped}">${this.escapeHtml(short)}</span>`;
  },

  /**
   * Calculate decade from year
   */
  getDecade(year) {
    if (!year) return null;
    return Math.floor(year / 10) * 10;
  },

  /**
   * Truncate text with ellipsis
   */
  truncate(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  },

  /**
   * Escape HTML entities
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Create element from HTML string
   */
  createElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  },

  /**
   * Group array of objects by key
   */
  groupBy(array, key) {
    return array.reduce((result, item) => {
      const k = typeof key === 'function' ? key(item) : item[key];
      (result[k] = result[k] || []).push(item);
      return result;
    }, {});
  },

  /**
   * Calculate statistics for numeric array
   */
  stats(array) {
    const valid = array.filter(x => x !== null && x !== undefined && !isNaN(x));
    if (valid.length === 0) {
      return { count: 0, mean: null, sd: null, min: null, max: null };
    }
    const count = valid.length;
    const sum = valid.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    const variance = valid.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count;
    const sd = Math.sqrt(variance);
    return {
      count,
      mean,
      sd,
      min: Math.min(...valid),
      max: Math.max(...valid)
    };
  },

  /**
   * Parse URL query parameters
   */
  parseQueryParams() {
    const params = {};
    const searchParams = new URLSearchParams(window.location.search);
    for (const [key, value] of searchParams) {
      params[key] = value;
    }
    return params;
  },

  /**
   * Update URL query parameters without reload
   */
  updateQueryParams(params) {
    const url = new URL(window.location);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    });
    window.history.replaceState({}, '', url);
  },

  /**
   * Show notification toast
   */
  showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notification-container') ||
      (() => {
        const div = document.createElement('div');
        div.id = 'notification-container';
        div.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;';
        document.body.appendChild(div);
        return div;
      })();

    const toast = document.createElement('div');
    toast.className = `alert alert-${type}`;
    toast.style.cssText = 'min-width:250px;margin-bottom:0.5rem;animation:slideIn 0.3s ease;';
    toast.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span>${FReD.utils.escapeHtml(message)}</span>
        <button style="background:none;border:none;cursor:pointer;font-size:1.25rem;line-height:1;" onclick="this.parentElement.parentElement.remove()">&times;</button>
      </div>
    `;
    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => toast.remove(), duration);
    }
  },

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      FReD.utils.showNotification('Copied to clipboard!', 'info', 2000);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      FReD.utils.showNotification('Failed to copy', 'error', 2000);
      return false;
    }
  },

  /**
   * Download data as file
   */
  downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Download data as CSV
   */
  downloadCSV(data, filename) {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(h => {
          let val = row[h];
          if (val === null || val === undefined) val = '';
          val = String(val);
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            val = '"' + val.replace(/"/g, '""') + '"';
          }
          return val;
        }).join(',')
      )
    ];
    FReD.utils.downloadFile(csvRows.join('\n'), filename, 'text/csv');
  },

  /**
   * Simple template rendering
   */
  render(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? FReD.utils.escapeHtml(String(data[key])) : match;
    });
  }
};

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;
document.head.appendChild(style);

window.FReD = FReD;
