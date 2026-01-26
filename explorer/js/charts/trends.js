/**
 * FReD Explorer - Trend Charts
 *
 * Creates decade and journal trend visualizations
 */

window.FReD = window.FReD || {};
FReD.charts = FReD.charts || {};

FReD.charts.trends = {
  decadeContainer: null,
  disciplineContainer: null,
  lastStudies: null,
  lastCriterion: null,

  /**
   * Initialize trend charts
   */
  init(decadeContainerId, disciplineContainerId) {
    this.decadeContainer = document.getElementById(decadeContainerId);
    this.disciplineContainer = document.getElementById(disciplineContainerId);

    // Listen for theme changes
    window.addEventListener('themechange', () => {
      if (this.lastStudies && this.lastCriterion) {
        this.renderDecade(this.lastStudies, this.lastCriterion);
        this.renderDiscipline(this.lastStudies, this.lastCriterion);
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
      const year = FReD.utils.extractYear(item.ref_o);
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

    // Get colors - include mixed color explicitly
    const colors = FReD.successCriteria.getColorsForCriterion(criterion);
    colors['mixed'] = '#DAA520';  // Goldenrod - darker yellow
    colors['Mixed'] = '#DAA520';

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
   * Render discipline bar chart
   */
  renderDiscipline(studies, criterion) {
    if (!this.disciplineContainer) return;

    // Aggregate by reference
    const aggregated = FReD.dataLoader.aggregateByReference(studies, criterion);

    // Filter to those with discipline info
    const withDiscipline = aggregated.filter(item =>
      item.discipline &&
      item.discipline.trim() !== ''
    );

    if (withDiscipline.length === 0) {
      this.disciplineContainer.innerHTML = '<div class="alert alert-info">No discipline information available.</div>';
      return;
    }

    // Group by discipline and outcome
    const disciplineOutcomes = {};
    withDiscipline.forEach(item => {
      const discipline = this.capitalizeDiscipline(item.discipline);
      if (!disciplineOutcomes[discipline]) {
        disciplineOutcomes[discipline] = {};
      }
      disciplineOutcomes[discipline][item.outcome] = (disciplineOutcomes[discipline][item.outcome] || 0) + 1;
    });

    // Calculate totals and identify small disciplines (<10 replications)
    const MIN_COUNT = 10;
    const disciplineTotals = Object.entries(disciplineOutcomes).map(([discipline, outcomes]) => ({
      discipline,
      total: Object.values(outcomes).reduce((a, b) => a + b, 0),
      outcomes
    }));

    // Separate large and small disciplines
    const largeDisciplines = disciplineTotals.filter(d => d.total >= MIN_COUNT);
    const smallDisciplines = disciplineTotals.filter(d => d.total < MIN_COUNT);

    // Merge small disciplines into "Other"
    if (smallDisciplines.length > 0) {
      const otherOutcomes = {};
      smallDisciplines.forEach(d => {
        Object.entries(d.outcomes).forEach(([outcome, count]) => {
          otherOutcomes[outcome] = (otherOutcomes[outcome] || 0) + count;
        });
      });
      const otherTotal = Object.values(otherOutcomes).reduce((a, b) => a + b, 0);
      if (otherTotal > 0) {
        largeDisciplines.push({
          discipline: 'Other',
          total: otherTotal,
          outcomes: otherOutcomes
        });
      }
    }

    // Sort by total (largest first), with "Other" always at the end
    largeDisciplines.sort((a, b) => {
      if (a.discipline === 'Other') return 1;
      if (b.discipline === 'Other') return -1;
      return b.total - a.total;
    });

    // For horizontal bar chart, reverse order so largest is at top
    const sortedDisciplines = largeDisciplines.reverse();
    const displayDisciplines = sortedDisciplines.map(d => d.discipline);

    // Build outcomes map for sorted disciplines
    const finalDisciplineOutcomes = {};
    sortedDisciplines.forEach(d => {
      finalDisciplineOutcomes[d.discipline] = d.outcomes;
    });

    // Get unique outcomes and define display order
    const allOutcomes = new Set();
    sortedDisciplines.forEach(d => {
      Object.keys(d.outcomes).forEach(o => allOutcomes.add(o));
    });

    // Define outcome order for consistent legend
    const outcomeOrder = ['success', 'Success', 'failure', 'Failure', 'mixed', 'Mixed',
                          'OS not significant', 'Not calculable', 'not calculable'];
    const outcomes = [...allOutcomes].sort((a, b) => {
      const aIdx = outcomeOrder.findIndex(o => o.toLowerCase() === a.toLowerCase());
      const bIdx = outcomeOrder.findIndex(o => o.toLowerCase() === b.toLowerCase());
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    // Get colors - include mixed color explicitly
    const colors = FReD.successCriteria.getColorsForCriterion(criterion);
    // Ensure mixed has the right color (dark yellow)
    colors['mixed'] = '#DAA520';  // Goldenrod - darker yellow
    colors['Mixed'] = '#DAA520';

    // Create traces
    const traces = outcomes.map(outcome => ({
      x: displayDisciplines.map(d => finalDisciplineOutcomes[d][outcome] || 0),
      y: displayDisciplines,
      type: 'bar',
      orientation: 'h',
      name: FReD.utils.capFirstLetter(outcome),
      marker: {
        color: colors[outcome] || colors[FReD.utils.capFirstLetter(outcome)] || '#888'
      }
    }));

    // Calculate dynamic height based on number of disciplines
    const plotHeight = Math.max(250, displayDisciplines.length * 40 + 120);

    // Get theme-aware layout
    const themeLayout = FReD.themeToggle ? FReD.themeToggle.getPlotlyLayout() : {};

    const layout = {
      paper_bgcolor: themeLayout.paper_bgcolor || '#FFFFFF',
      plot_bgcolor: themeLayout.plot_bgcolor || '#FFFFFF',
      font: themeLayout.font || {},
      barmode: 'stack',
      xaxis: {
        title: 'Number of Replicated Original Studies',
        gridcolor: themeLayout.xaxis?.gridcolor,
        linecolor: themeLayout.xaxis?.linecolor
      },
      yaxis: {
        automargin: true,
        tickfont: { size: 12, color: themeLayout.font?.color },
        gridcolor: themeLayout.yaxis?.gridcolor,
        linecolor: themeLayout.yaxis?.linecolor
      },
      legend: {
        orientation: 'h',
        y: 1.02,
        x: 0.5,
        xanchor: 'center',
        yanchor: 'bottom',
        bgcolor: 'transparent',
        font: { size: 11, color: themeLayout.font?.color },
        traceorder: 'normal'
      },
      margin: { t: 40, r: 20, b: 50, l: 180 },
      height: plotHeight,
      hovermode: 'y unified'
    };

    const config = {
      displayModeBar: false,
      responsive: true
    };

    Plotly.newPlot(this.disciplineContainer, traces, layout, config);
  },

  /**
   * Capitalize discipline name properly
   */
  capitalizeDiscipline(name) {
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
    if (this.disciplineContainer) {
      Plotly.purge(this.disciplineContainer);
      this.disciplineContainer.innerHTML = '';
    }
  }
};

window.FReD = FReD;
