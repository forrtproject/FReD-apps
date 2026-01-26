/**
 * FReD Annotator - Retraction Checker
 *
 * Loads Retraction Watch data on demand and checks DOIs for retractions
 */

window.FReD = window.FReD || {};

FReD.retractionChecker = {
  // Retraction Watch data URL (local gzipped copy updated weekly via GitHub Actions)
  dataUrl: '../data/retraction-watch.csv.gz',

  // Cached retraction data (DOI -> retraction info)
  retractionMap: null,

  // Loading state
  isLoading: false,
  isLoaded: false,

  /**
   * Load retraction data from Retraction Watch CSV
   * @returns {Promise<Map>} Map of DOI -> retraction info
   */
  async loadData() {
    if (this.isLoaded && this.retractionMap) {
      return this.retractionMap;
    }

    if (this.isLoading) {
      // Wait for existing load to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.retractionMap;
    }

    this.isLoading = true;
    console.log('Loading Retraction Watch data...');

    try {
      const response = await fetch(this.dataUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Decompress gzipped data
      const compressedData = await response.arrayBuffer();
      const decompressed = pako.ungzip(new Uint8Array(compressedData));
      const csvText = new TextDecoder().decode(decompressed);

      this.retractionMap = this.parseCSV(csvText);
      this.isLoaded = true;

      console.log(`Loaded ${this.retractionMap.size} retraction records`);
      return this.retractionMap;

    } catch (error) {
      console.error('Failed to load Retraction Watch data:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  },

  /**
   * Parse Retraction Watch CSV into a map
   * CSV columns: Record ID, Title, Subject, Institution, Journal, Publisher, Country,
   *              Author, URLS, ArticleType, RetractionDate, RetractionDOI,
   *              OriginalPaperDOI, RetractionNature, Reason, Paywalled, Notes
   */
  parseCSV(csvText) {
    const map = new Map();
    const lines = csvText.split('\n');

    if (lines.length < 2) {
      return map;
    }

    // Parse header to find column indices
    const header = this.parseCSVLine(lines[0]);
    const doiIndex = header.findIndex(h => h.toLowerCase().includes('originalpaperdoi'));
    const titleIndex = header.findIndex(h => h.toLowerCase() === 'title');
    const retractionDateIndex = header.findIndex(h => h.toLowerCase().includes('retractiondate'));
    const reasonIndex = header.findIndex(h => h.toLowerCase() === 'reason');
    const retractionNatureIndex = header.findIndex(h => h.toLowerCase().includes('retractionnature'));

    if (doiIndex === -1) {
      console.warn('Could not find OriginalPaperDOI column');
      return map;
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = this.parseCSVLine(line);
        const doi = (values[doiIndex] || '').trim().toLowerCase();

        if (doi && doi !== 'na' && doi !== 'n/a') {
          // Normalize DOI (remove URL prefix if present)
          const normalizedDoi = this.normalizeDOI(doi);

          if (normalizedDoi) {
            map.set(normalizedDoi, {
              doi: normalizedDoi,
              title: values[titleIndex] || '',
              retractionDate: values[retractionDateIndex] || '',
              reason: values[reasonIndex] || '',
              nature: values[retractionNatureIndex] || ''
            });
          }
        }
      } catch (e) {
        // Skip malformed lines
        continue;
      }
    }

    return map;
  },

  /**
   * Parse a CSV line handling quoted fields
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  },

  /**
   * Normalize a DOI string
   */
  normalizeDOI(doi) {
    if (!doi) return null;

    // Remove URL prefix
    let normalized = doi
      .replace(/^https?:\/\/doi\.org\//i, '')
      .replace(/^doi:/i, '')
      .trim()
      .toLowerCase();

    // Validate DOI format (starts with 10.)
    if (normalized.startsWith('10.')) {
      return normalized;
    }

    return null;
  },

  /**
   * Check a single DOI for retraction
   * @param {string} doi - DOI to check
   * @returns {object|null} Retraction info if retracted, null otherwise
   */
  checkDOI(doi) {
    if (!this.retractionMap || !doi) return null;

    const normalized = this.normalizeDOI(doi);
    if (!normalized) return null;

    return this.retractionMap.get(normalized) || null;
  },

  /**
   * Check multiple DOIs for retractions
   * @param {string[]|Set} dois - DOIs to check
   * @returns {Map} Map of DOI -> retraction info for retracted articles
   */
  checkDOIs(dois) {
    const results = new Map();

    if (!this.retractionMap) return results;

    const doiArray = Array.isArray(dois) ? dois : [...dois];

    doiArray.forEach(doi => {
      const info = this.checkDOI(doi);
      if (info) {
        results.set(doi.toLowerCase(), info);
      }
    });

    return results;
  },

  /**
   * Reset the checker (for testing or re-loading)
   */
  reset() {
    this.retractionMap = null;
    this.isLoaded = false;
    this.isLoading = false;
  }
};

window.FReD = FReD;
