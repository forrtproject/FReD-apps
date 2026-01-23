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

  // Current criterion
  criterion: 'significance_r',

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

    // Success criterion change
    document.getElementById('success-criterion')?.addEventListener('change', (e) => {
      this.criterion = e.target.value;
      this.updateResults();
      this.updateReport();
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
            retracted_original: entry.retracted_original,
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
   * Update coverage chart
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

    const data = [{
      values: [inFReD, notInFReD],
      labels: ['In FReD', 'Not in FReD'],
      type: 'pie',
      marker: {
        colors: ['var(--fred-success)', 'var(--fred-failure)'].map(c => {
          // Get computed color values
          return c.startsWith('var(') ? '#8FBC8F' : c; // Fallback for pie chart
        })
      },
      textinfo: 'label+percent',
      hoverinfo: 'label+value'
    }];

    // Get theme-aware layout
    const themeLayout = FReD.themeToggle ? FReD.themeToggle.getPlotlyLayout() : {};

    const layout = {
      paper_bgcolor: themeLayout.paper_bgcolor || '#FFFFFF',
      plot_bgcolor: themeLayout.plot_bgcolor || '#FFFFFF',
      font: themeLayout.font || {},
      title: {
        text: `${this.selectedDOIs.size} DOIs: ${inFReD} in FReD`,
        font: { color: themeLayout.font?.color }
      },
      height: 150,
      margin: { t: 40, r: 20, b: 20, l: 20 },
      showlegend: false
    };

    Plotly.newPlot(container, data, layout, { displayModeBar: false, responsive: true });
  },

  /**
   * Update results table
   */
  updateResultsTable() {
    const tableData = this.matchedStudies.map(study => {
      const { outcomeReport } = FReD.successCriteria.getOutcome(study, this.criterion);

      return [
        study.doi_original ? `<a href="https://doi.org/${study.doi_original}" target="_blank">${study.doi_original}</a>` : '',
        study.doi_replication ? `<a href="https://doi.org/${study.doi_replication}" target="_blank">${study.doi_replication}</a>` : '',
        FReD.utils.escapeHtml(study.description || ''),
        FReD.utils.formatNumber(study.es_original, 3),
        FReD.utils.formatNumber(study.es_replication, 3),
        FReD.utils.capFirstLetter(outcomeReport || 'Not calculable')
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
          { title: 'Original DOI' },
          { title: 'Replication DOI' },
          { title: 'Description' },
          { title: 'ES (Orig)' },
          { title: 'ES (Rep)' },
          { title: 'Result' }
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
   * Update outcome chart
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
      const { outcomeReport } = FReD.successCriteria.getOutcome(study, this.criterion);
      const outcome = FReD.utils.capFirstLetter(outcomeReport || 'Not calculable');
      counts[outcome] = (counts[outcome] || 0) + 1;
    });

    const outcomes = Object.keys(counts);
    const colors = FReD.successCriteria.getColorsForCriterion(this.criterion);

    const data = [{
      y: outcomes,
      x: outcomes.map(o => counts[o]),
      type: 'bar',
      orientation: 'h',
      marker: {
        color: outcomes.map(o => colors[o] || colors[o.toLowerCase()] || '#888')
      }
    }];

    // Get theme-aware layout
    const themeLayout = FReD.themeToggle ? FReD.themeToggle.getPlotlyLayout() : {};

    const layout = {
      paper_bgcolor: themeLayout.paper_bgcolor || '#FFFFFF',
      plot_bgcolor: themeLayout.plot_bgcolor || '#FFFFFF',
      font: themeLayout.font || {},
      title: {
        text: 'Outcomes of Replication Attempts',
        font: { color: themeLayout.font?.color }
      },
      xaxis: {
        title: 'Count',
        gridcolor: themeLayout.xaxis?.gridcolor,
        linecolor: themeLayout.xaxis?.linecolor
      },
      yaxis: {
        automargin: true,
        gridcolor: themeLayout.yaxis?.gridcolor,
        linecolor: themeLayout.yaxis?.linecolor
      },
      margin: { t: 40, r: 20, b: 40, l: 150 },
      height: 200
    };

    Plotly.newPlot(container, data, layout, { displayModeBar: false, responsive: true });
  },

  /**
   * Initialize database browser table
   */
  initDatabaseTable() {
    if (!this.floraData?.entries) return;

    const tableData = this.floraData.entries.map(entry => [
      entry.doi_original || '',
      FReD.utils.escapeHtml(entry.ref_original || '')
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

    const html = FReD.reportGenerator.generate(this.matchedStudies, this.criterion, { format: 'html' });
    const markdown = FReD.reportGenerator.generate(this.matchedStudies, this.criterion, { format: 'markdown' });

    reportContainer.innerHTML = html;
    mdSource.textContent = markdown;
  },

  /**
   * Render replicability scatterplot
   */
  renderReplicabilityPlot() {
    const container = document.getElementById('replicability-plot');
    if (!container || this.matchedStudies.length === 0) {
      if (container) container.innerHTML = '';
      return;
    }

    const validStudies = this.matchedStudies.filter(s =>
      s.es_original != null && s.es_replication != null
    );

    if (validStudies.length === 0) {
      container.innerHTML = '<p class="text-muted">No studies with effect size data.</p>';
      return;
    }

    const colors = FReD.successCriteria.getColorsForCriterion(this.criterion);

    // Group by outcome
    const tracesByOutcome = {};
    validStudies.forEach(study => {
      const { outcomeReport } = FReD.successCriteria.getOutcome(study, this.criterion);
      const outcome = FReD.utils.capFirstLetter(outcomeReport || 'Not calculable');

      if (!tracesByOutcome[outcome]) {
        tracesByOutcome[outcome] = { x: [], y: [], text: [], color: colors[outcome] || '#888' };
      }

      tracesByOutcome[outcome].x.push(study.es_original);
      tracesByOutcome[outcome].y.push(study.es_replication);
      tracesByOutcome[outcome].text.push(
        `${study.description || ''}<br>r(orig)=${FReD.utils.formatNumber(study.es_original, 3)}, r(rep)=${FReD.utils.formatNumber(study.es_replication, 3)}`
      );
    });

    const traces = Object.entries(tracesByOutcome).map(([outcome, data]) => ({
      x: data.x,
      y: data.y,
      text: data.text,
      type: 'scatter',
      mode: 'markers',
      name: outcome,
      marker: { color: data.color, size: 10 },
      hovertemplate: '%{text}<extra></extra>'
    }));

    // Add diagonal line
    traces.push({
      x: [0, 1], y: [0, 1],
      type: 'scatter', mode: 'lines',
      line: { color: 'grey', dash: 'solid' },
      showlegend: false, hoverinfo: 'skip'
    });

    // Add zero line
    traces.push({
      x: [0, 1], y: [0, 0],
      type: 'scatter', mode: 'lines',
      line: { color: 'grey', dash: 'dash' },
      showlegend: false, hoverinfo: 'skip'
    });

    // Get theme-aware layout
    const themeLayout = FReD.themeToggle ? FReD.themeToggle.getPlotlyLayout() : {};

    const layout = {
      paper_bgcolor: themeLayout.paper_bgcolor || '#FFFFFF',
      plot_bgcolor: themeLayout.plot_bgcolor || '#FFFFFF',
      font: themeLayout.font || {},
      xaxis: {
        title: 'Original Effect Size (r)',
        range: [0, 1],
        gridcolor: themeLayout.xaxis?.gridcolor,
        linecolor: themeLayout.xaxis?.linecolor
      },
      yaxis: {
        title: 'Replication Effect Size (r)',
        range: [-0.5, 1],
        gridcolor: themeLayout.yaxis?.gridcolor,
        linecolor: themeLayout.yaxis?.linecolor
      },
      legend: {
        orientation: 'h',
        y: 1.1,
        bgcolor: 'transparent',
        font: themeLayout.legend?.font || {}
      },
      margin: { t: 60, r: 20, b: 60, l: 60 }
    };

    Plotly.newPlot(container, traces, layout, { displayModeBar: false, responsive: true });
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  FReD.annotator.init();
});

window.FReD = FReD;
