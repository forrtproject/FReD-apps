# FReD Apps - FORRT Replication Database

Static web applications for exploring and annotating replication studies from the FORRT Replication Database (FReD).

## Apps

### FReD Explorer

Browse and analyze replication studies with interactive visualizations.

**Features:**
- Filter studies by search terms, minimum power, and source project
- Compare original and replication effect sizes with scatterplots
- View forest plots for meta-analytic visualization
- Explore outcomes by decade and discipline
- Choose from 8 different success criteria for assessing replication outcomes
- Export data as CSV or Excel

### FLoRA Annotator

Annotate reference lists with replication information.

**Features:**
- Input DOIs via text paste or file upload (PDF, BibTeX, RIS, plain text)
- Automatic DOI lookup via CrossRef for references without DOIs
- Match references to the FLoRA database
- Check for retracted articles via Retraction Watch
- Generate shareable reports in HTML or Markdown
- Browse and manually select studies from the full database

## Tech Stack

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **HTML5/CSS3** - Responsive design with CSS custom properties for theming
- **Plotly.js** (v2.27.0) - Interactive charts (scatterplots, bar charts, forest plots)
- **DataTables** (v1.13.7) - Sortable, searchable data tables with export functionality
- **jQuery** (v3.7.1) - DOM manipulation (required by DataTables)

### Data Processing
- **R** - Preprocessing scripts using the [FReD R package](https://github.com/forrtproject/FReD)
- **JSON** - Pre-computed data files for fast loading

### Deployment
- **GitHub Pages** - Static site hosting
- **GitHub Actions** - Automated deployment and weekly data updates

## Project Structure

```
FReD-apps/
├── index.html              # Landing page
├── explorer/               # FReD Explorer app
│   ├── index.html
│   ├── css/explorer.css
│   └── js/
│       ├── app.js
│       ├── state.js
│       ├── filters.js
│       ├── column-config.js
│       └── charts/         # Visualization modules
├── annotator/              # FLoRA Annotator app
│   ├── index.html
│   ├── css/annotator.css
│   └── js/
│       ├── app.js
│       ├── doi-parser.js
│       ├── retraction-checker.js
│       └── report-generator.js
├── shared/                 # Shared resources
│   ├── css/theme.css       # Common theme and styles
│   ├── js/
│   │   ├── data-loader.js
│   │   ├── success-criteria.js
│   │   ├── theme-toggle.js
│   │   └── utils.js
│   └── images/
├── data/                   # Pre-computed JSON data
│   ├── explorer-data.json
│   └── flora-data.json
├── preprocessing/          # R scripts for data generation
│   ├── process-explorer-data.R
│   └── process-flora-data.R
└── .github/workflows/
    └── update-data.yml     # Weekly data refresh
```

## Local Development

### Quick Start

Start a local HTTP server to test the apps. Any static server will work:

**Python:**
```bash
python3 -m http.server 8080
```

**Node.js (with npx):**
```bash
npx serve .
```

**PHP:**
```bash
php -S localhost:8080
```

Then open http://localhost:8080 in your browser.

### Why a Server is Required

These apps cannot be run by opening HTML files directly (`file://` protocol) because:
- JavaScript modules and fetch requests require HTTP
- Cross-origin restrictions apply to local files

## Data Updates

Data is automatically updated weekly via GitHub Actions:

1. The `update-data.yml` workflow runs every Sunday at 2:00 AM UTC
2. R preprocessing scripts fetch the latest data from the FReD package
3. JSON files in `data/` are regenerated and committed if changes are detected
4. GitHub Pages automatically redeploys from the main branch

To manually trigger a data update, use the "Run workflow" button in the GitHub Actions tab.

## Related Resources

- [FORRT Replication Hub](https://forrt.org/replication-hub/) - Main project page
- [FReD R Package](https://github.com/forrtproject/FReD) - Full-featured R package with real-time calculations
- [FReD on OSF](https://osf.io/9r62x/) - Raw dataset and documentation
- [FORRT](https://forrt.org) - Framework for Open and Reproducible Research Training

## License

**Code:** [MIT License](LICENSE)

**Data (FReD and FLoRA):** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

Part of the [FORRT](https://forrt.org) project.
