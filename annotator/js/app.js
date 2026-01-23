/**
 * FReD Annotator - Main Application
 *
 * Coordinates all components of the Annotator app
 */

window.FReD = window.FReD || {};

FReD.annotator = {
  // Data
  floraData: null,
  selectedDOIs: new Set(),
  matchedStudies: [],

  // DataTables
  resultsTable: null,
  databaseTable: null,

  /**
   * Initialize the application
   */
  async init() {
    console.log('Initializing FReD Annotator...');

    // Show welcome modal
    document.getElementById('welcome-modal').classList.add('active');

    // Setup event listeners
    this.setupEventListeners();

    // Setup tabs
    this.setupTabs();

    // Listen for theme changes
    window.addEventListener('themechange', () => {
      this.updateResults();
      if (document.querySelector('.tab[data-tab="report"]')?.classList.contains('active')) {
        this.renderReplicabilityPlot();
      }
    });

    // Load data
    try {
      await this.loadData();
    } catch (error) {
      console.error('Failed to load data:', error);
      FReD.utils.showNotification('Failed to load data. Please try refreshing.', 'error');
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
    // Process button
    document.getElementById('btn-process')?.addEventListener('click', () => {
      this.processInput();
    });

    // Clear button
    document.getElementById('btn-clear')?.addEventListener('click', () => {
      this.clearInput();
    });

    // File upload
    document.getElementById('file-upload')?.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.processFile(e.target.files[0]);
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

    // Report buttons
    document.getElementById('btn-copy-report')?.addEventListener('click', () => {
      const reportHtml = document.getElementById('report-container').innerHTML;
      FReD.utils.copyToClipboard(FReD.reportGenerator.htmlToText(reportHtml));
    });

    document.getElementById('btn-toggle-markdown')?.addEventListener('click', () => {
      const mdSource = document.getElementById('markdown-source');
      const reportView = document.getElementById('report-container');
      if (mdSource.style.display === 'none') {
        mdSource.style.display = 'block';
        reportView.style.display = 'none';
      } else {
        mdSource.style.display = 'none';
        reportView.style.display = 'block';
      }
    });

    document.getElementById('btn-print')?.addEventListener('click', () => {
      window.print();
    });
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
      this.renderReplicabilityPlot();
    }
  },

  /**
   * Process text input
   */
  async processInput() {
    const textInput = document.getElementById('reference-input').value;

    if (!textInput.trim()) {
      FReD.utils.showNotification('Please enter some references or DOIs.', 'warning');
      return;
    }

    const dois = FReD.doiParser.extractFromText(textInput);
    this.addDOIs(dois);

    FReD.utils.showNotification(`Found ${dois.length} DOI(s) from text input.`, 'info');

    // Switch to selection tab
    this.switchTab('selection');
  },

  /**
   * Process uploaded file
   */
  async processFile(file) {
    FReD.utils.showNotification(`Processing ${file.name}...`, 'info');

    try {
      const dois = await FReD.doiParser.extractFromFile(file);
      this.addDOIs(dois);
      FReD.utils.showNotification(`Found ${dois.length} DOI(s) from ${file.name}.`, 'info');
      this.switchTab('selection');
    } catch (error) {
      console.error('File processing error:', error);
      FReD.utils.showNotification('Failed to process file.', 'error');
    }
  },

  /**
   * Add DOIs to selection
   */
  addDOIs(dois) {
    dois.forEach(doi => this.selectedDOIs.add(doi.toLowerCase()));
    this.updateDOIPreview();
    this.matchStudies();
    this.updateResults();
  },

  /**
   * Clear input and selection
   */
  clearInput() {
    document.getElementById('reference-input').value = '';
    document.getElementById('file-upload').value = '';
    this.selectedDOIs.clear();
    this.matchedStudies = [];
    this.updateDOIPreview();
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
    this.updateCoverageChart();
    this.updateResultsTable();
    this.updateOutcomeChart();
  },

  /**
   * Update coverage chart - simple stacked bar showing DOI coverage
   */
  updateCoverageChart() {
    const container = document.getElementById('coverage-chart');
    if (!container || this.selectedDOIs.size === 0) {
      if (container) container.innerHTML = '';
      return;
    }

    const matched = new Set(this.matchedStudies.map(s => s.doi_original?.toLowerCase()));
    const inFReD = [...this.selectedDOIs].filter(doi => matched.has(doi)).length;
    const notInFReD = this.selectedDOIs.size - inFReD;
    const total = this.selectedDOIs.size;
    const pctInFReD = ((inFReD / total) * 100).toFixed(1);
    const pctNotInFReD = ((notInFReD / total) * 100).toFixed(1);

    // Simple HTML-based coverage bar instead of Plotly pie chart
    container.innerHTML = `
      <div style="margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--fred-text);">
        <strong>${total}</strong> DOIs submitted &bull; <strong>${inFReD}</strong> found in FReD (${pctInFReD}%)
      </div>
      <div style="display: flex; height: 24px; border-radius: 4px; overflow: hidden; background: #ddd;">
        ${inFReD > 0 ? `<div style="width: ${pctInFReD}%; background: #8FBC8F; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 500;">${inFReD > 0 && parseFloat(pctInFReD) >= 10 ? 'In FReD' : ''}</div>` : ''}
        ${notInFReD > 0 ? `<div style="width: ${pctNotInFReD}%; background: #C8C8C8; display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px; font-weight: 500;">${notInFReD > 0 && parseFloat(pctNotInFReD) >= 15 ? 'Not in FReD' : ''}</div>` : ''}
      </div>
    `;
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
        study.ref_original
          ? `<span title="${FReD.utils.escapeHtml(study.ref_original)}">${study.doi_original ? `<a href="https://doi.org/${study.doi_original}" target="_blank">${FReD.utils.escapeHtml(study.title_original || study.doi_original)}</a>` : FReD.utils.escapeHtml(study.title_original || 'Unknown')}</span>`
          : (study.doi_original ? `<a href="https://doi.org/${study.doi_original}" target="_blank">${study.doi_original}</a>` : ''),
        study.ref_replication
          ? `<span title="${FReD.utils.escapeHtml(study.ref_replication)}">${study.doi_replication ? `<a href="https://doi.org/${study.doi_replication}" target="_blank">${FReD.utils.escapeHtml(study.title_replication || study.doi_replication)}</a>` : FReD.utils.escapeHtml(study.title_replication || 'Unknown')}</span>`
          : (study.doi_replication ? `<a href="https://doi.org/${study.doi_replication}" target="_blank">${study.doi_replication}</a>` : ''),
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
   * Update outcome chart - horizontal stacked bar
   */
  updateOutcomeChart() {
    const container = document.getElementById('outcome-chart');
    if (!container || this.matchedStudies.length === 0) {
      if (container) container.innerHTML = '';
      return;
    }

    // Count outcomes
    const counts = {};
    this.matchedStudies.forEach(study => {
      const outcome = study.outcome || 'Not coded';
      counts[outcome] = (counts[outcome] || 0) + 1;
    });

    const total = this.matchedStudies.length;
    const outcomes = Object.keys(counts);

    // Define colors for outcomes
    const colors = {
      'success': '#8FBC8F',
      'replicated': '#8FBC8F',
      'failure': '#F08080',
      'not replicated': '#F08080',
      'mixed': '#FFD700',
      'inconclusive': '#C8C8C8',
      'informative failure signal': '#FFB347',
      'not coded': '#C8C8C8'
    };

    const getColor = (outcome) => {
      const lower = outcome.toLowerCase();
      for (const [key, color] of Object.entries(colors)) {
        if (lower.includes(key)) return color;
      }
      return '#C8C8C8';
    };

    // Create stacked bar traces
    const traces = outcomes.map(outcome => {
      const count = counts[outcome];
      const proportion = count / total;
      const percentage = (proportion * 100).toFixed(1);
      const showLabel = proportion >= 0.1;

      return {
        x: [proportion],
        y: [''],
        type: 'bar',
        orientation: 'h',
        name: `${outcome} (${count})`,
        text: showLabel ? [`${percentage}%`] : [''],
        textposition: 'inside',
        insidetextanchor: 'middle',
        textfont: { color: '#fff', size: 12 },
        hoverinfo: showLabel ? 'none' : 'text',
        hovertext: [`${outcome}: ${percentage}%`],
        marker: { color: getColor(outcome) }
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
   * Initialize database browser table
   */
  initDatabaseTable() {
    if (!this.floraData?.entries) return;

    const tableData = this.floraData.entries.map(entry => [
      entry.doi_original || '',
      FReD.utils.escapeHtml(entry.ref_original || entry.title_original || '')
    ]);

    this.databaseTable = $('#database-table').DataTable({
      data: tableData,
      columns: [
        { title: 'DOI' },
        { title: 'Reference' }
      ],
      pageLength: 10,
      scrollX: true,
      select: {
        style: 'multi'
      }
    });

    // Handle selection
    this.databaseTable.on('select', (e, dt, type, indexes) => {
      indexes.forEach(idx => {
        const doi = tableData[idx][0];
        if (doi) this.selectedDOIs.add(doi.toLowerCase());
      });
      this.matchStudies();
      this.updateDOIPreview();
      this.updateResults();
    });

    this.databaseTable.on('deselect', (e, dt, type, indexes) => {
      indexes.forEach(idx => {
        const doi = tableData[idx][0];
        if (doi) this.selectedDOIs.delete(doi.toLowerCase());
      });
      this.matchStudies();
      this.updateDOIPreview();
      this.updateResults();
    });
  },

  /**
   * Update report
   */
  updateReport() {
    const reportContainer = document.getElementById('report-container');
    const mdSource = document.getElementById('markdown-source');

    if (this.matchedStudies.length === 0) {
      reportContainer.innerHTML = '<p>No studies selected. Add DOIs in the Input tab or select from the database.</p>';
      mdSource.textContent = '';
      return;
    }

    const html = FReD.reportGenerator.generate(this.matchedStudies, null, { format: 'html' });
    const markdown = FReD.reportGenerator.generate(this.matchedStudies, null, { format: 'markdown' });

    reportContainer.innerHTML = html;
    mdSource.textContent = markdown;
  },

  /**
   * Render replicability plot - simplified without effect sizes
   */
  renderReplicabilityPlot() {
    const container = document.getElementById('replicability-plot');
    if (!container || this.matchedStudies.length === 0) {
      if (container) container.innerHTML = '<p class="text-muted">No studies selected or effect size data not available in FLoRA dataset.</p>';
      return;
    }

    // FLoRA data doesn't have effect sizes, so show a message
    container.innerHTML = '<p class="text-muted">Effect size comparison not available. The FLoRA dataset provides replication outcomes without detailed effect size data.</p>';
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  FReD.annotator.init();
});

window.FReD = FReD;
