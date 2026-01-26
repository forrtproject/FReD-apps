/**
 * FReD Explorer - Main Application
 *
 * Initializes and coordinates all components of the Explorer app
 */

window.FReD = window.FReD || {};

FReD.explorer = {
  // Data
  allStudies: [],
  filteredStudies: [],
  dataTable: null,
  fullDataTable: null,
  visibleColumns: [],

  /**
   * Initialize the application
   */
  async init() {
    console.log('Initializing FReD Explorer...');

    // Show welcome modal (unless user opted out)
    this.initWelcomeModal();

    // Initialize state management
    FReD.state.init();

    // Initialize filters
    FReD.filters.init();

    // Initialize charts
    FReD.charts.scatterplot.init('scatterplot');
    FReD.charts.barchart.init('barchart');
    FReD.charts.forestplot.init('forestplot');
    FReD.charts.trends.init('decade-chart', 'discipline-chart');

    // Setup tab navigation
    this.setupTabs();

    // Setup export buttons
    this.setupExportButtons();

    // Setup column selector
    this.setupColumnSelector();

    // Setup reference tooltips
    this.setupTooltips();

    // Listen for state changes
    FReD.state.onChange((changes, state) => {
      this.onStateChange(changes, state);
    });

    // Load data
    try {
      await this.loadData();
    } catch (error) {
      console.error('Failed to load data:', error);
      FReD.utils.showNotification('Failed to load data. Please try refreshing the page.', 'error');
    }

    // Load citation
    this.loadCitation();
  },

  /**
   * Initialize welcome modal with "don't show again" functionality
   */
  initWelcomeModal() {
    const STORAGE_KEY = 'fred-explorer-welcome-dismissed';
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
   * Load data from JSON file
   */
  async loadData() {
    console.log('Loading data...');

    const data = await FReD.dataLoader.loadExplorerData();

    this.allStudies = data.studies || [];
    console.log(`Loaded ${this.allStudies.length} studies`);

    // Populate source dropdown
    // data.sources may be a string or non-array, so check for array explicitly
    const sources = Array.isArray(data.sources) ? data.sources : FReD.dataLoader.getSources(this.allStudies);
    FReD.filters.populateSources(sources);

    // Update metadata displays
    if (data.metadata) {
      document.getElementById('data-updated').textContent =
        new Date(data.metadata.generated).toLocaleDateString();
    }

    // Apply initial state to filters
    FReD.filters.applyState(FReD.state.get());

    // Initial render
    this.updateFilters();

    // Set active tab from state
    const tab = FReD.state.get('tab');
    if (tab) {
      this.switchTab(tab);
    }

    // Ensure success note is shown (updateFilters already calls this, but ensure visibility)
    this.updateSuccessNote(FReD.state.get('criterion'));
  },

  /**
   * Handle state changes
   */
  onStateChange(changes, state) {
    // Apply state to filter UI
    FReD.filters.applyState(state);

    // Re-filter and render (includes success note update)
    this.updateFilters();

    // Switch tab if changed
    if (changes.tab) {
      this.switchTab(changes.tab);
    }
  },

  /**
   * Update filters and re-render
   */
  updateFilters() {
    const state = FReD.state.get();

    // Apply filters
    this.filteredStudies = FReD.filters.applyFilters(this.allStudies, {
      source: state.source,
      minPower: state.minPower,
      search: state.search
    });

    // Update count displays
    FReD.filters.updateStudyCount(this.filteredStudies.length, this.allStudies.length);
    FReD.filters.updateReplicationCount(this.filteredStudies, this.allStudies);

    // Update success note (depends on filtered studies)
    this.updateSuccessNote(state.criterion);

    // Update all visualizations
    this.renderAll(state.criterion);
  },

  /**
   * Render all visualizations
   */
  renderAll(criterion) {
    // Scatterplot
    FReD.charts.scatterplot.render(this.filteredStudies, criterion);

    // Bar chart
    FReD.charts.barchart.render(this.filteredStudies, criterion);

    // Update studies table
    this.updateStudiesTable(criterion);

    // Forest plot and trends are rendered on tab switch for performance
    const activeTab = FReD.state.get('tab');
    if (activeTab === 'forest') {
      FReD.charts.forestplot.render(this.filteredStudies);
    } else if (activeTab === 'correlates') {
      FReD.charts.trends.renderDecade(this.filteredStudies, criterion);
      FReD.charts.trends.renderDiscipline(this.filteredStudies, criterion);
    } else if (activeTab === 'data') {
      this.updateFullDataTable();
    }
  },

  /**
   * Update success criterion note
   */
  updateSuccessNote(criterion) {
    const noteEl = document.getElementById('success-note');
    const criterionInfo = FReD.successCriteria.getCriterion(criterion);
    if (criterionInfo && noteEl) {
      let noteHtml = `<strong>Note:</strong> ${criterionInfo.note}`;

      // Add dynamic reversal caveat for significance_r criterion
      if (criterionInfo.hasDynamicReversalNote && this.filteredStudies.length > 0) {
        const { successCount, nonAssessableCount } = FReD.successCriteria.countNonAssessableSuccesses(
          this.filteredStudies,
          criterion
        );

        if (nonAssessableCount > 0) {
          noteHtml += `<br><em style="color: var(--fred-text-muted);">For the selected entries, ${nonAssessableCount} of ${successCount} successes cannot be distinguished from reversals (non-directional effect type or missing effect size data).</em>`;
        }
      }

      noteEl.innerHTML = noteHtml;
    }
  },

  /**
   * Setup tab/sidebar navigation
   */
  setupTabs() {
    // Support both old tabs and new sidebar nav
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        FReD.state.set('tab', tabId);
      });
    });

    // Sidebar navigation links
    const sidebarLinks = document.querySelectorAll('.sidebar-nav-link');
    sidebarLinks.forEach(link => {
      link.addEventListener('click', () => {
        const tabId = link.dataset.tab;
        FReD.state.set('tab', tabId);
      });
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
   * Switch to a tab
   */
  switchTab(tabId) {
    // Update tab buttons (legacy)
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    // Update sidebar navigation links
    document.querySelectorAll('.sidebar-nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.tab === tabId);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabId}`);
    });

    // Render tab-specific content
    const criterion = FReD.state.get('criterion');
    if (tabId === 'forest') {
      FReD.charts.forestplot.render(this.filteredStudies);
    } else if (tabId === 'correlates') {
      FReD.charts.trends.renderDecade(this.filteredStudies, criterion);
      FReD.charts.trends.renderDiscipline(this.filteredStudies, criterion);
    } else if (tabId === 'data') {
      this.updateFullDataTable();
    }
  },

  /**
   * Update the studies table
   */
  updateStudiesTable(criterion) {
    const self = this;

    // Get visible columns from column config
    if (!this.visibleColumns || this.visibleColumns.length === 0) {
      this.visibleColumns = FReD.columnConfig.getVisibleColumns();
    }

    // Build row data using column config
    const tableData = this.filteredStudies.map((study, idx) => {
      return FReD.columnConfig.buildRowData(study, idx, this.visibleColumns, criterion);
    });

    // Get the index of the idx column (always last)
    const idxColIndex = this.visibleColumns.length + 1;

    if (this.dataTable) {
      this.dataTable.clear();
      this.dataTable.rows.add(tableData);
      this.dataTable.draw();
    } else {
      const columns = FReD.columnConfig.buildTableColumns(this.visibleColumns);

      this.dataTable = $('#studies-table').DataTable({
        data: tableData,
        columns: columns,
        pageLength: 10,
        lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
        order: [[this.getOrigRefColumnIndex(), 'asc']], // Order by Original Reference if visible
        dom: 'lfrtip', // Include length menu
        scrollX: true,
        language: {
          emptyTable: 'No effects match the current filters'
        }
      });

      // Add click handler for expand/collapse
      $('#studies-table tbody').on('click', 'td.dt-control', function() {
        const tr = $(this).closest('tr');
        const row = self.dataTable.row(tr);

        if (row.child.isShown()) {
          row.child.hide();
          tr.removeClass('shown');
        } else {
          const rowData = row.data();
          const studyIdx = rowData[rowData.length - 1]; // idx is always last
          const study = self.filteredStudies[studyIdx];
          row.child(self.formatStudyDetails(study, criterion)).show();
          tr.addClass('shown');
        }
      });
    }
  },

  /**
   * Get the column index for Original Reference (for default sorting)
   */
  getOrigRefColumnIndex() {
    const idx = this.visibleColumns.indexOf('ref_o');
    return idx >= 0 ? idx + 1 : 1; // +1 for control column, default to 1
  },

  /**
   * Setup column selector UI
   */
  setupColumnSelector() {
    const container = document.getElementById('column-selector-container');
    if (!container) return;

    // Initialize visible columns
    this.visibleColumns = FReD.columnConfig.getVisibleColumns();

    // Build the dropdown HTML
    const selectableColumns = FReD.columnConfig.getSelectableColumns();

    let html = `
      <div class="column-selector-wrapper">
        <button class="column-selector-btn" id="column-selector-btn" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          Columns
        </button>
        <div class="column-selector-dropdown" id="column-selector-dropdown">
          <div class="column-selector-header">
            Select Columns
            <span class="column-selector-reset" id="column-selector-reset">Reset</span>
          </div>
          <div class="column-selector-list">
    `;

    selectableColumns.forEach(col => {
      const checked = this.visibleColumns.includes(col.key) ? 'checked' : '';
      html += `
        <div class="column-selector-item">
          <input type="checkbox" id="col-${col.key}" data-column="${col.key}" ${checked}>
          <label for="col-${col.key}">${col.label}</label>
        </div>
      `;
    });

    html += `
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Setup event handlers
    const btn = document.getElementById('column-selector-btn');
    const dropdown = document.getElementById('column-selector-dropdown');
    const resetBtn = document.getElementById('column-selector-reset');

    // Toggle dropdown
    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });

    // Handle checkbox changes
    dropdown?.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        this.handleColumnToggle(e.target.dataset.column, e.target.checked);
      }
    });

    // Reset to defaults
    resetBtn?.addEventListener('click', () => {
      this.visibleColumns = FReD.columnConfig.resetToDefaults();
      this.updateColumnCheckboxes();
      this.rebuildTable();
    });
  },

  /**
   * Handle column visibility toggle
   */
  handleColumnToggle(columnKey, isVisible) {
    if (isVisible && !this.visibleColumns.includes(columnKey)) {
      this.visibleColumns.push(columnKey);
    } else if (!isVisible) {
      this.visibleColumns = this.visibleColumns.filter(k => k !== columnKey);
    }

    // Save preference
    FReD.columnConfig.saveVisibleColumns(this.visibleColumns);

    // Rebuild table with new columns
    this.rebuildTable();
  },

  /**
   * Update checkbox states in the column selector
   */
  updateColumnCheckboxes() {
    const selectableColumns = FReD.columnConfig.getSelectableColumns();
    selectableColumns.forEach(col => {
      const checkbox = document.getElementById(`col-${col.key}`);
      if (checkbox) {
        checkbox.checked = this.visibleColumns.includes(col.key);
      }
    });
  },

  /**
   * Rebuild the table with current column configuration
   */
  rebuildTable() {
    // Destroy existing table
    if (this.dataTable) {
      this.dataTable.destroy();
      this.dataTable = null;
      $('#studies-table').empty();
    }

    // Rebuild with new columns
    const criterion = FReD.state.get('criterion');
    this.updateStudiesTable(criterion);
  },

  /**
   * Format coded p-value for display
   * Rules:
   * - p < X: show only up to last non-zero digit (e.g., .05 not .0500)
   * - p = X: show minimum 3 decimals, drop trailing zeros after 3 (e.g., .050 not .05000, but keep .05001)
   * - p > X: same as p <
   */
  formatCodedPValue(value, type) {
    if (value == null || value === '') return 'N/A';

    // Convert to number in case it's a string from JSON
    const numValue = Number(value);
    if (isNaN(numValue)) return 'N/A';

    const symbol = (type === 'l' || type === '<') ? '<' :
                   (type === 'g' || type === '>') ? '>' : '=';

    let formatted;
    if (symbol === '=') {
      // For p = X: minimum 3 decimals, drop trailing zeros after position 3
      // Format to enough precision first
      const fullStr = numValue.toFixed(6);
      // Find the decimal point position
      const decimalPos = fullStr.indexOf('.');
      if (decimalPos === -1) {
        formatted = numValue.toFixed(3);
      } else {
        // Check if there are significant digits beyond position 3
        const fullDecimals = fullStr.slice(decimalPos + 1);
        let lastSignificant = 2; // minimum 3 decimals (index 2)
        for (let i = fullDecimals.length - 1; i >= 3; i--) {
          if (fullDecimals[i] !== '0') {
            lastSignificant = i;
            break;
          }
        }
        formatted = numValue.toFixed(lastSignificant + 1);
      }
    } else {
      // For p < or p >: show only up to last non-zero digit
      const fullStr = numValue.toFixed(6);
      // Remove trailing zeros
      formatted = parseFloat(fullStr).toString();
      // Ensure at least some decimal representation for small values
      if (!formatted.includes('.') && numValue < 1) {
        formatted = numValue.toFixed(2);
      }
    }

    return `p ${symbol} ${formatted}`;
  },

  /**
   * Generate CI visualization SVG
   */
  generateCIVisualization(study) {
    const es_o = study.es_o;
    const es_r = study.es_r;
    const ci_lower_o = study.ci_lower_o;
    const ci_upper_o = study.ci_upper_o;
    const ci_lower_r = study.ci_lower_r;
    const ci_upper_r = study.ci_upper_r;

    // Check if we have enough data
    const hasOriginal = es_o != null && ci_lower_o != null && ci_upper_o != null;
    const hasReplication = es_r != null && ci_lower_r != null && ci_upper_r != null;

    if (!hasOriginal && !hasReplication) {
      return '<p style="font-size: 0.875rem; color: var(--fred-text-muted);">Insufficient data for visualization</p>';
    }

    // Calculate range for scaling (include 0 always)
    const allValues = [0];
    if (hasOriginal) allValues.push(ci_lower_o, ci_upper_o, es_o);
    if (hasReplication) allValues.push(ci_lower_r, ci_upper_r, es_r);

    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const range = maxVal - minVal || 1;
    const padding = range * 0.1;
    const scaleMin = minVal - padding;
    const scaleMax = maxVal + padding;
    const scaleRange = scaleMax - scaleMin;

    // SVG dimensions
    const width = 300;
    const height = 80;
    const marginLeft = 10;
    const marginRight = 10;
    const plotWidth = width - marginLeft - marginRight;

    // Scale function
    const scale = (val) => marginLeft + ((val - scaleMin) / scaleRange) * plotWidth;
    const zeroX = scale(0);

    let svg = `<svg width="${width}" height="${height}" style="display: block; margin-top: 0.5rem;">`;

    // Zero line
    svg += `<line x1="${zeroX}" y1="10" x2="${zeroX}" y2="70" stroke="#999" stroke-width="1" stroke-dasharray="3,3"/>`;
    svg += `<text x="${zeroX}" y="78" text-anchor="middle" font-size="10" fill="#666">0</text>`;

    // Original CI (top row, y=25)
    if (hasOriginal) {
      const x1 = scale(ci_lower_o);
      const x2 = scale(ci_upper_o);
      const xPoint = scale(es_o);
      svg += `<line x1="${x1}" y1="25" x2="${x2}" y2="25" stroke="#666" stroke-width="2"/>`;
      svg += `<line x1="${x1}" y1="20" x2="${x1}" y2="30" stroke="#666" stroke-width="2"/>`;
      svg += `<line x1="${x2}" y1="20" x2="${x2}" y2="30" stroke="#666" stroke-width="2"/>`;
      svg += `<circle cx="${xPoint}" cy="25" r="5" fill="#666"/>`;
      svg += `<text x="5" y="28" font-size="10" fill="#666">O</text>`;
    }

    // Replication CI (bottom row, y=50)
    if (hasReplication) {
      const x1 = scale(ci_lower_r);
      const x2 = scale(ci_upper_r);
      const xPoint = scale(es_r);
      svg += `<line x1="${x1}" y1="50" x2="${x2}" y2="50" stroke="var(--fred-primary)" stroke-width="2"/>`;
      svg += `<line x1="${x1}" y1="45" x2="${x1}" y2="55" stroke="var(--fred-primary)" stroke-width="2"/>`;
      svg += `<line x1="${x2}" y1="45" x2="${x2}" y2="55" stroke="var(--fred-primary)" stroke-width="2"/>`;
      svg += `<circle cx="${xPoint}" cy="50" r="5" fill="var(--fred-primary)"/>`;
      svg += `<text x="5" y="53" font-size="10" fill="var(--fred-primary)">R</text>`;
    }

    svg += '</svg>';
    return svg;
  },

  /**
   * Format DOI as hyperlink showing full URL
   */
  formatDOILink(doi) {
    if (!doi) return '';
    const cleanDoi = doi.trim();
    const url = cleanDoi.startsWith('http') ? cleanDoi : `https://doi.org/${cleanDoi}`;
    return ` <a href="${FReD.utils.escapeHtml(url)}" target="_blank">${FReD.utils.escapeHtml(url)}</a>`;
  },

  /**
   * Format study details for expanded row
   */
  formatStudyDetails(study, criterion) {
    const { outcomeReport } = FReD.successCriteria.getOutcome(study, criterion);

    // Build replication reference with link
    const repRef = FReD.utils.escapeHtml(study.ref_r || 'N/A');
    const repLink = study.url_r ? ` <a href="${FReD.utils.escapeHtml(study.url_r)}" target="_blank" style="white-space: nowrap;">[Report]</a>` : '';

    // DOI links
    const origDOI = this.formatDOILink(study.doi_o);
    const repDOI = this.formatDOILink(study.doi_r);

    // Format claim (from claim_text_o field) - strip surrounding quotes if present
    let claimText = study.claim_text_o || '';
    if (claimText.startsWith('"') && claimText.endsWith('"')) {
      claimText = claimText.slice(1, -1);
    }
    claimText = claimText.trim() ? FReD.utils.escapeHtml(claimText.trim()) : null;
    const claimsHtml = claimText ? `
          <div style="margin-bottom: 1rem;">
            <h5 style="margin: 0 0 0.5rem 0; color: var(--fred-primary);">Claim</h5>
            <div style="font-size: 0.875rem;">
              <p style="margin: 0;">${claimText}</p>
            </div>
          </div>` : '';

    return `
      <div class="study-details" style="padding: 1rem; background: var(--fred-bg-alt); border-radius: 4px; margin: 0.5rem;">
        ${claimsHtml}
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
          <div>
            <h5 style="margin: 0 0 0.5rem 0; color: var(--fred-primary);">Effect Sizes</h5>
            <table style="font-size: 0.875rem;">
              <tr><td style="padding-right: 1rem;"><strong>Original ES (r):</strong></td><td>${FReD.utils.formatNumber(study.es_o, 3) || 'N/A'}</td></tr>
              <tr><td><strong>Replication ES (r):</strong></td><td>${FReD.utils.formatNumber(study.es_r, 3) || 'N/A'}</td></tr>
              <tr><td><strong>Original N:</strong></td><td>${study.n_o || 'N/A'}</td></tr>
              <tr><td><strong>Replication N:</strong></td><td>${study.n_r || 'N/A'}</td></tr>
            </table>
          </div>
          <div>
            <h5 style="margin: 0 0 0.5rem 0; color: var(--fred-primary);">Statistics</h5>
            <table style="font-size: 0.875rem;">
              <tr><td style="padding-right: 1rem;"><strong>Original p-value:</strong></td><td>${this.formatCodedPValue(study.pval_value_o, study.pval_type_o)}</td></tr>
              <tr><td><strong>Replication p-value:</strong></td><td>${this.formatCodedPValue(study.pval_value_r, study.pval_type_r)}</td></tr>
              <tr><td><strong>Power:</strong></td><td>${FReD.utils.formatNumber(study.power_r, 2) || 'N/A'}</td></tr>
              <tr><td><strong>Outcome (${criterion}):</strong></td><td>${FReD.utils.capFirstLetter(outcomeReport || 'Not calculable')}</td></tr>
            </table>
          </div>
          <div>
            <h5 style="margin: 0 0 0.5rem 0; color: var(--fred-primary);">Confidence Intervals</h5>
            <table style="font-size: 0.875rem;">
              <tr><td style="padding-right: 1rem;"><strong>Original CI:</strong></td><td>[${FReD.utils.formatNumber(study.ci_lower_o, 3) || '?'}, ${FReD.utils.formatNumber(study.ci_upper_o, 3) || '?'}]</td></tr>
              <tr><td><strong>Replication CI:</strong></td><td>[${FReD.utils.formatNumber(study.ci_lower_r, 3) || '?'}, ${FReD.utils.formatNumber(study.ci_upper_r, 3) || '?'}]</td></tr>
            </table>
            ${this.generateCIVisualization(study)}
          </div>
        </div>
        <div style="margin-top: 1rem;">
          <h5 style="margin: 0 0 0.5rem 0; color: var(--fred-primary);">References</h5>
          <p style="font-size: 0.875rem; margin: 0 0 0.5rem 0;"><strong>Original:</strong> ${FReD.utils.escapeHtml(study.ref_o || 'N/A')}${origDOI}</p>
          <p style="font-size: 0.875rem; margin: 0;"><strong>Replication:</strong> ${repRef}${repDOI}${repLink}</p>
        </div>
      </div>
    `;
  },

  /**
   * Update the full data table
   */
  updateFullDataTable() {
    const tableData = this.filteredStudies.map(study => [
      FReD.utils.escapeHtml(study.description || ''),
      FReD.utils.formatNumber(study.es_o, 3),
      FReD.utils.formatNumber(study.es_r, 3),
      study.n_o || '',
      study.n_r || '',
      FReD.utils.formatNumber(study.power_r, 2),
      study.result || '',
      FReD.utils.escapeHtml(study.source || '')
    ]);

    if (this.fullDataTable) {
      this.fullDataTable.clear();
      this.fullDataTable.rows.add(tableData);
      this.fullDataTable.draw();
    } else {
      this.fullDataTable = $('#full-data-table').DataTable({
        data: tableData,
        columns: [
          { title: 'Description' },
          { title: 'ES (Orig)' },
          { title: 'ES (Rep)' },
          { title: 'N (Orig)' },
          { title: 'N (Rep)' },
          { title: 'Power' },
          { title: 'Result' },
          { title: 'Source' }
        ],
        pageLength: 25,
        order: [[0, 'asc']],
        scrollX: true,
        language: {
          emptyTable: 'No studies match the current filters'
        }
      });
    }
  },

  /**
   * Setup export buttons
   */
  setupExportButtons() {
    // Copy button
    document.getElementById('btn-copy')?.addEventListener('click', () => {
      const text = this.getTableText();
      FReD.utils.copyToClipboard(text);
    });

    // CSV button
    document.getElementById('btn-csv')?.addEventListener('click', () => {
      const csv = this.getTableCSV();
      FReD.utils.downloadFile(csv, `fred-explorer-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    });

    // Excel button
    document.getElementById('btn-excel')?.addEventListener('click', () => {
      this.downloadExcel();
    });

    // Download button (full data)
    document.getElementById('btn-download')?.addEventListener('click', () => {
      this.downloadExcel();
    });
  },

  /**
   * Setup reference tooltips
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
   * Get table data as text
   */
  getTableText() {
    const criterion = FReD.state.get('criterion');
    const headers = ['Description', 'Tags', 'Result', 'Original Reference', 'Replication Reference'];
    const rows = this.filteredStudies.map(study => {
      const { outcomeReport } = FReD.successCriteria.getOutcome(study, criterion);
      return [
        study.description || '',
        study.tags || '',
        outcomeReport || 'Not calculable',
        study.ref_o || '',
        study.ref_r || ''
      ].join('\t');
    });
    return [headers.join('\t'), ...rows].join('\n');
  },

  /**
   * Get table data as CSV
   */
  getTableCSV() {
    const criterion = FReD.state.get('criterion');
    const data = this.filteredStudies.map(study => {
      const { outcomeReport } = FReD.successCriteria.getOutcome(study, criterion);
      return {
        description: study.description || '',
        tags: study.tags || '',
        result: outcomeReport || 'Not calculable',
        ref_o: study.ref_o || '',
        ref_r: study.ref_r || '',
        es_o: study.es_o,
        es_r: study.es_r,
        n_o: study.n_o,
        n_r: study.n_r,
        power: study.power_r,
        source: study.source || ''
      };
    });

    const headers = Object.keys(data[0] || {});
    const rows = data.map(row =>
      headers.map(h => {
        let val = row[h];
        if (val === null || val === undefined) val = '';
        val = String(val);
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      }).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  },

  /**
   * Download data as Excel (using CSV for now, could use SheetJS for proper xlsx)
   */
  downloadExcel() {
    const csv = this.getTableCSV();
    FReD.utils.downloadFile(csv, `fred-explorer-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    FReD.utils.showNotification('Downloaded as CSV. For Excel format, open the CSV file in Excel.', 'info');
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  FReD.explorer.init();
});

window.FReD = FReD;
