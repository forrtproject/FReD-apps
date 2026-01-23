/**
 * FReD Explorer - Forest Plot
 *
 * Creates a forest plot (blobbogram) showing effect sizes with confidence intervals
 */

window.FReD = window.FReD || {};
FReD.charts = FReD.charts || {};

FReD.charts.forestplot = {
  container: null,
  autoRenderLimit: 50,  // Auto-render only if <= this many effects
  pageSize: 50,         // Effects per page when paginated
  currentPage: 1,
  allValidStudies: [],
  lastStudies: null,

  /**
   * Initialize the forest plot
   */
  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('Forest plot container not found:', containerId);
      return;
    }

    // Listen for theme changes
    window.addEventListener('themechange', () => {
      if (this.lastStudies) {
        this.render(this.lastStudies);
      }
    });
  },

  /**
   * Render the forest plot with given data
   */
  render(studies) {
    if (!this.container) return;

    // Store for re-rendering on theme change
    this.lastStudies = studies;

    // Filter studies with valid effect sizes and references
    this.allValidStudies = studies.filter(s =>
      s.es_replication != null && !isNaN(s.es_replication) &&
      s.ref_original
    );

    if (this.allValidStudies.length === 0) {
      this.container.innerHTML = '<div class="alert alert-info">No effects with effect size data to display.</div>';
      return;
    }

    // Sort by replication effect size
    this.allValidStudies.sort((a, b) => (a.es_replication || 0) - (b.es_replication || 0));

    const totalEffects = this.allValidStudies.length;

    // If within auto-render limit, show directly
    if (totalEffects <= this.autoRenderLimit) {
      this.renderPlot(this.allValidStudies, totalEffects);
      return;
    }

    // Otherwise, show pagination controls
    this.currentPage = 1;
    this.renderWithPagination();
  },

  /**
   * Render with pagination controls
   */
  renderWithPagination() {
    const totalEffects = this.allValidStudies.length;
    const totalPages = Math.ceil(totalEffects / this.pageSize);
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const endIdx = Math.min(startIdx + this.pageSize, totalEffects);
    const pageStudies = this.allValidStudies.slice(startIdx, endIdx);

    // Create controls container
    const controlsHtml = `
      <div class="forest-controls" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div class="text-muted">
          Showing ${startIdx + 1}-${endIdx} of ${totalEffects} effects
        </div>
        <div class="btn-group">
          <button class="btn btn-sm btn-secondary" id="forest-prev" ${this.currentPage === 1 ? 'disabled' : ''}>
            &laquo; Previous
          </button>
          <span style="padding: 0.25rem 0.75rem; font-size: 0.875rem;">
            Page ${this.currentPage} of ${totalPages}
          </span>
          <button class="btn btn-sm btn-secondary" id="forest-next" ${this.currentPage === totalPages ? 'disabled' : ''}>
            Next &raquo;
          </button>
        </div>
      </div>
      <div id="forest-plot-area"></div>
    `;

    this.container.innerHTML = controlsHtml;

    // Setup event listeners for pagination
    document.getElementById('forest-prev')?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderWithPagination();
      }
    });

    document.getElementById('forest-next')?.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderWithPagination();
      }
    });

    // Render the plot in the plot area
    const plotContainer = document.getElementById('forest-plot-area');
    this.renderPlotToElement(pageStudies, totalEffects, plotContainer);
  },

  /**
   * Render plot to container element
   */
  renderPlot(validStudies, totalCount) {
    this.renderPlotToElement(validStudies, totalCount, this.container);
  },

  /**
   * Render plot to specific element
   */
  renderPlotToElement(validStudies, totalCount, element) {
    if (!element) return;

    // Prepare data
    const references = validStudies.map(s => this.truncateRef(s.ref_original, 60));

    // Original effect sizes
    const originalTrace = {
      x: validStudies.map(s => s.es_original),
      y: references,
      error_x: {
        type: 'data',
        symmetric: false,
        array: validStudies.map(s =>
          s.ci_upper_original != null ? s.ci_upper_original - s.es_original : 0
        ),
        arrayminus: validStudies.map(s =>
          s.ci_lower_original != null ? s.es_original - s.ci_lower_original : 0
        ),
        color: 'rgba(128,128,128,0.5)'
      },
      type: 'scatter',
      mode: 'markers',
      name: 'Original',
      marker: {
        color: 'rgba(128,128,128,0.5)',
        size: 8
      },
      hovertemplate: '%{y}<br>Original r = %{x:.3f}<extra></extra>'
    };

    // Replication effect sizes
    const replicationTrace = {
      x: validStudies.map(s => s.es_replication),
      y: references,
      error_x: {
        type: 'data',
        symmetric: false,
        array: validStudies.map(s =>
          s.ci_upper_replication != null ? s.ci_upper_replication - s.es_replication : 0
        ),
        arrayminus: validStudies.map(s =>
          s.ci_lower_replication != null ? s.es_replication - s.ci_lower_replication : 0
        ),
        color: 'rgba(0,0,0,0.7)'
      },
      type: 'scatter',
      mode: 'markers',
      name: 'Replication',
      marker: {
        color: 'black',
        size: 8
      },
      hovertemplate: '%{y}<br>Replication r = %{x:.3f}<extra></extra>'
    };

    // Zero line
    const zeroLine = {
      x: [0, 0],
      y: [references[0], references[references.length - 1]],
      type: 'scatter',
      mode: 'lines',
      line: { color: 'rgba(128,128,128,0.8)', width: 2 },
      hoverinfo: 'skip',
      showlegend: false
    };

    // Calculate x-axis range
    const allEffects = [
      ...validStudies.map(s => s.es_original).filter(x => x != null),
      ...validStudies.map(s => s.es_replication).filter(x => x != null),
      ...validStudies.map(s => s.ci_lower_original).filter(x => x != null),
      ...validStudies.map(s => s.ci_upper_original).filter(x => x != null),
      ...validStudies.map(s => s.ci_lower_replication).filter(x => x != null),
      ...validStudies.map(s => s.ci_upper_replication).filter(x => x != null)
    ];

    const xMin = Math.floor(Math.min(...allEffects, -0.1) * 10) / 10;
    const xMax = Math.ceil(Math.max(...allEffects, 0.1) * 10) / 10;

    // Calculate dynamic height
    const plotHeight = Math.max(400, validStudies.length * 25 + 100);

    const title = `${validStudies.length} effect sizes${totalCount > validStudies.length ? ` (of ${totalCount} total)` : ''}`;

    // Get theme-aware layout
    const themeLayout = FReD.themeToggle ? FReD.themeToggle.getPlotlyLayout() : {};

    const layout = {
      paper_bgcolor: themeLayout.paper_bgcolor || '#FFFFFF',
      plot_bgcolor: themeLayout.plot_bgcolor || '#FFFFFF',
      font: themeLayout.font || {},
      title: {
        text: title,
        font: { size: 14, color: themeLayout.font?.color }
      },
      xaxis: {
        title: 'Effect Size (r)',
        range: [xMin - 0.1, xMax + 0.1],
        zeroline: true,
        zerolinewidth: 2,
        zerolinecolor: themeLayout.xaxis?.zerolinecolor || 'rgba(128,128,128,0.5)',
        gridcolor: themeLayout.xaxis?.gridcolor,
        linecolor: themeLayout.xaxis?.linecolor
      },
      yaxis: {
        automargin: true,
        tickfont: { size: 10, color: themeLayout.font?.color },
        gridcolor: themeLayout.yaxis?.gridcolor,
        linecolor: themeLayout.yaxis?.linecolor
      },
      legend: {
        orientation: 'h',
        y: 1.05,
        x: 0.5,
        xanchor: 'center',
        bgcolor: 'transparent',
        font: themeLayout.legend?.font || {}
      },
      margin: { t: 60, r: 20, b: 60, l: 250 },
      height: plotHeight,
      hovermode: 'closest'
    };

    const config = {
      displayModeBar: false,
      responsive: true,
      scrollZoom: false
    };

    Plotly.newPlot(element, [zeroLine, originalTrace, replicationTrace], layout, config);
  },

  /**
   * Truncate reference string
   */
  truncateRef(ref, maxLen) {
    if (!ref) return 'Unknown';
    if (ref.length <= maxLen) return ref;
    return ref.substring(0, maxLen - 3) + '...';
  },

  /**
   * Clear the plot
   */
  clear() {
    if (this.container) {
      Plotly.purge(this.container);
      this.container.innerHTML = '';
    }
  }
};

window.FReD = FReD;
