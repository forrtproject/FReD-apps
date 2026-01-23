/**
 * FReD Explorer - Bar Chart
 *
 * Creates a stacked bar chart showing outcome proportions
 */

window.FReD = window.FReD || {};
FReD.charts = FReD.charts || {};

FReD.charts.barchart = {
  container: null,
  countSpan: null,
  lastStudies: null,
  lastCriterion: null,

  /**
   * Initialize the bar chart
   */
  init(containerId) {
    this.container = document.getElementById(containerId);
    this.countSpan = document.getElementById('outcome-count');
    if (!this.container) {
      console.error('Barchart container not found:', containerId);
      return;
    }

    // Listen for theme changes
    window.addEventListener('themechange', () => {
      if (this.lastStudies && this.lastCriterion) {
        this.render(this.lastStudies, this.lastCriterion);
      }
    });
  },

  /**
   * Render the bar chart with given data
   */
  render(studies, criterion) {
    if (!this.container) return;

    // Store for re-rendering on theme change
    this.lastStudies = studies;
    this.lastCriterion = criterion;

    const total = studies.length;

    // Update the count in the header
    if (this.countSpan) {
      this.countSpan.textContent = `(${total} effects)`;
    }

    if (total === 0) {
      this.container.innerHTML = '<div class="alert alert-info">No studies selected.</div>';
      return;
    }

    // Get colors for current criterion
    const colors = FReD.successCriteria.getColorsForCriterion(criterion);

    // Count outcomes
    const counts = {};
    studies.forEach(study => {
      const { outcomeReport } = FReD.successCriteria.getOutcome(study, criterion);
      const outcome = FReD.utils.capFirstLetter(outcomeReport || 'Not calculable');
      counts[outcome] = (counts[outcome] || 0) + 1;
    });

    const outcomes = Object.keys(counts);

    // Sort by a logical order
    const outcomeOrder = [
      'Success', 'success',
      'Success (homogeneous and jointly significantly above 0)',
      'Failure (not homogeneous but jointly significantly above 0)',
      'Failure', 'failure',
      'Failure (reversal)', 'failure (reversal)',
      'Failure (not homogeneous and not significant)',
      'Failure (homogeneous but not significant)',
      'OS not significant',
      'Not calculable', 'not coded'
    ];

    outcomes.sort((a, b) => {
      const aIdx = outcomeOrder.findIndex(o => a.toLowerCase() === o.toLowerCase());
      const bIdx = outcomeOrder.findIndex(o => b.toLowerCase() === o.toLowerCase());
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    // Get theme-aware layout
    const themeLayout = FReD.themeToggle ? FReD.themeToggle.getPlotlyLayout() : {};
    const textColor = themeLayout.font?.color || '#333';

    // Create traces for stacked bar
    const traces = outcomes.map(outcome => {
      const count = counts[outcome];
      const proportion = count / total;
      const percentage = (proportion * 100).toFixed(1);

      // Only show text label if segment is wide enough (>5% of total)
      const showLabel = proportion >= 0.05;
      // Shorten label for narrow segments (5-15%)
      const labelText = proportion >= 0.15
        ? `${outcome}: ${percentage}%`
        : `${percentage}%`;

      return {
        x: [proportion],
        y: [''],
        type: 'bar',
        orientation: 'h',
        name: outcome,
        text: showLabel ? [labelText] : [''],
        textposition: 'inside',
        insidetextanchor: 'middle',
        textfont: {
          color: '#fff',
          size: 13
        },
        // Only show hover for segments without visible labels
        hoverinfo: showLabel ? 'none' : 'text',
        hovertext: [`${percentage}%`],
        marker: {
          color: colors[outcome] || colors[outcome.toLowerCase()] || '#C8C8C8'
        }
      };
    });

    const layout = {
      barmode: 'stack',
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: themeLayout.font || {},
      xaxis: {
        showticklabels: false,
        showgrid: false,
        zeroline: false,
        range: [0, 1],
        fixedrange: true
      },
      yaxis: {
        fixedrange: true,
        showticklabels: false,
        showgrid: false,
        zeroline: false
      },
      legend: {
        orientation: 'h',
        y: -0.4,
        x: 0.5,
        xanchor: 'center',
        traceorder: 'normal',
        bgcolor: 'transparent',
        font: {
          size: 12,
          color: textColor
        }
      },
      margin: { t: 5, r: 10, b: 35, l: 10 },
      height: 80,
      hoverlabel: {
        bgcolor: '#333',
        font: { color: '#fff', size: 12 }
      }
    };

    const config = {
      displayModeBar: false,
      responsive: true
    };

    Plotly.newPlot(this.container, traces, layout, config);
  },

  /**
   * Clear the plot
   */
  clear() {
    if (this.container) {
      Plotly.purge(this.container);
      this.container.innerHTML = '';
    }
    if (this.countSpan) {
      this.countSpan.textContent = '';
    }
  }
};

window.FReD = FReD;
