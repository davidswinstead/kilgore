# Ahoy Matey! Kilgore's Sandwich - ATP Experiment Analysis Tool

**Kilgore's Sandwich** is a comprehensive web-based analyzer and logger for Adobe Target experiment (ATP) data. This tool streamlines the analysis of CSV exports from Adobe, enabling quick statistical insights, experiment tracking, and shareable experiment summaries.

## Project Overview

This is a single-page application (SPA) built with vanilla JavaScript that helps experiment analysts and product managers quickly evaluate A/B test results without repeatedly returning to Adobe.

### Core Purpose
- **Import Adobe CSV data** from ATP experiments
- **Configure metrics** (primary, secondary, Bayesian)
- **Perform statistical analysis** including Bayesian probability calculations
- **Track experiment progress** with estimated runtimes
- **Share results** via clipboard-friendly images or shareable URLs
- **Cache experiment data** locally for fast access

---

## Project Structure

```
kilgore/
├── index.html              # Main HTML entry point
├── styles/
│   └── main.css           # Primary stylesheet (737 lines)
├── js/
│   ├── main.js            # Core application logic (2,198 lines)
│   ├── bayesian.js        # Bayesian statistical calculations (109 lines)
│   ├── convertjson.js     # JSON format conversion utilities (529 lines)
│   ├── utils.js           # Utility functions (261 lines)
│   └── srm.js             # Sample Ratio Mismatch calculations [planned]
├── agents.md              # Best practices guide for agents
└── README.md             # This file
```

---

## Key Features

### 1. **File Upload & Processing**
- **Drag-and-drop CSV upload** with visual feedback
- **Batch file processing** - upload multiple CSV files simultaneously
- **Automatic ATP detection** from filenames (ATP-XXX format)
- **CSV parsing** with robust error handling

### 2. **Experiment Configuration**
- **Metric selection** - Choose primary and secondary metrics
- **Sample size tracking** - Input expected sample sizes
- **Start date recording** - Track experiment duration
- **Configuration persistence** - Save configs to localStorage for reuse
- **Raw config editing** - Direct JSON editing for power users

### 3. **Statistical Analysis**
- **Relative uplift calculation** - Compare control vs. variant metrics
- **Bayesian probability analysis** - Calculate confidence in winning variant
  - Uses Beta distribution sampling for small samples
  - Normal approximation for large samples (>30)
  - Properly calibrated thresholds for primary vs. secondary metrics
- **Binomial metric support** - Validated Bayesian calculations for conversion-type metrics

### 4. **Experiment Tracking**
- **Sidebar experiment list** - Quick access to saved experiments
- **Sort functionality**:
  - Recently updated (default)
  - Ending soon
  - Business impact (debug mode only)
- **Analytics calculations**:
  - Days running
  - Daily traffic rate
  - Projected end date
  - Revenue projections (where applicable)

### 5. **Sharing & Reporting**
- **Clipboard screenshot** - Export experiment summary as image (via html2canvas)
- **Shareable URLs** - Generate encoded URLs with experiment data for sharing
- **Multi-experiment sharing** - Select multiple experiments to share
- **Teams/JIRA friendly** - Formatted for easy pasting into collaboration tools

### 6. **Developer Features** (Debug Mode)
- Toggle developer options with 3-day expiration
- Business impact sorting (includes non-conclusive metrics)
- Extended Bayesian calculations to all binomial metrics
- "Go Fish" mode - Filter for validated/directional metrics
- Warning banner when debug mode is active

---

## Technical Details

### File Descriptions

#### **index.html**
- 218 lines of semantic HTML5
- Responsive flexbox layout
- Sidebar for experiment navigation
- Modal dialogs for sharing and configuration
- Upload section with file drop zone
- Configuration and results display areas

#### **main.js** (2,198 lines)
**Core application logic:**
- Application state management (`currentExperiment` object)
- File upload handling (single and batch)
- CSV parsing and data extraction
- Configuration management (load/save)
- Event listeners and UI interactions
- Screen navigation (upload → config → results)
- Experiment list rendering and sorting
- Share functionality (URL generation and image export)
- Debug mode management

**Key functions:**
- `handleFileUpload()` - Process single CSV
- `handleMultipleFileUpload()` - Batch processing
- `processCSVData()` - Parse Adobe CSV format
- `loadSavedExperiments()` - Render experiment list
- `loadSavedExperiment()` - Display experiment details
- `saveConfigurationWithMetrics()` - Persist experiment data
- `displayMetrics()` - Render metric analysis table
- `generateShareableURL()` - Create shareable link

#### **bayesian.js** (109 lines)
**Statistical calculations:**
- `calculateBayesianProb()` - Main Bayesian probability function
  - Validates input data
  - Uses Beta distribution (Alpha/Beta parameters)
  - Switches between normal approximation and Monte Carlo based on sample size
- `simpleBetaSample()` - Generate Beta distribution samples
- `normalCDF()` - Normal cumulative distribution function
- `erf()` - Error function (supports normal approximation)
- `getBayesianCellColor()` - Color-code results based on confidence
  - Primary metrics: 95% confidence = green; 5% = red
  - Secondary metrics: 98% confidence = green; 2% = red

#### **convertjson.js** (529 lines)
**Data format versioning and migration:**
- **v1 format**: Experiment-centric (full metric names per experiment)
- **v2 format**: Global metric registry (static IDs, compressed storage)
- `convertV1ToV2()` - Migrate old format to new format
- `convertV2ToV1()` - Reverse migration for compatibility
- `loadAndConvertData()` - Auto-convert on load
- `testConversion()` - Validation test suite
- Achieves ~40% compression reduction in storage

**Key data structures:**
```javascript
// v2 Format
{
  version: 'v2',
  metrics: { 0: 'Revenue', 1: 'Orders', ... },
  experiments: {
    'ATP-001': {
      name: 'Homepage variation',
      primary: 0,        // Reference to metrics[0]
      secondary: [1, 2],
      metrics: {
        0: { valA: 1000, valB: 1100, cVisits: 5000, vVisits: 5000 }
      }
    }
  }
}
```

#### **utils.js** (261 lines)
**Helper utilities:**
- **Message system**: `showMessage()`, `showError()`, `showSuccess()`, `showProcessing()`
- **Screen navigation**: `showScreen()` - Switch between upload/config/results
- **Local storage**: `saveToStorage()`, `loadFromStorage()`
- **Formatting**: `formatDate()`, `formatNumber()`, `calculatePercentageChange()`
- **CSV parsing**: `parseCSV()` - Split and parse CSV data
- **Analytics**: `calculateExperimentAnalytics()` - Compute days running, daily rate, projections
- **Revenue projection**: `calculateRevenueProjection()` - Project total revenue based on trending
- **Tooltips**: `createTooltip()` - Create hover explanations

#### **styles/main.css** (737 lines)
**Comprehensive styling:**
- **Layout**: Flexbox-based responsive design
- **Sidebar**: Fixed navigation with gradient background
- **Typography**: Segoe UI font stack, semantic sizing
- **Tables**: Metric display with color-coded cells
- **Forms**: Input fields, select dropdowns, textareas
- **Buttons**: Various styles (primary, secondary, success, danger)
- **Modals**: Overlay dialogs for sharing and configuration
- **Animations**: Transitions for panel toggling
- **Color scheme**: Blue sidebar (#116688), status indicators (red/yellow/green)

---

## Data Flow

### Upload → Configure → Analyze

```
CSV Upload
    ↓
Extract: ATP number, metrics, visits, conversions
    ↓
Check for existing config in localStorage
    ├─→ Config exists? → Load and update metrics
    └─→ No config? → Show configuration screen
    ↓
User selects primary/secondary metrics
    ↓
Save to localStorage (v2 format)
    ↓
Display results: Uplift, Bayesian, Analytics
    ↓
Optional: Share via URL or screenshot
```

### Local Storage Structure
```
localStorage['atpConfigurations'] → v2 data object with all ATP configs
localStorage['shareData-XXX']      → Temporary data for shareable URLs
localStorage['debug']             → Debug mode toggle (true/false)
localStorage['debugTimestamp']    → Debug mode expiration timer
```

---

## Usage Guide

### For Analysts
1. **Export CSV** from Adobe Workspace → Project → Export CSV
2. **Drop the CSV file** onto Kilgore's Sandwich
3. **If first time**: Select your primary and secondary metrics
4. **Review results**: Check uplift, Bayesian confidence, and projections
5. **Share findings**: Click "Share exp data" and copy the URL or screenshot

### For Repeat Experiments
- Kilgore remembers your configuration
- Upload fresh CSV daily for updated results
- Sidebar shows all saved experiments sorted by recency

### Advanced: Developer Mode
- Click "Toggle developer options"
- Access business impact sorting (hidden by default)
- Run Bayesian on all metrics (potential p-hacking risk)
- Use "Go Fish" filtering for validated metrics
- Edit raw JSON configuration

---

## Technical Specifications

### Browser Requirements
- Modern browser with localStorage support
- ES6 JavaScript support
- HTML5 File API
- Canvas support (for screenshot via html2canvas library)

### Dependencies
- **html2canvas** (CDN): For screenshot functionality
- **No other external libraries** - Pure vanilla JavaScript

### Data Limitations
- localStorage: ~5-10MB depending on browser
- Experiment count: Typically 50-100+ before reaching limits
- Metric count: Tested with 100+ metrics per experiment

### Bayesian Algorithm Details
- **Small samples (<30 per variation)**: Monte Carlo sampling with 10,000 iterations
- **Large samples (≥30 per variation)**: Normal approximation (CDF + error function)
- **Confidence thresholds**:
  - Primary metrics: 95% threshold for positive conclusion
  - Secondary metrics: 98% threshold (more conservative)

---

## CSV Format Expectations

Input CSV should contain:
```
Metric Name, Control Value, Variant Value, Control Visits, Variant Visits
Revenue, 1000, 1050, 5000, 5000
Orders, 100, 105, 5000, 5000
...
```

The tool extracts these and calculates:
- Relative uplift %
- Bayesian probability of variant winning
- Daily traffic and estimated runtime

---

## Disclaimer

⚠️ **Important Notes:**
1. Conclusions are only as good as the data
2. Upload fresh CSV data daily for accurate projections
3. Bayesian calculations valid only for binomial metrics (rates, conversions)
4. Do not rely on business impact sorting in debug mode (uses non-conclusive metrics)
5. Developer options expire after 3 days

---

## Future Enhancements

### Planned Features
- **Sample Ratio Mismatch (SRM) detection** - Validate traffic distribution
- **Multivariate experiment support** - Analyze 3+ variants
- **Automated alerts** - Notify when experiment reaches significance
- **Export to Excel/PDF** - Generate formal reports
- **Team collaboration** - Comments and notes on experiments
- **Historical trending** - Track metric changes over experiment life

### Code Quality
- Modular function design enabling easy extension
- v2 JSON format provides flexibility for future data structure changes
- localStorage provides foundation for future backend migration

---

## File Statistics

| File | Lines | Purpose |
|------|-------|---------|
| index.html | 218 | Structure & UI |
| main.js | 2,198 | Core logic |
| bayesian.js | 109 | Statistics |
| convertjson.js | 529 | Data migration |
| utils.js | 261 | Helpers |
| main.css | 737 | Styling |
| **Total** | **4,052** | **Complete app** |

---

## Development Notes

### Configuration Management
The app uses a two-tier storage system:
1. **Global metric registry** (v2 format) - Prevents duplication, enables ID-based references
2. **Experiment-specific config** - References metrics by ID

This design reduces storage usage while maintaining flexibility.

### State Management
The `currentExperiment` object tracks:
- ATP number
- Raw CSV data
- Parsed metrics array
- Associated configuration

Updates flow through `saveConfigurationWithMetrics()` which handles both storage and UI refresh.

### Error Handling
- CSV validation with meaningful error messages
- localStorage quota handling with fallback warnings
- Graceful degradation for missing or invalid data

---

## License & Attribution

Built for experiment analysis in Adobe Target environments. All data stored locally in browser localStorage.

---

*Last Updated: January 2026*
