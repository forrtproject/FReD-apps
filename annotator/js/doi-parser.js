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
  }
};

window.FReD = FReD;
