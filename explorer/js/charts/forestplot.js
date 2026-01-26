/**
 * FReD Explorer - Forest Plot
 *
 * Creates a forest plot showing effect sizes with confidence intervals
 */

window.FReD = window.FReD || {};
FReD.charts = FReD.charts || {};

FReD.charts.forestplot = {
  container: null,
  autoRenderLimit: 50,  // Auto-render only if <= this many effects
  pageSize: 50,         // Effects per page when paginated
  pageSizeOptions: [25, 50, 100, 200],
  currentPage: 1,
  sortBy: 'alphabetical', // 'alphabetical', 'original', 'replication'
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
      s.es_r != null && !isNaN(s.es_r) &&
      s.ref_o
    );

    if (this.allValidStudies.length === 0) {
      this.container.innerHTML = '<div class="alert alert-info">No effects with effect size data to display.</div>';
      return;
    }

    // Assign effect numbers BEFORE sorting (based on original data order)
    this.assignEffectNumbers();

    // Apply sorting
    this.applySorting();

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
   * Assign effect numbers to each study (e.g., [1/3], [2/3], [3/3] for studies with same ref_o)
   * This is done BEFORE sorting so the numbering is stable
   */
  assignEffectNumbers() {
    // Count total effects per ref_o
    const refCounts = new Map();
    for (const study of this.allValidStudies) {
      const ref = study.ref_o || 'Unknown';
      refCounts.set(ref, (refCounts.get(ref) || 0) + 1);
    }

    // Assign numbers in order of appearance
    const refCurrentIndex = new Map();
    for (const study of this.allValidStudies) {
      const ref = study.ref_o || 'Unknown';
      const total = refCounts.get(ref);
      const current = (refCurrentIndex.get(ref) || 0) + 1;
      refCurrentIndex.set(ref, current);

      // Store the effect number info on the study object
      study._effectNum = current;
      study._effectTotal = total;
    }
  },

  /**
   * Apply current sorting to studies
   * Sorting is applied to ALL studies before pagination
   */
  applySorting() {
    switch (this.sortBy) {
      case 'original':
        // Sort by original effect size descending (largest at top)
        this.allValidStudies.sort((a, b) => (b.es_o || 0) - (a.es_o || 0));
        break;
      case 'replication':
        // Sort by replication effect size descending (largest at top)
        this.allValidStudies.sort((a, b) => (b.es_r || 0) - (a.es_r || 0));
        break;
      case 'alphabetical':
      default:
        // Sort alphabetically, then by effect number within same ref_o
        this.allValidStudies.sort((a, b) => {
          const refCompare = (a.ref_o || '').localeCompare(b.ref_o || '');
          if (refCompare !== 0) return refCompare;
          return (a._effectNum || 0) - (b._effectNum || 0);
        });
        break;
    }
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

    // Build page size options
    const pageSizeOptionsHtml = this.pageSizeOptions
      .map(size => `<option value="${size}" ${size === this.pageSize ? 'selected' : ''}>${size}</option>`)
      .join('');

    // Create controls container
    const controlsHtml = `
      <div class="forest-controls">
        <div class="forest-controls-left">
          <span class="text-muted">
            Showing ${startIdx + 1}-${endIdx} of ${totalEffects} effects
          </span>
          <div class="forest-control-group">
            <label for="forest-page-size" class="forest-control-label">Per page:</label>
            <select id="forest-page-size" class="form-select form-select-sm">
              ${pageSizeOptionsHtml}
            </select>
          </div>
          <div class="forest-control-group">
            <label for="forest-sort" class="forest-control-label">Sort:</label>
            <select id="forest-sort" class="form-select form-select-sm">
              <option value="alphabetical" ${this.sortBy === 'alphabetical' ? 'selected' : ''}>Alphabetically</option>
              <option value="original" ${this.sortBy === 'original' ? 'selected' : ''}>By original effect</option>
              <option value="replication" ${this.sortBy === 'replication' ? 'selected' : ''}>By replication effect</option>
            </select>
          </div>
        </div>
        <div class="forest-controls-right">
          <div class="btn-group">
            <button class="btn btn-sm btn-secondary" id="forest-prev" ${this.currentPage === 1 ? 'disabled' : ''}>
              &laquo; Prev
            </button>
            <span class="forest-page-indicator">
              ${this.currentPage}/${totalPages}
            </span>
            <button class="btn btn-sm btn-secondary" id="forest-next" ${this.currentPage === totalPages ? 'disabled' : ''}>
              Next &raquo;
            </button>
          </div>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-secondary" id="forest-download-png" title="Download as PNG">
              PNG
            </button>
            <button class="btn btn-sm btn-outline-secondary" id="forest-download-svg" title="Download as SVG">
              SVG
            </button>
          </div>
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

    // Page size selector
    document.getElementById('forest-page-size')?.addEventListener('change', (e) => {
      this.pageSize = parseInt(e.target.value, 10);
      this.currentPage = 1; // Reset to first page
      this.renderWithPagination();
    });

    // Sort selector
    document.getElementById('forest-sort')?.addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.applySorting();
      this.currentPage = 1; // Reset to first page
      this.renderWithPagination();
    });

    // Download buttons
    document.getElementById('forest-download-png')?.addEventListener('click', () => {
      this.downloadPlot('png');
    });

    document.getElementById('forest-download-svg')?.addEventListener('click', () => {
      this.downloadPlot('svg');
    });

    // Render the plot in the plot area
    const plotContainer = document.getElementById('forest-plot-area');
    this.renderPlotToElement(pageStudies, totalEffects, plotContainer);
  },

  /**
   * Download the plot as PNG or SVG
   */
  downloadPlot(format) {
    const plotArea = document.getElementById('forest-plot-area') || this.container;
    if (!plotArea) return;

    const filename = `forest-plot-${new Date().toISOString().slice(0, 10)}`;

    Plotly.downloadImage(plotArea, {
      format: format,
      filename: filename,
      width: 1200,
      height: plotArea.offsetHeight || 800,
      scale: 2
    });
  },

  /**
   * Render plot to container element (for <= autoRenderLimit effects)
   */
  renderPlot(validStudies, totalCount) {
    // Create controls with count info, sort options, and download buttons
    const controlsHtml = `
      <div class="forest-controls">
        <div class="forest-controls-left">
          <span class="text-muted">
            ${validStudies.length} effect sizes
          </span>
          <div class="forest-control-group">
            <label for="forest-sort-simple" class="forest-control-label">Sort:</label>
            <select id="forest-sort-simple" class="form-select form-select-sm">
              <option value="alphabetical" ${this.sortBy === 'alphabetical' ? 'selected' : ''}>Alphabetically</option>
              <option value="original" ${this.sortBy === 'original' ? 'selected' : ''}>By original effect</option>
              <option value="replication" ${this.sortBy === 'replication' ? 'selected' : ''}>By replication effect</option>
            </select>
          </div>
        </div>
        <div class="forest-controls-right">
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-secondary" id="forest-download-png-simple" title="Download as PNG">
              PNG
            </button>
            <button class="btn btn-sm btn-outline-secondary" id="forest-download-svg-simple" title="Download as SVG">
              SVG
            </button>
          </div>
        </div>
      </div>
      <div id="forest-plot-area-simple"></div>
    `;

    this.container.innerHTML = controlsHtml;

    // Sort selector
    document.getElementById('forest-sort-simple')?.addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.applySorting();
      this.renderPlot(this.allValidStudies, totalCount);
    });

    // Download buttons
    document.getElementById('forest-download-png-simple')?.addEventListener('click', () => {
      this.downloadPlotSimple('png');
    });

    document.getElementById('forest-download-svg-simple')?.addEventListener('click', () => {
      this.downloadPlotSimple('svg');
    });

    // Render the plot
    const plotContainer = document.getElementById('forest-plot-area-simple');
    this.renderPlotToElement(validStudies, totalCount, plotContainer);
  },

  /**
   * Download the plot as PNG or SVG (simple mode)
   */
  downloadPlotSimple(format) {
    const plotArea = document.getElementById('forest-plot-area-simple');
    if (!plotArea) return;

    const filename = `forest-plot-${new Date().toISOString().slice(0, 10)}`;

    Plotly.downloadImage(plotArea, {
      format: format,
      filename: filename,
      width: 1200,
      height: plotArea.offsetHeight || 800,
      scale: 2
    });
  },

  /**
   * Extract "Author (Year)" from a reference string
   * Converts "Smith, J., Jones, K., & Brown, M. (2020)" to "Smith et al. (2020)"
   * Converts "Smith, J., & Jones, K. (2020)" to "Smith & Jones (2020)"
   * Converts "Smith, J. (2020)" to "Smith (2020)"
   */
  extractAuthorYear(ref) {
    if (!ref) return 'Unknown';

    // First extract the year
    const yearMatch = ref.match(/\((\d{4})\)/);
    if (!yearMatch) {
      return this.truncateRef(ref, 35);
    }
    const year = yearMatch[1];

    // Get everything before the year
    const beforeYear = ref.substring(0, ref.indexOf(`(${year})`)).trim();

    // Check for "et al." already in the reference
    if (/et\s+al\.?/i.test(beforeYear)) {
      const etAlMatch = beforeYear.match(/^([A-Za-z\-']+)(?:,?\s+[A-Z]\.?,?)?\s+et\s+al\.?/i);
      if (etAlMatch) {
        return `${etAlMatch[1]} et al. (${year})`;
      }
    }

    // Split by common author separators to count authors
    // Pattern: "Surname, I., Surname2, I., & Surname3, I."
    // or "Surname, I., & Surname2, I."
    // or "Surname, I."

    // Extract surnames (words before commas followed by initials)
    const authorParts = beforeYear.split(/,\s*&\s*|,\s+(?=[A-Z][a-z])|;\s*|\s+&\s+/);

    // Filter to get actual author names (surname followed by optional initials)
    const surnames = [];
    for (const part of authorParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // Extract the surname (first word that's not an initial)
      const surnameMatch = trimmed.match(/^([A-Za-z\-']+)/);
      if (surnameMatch && surnameMatch[1].length > 1) {
        surnames.push(surnameMatch[1]);
      }
    }

    if (surnames.length === 0) {
      return this.truncateRef(ref, 35);
    }

    if (surnames.length === 1) {
      return `${surnames[0]} (${year})`;
    }

    if (surnames.length === 2) {
      return `${surnames[0]} & ${surnames[1]} (${year})`;
    }

    // 3+ authors: use "et al."
    return `${surnames[0]} et al. (${year})`;
  },

  /**
   * Format reference for hover display with line breaks
   */
  formatRefForHover(ref) {
    if (!ref) return 'Unknown';

    // Insert line breaks roughly every 50 characters, at word boundaries
    const maxLineLength = 50;
    const words = ref.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= maxLineLength) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines.join('<br>');
  },

  /**
   * Create unique axis labels with staggering for CONSECUTIVE effects from same original
   * Only staggers entries that are next to each other and share the same ref_o
   * Returns { yPositions: number[], tickvals: number[], ticktext: string[] }
   */
  createStaggeredLabels(validStudies) {
    const yPositions = [];
    const tickvals = [];
    const ticktext = [];

    let yPos = 0;
    let prevRef = null;

    for (let i = 0; i < validStudies.length; i++) {
      const study = validStudies[i];
      const ref = study.ref_o || 'Unknown';
      const effectNum = study._effectNum || 1;
      const effectTotal = study._effectTotal || 1;

      // Base label
      const baseLabel = this.extractAuthorYear(ref);

      // Add suffix if there are multiple effects from this original
      if (effectTotal > 1) {
        ticktext.push(`${baseLabel} [${effectNum}/${effectTotal}]`);
      } else {
        ticktext.push(baseLabel);
      }

      // Determine y position
      if (i === 0) {
        yPos = 0;
      } else if (ref === prevRef) {
        // Same ref_o as previous - stagger closer together
        yPos += 0.6;
      } else {
        // Different ref_o - normal spacing
        yPos += 1.0;
      }

      yPositions.push(yPos);
      tickvals.push(yPos);
      prevRef = ref;
    }

    return { yPositions, tickvals, ticktext };
  },

  /**
   * Render plot to specific element
   */
  renderPlotToElement(validStudies, totalCount, element) {
    if (!element) return;

    // Create staggered y positions for proper visualization
    const { yPositions, tickvals, ticktext } = this.createStaggeredLabels(validStudies);

    // Prepare hover data
    const hoverRefsOriginal = validStudies.map(s => this.formatRefForHover(s.ref_o));
    const hoverRefsReplication = validStudies.map(s => this.formatRefForHover(s.ref_r));

    // Original effect sizes
    const originalTrace = {
      x: validStudies.map(s => s.es_o),
      y: yPositions,
      customdata: hoverRefsOriginal,
      error_x: {
        type: 'data',
        symmetric: false,
        array: validStudies.map(s =>
          s.ci_upper_o != null ? s.ci_upper_o - s.es_o : 0
        ),
        arrayminus: validStudies.map(s =>
          s.ci_lower_o != null ? s.es_o - s.ci_lower_o : 0
        ),
        color: '#2563eb'  // Blue for original
      },
      type: 'scatter',
      mode: 'markers',
      name: 'Original',
      marker: {
        color: '#2563eb',  // Blue - visually dominant
        size: 8
      },
      hovertemplate: '<b>%{customdata}</b><br><br>Original r = %{x:.3f}<extra></extra>'
    };

    // Replication effect sizes
    const replicationTrace = {
      x: validStudies.map(s => s.es_r),
      y: yPositions,
      customdata: hoverRefsReplication,
      error_x: {
        type: 'data',
        symmetric: false,
        array: validStudies.map(s =>
          s.ci_upper_r != null ? s.ci_upper_r - s.es_r : 0
        ),
        arrayminus: validStudies.map(s =>
          s.ci_lower_r != null ? s.es_r - s.ci_lower_r : 0
        ),
        color: 'rgba(100,100,100,0.6)'  // Gray for replication
      },
      type: 'scatter',
      mode: 'markers',
      name: 'Replication',
      marker: {
        color: 'rgba(100,100,100,0.7)',  // Gray - less dominant
        size: 8
      },
      hovertemplate: '<b>%{customdata}</b><br><br>Replication r = %{x:.3f}<extra></extra>'
    };

    // Zero line
    const zeroLine = {
      x: [0, 0],
      y: [yPositions[0], yPositions[yPositions.length - 1]],
      type: 'scatter',
      mode: 'lines',
      line: { color: 'rgba(128,128,128,0.8)', width: 2 },
      hoverinfo: 'skip',
      showlegend: false
    };

    // Calculate x-axis range
    const allEffects = [
      ...validStudies.map(s => s.es_o).filter(x => x != null),
      ...validStudies.map(s => s.es_r).filter(x => x != null),
      ...validStudies.map(s => s.ci_lower_o).filter(x => x != null),
      ...validStudies.map(s => s.ci_upper_o).filter(x => x != null),
      ...validStudies.map(s => s.ci_lower_r).filter(x => x != null),
      ...validStudies.map(s => s.ci_upper_r).filter(x => x != null)
    ];

    const xMin = Math.floor(Math.min(...allEffects, -0.1) * 10) / 10;
    const xMax = Math.ceil(Math.max(...allEffects, 0.1) * 10) / 10;

    // Calculate dynamic height based on actual y range
    const yRange = yPositions[yPositions.length - 1] - yPositions[0];
    const plotHeight = Math.max(400, yRange * 25 + 100);

    // Get theme-aware layout
    const themeLayout = FReD.themeToggle ? FReD.themeToggle.getPlotlyLayout() : {};

    const layout = {
      paper_bgcolor: themeLayout.paper_bgcolor || '#FFFFFF',
      plot_bgcolor: themeLayout.plot_bgcolor || '#FFFFFF',
      font: themeLayout.font || {},
      xaxis: {
        title: 'Effect Size (r)',
        range: [xMin - 0.1, xMax + 0.1],
        zeroline: true,
        zerolinewidth: 2,
        zerolinecolor: themeLayout.xaxis?.zerolinecolor || 'rgba(128,128,128,0.5)',
        gridcolor: themeLayout.xaxis?.gridcolor,
        linecolor: themeLayout.xaxis?.linecolor,
        showline: false,
        mirror: false
      },
      yaxis: {
        automargin: true,
        range: [Math.max(...yPositions) + 0.5, -1],  // Reversed; -1 gives top padding above first entry at y=0
        tickmode: 'array',
        tickvals: tickvals,
        ticktext: ticktext,
        tickfont: { size: 10, color: themeLayout.font?.color },
        showgrid: false,
        showline: false,
        mirror: false,
        zeroline: false
      },
      legend: {
        orientation: 'h',
        y: 1.02,
        x: 1,
        xanchor: 'right',
        bgcolor: 'transparent',
        font: themeLayout.legend?.font || {}
      },
      margin: { t: 60, r: 20, b: 60, l: 200 },
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
