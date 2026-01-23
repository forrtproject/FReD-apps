/**
 * FReD Explorer - Scatterplot Chart
 *
 * Creates an interactive scatterplot of original vs replication effect sizes
 */

window.FReD = window.FReD || {};
FReD.charts = FReD.charts || {};

FReD.charts.scatterplot = {
  container: null,
  lastStudies: null,
  lastCriterion: null,

  /**
   * Initialize the scatterplot
   */
  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('Scatterplot container not found:', containerId);
      return;
    }
    this.container.classList.add('loading');

    // Listen for theme changes
    window.addEventListener('themechange', () => {
      if (this.lastStudies && this.lastCriterion) {
        this.render(this.lastStudies, this.lastCriterion);
      }
    });
  },

  /**
   * Render the scatterplot with given data
   */
  render(studies, criterion) {
    if (!this.container) return;

    // Store for re-rendering on theme change
    this.lastStudies = studies;
    this.lastCriterion = criterion;

    this.container.classList.add('loading');

    // Filter out studies without effect sizes
    const validStudies = studies.filter(s =>
      s.es_original != null && !isNaN(s.es_original) &&
      s.es_replication != null && !isNaN(s.es_replication)
    );

    if (validStudies.length === 0) {
      this.container.innerHTML = '<div class="alert alert-info">No studies with effect size data to display.</div>';
      this.container.classList.remove('loading');
      return;
    }

    // Get colors for current criterion
    const colors = FReD.successCriteria.getColorsForCriterion(criterion);

    // Group studies by outcome for coloring
    const tracesByOutcome = {};

    validStudies.forEach(study => {
      const { outcomeReport, color } = FReD.successCriteria.getOutcome(study, criterion);
      const outcome = FReD.utils.capFirstLetter(outcomeReport || 'Not calculable');

      if (!tracesByOutcome[outcome]) {
        tracesByOutcome[outcome] = {
          x: [],
          y: [],
          text: [],
          color: colors[outcome] || colors[outcomeReport] || '#C8C8C8'
        };
      }

      tracesByOutcome[outcome].x.push(study.es_original);
      tracesByOutcome[outcome].y.push(study.es_replication);
      tracesByOutcome[outcome].text.push(
        `${study.description || 'No description'}<br>` +
        `r(original) = ${FReD.utils.formatNumber(study.es_original, 3)}<br>` +
        `r(replication) = ${FReD.utils.formatNumber(study.es_replication, 3)}`
      );
    });

    // Create scatter traces
    const traces = [];

    // Define order for legend
    const outcomeOrder = [
      'Success', 'success',
      'Failure', 'failure',
      'Failure (reversal)', 'failure (reversal)',
      'OS not significant',
      'Not calculable', 'not calculable'
    ];

    // Sort outcomes for consistent legend order
    const sortedOutcomes = Object.keys(tracesByOutcome).sort((a, b) => {
      const aIdx = outcomeOrder.findIndex(o => a.toLowerCase().includes(o.toLowerCase()));
      const bIdx = outcomeOrder.findIndex(o => b.toLowerCase().includes(o.toLowerCase()));
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    sortedOutcomes.forEach(outcome => {
      const data = tracesByOutcome[outcome];
      traces.push({
        x: data.x,
        y: data.y,
        text: data.text,
        type: 'scatter',
        mode: 'markers',
        name: outcome,
        marker: {
          color: data.color,
          size: Math.max(6, 12 - Math.log10(validStudies.length) * 2),
          line: { color: 'rgba(50,50,50,0.5)', width: 1 }
        },
        hovertemplate: '%{text}<extra></extra>'
      });
    });

    // Add diagonal line (x = y)
    traces.push({
      x: [0, 1],
      y: [0, 1],
      type: 'scatter',
      mode: 'lines',
      name: 'x = y',
      line: { color: 'rgba(128,128,128,0.5)', dash: 'solid' },
      hoverinfo: 'skip',
      showlegend: false
    });

    // Add horizontal line at y = 0
    traces.push({
      x: [0, 1],
      y: [0, 0],
      type: 'scatter',
      mode: 'lines',
      name: 'y = 0',
      line: { color: 'rgba(0,0,0,0.3)', dash: 'dash' },
      hoverinfo: 'skip',
      showlegend: false
    });

    // Create rug plots for significance
    const sigOriginal = validStudies.filter(s => s.p_value_original != null && s.p_value_original < 0.05);
    const nsOriginal = validStudies.filter(s => s.p_value_original != null && s.p_value_original >= 0.05);
    const sigReplication = validStudies.filter(s => s.p_value_replication != null && s.p_value_replication < 0.05);
    const nsReplication = validStudies.filter(s => s.p_value_replication != null && s.p_value_replication >= 0.05);

    // Bottom rug (original significance) - using bar shapes for better visibility
    if (sigOriginal.length > 0) {
      traces.push({
        x: sigOriginal.map(s => s.es_original),
        y: sigOriginal.map(() => -0.52),
        type: 'scatter',
        mode: 'markers',
        marker: { symbol: 'line-ns', size: 12, color: '#4DCCD0', line: { width: 2, color: '#4DCCD0' } },
        hoverinfo: 'skip',
        showlegend: false
      });
    }

    if (nsOriginal.length > 0) {
      traces.push({
        x: nsOriginal.map(s => s.es_original),
        y: nsOriginal.map(() => -0.52),
        type: 'scatter',
        mode: 'markers',
        marker: { symbol: 'line-ns', size: 12, color: '#FA948C', line: { width: 2, color: '#FA948C' } },
        hoverinfo: 'skip',
        showlegend: false
      });
    }

    // Left rug (replication significance)
    if (sigReplication.length > 0) {
      traces.push({
        x: sigReplication.map(() => -0.02),
        y: sigReplication.map(s => s.es_replication),
        type: 'scatter',
        mode: 'markers',
        marker: { symbol: 'line-ew', size: 12, color: '#4DCCD0', line: { width: 2, color: '#4DCCD0' } },
        hoverinfo: 'skip',
        showlegend: false
      });
    }

    if (nsReplication.length > 0) {
      traces.push({
        x: nsReplication.map(() => -0.02),
        y: nsReplication.map(s => s.es_replication),
        type: 'scatter',
        mode: 'markers',
        marker: { symbol: 'line-ew', size: 12, color: '#FA948C', line: { width: 2, color: '#FA948C' } },
        hoverinfo: 'skip',
        showlegend: false
      });
    }

    // Get theme-aware layout
    const themeLayout = FReD.themeToggle ? FReD.themeToggle.getPlotlyLayout() : {};

    const layout = {
      paper_bgcolor: themeLayout.paper_bgcolor || '#FFFFFF',
      plot_bgcolor: themeLayout.plot_bgcolor || '#FFFFFF',
      font: themeLayout.font || {},
      xaxis: {
        title: 'Original Effect Size (r)',
        range: [-0.05, 1.05],
        fixedrange: true,
        dtick: 0.25,
        gridcolor: themeLayout.xaxis?.gridcolor,
        linecolor: themeLayout.xaxis?.linecolor,
        tickcolor: themeLayout.xaxis?.tickcolor
      },
      yaxis: {
        title: 'Replication Effect Size (r)',
        range: [-0.55, 1.05],
        fixedrange: true,
        dtick: 0.25,
        gridcolor: themeLayout.yaxis?.gridcolor,
        linecolor: themeLayout.yaxis?.linecolor,
        tickcolor: themeLayout.yaxis?.tickcolor
      },
      legend: {
        orientation: 'h',
        y: 1.1,
        x: 0.5,
        xanchor: 'center',
        bgcolor: 'transparent',
        font: themeLayout.legend?.font || {}
      },
      margin: { t: 60, r: 20, b: 60, l: 60 },
      hovermode: 'closest'
    };

    const config = {
      displayModeBar: false,
      responsive: true
    };

    Plotly.newPlot(this.container, traces, layout, config);
    this.container.classList.remove('loading');
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
