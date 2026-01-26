/**
 * FReD Explorer - Column Configuration
 *
 * This file defines all available columns for the studies table.
 * To add or modify columns, edit the COLUMN_DEFINITIONS object below.
 *
 * Each column has:
 *   - key: internal field name from the data
 *   - label: human-readable display name
 *   - defaultVisible: whether shown by default
 *   - getValue: function to extract/format the value from a study object
 *   - className: optional CSS class for the column
 *   - width: optional column width
 */

window.FReD = window.FReD || {};

FReD.columnConfig = {
  // Storage keys for persisting user preferences
  STORAGE_KEY: 'fred-explorer-columns',
  ORDER_STORAGE_KEY: 'fred-explorer-column-order',

  /**
   * Column definitions - edit this to add/modify columns
   * Order here determines order in the column selector UI
   */
  COLUMN_DEFINITIONS: {
    // Always-visible columns (not in selector)
    _control: {
      key: '_control',
      label: '',
      alwaysVisible: true,
      getValue: () => '',
      className: 'dt-control',
      orderable: false,
      width: '30px'
    },
    _idx: {
      key: '_idx',
      label: 'idx',
      alwaysVisible: true,
      hidden: true,
      getValue: (study, idx) => idx
    },

    // User-selectable columns
    description: {
      key: 'description',
      label: 'Description',
      defaultVisible: true,
      getValue: (study) => FReD.utils.escapeHtml(study.description || ''),
      className: 'description-cell'
    },
    tags: {
      key: 'tags',
      label: 'Tags',
      defaultVisible: false,
      getValue: (study) => FReD.utils.escapeHtml(study.tags || '')
    },
    result: {
      key: 'result',
      label: 'Result',
      defaultVisible: true,
      getValue: (study, idx, criterion) => {
        const { outcomeReport } = FReD.successCriteria.getOutcome(study, criterion);
        return FReD.utils.capFirstLetter(outcomeReport || 'Not calculable');
      }
    },
    ref_o: {
      key: 'ref_o',
      label: 'Original Reference',
      defaultVisible: true,
      getValue: (study) => FReD.utils.formatReferenceCell(study.ref_o, study.doi_o)
    },
    ref_r: {
      key: 'ref_r',
      label: 'Replication Reference',
      defaultVisible: true,
      getValue: (study) => FReD.utils.formatReferenceCell(study.ref_r, study.doi_r, study.url_r)
    },
    source: {
      key: 'source',
      label: 'Source Project',
      defaultVisible: false,
      getValue: (study) => FReD.utils.escapeHtml(study.source || '')
    },
    discipline: {
      key: 'discipline',
      label: 'Discipline',
      defaultVisible: false,
      getValue: (study) => FReD.utils.escapeHtml(study.discipline || '')
    },
    orig_year: {
      key: 'orig_year',
      label: 'Original Year',
      defaultVisible: false,
      getValue: (study) => study.orig_year || ''
    },
    orig_journal: {
      key: 'orig_journal',
      label: 'Original Journal',
      defaultVisible: false,
      getValue: (study) => FReD.utils.escapeHtml(study.orig_journal || '')
    },
    es_o: {
      key: 'es_o',
      label: 'Effect Size (Original)',
      defaultVisible: false,
      getValue: (study) => FReD.utils.formatNumber(study.es_o, 3) || ''
    },
    es_r: {
      key: 'es_r',
      label: 'Effect Size (Replication)',
      defaultVisible: false,
      getValue: (study) => FReD.utils.formatNumber(study.es_r, 3) || ''
    },
    n_o: {
      key: 'n_o',
      label: 'N (Original)',
      defaultVisible: false,
      getValue: (study) => study.n_o || ''
    },
    n_r: {
      key: 'n_r',
      label: 'N (Replication)',
      defaultVisible: false,
      getValue: (study) => study.n_r || ''
    },
    power_r: {
      key: 'power_r',
      label: 'Power',
      defaultVisible: false,
      getValue: (study) => FReD.utils.formatNumber(study.power_r, 2) || ''
    },
    ci_o: {
      key: 'ci_o',
      label: 'CI (Original)',
      defaultVisible: false,
      getValue: (study) => {
        if (study.ci_lower_o != null && study.ci_upper_o != null) {
          return `[${FReD.utils.formatNumber(study.ci_lower_o, 3)}, ${FReD.utils.formatNumber(study.ci_upper_o, 3)}]`;
        }
        return '';
      }
    },
    ci_r: {
      key: 'ci_r',
      label: 'CI (Replication)',
      defaultVisible: false,
      getValue: (study) => {
        if (study.ci_lower_r != null && study.ci_upper_r != null) {
          return `[${FReD.utils.formatNumber(study.ci_lower_r, 3)}, ${FReD.utils.formatNumber(study.ci_upper_r, 3)}]`;
        }
        return '';
      }
    }
  },

  /**
   * Get all selectable columns (excludes always-visible and hidden columns)
   * Returns them in the user's preferred order
   */
  getSelectableColumns() {
    const allSelectable = Object.entries(this.COLUMN_DEFINITIONS)
      .filter(([key, col]) => !col.alwaysVisible && !col.hidden)
      .map(([key, col]) => ({ key, ...col }));

    // Get stored order
    const storedOrder = this.getColumnOrder();

    // Sort by stored order, unknown columns go to end
    return allSelectable.sort((a, b) => {
      const indexA = storedOrder.indexOf(a.key);
      const indexB = storedOrder.indexOf(b.key);
      // If not in stored order, put at end (maintain definition order for new columns)
      const orderA = indexA === -1 ? 999 : indexA;
      const orderB = indexB === -1 ? 999 : indexB;
      return orderA - orderB;
    });
  },

  /**
   * Get column order from localStorage or defaults
   */
  getColumnOrder() {
    const stored = localStorage.getItem(this.ORDER_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.warn('Failed to parse stored column order:', e);
      }
    }
    // Return default order from COLUMN_DEFINITIONS
    return Object.entries(this.COLUMN_DEFINITIONS)
      .filter(([key, col]) => !col.alwaysVisible && !col.hidden)
      .map(([key]) => key);
  },

  /**
   * Save column order to localStorage
   */
  saveColumnOrder(order) {
    localStorage.setItem(this.ORDER_STORAGE_KEY, JSON.stringify(order));
  },

  /**
   * Get visible columns from localStorage or defaults
   * Returns them in the user's preferred order
   */
  getVisibleColumns() {
    let visibleSet;
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        visibleSet = new Set(JSON.parse(stored));
      } catch (e) {
        console.warn('Failed to parse stored columns:', e);
      }
    }

    if (!visibleSet) {
      // Use default visible columns
      visibleSet = new Set(
        Object.entries(this.COLUMN_DEFINITIONS)
          .filter(([key, col]) => col.defaultVisible)
          .map(([key]) => key)
      );
    }

    // Return visible columns in the stored order
    const columnOrder = this.getColumnOrder();
    return columnOrder.filter(key => visibleSet.has(key));
  },

  /**
   * Save visible columns to localStorage
   */
  saveVisibleColumns(columns) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(columns));
  },

  /**
   * Reset to default columns and order
   */
  resetToDefaults() {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.ORDER_STORAGE_KEY);
    return this.getVisibleColumns();
  },

  /**
   * Build DataTable columns array based on visible columns
   */
  buildTableColumns(visibleColumns) {
    const columns = [];

    // Always add control column first
    const controlCol = this.COLUMN_DEFINITIONS._control;
    columns.push({
      title: controlCol.label,
      className: controlCol.className,
      orderable: controlCol.orderable,
      data: null,
      defaultContent: '',
      width: controlCol.width
    });

    // Add visible columns
    visibleColumns.forEach(key => {
      const col = this.COLUMN_DEFINITIONS[key];
      if (col && !col.alwaysVisible && !col.hidden) {
        columns.push({
          title: col.label,
          className: col.className || '',
          width: col.width
        });
      }
    });

    // Always add hidden idx column last
    columns.push({
      title: 'idx',
      visible: false
    });

    return columns;
  },

  /**
   * Build row data array for a study based on visible columns
   */
  buildRowData(study, idx, visibleColumns, criterion) {
    const row = [''];  // Control column

    visibleColumns.forEach(key => {
      const col = this.COLUMN_DEFINITIONS[key];
      if (col && !col.alwaysVisible && !col.hidden) {
        row.push(col.getValue(study, idx, criterion));
      }
    });

    row.push(idx);  // Hidden idx column
    return row;
  }
};
