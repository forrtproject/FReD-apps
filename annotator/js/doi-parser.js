/**
 * FReD Annotator - DOI Parser
 *
 * Extracts DOIs from text, files, and PDFs
 */

window.FReD = window.FReD || {};

FReD.doiParser = {
  // DOI regex pattern (based on Zotero's pattern)
  DOI_PATTERN: /10(?:\.[0-9]{4,})?\/[^\s]*[^\s.,]/gi,

  /**
   * Extract DOIs from text
   */
  extractFromText(text) {
    if (!text) return [];

    const matches = text.match(this.DOI_PATTERN) || [];

    // Clean up DOIs
    const dois = matches.map(doi => {
      // Remove trailing punctuation
      doi = doi.replace(/[,;.)\]]+$/, '');

      // Handle unbalanced parentheses
      const openCount = (doi.match(/\(/g) || []).length;
      const closeCount = (doi.match(/\)/g) || []).length;
      if (closeCount > openCount && doi.endsWith(')')) {
        doi = doi.slice(0, -1);
      }

      return doi.toLowerCase();
    });

    // Deduplicate
    return [...new Set(dois)];
  },

  /**
   * Extract DOIs from file
   */
  async extractFromFile(file) {
    const filename = file.name.toLowerCase();
    const text = await this.readFile(file);

    if (filename.endsWith('.pdf')) {
      return this.extractFromPDF(file);
    }

    // For text-based files (.bib, .ris, .txt)
    return this.extractFromText(text);
  },

  /**
   * Read file as text
   */
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = e => reject(e);
      reader.readAsText(file);
    });
  },

  /**
   * Extract DOIs from PDF (lazy-loads pdf.js)
   */
  async extractFromPDF(file) {
    // Lazy load PDF.js if not already loaded
    if (!window.pdfjsLib) {
      await this.loadPDFJS();
    }

    try {
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let allText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        allText += pageText + '\n';
      }

      return this.extractFromText(allText);
    } catch (error) {
      console.error('PDF parsing error:', error);
      FReD.utils.showNotification('Failed to parse PDF. Please try pasting the DOIs directly.', 'error');
      return [];
    }
  },

  /**
   * Read file as ArrayBuffer
   */
  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = e => reject(e);
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Load PDF.js library dynamically
   */
  loadPDFJS() {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  /**
   * Validate DOI format
   */
  isValidDOI(doi) {
    return /^10\.\d{4,}/.test(doi);
  },

  /**
   * Format DOI as URL
   */
  toURL(doi) {
    return `https://doi.org/${doi}`;
  },

  /**
   * Extract DOI from URL
   */
  fromURL(url) {
    const match = url.match(/doi\.org\/(.+)/i);
    return match ? match[1].toLowerCase() : null;
  },

  /**
   * Look up DOIs for references using CrossRef API
   * @param {string[]} references - Array of reference strings
   * @param {string} email - Email address for CrossRef API (polite pool)
   * @param {function} onProgress - Optional callback for progress updates
   * @returns {Promise<{results: Array<{reference: string, doi: string|null, confidence: number}>, stats: {found: number, notFound: number}}>}
   */
  async lookupDOIs(references, email, onProgress = null) {
    if (!email || !this.isValidEmail(email)) {
      throw new Error('A valid email is required for CrossRef API access');
    }

    const results = [];
    let found = 0;
    let notFound = 0;

    for (let i = 0; i < references.length; i++) {
      const ref = references[i].trim();
      if (!ref) continue;

      // Skip if reference already contains a DOI
      const existingDOIs = this.extractFromText(ref);
      if (existingDOIs.length > 0) {
        results.push({
          reference: ref,
          doi: existingDOIs[0],
          confidence: 1.0,
          source: 'existing'
        });
        found++;
        if (onProgress) onProgress(i + 1, references.length, ref, existingDOIs[0]);
        continue;
      }

      // Query CrossRef API
      try {
        const result = await this.queryCrossRef(ref, email);
        if (result.doi) {
          results.push({
            reference: ref,
            doi: result.doi,
            confidence: result.confidence,
            source: 'crossref'
          });
          found++;
        } else {
          results.push({
            reference: ref,
            doi: null,
            confidence: 0,
            source: 'not_found'
          });
          notFound++;
        }
        if (onProgress) onProgress(i + 1, references.length, ref, result.doi);
      } catch (error) {
        console.warn(`CrossRef lookup failed for: ${ref}`, error);
        results.push({
          reference: ref,
          doi: null,
          confidence: 0,
          source: 'error',
          error: error.message
        });
        notFound++;
        if (onProgress) onProgress(i + 1, references.length, ref, null);
      }

      // Rate limiting: CrossRef asks for max 50 requests per second for polite pool
      // We'll be conservative with 200ms delay between requests
      if (i < references.length - 1) {
        await this.delay(200);
      }
    }

    return {
      results,
      stats: { found, notFound, total: references.length }
    };
  },

  /**
   * Query CrossRef API for a single reference
   * @param {string} reference - The reference text
   * @param {string} email - Email for polite pool
   * @returns {Promise<{doi: string|null, confidence: number}>}
   */
  async queryCrossRef(reference, email) {
    // Clean up the reference for query
    const cleanRef = reference
      .replace(/\s+/g, ' ')
      .trim();

    const url = new URL('https://api.crossref.org/works');
    url.searchParams.set('query.bibliographic', cleanRef);
    url.searchParams.set('rows', '1');
    url.searchParams.set('mailto', email);

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limited by CrossRef. Please wait and try again.');
      }
      throw new Error(`CrossRef API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.message?.items?.length) {
      return { doi: null, confidence: 0 };
    }

    const item = data.message.items[0];
    const doi = item.DOI?.toLowerCase();
    const score = item.score || 0;

    // CrossRef scores vary widely; we'll consider anything above 50 as a reasonable match
    // and normalize to a 0-1 confidence score
    const confidence = Math.min(score / 100, 1);

    // Only return if confidence is reasonable (score > 30)
    if (score < 30) {
      return { doi: null, confidence: 0 };
    }

    return { doi, confidence };
  },

  /**
   * Validate email format
   */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  /**
   * Delay helper for rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Split text into individual references (one per line, or detect numbered lists)
   */
  splitIntoReferences(text) {
    // Split by newlines first
    let lines = text.split(/\n+/).map(l => l.trim()).filter(l => l);

    // If there's only one line but it looks like multiple refs concatenated,
    // try to split by common reference patterns (e.g., author-year patterns)
    if (lines.length === 1 && lines[0].length > 200) {
      // Try splitting on patterns like "Author, A. (YYYY)" that start a new reference
      const splitPattern = /(?=(?:[A-Z][a-z]+(?:,\s*[A-Z]\.)*(?:\s*(?:&|and)\s*[A-Z][a-z]+(?:,\s*[A-Z]\.)*)*)\s*\(\d{4}\))/g;
      const parts = lines[0].split(splitPattern).filter(p => p.trim());
      if (parts.length > 1) {
        lines = parts.map(p => p.trim());
      }
    }

    // Remove common list prefixes (1., 2., [1], etc.)
    return lines.map(line => line.replace(/^[\[\(]?\d+[\]\).\s]+/, '').trim());
  }
};

window.FReD = FReD;
