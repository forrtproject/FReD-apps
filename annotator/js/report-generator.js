/**
 * FReD Annotator - Report Generator
 *
 * Generates HTML and Markdown reports for annotated reading lists
 * Uses the outcome field directly from FLoRA data (no success criteria calculations)
 */

window.FReD = window.FReD || {};

FReD.reportGenerator = {
  // Outcome symbols
  symbols: {
    success: { html: '<span style="color: darkgreen;">&#x2714;</span>', text: '[Re]' },
    failure: { html: '<span style="color: darkred;">&#x2716;</span>', text: '[¬Re]' },
    mixed: { html: '&#x2753;', text: '[?Re]' },
    inconclusive: { html: '&#x2754;', text: '[?]' },
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
    const assessed = this.assessOutcomes(grouped);

    // Generate report content
    return format === 'markdown'
      ? this.generateMarkdown(assessed)
      : this.generateHTML(assessed);
  },

  /**
   * Group studies by original DOI/reference
   */
  groupByOriginal(studies) {
    const grouped = {};

    studies.forEach(study => {
      const key = study.doi_original || study.ref_original || study.title_original;
      if (!grouped[key]) {
        grouped[key] = {
          doi_original: study.doi_original,
          ref_original: study.ref_original,
          title_original: study.title_original,
          year_original: study.year_original,
          replications: []
        };
      }
      grouped[key].replications.push(study);
    });

    return Object.values(grouped);
  },

  /**
   * Map outcome string to symbol key
   */
  getOutcomeKey(outcome) {
    if (!outcome) return 'not_coded';
    const lower = outcome.toLowerCase();
    if (lower.includes('success') || lower.includes('replicated') && !lower.includes('not')) return 'success';
    if (lower.includes('fail') || lower.includes('not replicated')) return 'failure';
    if (lower.includes('mixed')) return 'mixed';
    if (lower.includes('inconclusive')) return 'inconclusive';
    return 'not_coded';
  },

  /**
   * Assess outcomes for each original study
   */
  assessOutcomes(grouped) {
    return grouped.map(original => {
      // Get outcomes directly from the data
      const replicationOutcomes = original.replications.map(rep => ({
        ...rep,
        outcomeKey: this.getOutcomeKey(rep.outcome)
      }));

      // Determine overall outcome based on replications
      const validOutcomes = replicationOutcomes
        .map(r => r.outcomeKey)
        .filter(o => o && o !== 'not_coded');

      let overallOutcome;
      if (validOutcomes.length === 0) {
        overallOutcome = 'not_coded';
      } else if (validOutcomes.every(o => o === 'success')) {
        overallOutcome = 'success';
      } else if (validOutcomes.every(o => o === 'failure')) {
        overallOutcome = 'failure';
      } else if (validOutcomes.every(o => o === 'inconclusive')) {
        overallOutcome = 'inconclusive';
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
  generateHTML(assessed) {
    const legend = this.generateLegendHTML();

    let html = `
      <h1>Replication Report</h1>
      <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
      <p><em>Based on data from the FORRT Replication Database (FReD)</em></p>

      ${legend}

      <h2>Replication Outcomes</h2>
    `;

    if (assessed.length === 0) {
      html += '<p>No studies found in FReD database.</p>';
    } else {
      assessed.forEach(original => {
        const symbol = this.symbols[original.overallOutcome] || this.symbols.not_coded;
        const displayRef = original.ref_original || original.title_original || original.doi_original || 'Unknown';

        html += `
          <h5>${symbol.html} ${FReD.utils.escapeHtml(displayRef)}</h5>
          ${original.doi_original ? `<p style="font-size: 0.875rem;"><a href="https://doi.org/${original.doi_original}" target="_blank">https://doi.org/${original.doi_original}</a></p>` : ''}
          <ul>
        `;

        original.replications.forEach(rep => {
          const displayRepRef = rep.ref_replication || rep.title_replication || rep.doi_replication || 'Unknown';
          const outcomeText = rep.outcome || 'Not coded';

          html += `
            <li>
              <strong>${FReD.utils.escapeHtml(outcomeText)}:</strong>
              ${FReD.utils.escapeHtml(displayRepRef)}
              ${rep.doi_replication ? `<a href="https://doi.org/${rep.doi_replication}" target="_blank">[DOI]</a>` : ''}
              ${rep.url_replication ? `<a href="${rep.url_replication}" target="_blank">[Link]</a>` : ''}
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
  generateLegendHTML() {
    return `
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
        <tr>
          <td style="text-align: center;">${this.symbols.inconclusive.html}</td>
          <td><em>Inconclusive:</em> Results were inconclusive.</td>
        </tr>
        <tr>
          <td style="text-align: center;">${this.symbols.not_coded.html}</td>
          <td><em>Not Coded:</em> The outcome has not yet been coded.</td>
        </tr>
      </table>
    `;
  },

  /**
   * Generate Markdown report
   */
  generateMarkdown(assessed) {
    let md = `# Replication Report

**Generated:** ${new Date().toLocaleDateString()}

*Based on data from the FORRT Replication Database (FReD)*

### Legend

| Symbol | Meaning |
|:------:|:--------|
| ${this.symbols.success.text} | *Success:* All replications succeeded. |
| ${this.symbols.failure.text} | *Failure:* All replications failed. |
| ${this.symbols.mixed.text} | *Mixed Results:* Mixed outcomes. |
| ${this.symbols.inconclusive.text} | *Inconclusive:* Results inconclusive. |
| ${this.symbols.not_coded.text} | *Not Coded:* Not yet coded. |

## Replication Outcomes

`;

    if (assessed.length === 0) {
      md += 'No studies found in FReD database.\n';
    } else {
      assessed.forEach(original => {
        const symbol = this.symbols[original.overallOutcome] || this.symbols.not_coded;
        const displayRef = original.ref_original || original.title_original || original.doi_original || 'Unknown';

        md += `##### ${symbol.text} ${displayRef}`;
        if (original.doi_original) {
          md += ` [DOI](https://doi.org/${original.doi_original})`;
        }
        md += '\n\n';

        original.replications.forEach(rep => {
          const displayRepRef = rep.ref_replication || rep.title_replication || rep.doi_replication || 'Unknown';
          const outcomeText = rep.outcome || 'Not coded';

          md += `  - **${outcomeText}:** ${displayRepRef}`;
          if (rep.doi_replication) {
            md += ` [DOI](https://doi.org/${rep.doi_replication})`;
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
      .replace(/&#x2754;/g, '[?]')
      .replace(/&#x270F;/g, '[NC]');

    return div.textContent || div.innerText;
  }
};

window.FReD = FReD;
