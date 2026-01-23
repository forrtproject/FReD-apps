/**
 * FReD Annotator - Report Generator
 *
 * Generates HTML and Markdown reports for annotated reading lists
 */

window.FReD = window.FReD || {};

FReD.reportGenerator = {
  // Outcome symbols
  symbols: {
    success: { html: '<span style="color: darkgreen;">&#x2714;</span>', text: '[Re]' },
    failure: { html: '<span style="color: darkred;">&#x2716;</span>', text: '[¬Re]' },
    mixed: { html: '&#x2753;', text: '[?Re]' },
    os_not_significant: { html: '&#x2754;', text: '[N/A]' },
    not_coded: { html: '&#x270F;', text: '[NC]' }
  },

  /**
   * Generate full report
   */
  generate(matchedStudies, criterion, options = {}) {
    const { format = 'html' } = options;

    // Group by original study
    const grouped = this.groupByOriginal(matchedStudies);

    // Assess outcomes for each original
    const assessed = this.assessOutcomes(grouped, criterion);

    // Generate report content
    return format === 'markdown'
      ? this.generateMarkdown(assessed, criterion)
      : this.generateHTML(assessed, criterion);
  },

  /**
   * Group studies by original DOI/reference
   */
  groupByOriginal(studies) {
    const grouped = {};

    studies.forEach(study => {
      const key = study.doi_original || study.ref_original;
      if (!grouped[key]) {
        grouped[key] = {
          doi_original: study.doi_original,
          ref_original: study.ref_original,
          retracted_original: study.retracted_original,
          replications: []
        };
      }
      grouped[key].replications.push(study);
    });

    return Object.values(grouped);
  },

  /**
   * Assess outcomes for each original study
   */
  assessOutcomes(grouped, criterion) {
    return grouped.map(original => {
      // Get outcome for each replication
      const replicationOutcomes = original.replications.map(rep => {
        const { outcome, outcomeReport } = FReD.successCriteria.getOutcome(rep, criterion);
        return {
          ...rep,
          outcome,
          outcomeReport
        };
      });

      // Determine overall outcome
      const validOutcomes = replicationOutcomes
        .map(r => r.outcome)
        .filter(o => o && o !== 'Not calculable' && o !== 'not calculable');

      let overallOutcome;
      if (validOutcomes.length === 0) {
        overallOutcome = 'not_coded';
      } else if (validOutcomes.every(o => o.toLowerCase() === 'success')) {
        overallOutcome = 'success';
      } else if (validOutcomes.every(o => o.toLowerCase() === 'failure' || o.toLowerCase().includes('failure'))) {
        overallOutcome = 'failure';
      } else if (validOutcomes.every(o => o.toLowerCase().includes('not significant'))) {
        overallOutcome = 'os_not_significant';
      } else {
        overallOutcome = 'mixed';
      }

      return {
        ...original,
        replications: replicationOutcomes,
        overallOutcome
      };
    });
  },

  /**
   * Generate HTML report
   */
  generateHTML(assessed, criterion) {
    const criterionInfo = FReD.successCriteria.getCriterion(criterion);
    const legend = this.generateLegendHTML(criterionInfo);

    let html = `
      <h1>Replication Report</h1>
      <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
      <p><strong>Success Criterion:</strong> ${criterionInfo?.label || criterion}</p>
      <p><em>${criterionInfo?.note || ''}</em></p>

      ${legend}

      <h2>Replication Outcomes</h2>
    `;

    if (assessed.length === 0) {
      html += '<p>No studies found in FReD database.</p>';
    } else {
      assessed.forEach(original => {
        const symbol = this.symbols[original.overallOutcome] || this.symbols.not_coded;
        const retractedWarning = original.retracted_original
          ? '<span class="retracted-warning"></span>'
          : '';

        html += `
          <h5>${symbol.html} ${retractedWarning}${FReD.utils.escapeHtml(original.ref_original)}</h5>
          ${original.doi_original ? `<p style="font-size: 0.875rem;"><a href="https://doi.org/${original.doi_original}" target="_blank">https://doi.org/${original.doi_original}</a></p>` : ''}
          <ul>
        `;

        original.replications.forEach(rep => {
          const retractedRep = rep.retracted_replication
            ? '<span class="retracted-warning"></span>'
            : '';
          html += `
            <li>
              <strong>${FReD.utils.capFirstLetter(rep.outcomeReport || 'Not calculable')}:</strong>
              ${retractedRep}${FReD.utils.escapeHtml(rep.ref_replication || 'Unknown')}
              ${rep.doi_replication ? `<a href="https://doi.org/${rep.doi_replication}" target="_blank">[DOI]</a>` : ''}
            </li>
          `;
        });

        html += '</ul>';
      });
    }

    return html;
  },

  /**
   * Generate legend HTML
   */
  generateLegendHTML(criterionInfo) {
    let legend = `
      <h3>Legend</h3>
      <table>
        <tr>
          <td style="text-align: center; width: 60px;">${this.symbols.success.html}</td>
          <td><em>Success:</em> All replications of the original study were successful.</td>
        </tr>
        <tr>
          <td style="text-align: center;">${this.symbols.failure.html}</td>
          <td><em>Failure:</em> All replications of the original study failed.</td>
        </tr>
        <tr>
          <td style="text-align: center;">${this.symbols.mixed.html}</td>
          <td><em>Mixed Results:</em> The replications had mixed outcomes.</td>
        </tr>
    `;

    if (criterionInfo?.hasOSNotSignificant) {
      legend += `
        <tr>
          <td style="text-align: center;">${this.symbols.os_not_significant.html}</td>
          <td><em>Original Not Significant:</em> The original study's p-value was >= .05.</td>
        </tr>
      `;
    }

    legend += `
        <tr>
          <td style="text-align: center;">${this.symbols.not_coded.html}</td>
          <td><em>Not Coded:</em> The outcome has not yet been coded.</td>
        </tr>
      </table>
    `;

    return legend;
  },

  /**
   * Generate Markdown report
   */
  generateMarkdown(assessed, criterion) {
    const criterionInfo = FReD.successCriteria.getCriterion(criterion);

    let md = `# Replication Report

**Generated:** ${new Date().toLocaleDateString()}

**Success Criterion:** ${criterionInfo?.label || criterion}

*${criterionInfo?.note || ''}*

### Legend

| Symbol | Meaning |
|:------:|:--------|
| ${this.symbols.success.text} | *Success:* All replications succeeded. |
| ${this.symbols.failure.text} | *Failure:* All replications failed. |
| ${this.symbols.mixed.text} | *Mixed Results:* Mixed outcomes. |
`;

    if (criterionInfo?.hasOSNotSignificant) {
      md += `| ${this.symbols.os_not_significant.text} | *Original Not Significant:* p >= .05 |\n`;
    }

    md += `| ${this.symbols.not_coded.text} | *Not Coded:* Not yet coded. |

## Replication Outcomes

`;

    if (assessed.length === 0) {
      md += 'No studies found in FReD database.\n';
    } else {
      assessed.forEach(original => {
        const symbol = this.symbols[original.overallOutcome] || this.symbols.not_coded;
        const retracted = original.retracted_original ? 'RETRACTED: ' : '';

        md += `##### ${symbol.text} ${retracted}${original.ref_original}`;
        if (original.doi_original) {
          md += ` [https://doi.org/${original.doi_original}](https://doi.org/${original.doi_original})`;
        }
        md += '\n\n';

        original.replications.forEach(rep => {
          const retractedRep = rep.retracted_replication ? 'RETRACTED: ' : '';
          md += `  - **${FReD.utils.capFirstLetter(rep.outcomeReport || 'Not calculable')}:** ${retractedRep}${rep.ref_replication || 'Unknown'}`;
          if (rep.doi_replication) {
            md += ` [https://doi.org/${rep.doi_replication}](https://doi.org/${rep.doi_replication})`;
          }
          md += '\n';
        });

        md += '\n';
      });
    }

    return md;
  },

  /**
   * Convert HTML to plain text for copying
   */
  htmlToText(html) {
    const div = document.createElement('div');
    div.innerHTML = html;

    // Convert symbols
    div.innerHTML = div.innerHTML
      .replace(/&#x2714;/g, '[Re]')
      .replace(/&#x2716;/g, '[¬Re]')
      .replace(/&#x2753;/g, '[?Re]')
      .replace(/&#x2754;/g, '[N/A]')
      .replace(/&#x270F;/g, '[NC]');

    return div.textContent || div.innerText;
  }
};

window.FReD = FReD;
