/**
 * FReD Static Apps - Success Criteria Definitions
 *
 * Mirrors the R implementation in replication_outcomes.R
 * Note: Client-side calculations are only for reference/validation.
 * The preprocessed JSON should have all outcomes pre-computed.
 */

window.FReD = window.FReD || {};

FReD.successCriteria = {
  // Criterion definitions
  criteria: {
    significance_r: {
      id: 'significance_r',
      label: 'Significance of Replication',
      shortLabel: 'Significance (Rep)',
      hasOSNotSignificant: true,
      note: 'Replication success was assessed based on the statistical significance of the replication effect (and whether its direction is consistent with the original effect). Replications that were significant and in the same direction as the original were considered as successes, while replications that were not significant or in the opposite direction were considered as failures.'
    },
    significance_agg: {
      id: 'significance_agg',
      label: 'Aggregated Significance',
      shortLabel: 'Aggregated Sig',
      hasOSNotSignificant: false,
      note: 'Replication success was assessed based on the aggregation of effect sizes from the original and replication studies using a meta-analytic approach. Replications where the combined effect was significantly different from zero were considered as successes, while those where the combined effect was not significant were considered as failures.'
    },
    consistency_ci: {
      id: 'consistency_ci',
      label: 'Consistency with CI',
      shortLabel: 'Consistency (CI)',
      hasOSNotSignificant: false,
      note: 'Replication success was assessed based on whether the original effect size fell within the confidence interval of the replication effect size. Replications where the original effect size was within the confidence interval were considered as successes, while those where it was outside were considered as failures.'
    },
    consistency_pi: {
      id: 'consistency_pi',
      label: 'Consistency with PI',
      shortLabel: 'Consistency (PI)',
      hasOSNotSignificant: false,
      note: 'Replication success was assessed based on whether the replication effect size fell within the prediction interval derived from the original study and replication sample size. Replications within the prediction interval were considered as successes, while those outside the prediction interval were considered as failures.'
    },
    homogeneity: {
      id: 'homogeneity',
      label: 'Homogeneity',
      shortLabel: 'Homogeneity',
      hasOSNotSignificant: false,
      note: 'Replication success was assessed based on the homogeneity of the effects from the original and replication studies using a heterogeneity test (Q-test). Replications where the effects were homogeneous were considered as successes, while those that showed heterogeneity were considered as failures.'
    },
    homogeneity_significance: {
      id: 'homogeneity_significance',
      label: 'Homogeneity & Significance',
      shortLabel: 'Homog. & Sig',
      hasOSNotSignificant: true,
      note: 'Replication success was assessed based on the combination of homogeneity and the significance of the effect sizes. Replications where the effects were homogeneous and jointly significantly different from zero were considered as successes, while those that were either not homogeneous or not significantly different from zero were considered as failures.'
    },
    small_telescopes: {
      id: 'small_telescopes',
      label: 'Small Telescopes',
      shortLabel: 'Small Telescopes',
      hasOSNotSignificant: false,
      note: 'Replication success was assessed based on whether the replication effect size was larger than the effect size that would have given the original study a power of 33%. Replications that met this criterion were considered as successes, while those that did not were considered as failures.'
    },
    reported_success: {
      id: 'reported_success',
      label: 'Reported Success',
      shortLabel: 'Reported',
      hasOSNotSignificant: false,
      note: 'Replication success was assessed based on the outcome reported in the replication study itself. This uses the pre-coded "result" field from the FReD database.'
    }
  },

  // Color mapping for outcomes
  colors: {
    // Common outcomes
    'success': '#8FBC8F',
    'Success': '#8FBC8F',
    'failure': '#FF7F7F',
    'Failure': '#FF7F7F',
    'failure (reversal)': 'darkred',
    'Failure (reversal)': 'darkred',
    'OS not significant': '#D3D3D3',
    'Not calculable': '#C8C8C8',
    'not calculable': '#C8C8C8',

    // Reported success outcomes (from FReD database)
    'successful': '#8FBC8F',
    'Successful': '#8FBC8F',
    'failed': '#FF7F7F',
    'Failed': '#FF7F7F',
    'mixed': '#FFD700',
    'Mixed': '#FFD700',
    'informative failure': '#FF7F7F',
    'Informative failure': '#FF7F7F',
    'uninformative': '#D3D3D3',
    'Uninformative': '#D3D3D3',
    'descriptive only': '#B0C4DE',
    'Descriptive only': '#B0C4DE',
    'statistically successful but flawed': '#9ACD32',
    'Statistically successful but flawed': '#9ACD32',

    // Homogeneity & significance specific
    'success (homogeneous and jointly significantly above 0)': '#8FBC8F',
    'Success (homogeneous and jointly significantly above 0)': '#8FBC8F',
    'failure (not homogeneous but jointly significantly above 0)': '#efa986',
    'Failure (not homogeneous but jointly significantly above 0)': '#efa986',
    'failure (not homogeneous and not significant)': 'darkred',
    'Failure (not homogeneous and not significant)': 'darkred',
    'failure (homogeneous but not significant)': '#FF7F7F',
    'Failure (homogeneous but not significant)': '#FF7F7F'
  },

  // Rug plot colors (significance indicators)
  rugColors: {
    significant: '#4DCCD0',
    notSignificant: '#FA948C'
  },

  /**
   * Get color for an outcome label
   */
  getColor(outcome) {
    if (!outcome) return this.colors['Not calculable'];
    return this.colors[outcome] || this.colors['Not calculable'];
  },

  /**
   * Get colors for a specific criterion
   */
  getColorsForCriterion(criterionId) {
    const criterion = this.criteria[criterionId];
    if (!criterion) return {};

    const colors = {
      'success': this.colors['success'],
      'Success': this.colors['Success'],
      'failure': this.colors['failure'],
      'Failure': this.colors['Failure'],
      'Not calculable': this.colors['Not calculable']
    };

    // Add criterion-specific colors
    if (criterion.hasOSNotSignificant) {
      colors['OS not significant'] = this.colors['OS not significant'];
    }

    if (criterionId === 'significance_r' || criterionId === 'significance_agg') {
      colors['failure (reversal)'] = this.colors['failure (reversal)'];
      colors['Failure (reversal)'] = this.colors['Failure (reversal)'];
    }

    if (criterionId === 'homogeneity_significance') {
      Object.assign(colors, {
        'success (homogeneous and jointly significantly above 0)': this.colors['success (homogeneous and jointly significantly above 0)'],
        'Success (homogeneous and jointly significantly above 0)': this.colors['Success (homogeneous and jointly significantly above 0)'],
        'failure (not homogeneous but jointly significantly above 0)': this.colors['failure (not homogeneous but jointly significantly above 0)'],
        'Failure (not homogeneous but jointly significantly above 0)': this.colors['Failure (not homogeneous but jointly significantly above 0)'],
        'failure (not homogeneous and not significant)': this.colors['failure (not homogeneous and not significant)'],
        'Failure (not homogeneous and not significant)': this.colors['Failure (not homogeneous and not significant)'],
        'failure (homogeneous but not significant)': this.colors['failure (homogeneous but not significant)'],
        'Failure (homogeneous but not significant)': this.colors['Failure (homogeneous but not significant)']
      });
    }

    // Add reported success colors
    if (criterionId === 'reported_success') {
      Object.assign(colors, {
        'successful': this.colors['successful'],
        'Successful': this.colors['Successful'],
        'failed': this.colors['failed'],
        'Failed': this.colors['Failed'],
        'mixed': this.colors['mixed'],
        'Mixed': this.colors['Mixed'],
        'informative failure': this.colors['informative failure'],
        'Informative failure': this.colors['Informative failure'],
        'uninformative': this.colors['uninformative'],
        'Uninformative': this.colors['Uninformative'],
        'descriptive only': this.colors['descriptive only'],
        'Descriptive only': this.colors['Descriptive only'],
        'statistically successful but flawed': this.colors['statistically successful but flawed'],
        'Statistically successful but flawed': this.colors['Statistically successful but flawed']
      });
    }

    return colors;
  },

  /**
   * Get outcome for a study based on pre-computed data
   */
  getOutcome(study, criterionId) {
    if (!study || !study.outcomes) {
      return { outcome: 'Not calculable', outcomeReport: 'Not calculable', color: this.colors['Not calculable'] };
    }

    // Special case for reported_success
    if (criterionId === 'reported_success') {
      const result = study.reported_success || study.result || 'Not calculable';
      return {
        outcome: result,
        outcomeReport: result,
        color: this.getColor(result)
      };
    }

    const outcomeData = study.outcomes[criterionId];
    if (!outcomeData) {
      return { outcome: 'Not calculable', outcomeReport: 'Not calculable', color: this.colors['Not calculable'] };
    }

    return {
      outcome: outcomeData.outcome || 'Not calculable',
      outcomeReport: outcomeData.outcome_report || outcomeData.outcome || 'Not calculable',
      color: this.getColor(outcomeData.outcome_report || outcomeData.outcome)
    };
  },

  /**
   * Calculate p-value from r and N (for reference)
   */
  pFromR(r, n) {
    if (r === null || n === null || isNaN(r) || isNaN(n) || n <= 2) return null;
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    // Two-tailed p-value using approximation
    const df = n - 2;
    const x = df / (df + t * t);
    // Incomplete beta approximation (simplified)
    const p = this._betaInc(df / 2, 0.5, x);
    return p;
  },

  /**
   * Incomplete beta function approximation
   */
  _betaInc(a, b, x) {
    // Simplified approximation for p-value calculation
    // For production use, consider a more robust implementation
    if (x === 0) return 0;
    if (x === 1) return 1;
    // Use normal approximation for large df
    if (a > 100) {
      const z = Math.sqrt(2 * a) * (Math.pow(x / (1 - x), 1/3) * (1 - 1/(9*a)) - (1 - 1/(9*b)));
      return 1 - this._normalCDF(Math.abs(z)) * 2;
    }
    // Fallback
    return 0.05; // Default fallback
  },

  /**
   * Normal CDF approximation
   */
  _normalCDF(x) {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
  },

  /**
   * Get all available criteria as array
   */
  getCriteriaList() {
    return Object.values(this.criteria);
  },

  /**
   * Get criterion by ID
   */
  getCriterion(id) {
    return this.criteria[id] || null;
  }
};

window.FReD = FReD;
