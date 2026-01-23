/**
 * FReD Explorer - Trend Charts
 *
 * Creates decade and journal trend visualizations
 */

window.FReD = window.FReD || {};
FReD.charts = FReD.charts || {};

FReD.charts.trends = {
  decadeContainer: null,
  journalContainer: null,
  lastStudies: null,
  lastCriterion: null,

  /**
   * Initialize trend charts
   */
  init(decadeContainerId, journalContainerId) {
    this.decadeContainer = document.getElementById(decadeContainerId);
    this.journalContainer = document.getElementById(journalContainerId);

    // Listen for theme changes
    window.addEventListener('themechange', () => {
      if (this.lastStudies && this.lastCriterion) {
        this.renderDecade(this.lastStudies, this.lastCriterion);
        this.renderJournal(this.lastStudies, this.lastCriterion);
      }
    });
  },

  /**
   * Render decade trend chart
   */
  renderDecade(studies, criterion) {
    if (!this.decadeContainer) return;

    // Store for re-rendering on theme change
    this.lastStudies = studies;
    this.lastCriterion = criterion;

    // Aggregate by reference to avoid counting same original multiple times
    const aggregated = FReD.dataLoader.aggregateByReference(studies, criterion);

    // Extract years and decades
    const withDecade = aggregated.map(item => {
      const year = FReD.utils.extractYear(item.ref_original);
      const decade = year ? FReD.utils.getDecade(year) : null;
      return { ...item, year, decade };
    }).filter(item => item.decade && item.decade >= 1950 && item.decade <= 2020);

    if (withDecade.length === 0) {
      this.decadeContainer.innerHTML = '<div class="alert alert-info">No valid publication years found.</div>';
      return;
    }

    // Group by decade and outcome
    const decadeOutcomes = {};
    withDecade.forEach(item => {
      const key = `${item.decade}-${item.outcome}`;
      if (!decadeOutcomes[item.decade]) {
        decadeOutcomes[item.decade] = {};
      }
      decadeOutcomes[item.decade][item.outcome] = (decadeOutcomes[item.decade][item.outcome] || 0) + 1;
    });

    // Get unique outcomes and decades
    const outcomes = [...new Set(withDecade.map(d => d.outcome))];
    const decades = Object.keys(decadeOutcomes).sort();

    // Get colors
    const colors = FReD.successCriteria.getColorsForCriterion(criterion);

    // Create traces
    const traces = outcomes.map(outcome => ({
      x: decades.map(d => parseInt(d)),
      y: decades.map(d => decadeOutcomes[d][outcome] || 0),
      type: 'scatter',
      mode: 'lines+markers',
      name: FReD.utils.capFirstLetter(outcome),
      line: { color: colors[outcome] || colors[FReD.utils.capFirstLetter(outcome)] || '#888' },
      marker: { color: colors[outcome] || colors[FReD.utils.capFirstLetter(outcome)] || '#888' }
    }));

    // Get theme-aware layout
    const themeLayout = FReD.themeToggle ? FReD.themeToggle.getPlotlyLayout() : {};

    const layout = {
      paper_bgcolor: themeLayout.paper_bgcolor || '#FFFFFF',
      plot_bgcolor: themeLayout.plot_bgcolor || '#FFFFFF',
      font: themeLayout.font || {},
      title: {
        text: `Aggregated replication outcomes by decade (k = ${withDecade.length} original studies)`,
        font: { size: 14, color: themeLayout.font?.color }
      },
      xaxis: {
        title: 'Decade the Original Finding was Published',
        dtick: 10,
        gridcolor: themeLayout.xaxis?.gridcolor,
        linecolor: themeLayout.xaxis?.linecolor
      },
      yaxis: {
        title: 'Number of Replication Findings',
        gridcolor: themeLayout.yaxis?.gridcolor,
        linecolor: themeLayout.yaxis?.linecolor
      },
      legend: {
        orientation: 'h',
        y: -0.2,
        x: 0.5,
        xanchor: 'center',
        bgcolor: 'transparent',
        font: themeLayout.legend?.font || {}
      },
      margin: { t: 60, r: 20, b: 80, l: 60 },
      hovermode: 'x unified'
    };

    const config = {
      displayModeBar: false,
      responsive: true
    };

    Plotly.newPlot(this.decadeContainer, traces, layout, config);
  },

  /**
   * Render journal bar chart
   */
  renderJournal(studies, criterion) {
    if (!this.journalContainer) return;

    // Aggregate by reference
    const aggregated = FReD.dataLoader.aggregateByReference(studies, criterion);

    // Filter to those with journal info
    const withJournal = aggregated.filter(item =>
      item.orig_journal &&
      !['consistent', 'inconsistent', 'mixed', 'success', 'failure'].includes(item.orig_journal.toLowerCase())
    );

    if (withJournal.length === 0) {
      this.journalContainer.innerHTML = '<div class="alert alert-info">No journal information available.</div>';
      return;
    }

    // Group by journal and outcome
    const journalOutcomes = {};
    withJournal.forEach(item => {
      const journal = this.capitalizeJournal(item.orig_journal);
      if (!journalOutcomes[journal]) {
        journalOutcomes[journal] = {};
      }
      journalOutcomes[journal][item.outcome] = (journalOutcomes[journal][item.outcome] || 0) + 1;
    });

    // Sort journals by total count
    const journalTotals = Object.entries(journalOutcomes).map(([journal, outcomes]) => ({
      journal,
      total: Object.values(outcomes).reduce((a, b) => a + b, 0)
    })).sort((a, b) => b.total - a.total);

    // Limit to top journals if too many
    const maxJournals = 30;
    const topJournals = journalTotals.slice(0, maxJournals).map(j => j.journal);

    // Get unique outcomes
    const outcomes = [...new Set(withJournal.map(d => d.outcome))];

    // Get colors
    const colors = FReD.successCriteria.getColorsForCriterion(criterion);

    // Create traces
    const traces = outcomes.map(outcome => ({
      x: topJournals.map(j => journalOutcomes[j][outcome] || 0),
      y: topJournals,
      type: 'bar',
      orientation: 'h',
      name: FReD.utils.capFirstLetter(outcome),
      marker: {
        color: colors[outcome] || colors[FReD.utils.capFirstLetter(outcome)] || '#888'
      }
    }));

    // Calculate dynamic height
    const plotHeight = Math.max(400, topJournals.length * 25 + 100);

    // Get theme-aware layout
    const themeLayout = FReD.themeToggle ? FReD.themeToggle.getPlotlyLayout() : {};

    const layout = {
      paper_bgcolor: themeLayout.paper_bgcolor || '#FFFFFF',
      plot_bgcolor: themeLayout.plot_bgcolor || '#FFFFFF',
      font: themeLayout.font || {},
      title: {
        text: `Aggregated replication outcomes by journal (k = ${withJournal.length} original studies)`,
        font: { size: 14, color: themeLayout.font?.color }
      },
      barmode: 'stack',
      xaxis: {
        title: 'Number of Replicated Original Studies',
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
      margin: { t: 60, r: 20, b: 60, l: 200 },
      height: plotHeight,
      hovermode: 'y unified'
    };

    const config = {
      displayModeBar: false,
      responsive: true
    };

    Plotly.newPlot(this.journalContainer, traces, layout, config);
  },

  /**
   * Capitalize journal name properly
   */
  capitalizeJournal(name) {
    if (!name) return 'Unknown';
    return name.replace(/\b\w/g, c => c.toUpperCase());
  },

  /**
   * Clear charts
   */
  clear() {
    if (this.decadeContainer) {
      Plotly.purge(this.decadeContainer);
      this.decadeContainer.innerHTML = '';
    }
    if (this.journalContainer) {
      Plotly.purge(this.journalContainer);
      this.journalContainer.innerHTML = '';
    }
  }
};

window.FReD = FReD;
