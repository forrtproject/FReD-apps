/**
 * FReD Annotator - Report Generator
 *
 * Generates HTML and Markdown reports for annotated reading lists
 * Uses the outcome field directly from FLoRA data (no success criteria calculations)
 */

window.FReD = window.FReD || {};

FReD.reportGenerator = {
  // Outcome symbols - using text characters that respond to CSS color
  // Note: getSymbol() method provides theme-aware symbols
  symbols: {
    success: { html: '<span style="color: #166534;">&#x2714;</span>', text: '[Re]' },  // ✔
    failure: { html: '<span style="color: #991B1B;">&#x2716;</span>', text: '[¬Re]' },  // ✖
    mixed: { html: '<span style="color: #A16207; font-weight: bold;">?</span>', text: '[?Re]' },  // Plain ?
    inconclusive: { html: '<span style="color: #666;">~</span>', text: '[?]' },
    not_coded: { html: '<span style="color: #666;">&#x270F;</span>', text: '[NC]' }  // ✏
  },

  /**
   * Get symbol with theme-aware styling
   */
  getSymbol(key) {
    const symbol = this.symbols[key] || this.symbols.not_coded;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    if (key === 'mixed') {
      // In light mode, add visible outline for visibility; in dark mode, use brighter yellow
      const style = isDark
        ? 'color: #EAB308; font-weight: bold;'  // Brighter yellow for dark mode
        : 'color: #A16207; font-weight: bold; text-shadow: -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px 0.5px 0 #000;';  // Black outline for light mode
      return { html: `<span style="${style}">?</span>`, text: symbol.text };
    }
    return symbol;
  },

  /**
   * Generate full report
   */
  generate(matchedStudies, criterion, options = {}) {
    const { format = 'html', retractedDOIs = new Map(), inputDOIs = new Set() } = options;

    // Group by original study
    const grouped = this.groupByOriginal(matchedStudies);

    // Assess outcomes for each original
    const assessed = this.assessOutcomes(grouped);

    // Generate report content
    return format === 'markdown'
      ? this.generateMarkdown(assessed, retractedDOIs, inputDOIs)
      : this.generateHTML(assessed, retractedDOIs, inputDOIs);
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
  generateHTML(assessed, retractedDOIs = new Map(), inputDOIs = new Set()) {
    // Collect which outcome types are present
    const presentOutcomes = new Set();
    assessed.forEach(original => {
      presentOutcomes.add(original.overallOutcome);
    });

    const legend = this.generateLegendHTML(presentOutcomes, retractedDOIs.size > 0);

    let html = `
      <h1>Replication Report</h1>
      <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
      <p><em>Based on data from the FORRT Library of Replication Attempts (FLoRA)</em></p>

      ${legend}
    `;

    // Add retraction section if there are retracted articles
    if (retractedDOIs.size > 0) {
      html += `
        <h2>Retracted Articles</h2>
        <p style="color: #991B1B;"><strong>Warning:</strong> The following ${retractedDOIs.size} article(s) from your reference list have been retracted:</p>
        <ul>
      `;

      retractedDOIs.forEach((info, doi) => {
        let retractionDetails = '';
        if (info.retractionDate) {
          retractionDetails += ` (retracted ${info.retractionDate}`;
          if (info.reason) {
            retractionDetails += `: ${info.reason}`;
          }
          retractionDetails += ')';
        } else if (info.reason) {
          retractionDetails += ` (${info.reason})`;
        }

        html += `<li class="retracted-item">
          <span class="retraction-badge">RETRACTED</span>
          <a href="https://doi.org/${doi}" target="_blank">${doi}</a>
          ${info.title ? `- ${FReD.utils.escapeHtml(info.title)}` : ''}
          ${retractionDetails ? `<br><small style="color: #666;">${FReD.utils.escapeHtml(retractionDetails)}</small>` : ''}
        </li>`;
      });

      html += '</ul>';
    }

    html += '<h2>Replication Outcomes</h2>';

    if (assessed.length === 0) {
      html += '<p>No studies found in FLoRA database.</p>';
    } else {
      assessed.forEach(original => {
        const symbol = this.getSymbol(original.overallOutcome);
        const displayRef = original.ref_original || original.title_original || original.doi_original || 'Unknown';

        // Check if this study is also retracted
        const isRetracted = original.doi_original && retractedDOIs.has(original.doi_original.toLowerCase());
        const retractedBadge = isRetracted ? '<span class="retraction-badge" style="margin-right: 0.5em;">RETRACTED</span>' : '';

        // Build original study display with DOI link inline
        let originalDisplay = FReD.utils.escapeHtml(displayRef);
        if (original.doi_original) {
          originalDisplay += ` <a href="https://doi.org/${original.doi_original}" target="_blank">https://doi.org/${original.doi_original}</a>`;
        }

        // Use flexbox for hanging indent: symbol in fixed-width column, text wraps within its column
        html += `
          <div style="display: flex; margin-bottom: 0.25rem;">
            <span style="flex-shrink: 0; width: 1.5em; font-weight: bold;">${symbol.html}</span>
            <span style="flex: 1;">${retractedBadge}<strong>${originalDisplay}</strong></span>
          </div>
        `;

        html += '<ul style="margin-top: 0.25rem; margin-bottom: 1rem; margin-left: 1.5em;">';

        original.replications.forEach(rep => {
          const displayRepRef = rep.ref_replication || rep.title_replication || rep.doi_replication || 'Unknown';
          const outcomeText = rep.outcome || 'Not coded';

          // Build replication reference with DOI link inline
          let repDisplay = FReD.utils.escapeHtml(displayRepRef);
          if (rep.doi_replication) {
            repDisplay += ` <a href="https://doi.org/${rep.doi_replication}" target="_blank">https://doi.org/${rep.doi_replication}</a>`;
          }

          // Add "Link to report" if url_replication is present
          if (rep.url_replication) {
            repDisplay += ` <a href="${FReD.utils.escapeHtml(rep.url_replication)}" target="_blank">[Link to report]</a>`;
          }

          html += `<li style="margin-bottom: 0.5rem;"><strong>${FReD.utils.escapeHtml(outcomeText)}:</strong> ${repDisplay}</li>`;
        });

        html += '</ul>';
      });
    }

    return html;
  },

  /**
   * Generate legend HTML - only shows outcomes that are present in the data
   */
  generateLegendHTML(presentOutcomes = new Set(), hasRetractions = false) {
    const legendItems = [
      { key: 'success', label: 'Success', desc: 'All replications of the original study were successful.' },
      { key: 'failure', label: 'Failure', desc: 'All replications of the original study failed.' },
      { key: 'mixed', label: 'Mixed Results', desc: 'The replications had mixed outcomes.' },
      { key: 'inconclusive', label: 'Inconclusive', desc: 'Results were inconclusive.' },
      { key: 'not_coded', label: 'Not Coded', desc: 'The outcome has not yet been coded.' }
    ];

    // Filter to only show legend items that are present, but always show success, failure, mixed
    const alwaysShow = ['success', 'failure', 'mixed'];
    const itemsToShow = legendItems.filter(item =>
      alwaysShow.includes(item.key) || presentOutcomes.has(item.key)
    );

    let html = '<h3>Legend</h3><table>';
    itemsToShow.forEach(item => {
      const symbol = this.getSymbol(item.key);
      html += `
        <tr>
          <td style="text-align: center; width: 60px;">${symbol.html}</td>
          <td><em>${item.label}:</em> ${item.desc}</td>
        </tr>
      `;
    });

    // Add retraction indicator to legend if there are retractions
    if (hasRetractions) {
      html += `
        <tr>
          <td style="text-align: center; width: 60px;"><span class="retraction-badge">RETRACTED</span></td>
          <td><em>Retracted:</em> This article has been retracted according to the Retraction Watch database.</td>
        </tr>
      `;
    }

    html += '</table>';

    return html;
  },

  /**
   * Generate Markdown report
   */
  generateMarkdown(assessed, retractedDOIs = new Map(), inputDOIs = new Set()) {
    let md = `# Replication Report

**Generated:** ${new Date().toLocaleDateString()}

*Based on data from the FORRT Library of Replication Attempts (FLoRA)*

### Legend

| Symbol | Meaning |
|:------:|:--------|
| ${this.symbols.success.text} | *Success:* All replications succeeded. |
| ${this.symbols.failure.text} | *Failure:* All replications failed. |
| ${this.symbols.mixed.text} | *Mixed Results:* Mixed outcomes. |
| ${this.symbols.inconclusive.text} | *Inconclusive:* Results inconclusive. |
| ${this.symbols.not_coded.text} | *Not Coded:* Not yet coded. |
${retractedDOIs.size > 0 ? '| [RETRACTED] | *Retracted:* Article has been retracted. |\n' : ''}
`;

    // Add retraction section if there are retracted articles
    if (retractedDOIs.size > 0) {
      md += `## Retracted Articles

**Warning:** The following ${retractedDOIs.size} article(s) from your reference list have been retracted:

`;
      retractedDOIs.forEach((info, doi) => {
        let retractionDetails = '';
        if (info.retractionDate) {
          retractionDetails = ` (retracted ${info.retractionDate}${info.reason ? ': ' + info.reason : ''})`;
        } else if (info.reason) {
          retractionDetails = ` (${info.reason})`;
        }

        md += `- **[RETRACTED]** [${doi}](https://doi.org/${doi})${info.title ? ' - ' + info.title : ''}${retractionDetails}\n`;
      });
      md += '\n';
    }

    md += '## Replication Outcomes\n\n';

    if (assessed.length === 0) {
      md += 'No studies found in FLoRA database.\n';
    } else {
      assessed.forEach(original => {
        const symbol = this.symbols[original.overallOutcome] || this.symbols.not_coded;
        const displayRef = original.ref_original || original.title_original || original.doi_original || 'Unknown';

        // Check if this study is also retracted
        const isRetracted = original.doi_original && retractedDOIs.has(original.doi_original.toLowerCase());
        const retractedPrefix = isRetracted ? '[RETRACTED] ' : '';

        md += `##### ${symbol.text} ${retractedPrefix}${displayRef}`;
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
