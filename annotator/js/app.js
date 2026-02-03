/**
 * FLoRA Annotator - Main Application
 *
 * Coordinates all components of the Annotator app
 */

window.FReD = window.FReD || {};

FReD.annotator = {
  // Data
  floraData: null,
  selectedDOIs: new Set(),
  inputDOIs: new Set(),  // DOIs from text input or file (not manual selection)
  matchedStudies: [],

  // Retraction data
  retractedDOIs: new Map(),  // DOI -> retraction info
  checkRetractions: false,   // Whether retraction checking is enabled

  // DataTables
  resultsTable: null,
  databaseTable: null,

  /**
   * Initialize the application
   */
  async init() {
    console.log('Initializing FLoRA Annotator...');

    // Show welcome modal (unless user opted out)
    this.initWelcomeModal();

    // Setup event listeners
    this.setupEventListeners();

    // Setup tabs
    this.setupTabs();

    // Setup reference tooltips
    this.setupTooltips();

    // Listen for theme changes
    window.addEventListener('themechange', () => {
      this.updateResults();
    });

    // Load data
    try {
      await this.loadData();
    } catch (error) {
      console.error('Failed to load data:', error);
      FReD.utils.showNotification('Failed to load data. Please try refreshing.', 'error');
    }

    // Load citation
    this.loadCitation();
  },

  /**
   * Initialize welcome modal with "don't show again" functionality
   */
  initWelcomeModal() {
    const STORAGE_KEY = 'flora-annotator-welcome-dismissed';
    const modal = document.getElementById('welcome-modal');
    const closeBtn = document.getElementById('welcome-close-btn');
    const dontShowCheckbox = document.getElementById('welcome-dont-show');

    // Check if user has opted out
    if (localStorage.getItem(STORAGE_KEY) === 'true') {
      return; // Don't show modal
    }

    // Show modal
    modal.classList.add('active');

    // Handle close button
    closeBtn?.addEventListener('click', () => {
      if (dontShowCheckbox?.checked) {
        localStorage.setItem(STORAGE_KEY, 'true');
      }
      modal.classList.remove('active');
    });
  },

  /**
   * Load citation from FReD-data repo
   */
  async loadCitation() {
    const citationEl = document.getElementById('citation');
    if (!citationEl) return;

    try {
      const response = await fetch('https://raw.githubusercontent.com/forrtproject/FReD-data/refs/heads/main/output/citation.txt');
      if (response.ok) {
        const citation = await response.text();
        citationEl.textContent = citation.trim();
      } else {
        citationEl.textContent = 'Citation unavailable.';
      }
    } catch (error) {
      console.error('Failed to load citation:', error);
      citationEl.textContent = 'Citation unavailable.';
    }
  },

  /**
   * Load FLoRA data
   */
  async loadData() {
    console.log('Loading FLoRA data...');

    this.floraData = await FReD.dataLoader.loadFloraData();
    console.log(`Loaded ${this.floraData.entries?.length || 0} entries`);

    // Update metadata
    if (this.floraData.metadata) {
      document.getElementById('data-updated').textContent =
        new Date(this.floraData.metadata.generated).toLocaleDateString();
    }

    // Initialize database browser table
    this.initDatabaseTable();
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Process button (initial state)
    document.getElementById('btn-process')?.addEventListener('click', () => {
      this.processInput();
    });

    // Add to selection button (shown after DOIs added)
    document.getElementById('btn-add-refs')?.addEventListener('click', () => {
      this.processInput(false); // Add mode
    });

    // Replace selection button (shown after DOIs added)
    document.getElementById('btn-replace-refs')?.addEventListener('click', () => {
      this.processInput(true); // Replace mode
    });

    // Clear button
    document.getElementById('btn-clear')?.addEventListener('click', () => {
      this.clearInput();
    });

    // File upload
    document.getElementById('file-upload')?.addEventListener('change', (e) => {
      const fileChosen = document.getElementById('file-chosen');
      if (e.target.files.length > 0) {
        if (fileChosen) {
          fileChosen.textContent = e.target.files[0].name;
        }
        this.processFile(e.target.files[0]);
      } else {
        if (fileChosen) {
          fileChosen.textContent = 'No file chosen';
        }
      }
    });

    // PDF URL fetch
    document.getElementById('btn-fetch-pdf')?.addEventListener('click', () => {
      this.fetchPdfFromUrl();
    });

    // Allow Enter key to trigger PDF fetch
    document.getElementById('pdf-url-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.fetchPdfFromUrl();
      }
    });

    // Toggle DOIs display
    document.getElementById('btn-toggle-dois')?.addEventListener('click', () => {
      const body = document.getElementById('doi-preview-body');
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
    });

    // Copy DOIs
    document.getElementById('btn-copy-dois')?.addEventListener('click', () => {
      const dois = [...this.selectedDOIs].join('\n');
      FReD.utils.copyToClipboard(dois);
    });

    // DOI Lookup via CrossRef
    document.getElementById('btn-lookup-dois')?.addEventListener('click', () => {
      this.lookupDOIs();
    });

    // Report buttons
    document.getElementById('btn-copy-report')?.addEventListener('click', () => {
      const reportHtml = document.getElementById('report-container').innerHTML;
      FReD.utils.copyToClipboard(FReD.reportGenerator.htmlToText(reportHtml));
    });

    document.getElementById('btn-copy-markdown')?.addEventListener('click', () => {
      const mdSource = document.getElementById('markdown-source');
      FReD.utils.copyToClipboard(mdSource.textContent);
    });

    document.getElementById('btn-print')?.addEventListener('click', () => {
      window.print();
    });

    // About modal link
    const aboutLink = document.getElementById('about-link');
    if (aboutLink) {
      aboutLink.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('about-modal')?.classList.add('active');
      });
    }
  },

  /**
   * Setup tab navigation
   */
  setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        this.switchTab(tabId);
      });
    });
  },

  /**
   * Setup reference tooltips for the results table
   */
  setupTooltips() {
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip-popup';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    let hideTimeout = null;
    let currentTarget = null;

    const showTooltip = (target) => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }

      currentTarget = target;
      const text = target.dataset.tooltip;
      const link = target.dataset.link;

      // Build tooltip content with buttons
      let html = `<div class="tooltip-text">${FReD.utils.escapeHtml(text)}</div>`;
      html += `<div class="tooltip-actions">`;
      html += `<button class="tooltip-btn tooltip-copy" title="Copy reference">📋 Copy</button>`;
      if (link) {
        html += `<a href="${FReD.utils.escapeHtml(link)}" target="_blank" class="tooltip-btn tooltip-link" title="Open paper">🔗 Open</a>`;
      }
      html += `</div>`;

      tooltip.innerHTML = html;
      tooltip.style.display = 'block';

      // Position tooltip
      const rect = target.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      let top = rect.top - tooltipRect.height - 8;
      let left = rect.left;

      if (top < 10) {
        top = rect.bottom + 8;
      }

      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
      }
      if (left < 10) left = 10;

      tooltip.style.top = top + 'px';
      tooltip.style.left = left + 'px';

      // Setup copy button
      tooltip.querySelector('.tooltip-copy')?.addEventListener('click', () => {
        navigator.clipboard.writeText(text).then(() => {
          const btn = tooltip.querySelector('.tooltip-copy');
          btn.textContent = '✓ Copied!';
          setTimeout(() => { btn.textContent = '📋 Copy'; }, 1500);
        });
      });
    };

    const hideTooltip = () => {
      hideTimeout = setTimeout(() => {
        tooltip.style.display = 'none';
        currentTarget = null;
      }, 150);
    };

    // Show on hover over reference
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('.ref-tooltip');
      if (target && target.dataset.tooltip) {
        showTooltip(target);
      }
    });

    // Hide when leaving reference (with delay)
    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('.ref-tooltip');
      if (target) {
        hideTooltip();
      }
    });

    // Keep visible when hovering over tooltip
    tooltip.addEventListener('mouseenter', () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
    });

    // Hide when leaving tooltip
    tooltip.addEventListener('mouseleave', () => {
      hideTooltip();
    });
  },

  /**
   * Switch to a tab
   */
  switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabId}`);
    });

    // Update content based on tab
    if (tabId === 'report') {
      this.updateReport();
    }
  },

  /**
   * Look up DOIs via CrossRef for references without DOIs
   */
  async lookupDOIs() {
    const textInput = document.getElementById('reference-input').value;
    const emailInput = document.getElementById('crossref-email');
    const lookupBtn = document.getElementById('btn-lookup-dois');
    const email = emailInput?.value?.trim();

    if (!textInput.trim()) {
      FReD.utils.showNotification('Please enter some references first.', 'warning');
      return;
    }

    if (!email || !FReD.doiParser.isValidEmail(email)) {
      FReD.utils.showNotification('Please enter a valid email address (required by CrossRef).', 'warning');
      emailInput?.focus();
      return;
    }

    // Parse references from the input
    const references = FReD.doiParser.splitIntoReferences(textInput);

    if (references.length === 0) {
      FReD.utils.showNotification('No references found to look up.', 'warning');
      return;
    }

    // Count how many already have DOIs
    const withoutDOIs = references.filter(ref => FReD.doiParser.extractFromText(ref).length === 0);

    if (withoutDOIs.length === 0) {
      FReD.utils.showNotification('All references already contain DOIs!', 'info');
      return;
    }

    // Disable button and show progress
    const originalText = lookupBtn.textContent;
    lookupBtn.disabled = true;
    lookupBtn.textContent = `Looking up (0/${withoutDOIs.length})...`;

    try {
      // Progress callback
      let processed = 0;
      const onProgress = (current, total, ref, doi) => {
        // Only count references that needed lookup
        if (!FReD.doiParser.extractFromText(ref).some(d => d === doi)) {
          processed++;
        }
        lookupBtn.textContent = `Looking up (${processed}/${withoutDOIs.length})...`;
      };

      const { results, stats } = await FReD.doiParser.lookupDOIs(references, email, onProgress);

      // Update the text input with DOIs added
      const updatedText = this.augmentReferencesWithDOIs(textInput, results);
      document.getElementById('reference-input').value = updatedText;

      // Show results
      const newlyFound = results.filter(r => r.source === 'crossref').length;
      const existing = results.filter(r => r.source === 'existing').length;

      let message = `DOI lookup complete: ${newlyFound} DOI(s) found via CrossRef`;
      if (existing > 0) {
        message += `, ${existing} already had DOIs`;
      }
      if (stats.notFound > 0) {
        message += `, ${stats.notFound} not found`;
      }

      FReD.utils.showNotification(message, newlyFound > 0 ? 'success' : 'info');

    } catch (error) {
      console.error('DOI lookup error:', error);
      FReD.utils.showNotification(`DOI lookup failed: ${error.message}`, 'error');
    } finally {
      lookupBtn.disabled = false;
      lookupBtn.textContent = originalText;
    }
  },

  /**
   * Augment reference text with found DOIs
   */
  augmentReferencesWithDOIs(originalText, results) {
    // Create a map of reference -> DOI for newly found DOIs
    const doiMap = new Map();
    results.forEach(r => {
      if (r.doi && r.source === 'crossref') {
        doiMap.set(r.reference, r.doi);
      }
    });

    if (doiMap.size === 0) {
      return originalText;
    }

    // Split text into lines and augment those that got DOIs
    const lines = originalText.split('\n');
    const updatedLines = lines.map(line => {
      const trimmed = line.trim();
      // Check if this line matches any reference that got a DOI
      for (const [ref, doi] of doiMap.entries()) {
        // Simple matching: check if the line contains the reference or vice versa
        if (trimmed && (trimmed.includes(ref) || ref.includes(trimmed))) {
          // Don't add if already has this DOI
          if (!line.toLowerCase().includes(doi)) {
            return `${line} https://doi.org/${doi}`;
          }
        }
      }
      return line;
    });

    return updatedLines.join('\n');
  },

  /**
   * Process text input
   * @param {boolean} replace - If true, replace existing selection; if false, add to it
   */
  async processInput(replace = false) {
    const textInput = document.getElementById('reference-input').value;

    if (!textInput.trim()) {
      FReD.utils.showNotification('Please enter some references or DOIs.', 'warning');
      return;
    }

    const dois = FReD.doiParser.extractFromText(textInput);

    if (replace) {
      // Clear existing DOIs before adding new ones
      this.selectedDOIs.clear();
      this.inputDOIs.clear();
      this.matchedStudies = [];
      this.retractedDOIs.clear();
    }

    // Update retraction check setting from checkbox
    this.checkRetractions = document.getElementById('check-retractions')?.checked || false;

    await this.addDOIs(dois);

    const action = replace ? 'Replaced with' : 'Found';
    FReD.utils.showNotification(`${action} ${dois.length} DOI(s) from text input.`, 'info');

    // Switch to selection tab
    this.switchTab('selection');
  },

  /**
   * Process uploaded file
   */
  async processFile(file) {
    FReD.utils.showNotification(`Processing ${file.name}...`, 'info');

    // Update retraction check setting from checkbox
    this.checkRetractions = document.getElementById('check-retractions')?.checked || false;

    try {
      const dois = await FReD.doiParser.extractFromFile(file);
      await this.addDOIs(dois);
      FReD.utils.showNotification(`Found ${dois.length} DOI(s) from ${file.name}.`, 'info');
      this.switchTab('selection');
    } catch (error) {
      console.error('File processing error:', error);
      FReD.utils.showNotification('Failed to process file.', 'error');
    }
  },

  /**
   * Fetch and process PDF from URL
   */
  async fetchPdfFromUrl() {
    const urlInput = document.getElementById('pdf-url-input');
    const fetchBtn = document.getElementById('btn-fetch-pdf');
    const url = urlInput?.value?.trim();

    if (!url) {
      FReD.utils.showNotification('Please enter a PDF URL.', 'warning');
      urlInput?.focus();
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      FReD.utils.showNotification('Please enter a valid URL.', 'warning');
      urlInput?.focus();
      return;
    }

    // Update retraction check setting from checkbox
    this.checkRetractions = document.getElementById('check-retractions')?.checked || false;

    // Disable button and show loading state
    const originalText = fetchBtn.textContent;
    fetchBtn.disabled = true;
    fetchBtn.textContent = 'Fetching...';

    try {
      FReD.utils.showNotification('Fetching PDF from URL...', 'info');
      const dois = await FReD.doiParser.extractFromPDFUrl(url);

      if (dois.length === 0) {
        FReD.utils.showNotification('No DOIs found in the PDF. The document may not contain DOI references.', 'warning');
      } else {
        await this.addDOIs(dois);
        FReD.utils.showNotification(`Found ${dois.length} DOI(s) from PDF.`, 'success');
        this.switchTab('selection');
        // Clear the URL input on success
        urlInput.value = '';
      }
    } catch (error) {
      console.error('PDF URL fetch error:', error);
      let errorMsg = error.message || 'Failed to fetch or parse PDF.';
      // Make the error more user-friendly
      if (errorMsg.includes('Try downloading')) {
        // Already a user-friendly message from fetchWithCorsProxy
      } else if (errorMsg.includes('HTTP') || errorMsg.includes('403') || errorMsg.includes('blocked')) {
        errorMsg = 'The server blocked the request. Try downloading the PDF and uploading it instead.';
      } else if (errorMsg.includes('CORS') || errorMsg.includes('network') || errorMsg.includes('Failed to fetch')) {
        errorMsg = 'Could not fetch the PDF due to network restrictions. Try downloading the PDF and uploading it instead.';
      }
      FReD.utils.showNotification(errorMsg, 'error');
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.textContent = originalText;
    }
  },

  /**
   * Add DOIs to selection (from text input or file)
   */
  async addDOIs(dois) {
    dois.forEach(doi => {
      const normalizedDoi = doi.toLowerCase();
      this.selectedDOIs.add(normalizedDoi);
      this.inputDOIs.add(normalizedDoi);  // Track as user-provided input
    });
    this.updateDOIPreview();
    this.updateProcessButtons();
    this.matchStudies();

    // Check for retractions if enabled
    if (this.checkRetractions) {
      await this.checkForRetractions();
    }

    this.updateResults();
  },

  /**
   * Check selected DOIs for retractions
   */
  async checkForRetractions() {
    const btn = document.getElementById('btn-process');
    const addBtn = document.getElementById('btn-add-refs');
    const replaceBtn = document.getElementById('btn-replace-refs');

    // Disable buttons during check
    [btn, addBtn, replaceBtn].forEach(b => {
      if (b) b.disabled = true;
    });

    try {
      FReD.utils.showNotification('Loading Retraction Watch database...', 'info');

      // Load retraction data if not already loaded
      await FReD.retractionChecker.loadData();

      // Check all selected DOIs
      this.retractedDOIs = FReD.retractionChecker.checkDOIs(this.selectedDOIs);

      if (this.retractedDOIs.size > 0) {
        FReD.utils.showNotification(
          `Found ${this.retractedDOIs.size} retracted article(s).`,
          'warning'
        );
      } else {
        FReD.utils.showNotification('No retracted articles found.', 'success');
      }

    } catch (error) {
      console.error('Retraction check failed:', error);
      FReD.utils.showNotification(
        'Failed to check for retractions. The Retraction Watch database may be unavailable.',
        'error'
      );
    } finally {
      // Re-enable buttons
      [btn, addBtn, replaceBtn].forEach(b => {
        if (b) b.disabled = false;
      });
    }
  },

  /**
   * Update process button visibility based on whether DOIs have been added
   */
  updateProcessButtons() {
    const btnProcess = document.getElementById('btn-process');
    const btnAdd = document.getElementById('btn-add-refs');
    const btnReplace = document.getElementById('btn-replace-refs');

    const hasDOIs = this.selectedDOIs.size > 0;

    if (btnProcess) btnProcess.style.display = hasDOIs ? 'none' : '';
    if (btnAdd) btnAdd.style.display = hasDOIs ? '' : 'none';
    if (btnReplace) btnReplace.style.display = hasDOIs ? '' : 'none';
  },

  /**
   * Clear input and selection
   */
  clearInput() {
    document.getElementById('reference-input').value = '';
    document.getElementById('file-upload').value = '';
    document.getElementById('pdf-url-input').value = '';
    const fileChosen = document.getElementById('file-chosen');
    if (fileChosen) {
      fileChosen.textContent = 'No file chosen';
    }
    this.selectedDOIs.clear();
    this.inputDOIs.clear();
    this.matchedStudies = [];
    this.retractedDOIs.clear();
    this.updateDOIPreview();
    this.updateProcessButtons();
    this.updateResults();
  },

  /**
   * Update DOI preview display
   */
  updateDOIPreview() {
    const card = document.getElementById('doi-preview-card');
    const list = document.getElementById('doi-list');

    if (this.selectedDOIs.size > 0) {
      card.style.display = 'block';
      list.textContent = [...this.selectedDOIs].join('\n');
    } else {
      card.style.display = 'none';
    }
  },

  /**
   * Match DOIs to FLoRA database
   */
  matchStudies() {
    this.matchedStudies = [];

    if (!this.floraData?.entries) return;

    const doiSet = this.selectedDOIs;

    this.floraData.entries.forEach(entry => {
      if (entry.doi_original && doiSet.has(entry.doi_original.toLowerCase())) {
        // Flatten replications
        entry.replications?.forEach(rep => {
          this.matchedStudies.push({
            doi_original: entry.doi_original,
            ref_original: entry.ref_original,
            title_original: entry.title_original,
            year_original: entry.year_original,
            ...rep
          });
        });
      }
    });
  },

  /**
   * Update results display
   */
  updateResults() {
    this.updateCoverageNote();
    this.updateResultsTable();
    this.updateOutcomeChart();
  },

  /**
   * Update coverage display - text note showing DOI coverage
   */
  updateCoverageNote() {
    const container = document.getElementById('coverage-chart');
    if (!container) return;

    // If no DOIs at all, hide the container
    if (this.selectedDOIs.size === 0) {
      container.innerHTML = '';
      return;
    }

    // Count input DOIs that have replications in FLoRA
    const matchedOriginalDOIs = new Set(this.matchedStudies.map(s => s.doi_original?.toLowerCase()));
    const inputWithReplications = [...this.inputDOIs].filter(doi => matchedOriginalDOIs.has(doi)).length;

    // Count manually selected DOIs (from database table, not from input)
    const manuallySelected = [...this.selectedDOIs].filter(doi => !this.inputDOIs.has(doi)).length;

    // Build the text note
    let noteHtml = '<p style="font-size: 0.9rem; color: var(--fred-text); margin: 0;">';

    if (this.inputDOIs.size > 0) {
      noteHtml += `Of <strong>${this.inputDOIs.size}</strong> provided DOI${this.inputDOIs.size !== 1 ? 's' : ''}, <strong>${inputWithReplications}</strong> ${inputWithReplications === 1 ? 'has' : 'have'} replications in FLoRA`;

      // Add retraction info
      if (this.retractedDOIs.size > 0) {
        noteHtml += ` and <strong class="retraction-count">${this.retractedDOIs.size}</strong> ${this.retractedDOIs.size === 1 ? 'has' : 'have'} been retracted`;
      }
      noteHtml += '.';
    }

    if (manuallySelected > 0) {
      if (this.inputDOIs.size > 0) {
        noteHtml += ` <strong>${manuallySelected}</strong> additional ${manuallySelected === 1 ? 'study has' : 'studies have'} been manually selected.`;
      } else {
        noteHtml += `<strong>${manuallySelected}</strong> ${manuallySelected === 1 ? 'study has' : 'studies have'} been manually selected from the database.`;
      }
    }

    noteHtml += '</p>';
    container.innerHTML = noteHtml;
  },

  /**
   * Update results table - simplified for FLoRA data
   */
  updateResultsTable() {
    const tableData = this.matchedStudies.map(study => {
      // Format outcome with color
      const outcome = study.outcome || 'Not coded';
      const outcomeClass = this.getOutcomeClass(outcome);

      return [
        FReD.utils.formatReferenceCell(study.ref_original, study.doi_original) ||
          (study.doi_original ? `<a href="https://doi.org/${study.doi_original}" target="_blank">${study.doi_original}</a>` : ''),
        FReD.utils.formatReferenceCell(study.ref_replication, study.doi_replication) ||
          (study.doi_replication ? `<a href="https://doi.org/${study.doi_replication}" target="_blank">${study.doi_replication}</a>` : ''),
        `<span class="outcome-badge ${outcomeClass}">${FReD.utils.escapeHtml(outcome)}</span>`
      ];
    });

    if (this.resultsTable) {
      this.resultsTable.clear();
      this.resultsTable.rows.add(tableData);
      this.resultsTable.draw();
    } else {
      this.resultsTable = $('#results-table').DataTable({
        data: tableData,
        columns: [
          { title: 'Original' },
          { title: 'Replication' },
          { title: 'Outcome' }
        ],
        pageLength: 10,
        scrollX: true,
        language: {
          emptyTable: 'No matching studies found. Try adding more DOIs.'
        }
      });
    }
  },

  /**
   * Get CSS class for outcome
   */
  getOutcomeClass(outcome) {
    if (!outcome) return 'not-coded';
    const lower = outcome.toLowerCase();
    if (lower.includes('success') || lower.includes('replicated')) return 'success';
    if (lower.includes('fail') || lower.includes('not replicated')) return 'failure';
    if (lower.includes('mixed')) return 'mixed';
    return 'not-coded';
  },

  /**
   * Categorize outcome into one of: success, mixed, failed, other
   */
  getOutcomeCategory(outcome) {
    if (!outcome) return 'other';
    const lower = outcome.toLowerCase();
    if (lower.includes('success') || (lower.includes('replicated') && !lower.includes('not'))) {
      return 'success';
    }
    if (lower.includes('mixed') || lower.includes('informative')) {
      return 'mixed';
    }
    if (lower.includes('fail') || lower.includes('not replicated')) {
      return 'failed';
    }
    return 'other';
  },

  /**
   * Update outcome chart - horizontal stacked bar
   */
  updateOutcomeChart() {
    const container = document.getElementById('outcome-chart');
    if (!container || this.matchedStudies.length === 0) {
      if (container) container.innerHTML = '';
      return;
    }

    // Count outcomes by category
    const categoryCounts = { success: 0, mixed: 0, failed: 0, other: 0 };
    const categoryLabels = { success: [], mixed: [], failed: [], other: [] };

    this.matchedStudies.forEach(study => {
      const outcome = study.outcome || 'Not coded';
      const category = this.getOutcomeCategory(outcome);
      categoryCounts[category]++;
      if (!categoryLabels[category].includes(outcome)) {
        categoryLabels[category].push(outcome);
      }
    });

    const total = this.matchedStudies.length;

    // Use theme-aware colors that match badges
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // Fixed order: success, mixed, failed, other
    const categoryOrder = ['success', 'mixed', 'failed', 'other'];
    const categoryColors = isDark ? {
      success: '#166534',
      mixed: '#A16207',
      failed: '#991B1B',
      other: '#334155'
    } : {
      success: '#8FBC8F',
      mixed: '#EAB308',
      failed: '#F08080',
      other: '#C8C8C8'
    };
    const categoryNames = {
      success: 'successful',
      mixed: 'mixed',
      failed: 'failed',
      other: 'other'
    };

    // Create stacked bar traces in fixed order
    const traces = categoryOrder
      .filter(cat => categoryCounts[cat] > 0)
      .map(category => {
        const count = categoryCounts[category];
        const proportion = count / total;
        const percentage = (proportion * 100).toFixed(1);
        const showLabel = proportion >= 0.1;

        return {
          x: [proportion],
          y: [''],
          type: 'bar',
          orientation: 'h',
          name: `${categoryNames[category]} (${count})`,
          text: showLabel ? [`${percentage}%`] : [''],
          textposition: 'inside',
          insidetextanchor: 'middle',
          textfont: { color: '#fff', size: 12 },
          hoverinfo: showLabel ? 'none' : 'text',
          hovertext: [`${categoryNames[category]}: ${percentage}%`],
          marker: { color: categoryColors[category] }
      };
    });

    // Get theme-aware layout
    const themeLayout = FReD.themeToggle ? FReD.themeToggle.getPlotlyLayout() : {};
    const textColor = themeLayout.font?.color || '#333';

    const layout = {
      barmode: 'stack',
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: themeLayout.font || {},
      title: {
        text: `<b>Replication Outcomes</b> (${total} replications)`,
        font: { size: 14, color: textColor },
        x: 0,
        xanchor: 'left'
      },
      xaxis: {
        showticklabels: false,
        showgrid: false,
        zeroline: false,
        range: [0, 1],
        fixedrange: true
      },
      yaxis: {
        showticklabels: false,
        showgrid: false,
        zeroline: false,
        fixedrange: true
      },
      legend: {
        orientation: 'h',
        y: -0.3,
        x: 0.5,
        xanchor: 'center',
        bgcolor: 'transparent',
        font: { size: 11, color: textColor }
      },
      margin: { t: 35, r: 10, b: 40, l: 10 },
      height: 100
    };

    Plotly.newPlot(container, traces, layout, { displayModeBar: false, responsive: true });
  },

  /**
   * Convert DOI URLs in text to clickable links
   */
  linkifyDOIs(text) {
    // Match DOI URLs like https://doi.org/... or http://doi.org/...
    const doiPattern = /(https?:\/\/doi\.org\/[^\s<>"]+)/gi;
    return text.replace(doiPattern, '<a href="$1" target="_blank">$1</a>');
  },

  /**
   * Format details row HTML for a database entry
   */
  formatDatabaseDetailsRow(entry) {
    let html = '<div class="row-details">';

    // Show full original reference
    if (entry.ref_original) {
      // Escape HTML then convert DOI URLs to links
      let refHtml = this.linkifyDOIs(FReD.utils.escapeHtml(entry.ref_original));
      html += `<p><strong>Original:</strong> ${refHtml}</p>`;
    } else if (entry.doi_original) {
      html += `<p><strong>DOI:</strong> <a href="https://doi.org/${entry.doi_original}" target="_blank">https://doi.org/${entry.doi_original}</a></p>`;
    }

    // Show replications with full references
    if (entry.replications && entry.replications.length > 0) {
      html += '<h4>Replications:</h4><ul>';

      entry.replications.forEach(rep => {
        const outcome = rep.outcome || 'Not coded';
        const outcomeClass = this.getOutcomeClass(outcome);

        // Use full reference if available, otherwise title
        let repDisplay = '';
        if (rep.ref_replication) {
          // Escape HTML then convert DOI URLs to links
          repDisplay = this.linkifyDOIs(FReD.utils.escapeHtml(rep.ref_replication));
        } else {
          const repTitle = rep.title_replication || rep.doi_replication || 'Unknown';
          if (rep.doi_replication) {
            repDisplay = `<a href="https://doi.org/${rep.doi_replication}" target="_blank">${FReD.utils.escapeHtml(repTitle)}</a>`;
          } else {
            repDisplay = FReD.utils.escapeHtml(repTitle);
          }
        }

        let reportLink = '';
        if (rep.url_replication) {
          reportLink = ` <a href="${FReD.utils.escapeHtml(rep.url_replication)}" target="_blank">[Link to report]</a>`;
        }

        html += `<li><span class="outcome-badge ${outcomeClass}">${FReD.utils.escapeHtml(outcome)}</span> ${repDisplay}${reportLink}</li>`;
      });

      html += '</ul>';
    }

    html += '</div>';
    return html;
  },

  /**
   * Build searchable text for a database entry (for DataTables search)
   */
  buildSearchableText(entry) {
    const parts = [
      entry.ref_original || '',
      entry.title_original || '',
      entry.doi_original || ''
    ];

    // Add replication info to searchable text
    if (entry.replications) {
      entry.replications.forEach(rep => {
        parts.push(rep.ref_replication || '');
        parts.push(rep.title_replication || '');
        parts.push(rep.doi_replication || '');
        parts.push(rep.outcome || '');
      });
    }

    return parts.join(' ');
  },

  /**
   * Initialize database browser table
   */
  initDatabaseTable() {
    if (!this.floraData?.entries) return;

    // Store entries for detail row access
    this.databaseEntries = this.floraData.entries;

    const tableData = this.floraData.entries.map((entry, idx) => {
      // Use parseReference to get author-year
      const parsed = FReD.utils.parseReference(entry.ref_original);
      const authorYear = parsed.short || entry.doi_original || '';
      const title = entry.title_original || '';

      return {
        idx: idx,
        doi: entry.doi_original || '',
        authorYear: authorYear,
        title: FReD.utils.escapeHtml(title),
        // Hidden searchable text that includes all details
        searchText: this.buildSearchableText(entry)
      };
    });

    this.databaseTable = $('#database-table').DataTable({
      data: tableData,
      columns: [
        {
          className: 'details-control',
          orderable: false,
          data: null,
          defaultContent: '',
          width: '20px'
        },
        {
          title: 'Reference',
          data: 'authorYear',
          width: '180px'
        },
        {
          title: 'Title',
          data: 'title'
        },
        {
          // Hidden column for search
          data: 'searchText',
          visible: false
        }
      ],
      pageLength: 10,
      order: [[1, 'asc']],
      select: {
        style: 'multi',
        selector: 'td:not(.details-control)'
      }
    });

    // Handle details toggle
    const self = this;
    $('#database-table tbody').on('click', 'td.details-control', function(e) {
      e.stopPropagation();
      const tr = $(this).closest('tr');
      const row = self.databaseTable.row(tr);
      const rowData = row.data();

      if (row.child.isShown()) {
        row.child.hide();
        tr.removeClass('shown');
      } else {
        const entry = self.databaseEntries[rowData.idx];
        row.child(self.formatDatabaseDetailsRow(entry)).show();
        tr.addClass('shown');
      }
    });

    // Handle selection
    this.databaseTable.on('select', async (e, dt, type, indexes) => {
      indexes.forEach(idx => {
        const rowData = this.databaseTable.row(idx).data();
        if (rowData.doi) this.selectedDOIs.add(rowData.doi.toLowerCase());
      });
      this.matchStudies();
      this.updateDOIPreview();
      this.updateProcessButtons();

      // Check for retractions if enabled
      this.checkRetractions = document.getElementById('check-retractions')?.checked || false;
      if (this.checkRetractions) {
        await this.checkForRetractions();
      }

      this.updateResults();
    });

    this.databaseTable.on('deselect', (e, dt, type, indexes) => {
      indexes.forEach(idx => {
        const rowData = this.databaseTable.row(idx).data();
        if (rowData.doi) this.selectedDOIs.delete(rowData.doi.toLowerCase());
      });
      this.matchStudies();
      this.updateDOIPreview();
      this.updateProcessButtons();
      this.updateResults();
    });
  },

  /**
   * Update report
   */
  updateReport() {
    const reportContainer = document.getElementById('report-container');
    const mdSource = document.getElementById('markdown-source');

    if (this.matchedStudies.length === 0 && this.retractedDOIs.size === 0) {
      reportContainer.innerHTML = '<p>No studies selected. Add DOIs in the Input tab or select from the database.</p>';
      mdSource.textContent = '';
      return;
    }

    const options = {
      format: 'html',
      retractedDOIs: this.retractedDOIs,
      inputDOIs: this.inputDOIs
    };

    const html = FReD.reportGenerator.generate(this.matchedStudies, null, options);
    const markdown = FReD.reportGenerator.generate(this.matchedStudies, null, { ...options, format: 'markdown' });

    reportContainer.innerHTML = html;
    mdSource.textContent = markdown;
  },

};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  FReD.annotator.init();
});

window.FReD = FReD;
