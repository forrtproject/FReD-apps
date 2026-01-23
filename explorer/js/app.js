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

  /**
   * Initialize the application
   */
  async init() {
    console.log('Initializing FReD Explorer...');

    // Show welcome modal
    document.getElementById('welcome-modal').classList.add('active');

    // Initialize state management
    FReD.state.init();

    // Initialize filters
    FReD.filters.init();

    // Initialize charts
    FReD.charts.scatterplot.init('scatterplot');
    FReD.charts.barchart.init('barchart');
    FReD.charts.forestplot.init('forestplot');
    FReD.charts.trends.init('decade-chart', 'journal-chart');

    // Setup tab navigation
    this.setupTabs();

    // Setup export buttons
    this.setupExportButtons();

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
  },

  /**
   * Handle state changes
   */
  onStateChange(changes, state) {
    // Apply state to filter UI
    FReD.filters.applyState(state);

    // Re-filter and render
    this.updateFilters();

    // Update success note
    this.updateSuccessNote(state.criterion);

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

    // Update count display
    FReD.filters.updateStudyCount(this.filteredStudies.length, this.allStudies.length);

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
      FReD.charts.trends.renderJournal(this.filteredStudies, criterion);
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
      noteEl.innerHTML = `<strong>Note:</strong> ${criterionInfo.note}`;
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
      FReD.charts.trends.renderJournal(this.filteredStudies, criterion);
    } else if (tabId === 'data') {
      this.updateFullDataTable();
    }
  },

  /**
   * Update the studies table
   */
  updateStudiesTable(criterion) {
    const self = this;
    const tableData = this.filteredStudies.map((study, idx) => {
      const { outcomeReport } = FReD.successCriteria.getOutcome(study, criterion);
      return [
        '', // Control column for expand/collapse
        FReD.utils.escapeHtml(study.description || ''),
        FReD.utils.escapeHtml(study.tags || ''),
        FReD.utils.capFirstLetter(outcomeReport || 'Not calculable'),
        FReD.utils.formatReferenceCell(study.ref_original, study.doi_original),
        FReD.utils.formatReferenceCell(study.ref_replication, study.doi_replication, study.osf_link),
        study.osf_link ? `<a href="${study.osf_link}" target="_blank">Link</a>` : '',
        idx // Store index to retrieve full study data
      ];
    });

    if (this.dataTable) {
      this.dataTable.clear();
      this.dataTable.rows.add(tableData);
      this.dataTable.draw();
    } else {
      this.dataTable = $('#studies-table').DataTable({
        data: tableData,
        columns: [
          {
            title: '',
            className: 'dt-control',
            orderable: false,
            data: null,
            defaultContent: '<button class="btn btn-sm btn-secondary details-btn">+</button>',
            width: '30px'
          },
          { title: 'Description' },
          { title: 'Tags' },
          { title: 'Result' },
          { title: 'Original Reference' },
          { title: 'Replication Reference' },
          { title: 'Link' },
          { title: 'idx', visible: false }
        ],
        pageLength: 10,
        order: [[1, 'asc']],
        dom: 'frtip',
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
          $(this).find('.details-btn').text('+');
        } else {
          const studyIdx = row.data()[7];
          const study = self.filteredStudies[studyIdx];
          row.child(self.formatStudyDetails(study, criterion)).show();
          tr.addClass('shown');
          $(this).find('.details-btn').text('−');
        }
      });
    }
  },

  /**
   * Format study details for expanded row
   */
  formatStudyDetails(study, criterion) {
    const { outcomeReport } = FReD.successCriteria.getOutcome(study, criterion);

    return `
      <div class="study-details" style="padding: 1rem; background: var(--fred-bg-alt); border-radius: 4px; margin: 0.5rem;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
          <div>
            <h5 style="margin: 0 0 0.5rem 0; color: var(--fred-primary);">Effect Sizes</h5>
            <table style="font-size: 0.875rem;">
              <tr><td style="padding-right: 1rem;"><strong>Original ES (r):</strong></td><td>${FReD.utils.formatNumber(study.es_original, 3) || 'N/A'}</td></tr>
              <tr><td><strong>Replication ES (r):</strong></td><td>${FReD.utils.formatNumber(study.es_replication, 3) || 'N/A'}</td></tr>
              <tr><td><strong>Original N:</strong></td><td>${study.n_original || 'N/A'}</td></tr>
              <tr><td><strong>Replication N:</strong></td><td>${study.n_replication || 'N/A'}</td></tr>
            </table>
          </div>
          <div>
            <h5 style="margin: 0 0 0.5rem 0; color: var(--fred-primary);">Statistics</h5>
            <table style="font-size: 0.875rem;">
              <tr><td style="padding-right: 1rem;"><strong>Original p-value:</strong></td><td>${FReD.utils.formatNumber(study.p_value_original, 4) || 'N/A'}</td></tr>
              <tr><td><strong>Replication p-value:</strong></td><td>${FReD.utils.formatNumber(study.p_value_replication, 4) || 'N/A'}</td></tr>
              <tr><td><strong>Power:</strong></td><td>${FReD.utils.formatNumber(study.power_r, 2) || 'N/A'}</td></tr>
              <tr><td><strong>Outcome (${criterion}):</strong></td><td>${FReD.utils.capFirstLetter(outcomeReport || 'Not calculable')}</td></tr>
            </table>
          </div>
          <div>
            <h5 style="margin: 0 0 0.5rem 0; color: var(--fred-primary);">Confidence Intervals</h5>
            <table style="font-size: 0.875rem;">
              <tr><td style="padding-right: 1rem;"><strong>Original CI:</strong></td><td>[${FReD.utils.formatNumber(study.ci_lower_original, 3) || '?'}, ${FReD.utils.formatNumber(study.ci_upper_original, 3) || '?'}]</td></tr>
              <tr><td><strong>Replication CI:</strong></td><td>[${FReD.utils.formatNumber(study.ci_lower_replication, 3) || '?'}, ${FReD.utils.formatNumber(study.ci_upper_replication, 3) || '?'}]</td></tr>
            </table>
          </div>
        </div>
        ${study.osf_link ? `<p style="margin: 1rem 0 0 0;"><a href="${study.osf_link}" target="_blank">View on OSF →</a></p>` : ''}
      </div>
    `;
  },

  /**
   * Update the full data table
   */
  updateFullDataTable() {
    const tableData = this.filteredStudies.map(study => [
      FReD.utils.escapeHtml(study.description || ''),
      FReD.utils.formatNumber(study.es_original, 3),
      FReD.utils.formatNumber(study.es_replication, 3),
      study.n_original || '',
      study.n_replication || '',
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
        study.ref_original || '',
        study.ref_replication || ''
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
        ref_original: study.ref_original || '',
        ref_replication: study.ref_replication || '',
        es_original: study.es_original,
        es_replication: study.es_replication,
        n_original: study.n_original,
        n_replication: study.n_replication,
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
