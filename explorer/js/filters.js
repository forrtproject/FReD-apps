/**
 * FReD Explorer - Filter Management
 *
 * Handles filter UI and data filtering
 */

window.FReD = window.FReD || {};

FReD.filters = {
  // DOM element references
  elements: {},

  // Debounced search handler
  debouncedSearch: null,

  /**
   * Initialize filters
   */
  init() {
    // Get DOM elements
    this.elements = {
      search: document.getElementById('search'),
      source: document.getElementById('source'),
      minPower: document.getElementById('minpower'),
      minPowerValue: document.getElementById('minpower-value'),
      criterionSelect: document.getElementById('success-criterion'),
      // Support both old radio buttons and new dropdown
      criterionRadios: document.querySelectorAll('input[name="criterion"]'),
      studyCount: document.getElementById('study-count')
    };

    // Create debounced search
    this.debouncedSearch = FReD.utils.debounce((value) => {
      FReD.state.set('search', value);
    }, 300);

    // Setup event listeners
    this.setupListeners();

    // Apply initial state to UI
    this.applyState(FReD.state.get());
  },

  /**
   * Setup event listeners for filter controls
   */
  setupListeners() {
    // Search input
    this.elements.search.addEventListener('input', (e) => {
      this.debouncedSearch(e.target.value);
    });

    // Source dropdown
    this.elements.source.addEventListener('change', (e) => {
      FReD.state.set('source', e.target.value);
    });

    // Power slider
    this.elements.minPower.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.elements.minPowerValue.textContent = Math.round(value * 100) + '%';
    });

    this.elements.minPower.addEventListener('change', (e) => {
      FReD.state.set('minPower', parseFloat(e.target.value));
    });

    // Criterion dropdown (new design)
    if (this.elements.criterionSelect) {
      this.elements.criterionSelect.addEventListener('change', (e) => {
        FReD.state.set('criterion', e.target.value);
      });
    }

    // Criterion radios (legacy support)
    this.elements.criterionRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          FReD.state.set('criterion', e.target.value);
        }
      });
    });
  },

  /**
   * Apply state to UI elements
   */
  applyState(state) {
    // Search
    if (this.elements.search.value !== state.search) {
      this.elements.search.value = state.search || '';
    }

    // Source
    if (this.elements.source.value !== state.source) {
      this.elements.source.value = state.source || 'All studies';
    }

    // Power slider
    if (parseFloat(this.elements.minPower.value) !== state.minPower) {
      this.elements.minPower.value = state.minPower;
      this.elements.minPowerValue.textContent = Math.round(state.minPower * 100) + '%';
    }

    // Criterion dropdown
    if (this.elements.criterionSelect && this.elements.criterionSelect.value !== state.criterion) {
      this.elements.criterionSelect.value = state.criterion;
    }

    // Criterion radios (legacy support)
    this.elements.criterionRadios.forEach(radio => {
      radio.checked = radio.value === state.criterion;
    });
  },

  /**
   * Populate source dropdown from data
   */
  populateSources(sources) {
    const select = this.elements.source;
    const currentValue = select.value;

    // Ensure sources is an array
    const sourceArray = Array.isArray(sources) ? sources : (sources ? [sources] : ['All studies']);

    select.innerHTML = '';
    sourceArray.forEach(source => {
      const option = document.createElement('option');
      option.value = source;
      option.textContent = source;
      select.appendChild(option);
    });

    // Restore selection if still valid
    if (sourceArray.includes(currentValue)) {
      select.value = currentValue;
    }
  },

  /**
   * Update study count display
   */
  updateStudyCount(count, total) {
    this.elements.studyCount.textContent = count === total
      ? count.toLocaleString()
      : `${count.toLocaleString()} of ${total.toLocaleString()}`;
  },

  /**
   * Get current filter values
   */
  getFilters() {
    // Use dropdown if available, otherwise fall back to radio buttons
    const criterion = this.elements.criterionSelect
      ? this.elements.criterionSelect.value
      : document.querySelector('input[name="criterion"]:checked')?.value || 'significance_r';

    return {
      source: this.elements.source.value,
      minPower: parseFloat(this.elements.minPower.value),
      search: this.elements.search.value,
      criterion
    };
  },

  /**
   * Apply filters to studies array
   */
  applyFilters(studies, filters = null) {
    const f = filters || this.getFilters();
    return FReD.dataLoader.filterStudies(studies, f);
  }
};

window.FReD = FReD;
