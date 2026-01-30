// Main application logic for ATP Experiment Analysis Tool
// Last updated: 2025-01-22 17:45:00 - Primary KPI typeahead fix attempt
console.log("Main.js loaded");
// Application state
let currentExperiment = {
    atp: null,
    data: [],
    config: null,
    globalVisits: null,
    metrics: []
};

function isDeveloperModeActive() {
    const debugMode = localStorage.getItem('debug') === 'true';
    if (!debugMode) {
        return false;
    }

    let debugTimestamp = localStorage.getItem('debugTimestamp');
    if (!debugTimestamp) {
        debugTimestamp = Date.now().toString();
        localStorage.setItem('debugTimestamp', debugTimestamp);
    }

    const endTimeInMillis = 2 * 24 * 60 * 60 * 1000; //two days in milliseconds
    const timeSinceEnabled = Date.now() - parseInt(debugTimestamp, 10);

    if (timeSinceEnabled > endTimeInMillis) {
        localStorage.setItem('debug', 'false');
        localStorage.removeItem('debugTimestamp');
        return false;
    }

    return true;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    setupFileHandling();
    loadSavedExperiments();
    setupEventListeners();
    
    // Check for import data in URL
    checkForImportData();
    
    // Setup sort dropdown
    document.getElementById('sortExperiments').addEventListener('change', () => {
        loadSavedExperiments();
    });
    
    // Setup status filter dropdown
    document.getElementById('statusFilter').addEventListener('change', () => {
        loadSavedExperiments();
    });
    
    // Setup search input
    document.getElementById('experimentSearch').addEventListener('input', () => {
        loadSavedExperiments();
    });
    
    // Setup bulk cleanup button
    setupBulkCleanup();
    
    // Show/hide debug options based on localStorage
    const debugMode = isDeveloperModeActive();
    const businessImpactOption = document.getElementById('business-impact-option');
    if (businessImpactOption) {
        businessImpactOption.style.display = debugMode ? 'block' : 'none';
    }
    
    // Setup dev options toggle
    setupDevOptionsToggle();
    
    // Show/hide debug warning banner
    updateDebugWarning();
});

// Setup dev options toggle functionality
function setupDevOptionsToggle() {
    const toggleBtn = document.getElementById('toggleDevOptions');
    if (toggleBtn) {
        updateToggleButtonText();
        
        toggleBtn.addEventListener('click', () => {
            const debugMode = isDeveloperModeActive();
            
            // Toggle debug setting
            if (debugMode) {
                localStorage.setItem('debug', 'false');
                localStorage.removeItem('debugTimestamp');
            } else {
                localStorage.setItem('debug', 'true');
                localStorage.setItem('debugTimestamp', Date.now().toString());
            }
            
            // Update UI
            updateToggleButtonText();
            updateDebugWarning();
            
            // Refresh the page to apply changes
            window.location.reload();
        });
    }
}

// Update toggle button text based on current state
function updateToggleButtonText() {
    const toggleBtn = document.getElementById('toggleDevOptions');
    if (!toggleBtn) return;
    
    const debugMode = isDeveloperModeActive();
    
    const buttonText = debugMode ? 'Toggle dev options OFF' : 'Toggle dev options ON';
    toggleBtn.textContent = buttonText;
}

// Show/hide debug warning banner
function updateDebugWarning() {
    const debugWarning = document.getElementById('debugWarning');
    if (!debugWarning) return;
    
    const debugMode = isDeveloperModeActive();
    
    if (debugMode) {
        debugWarning.classList.remove('hidden');
    } else {
        debugWarning.classList.add('hidden');
    }
}

// File handling setup
function setupFileHandling() {
    const dropZone = document.getElementById('fileDropZone');
    const sidebar = document.querySelector('.sidebar');
    const fileInput = document.getElementById('fileInput');

    // Drag and drop on entire sidebar
    sidebar.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only show visual feedback on the dropzone
        dropZone.classList.add('dragover');
    });

    sidebar.addEventListener('dragleave', (e) => {
        // Only remove visual feedback when leaving the entire sidebar
        if (!sidebar.contains(e.relatedTarget)) {
            dropZone.classList.remove('dragover');
        }
    });

    sidebar.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleMultipleFileUpload(files);
        }
    });

    // Click to browse (only on dropzone)
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleMultipleFileUpload(e.target.files);
            // Reset the file input value to allow the same file to be uploaded again
            e.target.value = '';
        }
    });
}


function handleMultipleFileUpload(files) {
    const csvFiles = Array.from(files).filter(file => file.name.endsWith('.csv'));
    
    if (csvFiles.length === 0) {
        Utils.showError('Please upload CSV files.');
        return;
    }
    
    if (csvFiles.length === 1) {
        // Single file - use existing logic
        handleFileUpload(csvFiles[0]);
        return;
    }
    
    // Multiple files - process them one by one
    Utils.showProcessing(`Processing ${csvFiles.length} CSV files...`);
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let lastProcessedAtp = null;
    
    function processNextFile() {
        if (processedCount >= csvFiles.length) {
            // All files processed
            Utils.hideProcessing();
            
            if (successCount > 0) {
                Utils.showSuccess(`Successfully processed ${successCount} files. ${errorCount > 0 ? `${errorCount} files had errors.` : ''}`);
                loadSavedExperiments(); // Refresh the sidebar
                
                // If we processed files and have a last ATP, load it for display
                if (lastProcessedAtp) {
                    loadSavedExperiment(lastProcessedAtp);
                }
            } else {
                Utils.showError('No files were processed successfully.');
            }
            return;
        }
        
        const file = csvFiles[processedCount];
        processedCount++;
        
        Utils.showProcessing(`Processing file ${processedCount}/${csvFiles.length}: ${file.name}`);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csvData = processCSVData(e.target.result, file.name);
                
                // Check if configuration already exists for this ATP
                const existingConfig = loadConfiguration(csvData.atpNumber);
                
                if (existingConfig && existingConfig.needsConfig !== true) {
                    // Configuration exists and is complete - update with new data
                    saveConfigurationWithMetrics(csvData.atpNumber, existingConfig, csvData.data, csvData.globalVisits, csvData.csvDateInfo);
                    
                    successCount++;
                    lastProcessedAtp = csvData.atpNumber; // Track for potential display
                } else {
                    // No configuration exists - create a basic config with processed filename as name
                    const basicConfig = {
                        name: processFilenameToExperimentName(file.name, csvData.atpNumber),
                        primary: '',
                        secondary: [],
                        sampleSize: 10000,
                        startDate: csvData.csvDateInfo ? csvData.csvDateInfo.startDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                        bayesian: [],
                        needsConfig: true,
                        timestamp: Date.now()
                    };
                    
                    saveConfigurationWithMetrics(csvData.atpNumber, basicConfig, csvData.data, csvData.globalVisits, csvData.csvDateInfo);
                    
                    // Note: Business impact cannot be calculated for new configs since primary metric is not set yet
                    
                    successCount++;
                    lastProcessedAtp = csvData.atpNumber; // Track for potential display
                }
                
                // Process next file
                setTimeout(processNextFile, 100);
                
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                errorCount++;
                // Continue with next file
                setTimeout(processNextFile, 100);
            }
        };
        
        reader.onerror = () => {
            console.error(`Failed to read file: ${file.name}`);
            errorCount++;
            setTimeout(processNextFile, 100);
        };
        
        reader.readAsText(file);
    }
    
    // Start processing
    processNextFile();
}



// Handle single CSV file upload
function handleFileUpload(file) {
    if (!file.name.endsWith('.csv')) {
        Utils.showError('Please upload a CSV file.');
        return;
    }

    Utils.showProcessing('Processing CSV file...');

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const csvData = processCSVData(e.target.result, file.name);
            Utils.hideProcessing();
            
            // Check if configuration already exists for this ATP
            const existingConfig = loadConfiguration(csvData.atpNumber);
            
            console.log('Checking configuration for', csvData.atpNumber, ':', existingConfig);
            
            if (existingConfig && existingConfig.needsConfig !== true) {
                // Configuration exists and is complete - update with new data
                console.log('Loading existing configuration and updating with new data');
                
                // Save the new data with existing config
                saveConfigurationWithMetrics(csvData.atpNumber, existingConfig, csvData.data, csvData.globalVisits, csvData.csvDateInfo);
                
                // Use the reliable display code path - same as clicking on saved experiments
                loadSavedExperiment(csvData.atpNumber);
            } else {
                // No configuration exists or needs config - show configuration screen
                console.log('No configuration or needs config - showing configuration screen');
                
                // Set current experiment data for configuration screen
                currentExperiment.atp = csvData.atpNumber;
                currentExperiment.data = csvData.data;
                currentExperiment.globalVisits = csvData.globalVisits;
                currentExperiment.metrics = csvData.metrics;
                
                showConfigurationScreen(csvData.atpNumber, csvData.metrics, csvData.csvDateInfo, csvData.filename);
            }
        } catch (error) {
            Utils.hideProcessing();
            Utils.showError(error.message);
        }
    };
    reader.readAsText(file);
}


// Process CSV data using the original working logic
function processCSVData(csvText, filename = '') {
    const { data, globalVisits } = parseCSVData(csvText);
    
    // Extract ATP number from the data or filename
    let atpNumber = null;
    
    // Look for ATP number in the CSV content
    const lines = csvText.split('\n');
    for (const line of lines) {
        const match = line.match(/ATP[\s\-\_]?(\d+)/i);
        if (match) {
            atpNumber = `ATP-${match[1]}`;
            break;
        }
    }
    
    // If no ATP number found in content, check filename
    if (!atpNumber && filename) {
        const match = filename.match(/ATP[\s\-\_]?(\d+)/i);
        if (match) {
            atpNumber = `ATP-${match[1]}`;
        }
    }
    
    // If no ATP number found, use default
    if (!atpNumber) {
        atpNumber = 'ATP-001'; // Default fallback
    }
    
    // Extract start date information from CSV
    const csvDateInfo = extractStartDateFromCSV(csvText);
    
    // Extract unique metrics for the configuration screen
    const metrics = [...new Set(data.map(item => item.label))];
    
    // Convert data format to match expected structure with multi-variant support
    const processedData = data.map(item => ({
        label: item.label,
        section: item.section,
        control: item.valA,
        variant: item.valB, // Keep for backward compatibility
        variantB: item.valB,
        variantC: item.valC,
        variantD: item.valD,
        controlVisits: item.controlVisits,
        variantVisits: item.variantBVisits, // Keep for backward compatibility
        variantBVisits: item.variantBVisits,
        variantCVisits: item.variantCVisits,
        variantDVisits: item.variantDVisits
    }));
    
    return {
        data: processedData,
        atpNumber,
        metrics,
        csvDateInfo,
        globalVisits,
        filename
    };
}

// Extract start date from CSV header
function extractStartDateFromCSV(csvText) {
    // Look for date pattern in the header section like "# Date: Jun 24, 2025 - Jul 24, 2025"
    const dateMatch = csvText.match(/^"?#\s*Date:\s*([^-]+)\s*-\s*([^"]+)"?/mi);
    if (dateMatch) {
        const startDateStr = dateMatch[1].trim();
        const endDateStr = dateMatch[2].trim();

        try {
            const parseDate = (dateStr) => {
                const parts = dateStr.replace(',', '').split(' '); // e.g., ["Jun", "24", "2025"]
                const months = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 };
                const year = parseInt(parts[2], 10);
                const month = months[parts[0]];
                const day = parseInt(parts[1], 10);
                return new Date(year, month, day); // Creates date at local midnight
            };

            const startDate = parseDate(startDateStr);
            const endDate = parseDate(endDateStr);

            // Validate dates
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                return {
                    startDate: startDate,
                    endDate: endDate,
                    startDateStr: startDateStr,
                    endDateStr: endDateStr
                };
            }
        } catch (e) {
            console.warn('Failed to parse dates from CSV:', e);
        }
    }
    return null;
}

// Helper function to parse a CSV row respecting quoted fields
function parseCSVRow(row) {
    const cells = [];
    let currentCell = '';
    let insideQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        
        if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            cells.push(cleanCSVValue(currentCell));
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    
    // Push the last cell
    cells.push(cleanCSVValue(currentCell));
    
    return cells;
}

// Helper function to clean CSV values: strip quotes and remove thousand separators
function cleanCSVValue(value) {
    // Trim whitespace
    value = value.trim();
    
    // If value is surrounded by double quotes, remove them
    if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
    }
    
    // Remove thousand separator commas from numeric values
    // Only remove commas that are between digits (thousand separators)
    // Keep decimal periods intact
    value = value.replace(/(\d),(?=\d)/g, '$1');
    
    return value;
}

// Original working CSV parsing function with multi-variant support
function parseCSVData(csvText) {
    // Parse CSV rows respecting quoted fields
    const rows = csvText.split('\n').map(row => parseCSVRow(row));

    let data = [];
    let currentSectionVisits = null;
    let currentSection = '';
    let globalVisits = null;
    let variantCount = 2; // Default to 2 variants (control + 1 variant)

    // Detect number of variants from header rows
    for (let i = 0; i < Math.min(15, rows.length); i++) {
        const row = rows[i];
        if (row.length >= 3) {
            // Look for rows containing variant headers (control + variant columns)
            const variantColumns = row.filter(cell => {
                const lowerCell = cell.toLowerCase();
                return (lowerCell.includes('control') && (lowerCell.includes('[l3]') || lowerCell.includes('visit'))) ||
                       (lowerCell.includes('variant') && (lowerCell.includes('[l3]') || lowerCell.includes('visit')));
            });
            
            if (variantColumns.length > variantCount) {
                variantCount = variantColumns.length;
                console.log(`Found variant header row ${i}: ${variantColumns.length} variants detected`);
                console.log('Variant columns:', variantColumns);
            }
        }
    }

    console.log(`Detected ${variantCount} variants (including control)`);

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Detect section headers
        if (row[0] && row[0].startsWith('#') && row[0].includes('KPI')) {
            currentSection = row[0].replace(/#+/g, '').trim();
            currentSectionVisits = null;
            continue;
        }

        // Handle multi-variant CSV formats (3+ columns)
        let prefix, label, values = [];

        if (row.length >= variantCount + 1) {
            // Format: prefix, label, valA, valB, valC, valD...
            prefix = row[0];
            label = row[1];
            for (let j = 2; j < Math.min(row.length, variantCount + 2); j++) {
                values.push(parseFloat(row[j]));
            }

            if (prefix === 'Segments') {
                const visits = {};
                visits.control = parseInt(row[2]);
                if (values.length > 1) visits.variantB = parseInt(row[3]);
                if (values.length > 2) visits.variantC = parseInt(row[4]);
                if (values.length > 3) visits.variantD = parseInt(row[5]);

                if (!isNaN(visits.control)) {
                    currentSectionVisits = visits;
                    if (!globalVisits) {
                        globalVisits = visits;
                    }
                }
                continue;
            }

            if (prefix && prefix.startsWith('0 All Visits') && (!label || label.trim() === '')) {
                continue;
            }

        } else if (row.length >= variantCount) {
            // Format: label, valA, valB, valC, valD...
            prefix = '';
            label = row[0];
            for (let j = 1; j < Math.min(row.length, variantCount + 1); j++) {
                values.push(parseFloat(row[j]));
            }

            if (label === 'Segments') {
                const visits = {};
                visits.control = parseInt(row[1]);
                if (values.length > 1) visits.variantB = parseInt(row[2]);
                if (values.length > 2) visits.variantC = parseInt(row[3]);
                if (values.length > 3) visits.variantD = parseInt(row[4]);

                if (!isNaN(visits.control)) {
                    currentSectionVisits = visits;
                    if (!globalVisits) {
                        globalVisits = visits;
                    }
                }
                continue;
            }

                        // Check for CSV format where first row contains visit counts (All visits)
            if (label && (label.toLowerCase().includes('all visits') || label.startsWith('0.')) && 
                values.length >= 2 && !isNaN(values[0]) && !isNaN(values[1])) {
                const visits = {};
                visits.control = parseInt(values[0]);
                if (values.length > 1) visits.variantB = parseInt(values[1]);
                if (values.length > 2) visits.variantC = parseInt(values[2]);
                if (values.length > 3) visits.variantD = parseInt(values[3]);
                
                if (visits.control > 0 && visits.variantB > 0) {
                    currentSectionVisits = visits;
                    if (!globalVisits) {
                        globalVisits = visits;
                    }
                    console.log('CSV: Extracted visit counts from', label, '- Control:', visits.control, 'Variants:', visits);
                }
                // Don't continue here - also process this as a metric
            }

            if (label && label.startsWith('0 All Visits') && values.length >= 2 && !isNaN(values[0]) && !isNaN(values[1])) {
                continue;
            }

        } else {
            continue;
        }

        // Skip formatting rows
        if ((prefix && prefix.startsWith('#')) || (label && label.startsWith('#'))) {
            continue;
        }

        // Process valid metric rows
        if (label && label !== "Metrics" && values.length >= 2 && 
            !isNaN(values[0]) && !isNaN(values[1]) && values[0] !== null && values[1] !== null) {
            
            const metricData = {
                label,
                valA: values[0], // Control
                valB: values[1], // Variant B
                valC: values.length > 2 ? values[2] : null, // Variant C
                valD: values.length > 3 ? values[3] : null, // Variant D
                hasBayesianData: false,
                section: currentSection,
                controlVisits: null,
                controlConversions: null,
                variantBVisits: null,
                variantBConversions: null,
                variantCVisits: null,
                variantCConversions: null,
                variantDVisits: null,
                variantDConversions: null
            };

            // Store visit data for potential Bayesian calculation
            if (currentSectionVisits || globalVisits) {
                const visitsToUse = currentSectionVisits || globalVisits;
                metricData.controlVisits = visitsToUse.control;
                if (visitsToUse.variantB) metricData.variantBVisits = visitsToUse.variantB;
                if (visitsToUse.variantC) metricData.variantCVisits = visitsToUse.variantC;
                if (visitsToUse.variantD) metricData.variantDVisits = visitsToUse.variantD;
            }

            data.push(metricData);
        }
    }

    return { data, globalVisits };
}

// Process filename to create a clean experiment name
function processFilenameToExperimentName(filename, atpNumber) {
    if (!filename) return '';
    
    // Remove .csv extension
    let name = filename.replace(/\.csv$/i, '');
    
    // If the name starts with the ATP number (with optional separator), remove it
    /*
    if (atpNumber) {
        const atpPattern = new RegExp(`^${atpNumber.replace('ATP-', 'ATP[\\s\\-\\_]?')}[\\s\\-\\_]*`, 'i');
        name = name.replace(atpPattern, '');
    }
    */
    
    // Remove adidas Global date suffix pattern like "- adidas - Global - Jul 22, 2025"
    name = name.replace(/\s*-\s*adidas\s*-\s*Global\s*-\s*[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}\s*$/i, '');
    
    // Clean up any remaining leading/trailing separators or spaces
    name = name.replace(/^[\s\-\_]+|[\s\-\_]+$/g, '');
    
    return name;
}

// Test function for filename processing (for debugging)
function testFilenameProcessing() {
    const testCases = [
        { filename: 'ATP-1234_experiment_data.csv', atp: 'ATP-1234', expected: 'experiment_data' },
        { filename: 'ATP-1234-experiment-data.csv', atp: 'ATP-1234', expected: 'experiment-data' },
        { filename: 'ATP 1234 My Test Experiment.csv', atp: 'ATP-1234', expected: 'My Test Experiment' },
        { filename: 'my-experiment-data.csv', atp: 'ATP-1234', expected: 'my-experiment-data' },
        { filename: 'ATP1234_test.csv', atp: 'ATP-1234', expected: 'test' },
        { filename: 'experiment.csv', atp: null, expected: 'experiment' },
        { filename: 'ATP-5678 Checkout Flow Test - adidas - Global - Jul 22, 2025.csv', atp: 'ATP-5678', expected: 'Checkout Flow Test' },
        { filename: 'Homepage Banner Test - adidas - Global - Dec 15, 2024.csv', atp: 'ATP-9999', expected: 'Homepage Banner Test' },
        { filename: 'My Experiment - adidas - Global - Jan 1, 2025.csv', atp: null, expected: 'My Experiment' }
    ];
    
    console.log('Testing filename processing:');
    testCases.forEach((testCase, index) => {
        const result = processFilenameToExperimentName(testCase.filename, testCase.atp);
        const passed = result === testCase.expected;
        console.log(`Test ${index + 1}: ${passed ? '✅' : '❌'} "${testCase.filename}" -> "${result}" (expected: "${testCase.expected}")`);
    });
}

// Typeahead component for metric selection
function createTypeahead(containerId, options, selectedValue = '', placeholder = 'Select or type to search...', showMostSelected = false) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    
    container.innerHTML = '';
    
    // Create wrapper div
    const wrapper = document.createElement('div');
    wrapper.className = 'typeahead-wrapper';
    wrapper.style.position = 'relative';
    
    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'typeahead-input';
    input.placeholder = placeholder;
    input.value = selectedValue;
    input.style.cssText = `
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
    `;
    
    // Create dropdown container
    const dropdown = document.createElement('div');
    dropdown.className = 'typeahead-dropdown';
    dropdown.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #ddd;
        border-top: none;
        max-height: 300px;
        overflow-y: auto;
        display: none;
        z-index: 1000;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    
    let filteredOptions = [...options];
    let selectedIndex = -1;
    let allOptions = [...options]; // Keep original options for filtering
    
    // Function to render dropdown options with sections
    function renderDropdown(searchTerm = '') {
        dropdown.innerHTML = '';
        
        if (showMostSelected && !searchTerm) {
            // Show most selected section when no search term
            const mostSelected = getMostCommonlySelectedMetrics();
            const mostSelectedInOptions = mostSelected.filter(metric => options.includes(metric));
            
            if (mostSelectedInOptions.length > 0) {
                // Add "Most Selected" header
                const mostSelectedHeader = document.createElement('div');
                mostSelectedHeader.textContent = 'Most Selected';
                mostSelectedHeader.className = 'typeahead-section-header';
                dropdown.appendChild(mostSelectedHeader);
                
                // Add most selected options
                mostSelectedInOptions.forEach((option, index) => {
                    const item = createOptionItem(option, index, searchTerm);
                    item.classList.add('most-selected');
                    dropdown.appendChild(item);
                });
                
                // Add divider
                const divider = document.createElement('div');
                divider.textContent = 'All Metrics Parsed';
                divider.className = 'typeahead-section-divider';
                dropdown.appendChild(divider);
            }
        }
        
        // Filter options based on search term
        filteredOptions = allOptions.filter(option => 
            option.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        if (filteredOptions.length === 0) {
            const noResults = document.createElement('div');
            noResults.textContent = 'No matches found';
            noResults.style.cssText = 'padding: 8px 12px; color: #666; font-style: italic;';
            dropdown.appendChild(noResults);
        } else {
            // Calculate starting index for filtered options
            const startIndex = showMostSelected && !searchTerm ? 
                (getMostCommonlySelectedMetrics().filter(metric => options.includes(metric)).length + 2) : 0;
            
            filteredOptions.forEach((option, index) => {
                const item = createOptionItem(option, startIndex + index, searchTerm);
                dropdown.appendChild(item);
            });
        }
        
        selectedIndex = -1;
        updateSelection();
    }
    
    // Helper function to create option items
    function createOptionItem(option, index, searchTerm) {
        const item = document.createElement('div');
        item.textContent = option;
        item.className = 'typeahead-option';
        item.dataset.optionValue = option; // Store the actual option value
        item.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid #f0f0f0;
        `;
        
        // Highlight matching text
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        item.innerHTML = option.replace(regex, '<strong>$1</strong>');
        
        item.addEventListener('mouseenter', () => {
            // Find the actual index of this option in the DOM
            const items = dropdown.querySelectorAll('.typeahead-option');
            const actualIndex = Array.from(items).indexOf(item);
            selectedIndex = actualIndex;
            updateSelection();
        });
        
        item.addEventListener('click', () => {
            input.value = option;
            dropdown.style.display = 'none';
            input.dispatchEvent(new Event('change'));
        });
        
        return item;
    }
    
    // Function to update visual selection
    function updateSelection() {
        const items = dropdown.querySelectorAll('.typeahead-option');
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.style.backgroundColor = '#e3f2fd';
            } else {
                item.style.backgroundColor = '';
            }
        });
    }
    
    // Event listeners
    input.addEventListener('focus', () => {
        renderDropdown(input.value);
        dropdown.style.display = 'block';
    });
    
    input.addEventListener('input', (e) => {
        renderDropdown(e.target.value);
        dropdown.style.display = 'block';
    });
    
    input.addEventListener('keydown', (e) => {
        if (dropdown.style.display === 'none') return;
        
        // Get the actual option items (excludes headers/dividers)
        const items = dropdown.querySelectorAll('.typeahead-option');
        const totalItems = items.length;
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, totalItems - 1);
                updateSelection();
                // Scroll selected item into view
                if (selectedIndex >= 0 && selectedIndex < totalItems) {
                    items[selectedIndex].scrollIntoView({ block: 'nearest' });
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateSelection();
                // Scroll selected item into view
                if (selectedIndex >= 0 && selectedIndex < totalItems) {
                    items[selectedIndex].scrollIntoView({ block: 'nearest' });
                }
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < totalItems) {
                    const selectedOption = items[selectedIndex].dataset.optionValue;
                    input.value = selectedOption;
                    dropdown.style.display = 'none';
                    input.dispatchEvent(new Event('change'));
                }
                break;
            case 'Escape':
                dropdown.style.display = 'none';
                break;
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    wrapper.appendChild(input);
    wrapper.appendChild(dropdown);
    container.appendChild(wrapper);
    
    return {
        getValue: () => input.value,
        setValue: (value) => {
            input.value = value;
        },
        getInput: () => input
    };
}

// Configuration screen
function showConfigurationScreen(atpNumber, metrics, csvDateInfo, filename = '') {
    const existingConfig = loadConfiguration(atpNumber);
    const defaultStartDate = getDefaultStartDate(existingConfig, csvDateInfo);
    
    // Convert v2 numeric IDs back to metric names for display
    let primaryMetricName = null;
    let secondaryMetricNames = [];
    let sampleSizeMetricName = null;
    
    if (existingConfig) {
        const storageData = JSONConverter.loadAndConvertData('atpConfigurations');
        if (storageData && storageData.metrics) {
            primaryMetricName = JSONConverter.getMetricName(existingConfig.primary, storageData.metrics);
            secondaryMetricNames = (existingConfig.secondary || [])
                .map(metricId => JSONConverter.getMetricName(metricId, storageData.metrics))
                .filter(Boolean);
            sampleSizeMetricName = JSONConverter.getMetricName(existingConfig.sampleSizeMetric, storageData.metrics);
        }
    }
    
    // Populate form fields
    const defaultName = existingConfig?.name || processFilenameToExperimentName(filename, atpNumber);
    document.getElementById('experimentName').value = defaultName;
    document.getElementById('sampleSize').value = existingConfig?.sampleSize || '';
    document.getElementById('startDate').value = defaultStartDate;

    // Create typeahead for sample size metric
    const sampleSizeMetricContainer = document.getElementById('sampleSizeMetric');
    if (sampleSizeMetricContainer) {
        const sampleSizeMetrics = ['', ...metrics]; // Add an empty option
        const sampleSizeMetricTypeahead = createTypeahead(
            'sampleSizeMetric', 
            sampleSizeMetrics, 
            sampleSizeMetricName || '', 
            'Default (visitors)'
        );
        window.sampleSizeMetricTypeahead = sampleSizeMetricTypeahead;
    }
    
    // Create primary KPI typeahead using same approach as secondary
    console.log('Creating primary KPI typeahead...');
    const primaryContainer = document.getElementById('primaryKPI');
    console.log('Primary container found:', primaryContainer);
    
    // Replace the select element with a div container
    const newPrimaryContainer = document.createElement('div');
    newPrimaryContainer.id = 'primaryKPI';
    newPrimaryContainer.className = 'primary-kpi-container';
    
    // Replace the select in the DOM
    primaryContainer.parentNode.replaceChild(newPrimaryContainer, primaryContainer);
    console.log('Replaced with new container:', newPrimaryContainer);
    
    // Create wrapper div just like secondary KPIs
    const primaryWrapper = document.createElement('div');
    primaryWrapper.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    
    // Create unique container for this typeahead
    const primaryTypeaheadContainer = document.createElement('div');
    primaryTypeaheadContainer.className = 'primary-typeahead-container';
    primaryTypeaheadContainer.style.flex = '1';
    
    // Give it a unique ID
    const primaryUniqueId = 'primary-kpi-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    primaryTypeaheadContainer.id = primaryUniqueId;
    
    primaryWrapper.appendChild(primaryTypeaheadContainer);
    newPrimaryContainer.appendChild(primaryWrapper);
    
    // Create typeahead after appending to DOM
    setTimeout(() => {
        console.log('Creating typeahead for ID:', primaryUniqueId);
        const primaryTypeahead = createTypeahead(primaryUniqueId, metrics, primaryMetricName || '', 'Select or type primary KPI...', true);
        console.log('Typeahead created:', primaryTypeahead);
        
        // Store reference for later access
        window.primaryTypeahead = primaryTypeahead;
        newPrimaryContainer.typeahead = primaryTypeahead;
        
        // Add change listener for Bayesian options update and auto-populate secondary metrics
        if (primaryTypeahead) {
            primaryTypeahead.getInput().addEventListener('change', () => {
                updateBayesianOptions();
                autoPopulateSecondaryMetrics(metrics);
            });
        }
        updateBayesianOptions();
    }, 0);
    
    // Setup secondary KPIs
    setupSecondaryKPIs(metrics, secondaryMetricNames);
    
    // Update Bayesian options after secondary KPIs are set up
    setTimeout(() => {
        updateBayesianOptions();
    }, 100);
    
    // Show/hide delete button based on existing configuration
    const deleteBtn = document.getElementById('deleteConfig');
    if (existingConfig) {
        deleteBtn.style.display = 'inline-block';
    } else {
        deleteBtn.style.display = 'none';
    }
    
    Utils.showScreen('configSection');
}

// Setup secondary KPIs
function setupSecondaryKPIs(metrics, selectedSecondary) {
    const container = document.getElementById('secondaryKPIs');
    container.innerHTML = '';
    
    // Add existing secondary KPIs
    selectedSecondary.forEach(metric => {
        addSecondaryKPI(container, metrics, metric);
    });
    
    // Always ensure there's at least one empty slot available
    ensureEmptySecondarySlot(container, metrics);
}

// Add secondary KPI selector
function addSecondaryKPI(container, metrics, selectedValue) {
    const div = document.createElement('div');
    div.className = 'secondary-kpi-item';
    div.style.cssText = 'display: flex; align-items: center; margin-bottom: 8px; gap: 8px;';
    
    // Create unique container for this typeahead
    const typeaheadContainer = document.createElement('div');
    typeaheadContainer.className = 'secondary-typeahead-container';
    typeaheadContainer.style.flex = '1';
    
    // Give it a unique ID
    const uniqueId = 'secondary-kpi-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    typeaheadContainer.id = uniqueId;
    
    div.appendChild(typeaheadContainer);
    
    // Create typeahead after appending to DOM
    setTimeout(() => {
        const typeahead = createTypeahead(uniqueId, metrics, selectedValue || '', 'Select or type secondary KPI...', true);
        
        // Store reference for later access
        div.typeahead = typeahead;
        
        // Add change listener for Bayesian options update
        if (typeahead) {
            typeahead.getInput().addEventListener('change', () => {
                updateBayesianOptions();
                ensureEmptySecondarySlot(container, metrics);
            });
        }
    }, 0);
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => {
        div.remove();
        updateBayesianOptions();
        // Ensure there's always an empty slot after removal
        ensureEmptySecondarySlot(container, metrics);
    };
    
    div.appendChild(removeBtn);
    container.appendChild(div);
}

// Ensure there's always an empty secondary KPI slot available
function ensureEmptySecondarySlot(container, metrics) {
    const items = container.querySelectorAll('.secondary-kpi-item');
    let hasEmpty = false;
    
    // Check if any typeahead has empty value
    items.forEach(item => {
        if (item.typeahead && item.typeahead.getValue().trim() === '') {
            hasEmpty = true;
        }
    });
    
    // Add an empty slot if there isn't one and we have less than 5 total slots
    if (!hasEmpty && items.length < 5) {
        addSecondaryKPI(container, metrics, '');
    }
}

// Dynamic detection functions for metric classification
// Let's not hardcode lists, instead we do pattern-based detection

/**
 * Determines if a metric is already averaged based on its name patterns
 * Logic: Contains "%" OR " per " OR "Average" OR " rate"
 */
function isAlreadyAveragedMetric(metricName) {
    if (!metricName) return false;
    const lowerMetric = metricName.toLowerCase();
    return lowerMetric.includes('%') || 
           lowerMetric.includes(' per ') || 
           lowerMetric.includes('average') || 
           lowerMetric.includes(' rate');
}

/**
 * Determines if a metric is continuous (should NOT have Bayesian calculations by default)
 * Logic: AlreadyAveraged metrics + metrics containing "revenue"
 */
function isContinuousMetric(metricName) {
    if (!metricName) return false;
    const lowerMetric = metricName.toLowerCase();
    
    // First check if it's already averaged
    const isAlreadyAveraged = lowerMetric.includes('%') || 
                            lowerMetric.includes(' per ') || 
                            lowerMetric.includes('average') || 
                            lowerMetric.includes(' rate');
    
    // Then check if it contains revenue
    const hasRevenue = lowerMetric.includes('revenue');
    
    return isAlreadyAveraged || hasRevenue;
}

// Make detection functions globally available
window.isAlreadyAveragedMetric = isAlreadyAveragedMetric;
window.isContinuousMetric = isContinuousMetric;

// Dynamic arrays that get populated based on current metrics
// These maintain backward compatibility for code that expects arrays
window.alreadyAveragedMetrics = [];
window.continuousMetrics = [];

// Update Bayesian options
function updateBayesianOptions() {
    // Get primary value with fallback approach like secondary
    const primaryContainer = document.getElementById('primaryKPI');
    const primary = (window.primaryTypeahead ? window.primaryTypeahead.getValue() : 
                    primaryContainer.typeahead ? primaryContainer.typeahead.getValue() : '') || '';
    
    // Get secondary values from typeaheads
    const secondaryItems = document.querySelectorAll('#secondaryKPIs .secondary-kpi-item');
    const secondary = Array.from(secondaryItems)
        .map(item => item.typeahead ? item.typeahead.getValue() : '')
        .filter(v => v.trim() !== '');
    
    const allSelected = [primary, ...secondary].filter(Boolean);
    const existingConfig = loadConfiguration(currentExperiment.atp);
    
    // Convert stored Bayesian metric IDs back to metric names for comparison
    let bayesianSelected = [];
    if (existingConfig?.bayesian && existingConfig.bayesian.length > 0) {
        const storageData = JSONConverter.loadAndConvertData('atpConfigurations');
        if (storageData && storageData.metrics) {
            bayesianSelected = existingConfig.bayesian
                .map(metricId => JSONConverter.getMetricName(metricId, storageData.metrics))
                .filter(Boolean);
        }
    }
    
    const container = document.getElementById('bayesianOptions');
    container.innerHTML = '';
    
    allSelected.forEach(metric => {
        const div = document.createElement('div');
        div.className = 'bayesian-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `bayesian_${metric}`;
        
        // Check if this metric should be selected by default
        const shouldBeChecked = bayesianSelected.includes(metric) || 
                               (bayesianSelected.length === 0 && !isContinuousMetric(metric));
        checkbox.checked = shouldBeChecked;
        
        const label = document.createElement('label');
        label.htmlFor = `bayesian_${metric}`;
        label.textContent = metric;
        
        div.appendChild(checkbox);
        div.appendChild(label);
        container.appendChild(div);
    });
}

// Configuration management
function loadConfiguration(atpNumber) {
    const data = JSONConverter.loadAndConvertData('atpConfigurations');
    if (!data || !data.experiments) return null;
    return data.experiments[atpNumber] || null;
}

function saveConfiguration(atpNumber, config) {
    const data = JSONConverter.loadAndConvertData('atpConfigurations') || { version: JSONConverter.CURRENT_VERSION, metrics: [], experiments: {} };
    data.experiments[atpNumber] = config;
    JSONConverter.saveV2Data('atpConfigurations', data);
}

// Toggle revenue section visibility
function toggleRevenue() {
    const revenueSection = document.getElementById('revenue-section');
    if (revenueSection) {
        revenueSection.classList.toggle('revenue-hidden');
    }
}

// Delete experiment configuration
function deleteExperimentConfiguration() {
    if (!currentExperiment) return;
    
    const experimentName = currentExperiment.config?.name || `ATP ${currentExperiment.atp}`;
    
    if (confirm(`Are you sure you want to delete "${experimentName}" from the tool? This action cannot be undone.`)) {
        const data = JSONConverter.loadAndConvertData('atpConfigurations');
        if (data && data.experiments) {
            delete data.experiments[currentExperiment.atp];
            JSONConverter.saveV2Data('atpConfigurations', data);
        }
        
        // Reset current experiment
        currentExperiment = null;
        currentConfig = null;
        
        // Refresh the sidebar
        loadSavedExperiments();
        
        // Go back to upload screen
        Utils.showScreen('uploadSection');
        
        alert('Experiment deleted successfully.');
    }
}

// In main.js, update the saveConfigurationWithMetrics function to completely replace metrics:

function saveConfigurationWithMetrics(atpNumber, config, data, globalVisits, csvDateInfo) {
    const storageData = JSONConverter.loadAndConvertData('atpConfigurations') || { 
        version: JSONConverter.CURRENT_VERSION, 
        metrics: {}, 
        experiments: {} 
    };
    
    // Add new metrics to global list
    const existingMetrics = new Set(Object.values(storageData.metrics));
    const newMetrics = new Set();
    data.forEach(item => {
        newMetrics.add(item.label);
    });
    
    // Find the next available static ID
    const existingIds = Object.keys(storageData.metrics).map(id => parseInt(id));
    const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 0;
    
    // Add new metrics with static IDs
    let currentId = nextId;
    newMetrics.forEach(metric => {
        if (!existingMetrics.has(metric)) {
            storageData.metrics[currentId] = metric;
            currentId++;
        }
    });
    
    // COMPLETELY REPLACE metrics data - start with empty object
    const metrics = {};
    data.forEach(item => {
        const metricId = JSONConverter.getMetricId(item.label, storageData.metrics);
        if (metricId !== null) {
            const v2Metric = {
                valA: item.control,
                valB: item.variantB || item.variant // Maintain backward compatibility
            };
            
            // Add additional variants if they exist
            if (item.variantC !== null && item.variantC !== undefined) {
                v2Metric.valC = item.variantC;
            }
            if (item.variantD !== null && item.variantD !== undefined) {
                v2Metric.valD = item.variantD;
            }
            
            // Only include visits if they differ from global visits
            if (globalVisits) {
                if (item.controlVisits && item.controlVisits !== globalVisits.control) {
                    v2Metric.aVisits = item.controlVisits;
                }
                if (item.variantBVisits && item.variantBVisits !== (globalVisits.variantB || globalVisits.variant)) {
                    v2Metric.bVisits = item.variantBVisits;
                }
                if (item.variantCVisits && item.variantCVisits !== globalVisits.variantC) {
                    v2Metric.cVisits = item.variantCVisits;
                }
                if (item.variantDVisits && item.variantDVisits !== globalVisits.variantD) {
                    v2Metric.dVisits = item.variantDVisits;
                }
            } else {
                // No global visits, include all visit data
                if (item.controlVisits) {
                    v2Metric.aVisits = item.controlVisits;
                }
                if (item.variantBVisits) {
                    v2Metric.bVisits = item.variantBVisits;
                }
                if (item.variantCVisits) {
                    v2Metric.cVisits = item.variantCVisits;
                }
                if (item.variantDVisits) {
                    v2Metric.dVisits = item.variantDVisits;
                }
            }
            
            // Store Bayesian calculation results if available
            if (item.hasBayesianData && item.bayesianProbability !== undefined) {
                v2Metric.hasBayesianData = true;
                v2Metric.bayesianProbability = item.bayesianProbability;
            }
            
            metrics[metricId] = v2Metric;
        }
    });
    
    // Check if config is already in v2 format (has numeric IDs)
    const isAlreadyV2 = typeof config.primary === 'number' || 
                       (config.secondary && config.secondary.length > 0 && typeof config.secondary[0] === 'number') ||
                       (config.bayesian && config.bayesian.length > 0 && typeof config.bayesian[0] === 'number');
    
    let primaryId, secondaryIds, bayesianIds, sampleSizeMetricId;
    
    if (isAlreadyV2) {
        // Config is already in v2 format, use IDs directly
        primaryId = config.primary;
        secondaryIds = config.secondary || [];
        bayesianIds = config.bayesian || [];
        sampleSizeMetricId = config.sampleSizeMetric;
    } else {
        // Config is in v1 format, convert to v2
        primaryId = JSONConverter.getMetricId(config.primary, storageData.metrics);
        secondaryIds = (config.secondary || []).map(metric => JSONConverter.getMetricId(metric, storageData.metrics));
        bayesianIds = (config.bayesian || []).map(metric => JSONConverter.getMetricId(metric, storageData.metrics));
        sampleSizeMetricId = JSONConverter.getMetricId(config.sampleSizeMetric, storageData.metrics);
    }
    
    // Calculate sample ratio mismatch for multi-variant experiments
    let hasSampleRatioMismatch = false;
    let srmVariants = [];
    let srmAnalysisResults = [];
    
    if (globalVisits && globalVisits.control) {
        // Check each variant against control and store raw analysis data
        if (globalVisits.variantB || globalVisits.variant) {
            const variantBVisits = globalVisits.variantB || globalVisits.variant;
            const srmAnalysisB = SRM.analyzeSampleRatio(globalVisits.control, variantBVisits);
            if (srmAnalysisB.isSignificant) {
                hasSampleRatioMismatch = true;
                srmVariants.push('Variant-B');
                srmAnalysisResults.push({
                    variant: 'Variant-B',
                    controlRatio: srmAnalysisB.controlRatio,
                    variantRatio: srmAnalysisB.variantRatio,
                    pValue: srmAnalysisB.pValue,
                    severity: srmAnalysisB.severity
                });
            }
            console.log(`SRM Analysis for ${atpNumber} Variant B:`, srmAnalysisB);
        }
        
        if (globalVisits.variantC) {
            const srmAnalysisC = SRM.analyzeSampleRatio(globalVisits.control, globalVisits.variantC);
            if (srmAnalysisC.isSignificant) {
                hasSampleRatioMismatch = true;
                srmVariants.push('Variant-C');
                srmAnalysisResults.push({
                    variant: 'Variant-C',
                    controlRatio: srmAnalysisC.controlRatio,
                    variantRatio: srmAnalysisC.variantRatio,
                    pValue: srmAnalysisC.pValue,
                    severity: srmAnalysisC.severity
                });
            }
            console.log(`SRM Analysis for ${atpNumber} Variant C:`, srmAnalysisC);
        }
        
        if (globalVisits.variantD) {
            const srmAnalysisD = SRM.analyzeSampleRatio(globalVisits.control, globalVisits.variantD);
            if (srmAnalysisD.isSignificant) {
                hasSampleRatioMismatch = true;
                srmVariants.push('Variant-D');
                srmAnalysisResults.push({
                    variant: 'Variant-D',
                    controlRatio: srmAnalysisD.controlRatio,
                    variantRatio: srmAnalysisD.variantRatio,
                    pValue: srmAnalysisD.pValue,
                    severity: srmAnalysisD.severity
                });
            }
            console.log(`SRM Analysis for ${atpNumber} Variant D:`, srmAnalysisD);
        }
        
        if (hasSampleRatioMismatch) {
            console.log(`SRM detected for ${atpNumber} in variants: ${srmVariants.join(', ')}`);
            console.log(`SRM Storage - srmVariants:`, srmVariants);
            console.log(`SRM Storage - srmAnalysisResults:`, srmAnalysisResults);
        }
    }
    
    const v2Config = {
        // Keep all existing metadata
        name: config.name || '',
        primary: primaryId,
        secondary: secondaryIds,
        bayesian: bayesianIds,
        sampleSize: config.sampleSize || null,
        sampleSizeMetric: sampleSizeMetricId,
        startDate: config.startDate || null,
        needsConfig: config.needsConfig || false,
        timestamp: Date.now(), // Update timestamp for "last updated"
        
        // Replace data-related fields completely
        globalVisits,
        csvDateInfo,
        analytics: Utils.calculateExperimentAnalytics(config, globalVisits, data),
        metrics, // This completely replaces the old metrics
        hasSampleRatioMismatch: hasSampleRatioMismatch,
        srmVariants: srmVariants,
        srmAnalysisResults: srmAnalysisResults
        
        // Note: businessImpact, isPrimaryValidated, lastCalculated will be recalculated 
        // when the results are displayed, so we don't need to preserve old values
    };
    
    // Store projected end date as ISO string for consistent sorting
    if (v2Config.analytics.projectedEndDate && typeof v2Config.analytics.projectedEndDate !== 'string') {
        v2Config.analytics.projectedEndDate = v2Config.analytics.projectedEndDate.toISOString();
    }
    
    storageData.experiments[atpNumber] = v2Config;
    JSONConverter.saveV2Data('atpConfigurations', storageData);
    
    // Calculate and store business impact using the stored configuration
    const analytics = v2Config.analytics || {};
    calculateAndStoreBusinessImpact(data, v2Config, analytics, globalVisits, atpNumber);
}


function getDefaultStartDate(existingConfig, csvDateInfo) {
    if (existingConfig?.startDate) return existingConfig.startDate;
    if (csvDateInfo?.startDate) {
        const date = csvDateInfo.startDate;
        // Use local date formatting to avoid timezone conversion issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return '';
}

function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}

// Share experiment data functions
function showShareExperimentModal() {
    const data = JSONConverter.loadAndConvertData('atpConfigurations');
    if (!data || !data.experiments) {
        Utils.showError('No experiments found to share.');
        return;
    }
    
    // Get experiments updated in the last 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentExperiments = Object.entries(data.experiments)
        .filter(([atp, config]) => config.timestamp && config.timestamp > sevenDaysAgo)
        .sort(([,a], [,b]) => b.timestamp - a.timestamp);
    
    if (recentExperiments.length === 0) {
        Utils.showError('No experiments updated in the last 7 days.');
        return;
    }
    
    // Populate checkboxes
    const checkboxContainer = document.getElementById('experimentCheckboxes');
    checkboxContainer.innerHTML = '';
    
    recentExperiments.forEach(([atp, config]) => {
        const item = document.createElement('div');
        item.className = 'experiment-checkbox-item';
        item.innerHTML = `
            <input type="checkbox" id="share_${atp}" value="${atp}">
            <label for="share_${atp}">
                <strong>${atp}</strong> - ${config.name || 'Unnamed Experiment'}
                <br><small>Last updated: ${new Date(config.timestamp).toLocaleDateString()}</small>
            </label>
        `;
        checkboxContainer.appendChild(item);
    });
    
    document.getElementById('shareExpModal').classList.remove('hidden');
}

function generateShareableURL() {
    const selectedExperiments = Array.from(document.querySelectorAll('#experimentCheckboxes input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value);
    
    if (selectedExperiments.length === 0) {
        Utils.showError('Please select at least one experiment to share.');
        return;
    }
    
    const data = JSONConverter.loadAndConvertData('atpConfigurations');
    if (!data || !data.experiments) {
        Utils.showError('No experiments found.');
        return;
    }
    
    try {
        // Create subset with only selected experiments and their metrics
        const subsetData = JSONConverter.createSubset(data, selectedExperiments);
        
        // Minify the JSON
        const minifiedJson = JSON.stringify(subsetData);
        
        // Use URL-safe base64 encoding
        const base64 = btoa(unescape(encodeURIComponent(minifiedJson)));
        const encodedJson = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        
        // Create shareable URL with all data
        const currentUrl = window.location.origin + window.location.pathname;
        const shareableUrl = `${currentUrl}?import=${encodedJson}`;
            
        
        // Show the URL in the modal
        document.getElementById('shareUrlText').value = shareableUrl;
        document.getElementById('shareExpModal').classList.add('hidden');
        document.getElementById('shareUrlModal').classList.remove('hidden');
        
        console.log('Generated URL length:', shareableUrl.length);
        console.log('Original JSON size:', minifiedJson.length);
        console.log('Base64 encoded size:', encodedJson.length);
        
    } catch (error) {
        Utils.showError('Error generating shareable URL: ' + error.message);
    }
}

function checkForImportData() {
    const urlParams = new URLSearchParams(window.location.search);
    const importData = urlParams.get('import');
    
    if (importData) {
        try {
            console.log('Found import data in URL, length:', importData.length);
            
            // Decode URL-safe base64 data
            let decodedJson;
            try {
                // Convert URL-safe base64 back to standard base64
                const standardBase64 = importData.replace(/-/g, '+').replace(/_/g, '/');
                // Add padding if needed
                const paddedBase64 = standardBase64 + '='.repeat((4 - standardBase64.length % 4) % 4);
                decodedJson = decodeURIComponent(escape(atob(paddedBase64)));
            } catch (decodeError) {
                console.error('Base64 decode error:', decodeError);
                Utils.showError('Invalid base64 encoding: ' + decodeError.message);
                return;
            }
            
            console.log('Decoded JSON length:', decodedJson.length);
            
            // Then try to parse the JSON
            let importedData;
            try {
                importedData = JSON.parse(decodedJson);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                Utils.showError('Invalid JSON format: ' + parseError.message);
                return;
            }
            
            console.log('Successfully parsed import data:', importedData);
            
            if (confirm('Import shared experiment data? This will merge the data with your existing experiments.')) {
                importSharedData(importedData);
                // Clean up the URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (error) {
            console.error('Import error:', error);
            Utils.showError('Invalid import data: ' + error.message);
        }
    }
}

function importSharedData(importedData) {
    try {
        const existingData = JSONConverter.loadAndConvertData('atpConfigurations') || {
            version: JSONConverter.CURRENT_VERSION,
            metrics: {},
            experiments: {}
        };
        
        // Merge the imported data
        const mergedData = JSONConverter.mergeSubset(existingData, importedData);
        
        // Save the merged data
        JSONConverter.saveV2Data('atpConfigurations', mergedData);
        
        // Refresh the experiments list
        loadSavedExperiments();
        
        Utils.showSuccess('Shared experiment data imported successfully!');
    } catch (error) {
        Utils.showError('Error importing data: ' + error.message);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Config edit panel toggle
    document.getElementById('toggleImport').addEventListener('click', () => {
        const panel = document.getElementById('importConfigPanel');
        const textarea = document.getElementById('configImportArea');
        
        if (panel.classList.contains('hidden')) {
            // Load current config when opening
            const currentConfig = JSONConverter.loadAndConvertData('atpConfigurations');
            if (currentConfig) {
                try {
                    // Pretty print the JSON
                    textarea.value = JSON.stringify(currentConfig, null, 2);
                } catch (e) {
                    textarea.value = JSON.stringify(currentConfig);
                }
            } else {
                textarea.value = '';
            }
        }
        panel.classList.toggle('hidden');
    });

    // Save config button
    document.getElementById('importConfigButton').addEventListener('click', () => {
        const textarea = document.getElementById('configImportArea');
        const jsonString = textarea.value.trim();
        
        try {
            const config = JSON.parse(jsonString);
            if (typeof config === 'object') {
                // Convert to v2 format if needed
                const v2Config = JSONConverter.convertData(config);
                JSONConverter.saveV2Data('atpConfigurations', v2Config);
                loadSavedExperiments(); // Refresh the experiments list
                textarea.value = ''; // Clear the textarea
                document.getElementById('importConfigPanel').classList.add('hidden');
                alert('Configuration imported successfully!');
            } else {
                throw new Error('Invalid configuration format');
            }
        } catch (error) {
            alert('Error: Invalid JSON format. Please check your input.');
        }
    });

    // Save configuration
    document.getElementById('saveConfig').addEventListener('click', () => {
        const name = document.getElementById('experimentName').value.trim();
        
        // Get primary value with fallback approach like secondary
        const primaryContainer = document.getElementById('primaryKPI');
        const primary = (window.primaryTypeahead ? window.primaryTypeahead.getValue() : 
                        primaryContainer.typeahead ? primaryContainer.typeahead.getValue() : '') || '';
        
        // Get secondary values from typeaheads
        const secondaryItems = document.querySelectorAll('#secondaryKPIs .secondary-kpi-item');
        const secondary = Array.from(secondaryItems)
            .map(item => item.typeahead ? item.typeahead.getValue() : '')
            .filter(v => v.trim() !== '');
        const sampleSize = parseInt(document.getElementById('sampleSize').value) || null;
        const startDate = document.getElementById('startDate').value;
        const sampleSizeMetric = window.sampleSizeMetricTypeahead ? window.sampleSizeMetricTypeahead.getValue() : '';
        
        if (!name) {
            Utils.showError('Please enter an experiment name.');
            return;
        }
        
        if (!primary) {
            Utils.showError('Please select a primary KPI.');
            return;
        }
        
        // Get Bayesian selections
        const bayesianCheckboxes = document.querySelectorAll('#bayesianOptions input[type="checkbox"]:checked');
        const bayesian = Array.from(bayesianCheckboxes).map(cb => cb.nextElementSibling.textContent);
        
        const config = {
            name,
            primary,
            secondary,
            bayesian,
            sampleSize,
            sampleSizeMetric,
            startDate: startDate || null,
            needsConfig: false // Mark as configured
        };
        
        // Save configuration with metrics data
        const existingConfig = loadConfiguration(currentExperiment.atp);
        const csvDateInfo = existingConfig?.csvDateInfo || null;
        saveConfigurationWithMetrics(currentExperiment.atp, config, currentExperiment.data, currentExperiment.globalVisits, csvDateInfo);
        currentExperiment.config = config;
        
        Utils.showSuccess('Configuration saved successfully!');
        loadSavedExperiment(currentExperiment.atp);
        loadSavedExperiments();
    });
    
    // Cancel configuration
    document.getElementById('cancelConfig').addEventListener('click', () => {
        Utils.showScreen('uploadSection');
    });

    // Delete configuration
    document.getElementById('deleteConfig').addEventListener('click', () => {
        deleteExperimentConfiguration();
    });
    
    // Share experiment data
    document.getElementById('shareExpData').addEventListener('click', () => {
        showShareExperimentModal();
    });
    
    document.getElementById('confirmShare').addEventListener('click', () => {
        generateShareableURL();
    });
    
    document.getElementById('cancelShare').addEventListener('click', () => {
        document.getElementById('shareExpModal').classList.add('hidden');
    });
    
    document.getElementById('copyShareUrl').addEventListener('click', () => {
        const urlText = document.getElementById('shareUrlText');
        urlText.select();
        document.execCommand('copy');
        Utils.showSuccess('URL copied to clipboard!');
    });
    
    document.getElementById('closeShareUrl').addEventListener('click', () => {
        document.getElementById('shareUrlModal').classList.add('hidden');
    });
}

// Process and display results
function processAndDisplayResults() {
    const data = applyBayesianCalculations(currentExperiment.data, currentExperiment.config.bayesian);
    displayResults(data, currentExperiment.config, currentExperiment.globalVisits);
}

// Apply Bayesian calculations with multi-variant support
function applyBayesianCalculations(data, bayesianMetrics) {
    const debugMode = isDeveloperModeActive();
    
    // Convert v2 IDs to names for Bayesian calculations
    let bayesianMetricNames = [];
    if (bayesianMetrics && bayesianMetrics.length > 0) {
        const storageData = JSONConverter.loadAndConvertData('atpConfigurations');
        bayesianMetricNames = bayesianMetrics.map(metricId => JSONConverter.getMetricName(metricId, storageData.metrics)).filter(Boolean);
    }
    
    return data.map(row => {
        // Calculate Bayesian for selected metrics
        if (bayesianMetricNames.includes(row.label) && row.controlVisits) {
            const bayesianProbabilities = {};
            
            // Calculate Variant B vs Control
            if (row.variantBVisits || row.variantVisits) {
                const variantBVisits = row.variantBVisits || row.variantVisits;
                const variantBValue = row.variantB || row.variant;
                bayesianProbabilities.variantB = Bayesian.calculateBayesianProb(
                    row.controlVisits, row.control, variantBVisits, variantBValue
                );
            }
            
            // Calculate Variant C vs Control
            if (row.variantC !== null && row.variantC !== undefined && row.variantCVisits) {
                bayesianProbabilities.variantC = Bayesian.calculateBayesianProb(
                    row.controlVisits, row.control, row.variantCVisits, row.variantC
                );
            }
            
            // Calculate Variant D vs Control
            if (row.variantD !== null && row.variantD !== undefined && row.variantDVisits) {
                bayesianProbabilities.variantD = Bayesian.calculateBayesianProb(
                    row.controlVisits, row.control, row.variantDVisits, row.variantD
                );
            }
            
            return {
                ...row,
                hasBayesianData: true,
                bayesianProbabilities: bayesianProbabilities,
                // Keep backward compatibility
                bayesianProbability: bayesianProbabilities.variantB || 0
            };
        }
        
        // In debug mode, calculate Bayesian for predefined metrics that have visit data
        if (debugMode && !isContinuousMetric(row.label) && row.controlVisits) {
            const bayesianProbabilities = {};
            
            // Calculate Variant B vs Control
            if (row.variantBVisits || row.variantVisits) {
                const variantBVisits = row.variantBVisits || row.variantVisits;
                const variantBValue = row.variantB || row.variant;
                bayesianProbabilities.variantB = Bayesian.calculateBayesianProb(
                    row.controlVisits, row.control, variantBVisits, variantBValue
                );
            }
            
            // Calculate Variant C vs Control
            if (row.variantC !== null && row.variantC !== undefined && row.variantCVisits) {
                bayesianProbabilities.variantC = Bayesian.calculateBayesianProb(
                    row.controlVisits, row.control, row.variantCVisits, row.variantC
                );
            }
            
            // Calculate Variant D vs Control
            if (row.variantD !== null && row.variantD !== undefined && row.variantDVisits) {
                bayesianProbabilities.variantD = Bayesian.calculateBayesianProb(
                    row.controlVisits, row.control, row.variantDVisits, row.variantD
                );
            }
            
            return {
                ...row,
                hasBayesianData: true,
                bayesianProbabilities: bayesianProbabilities,
                // Keep backward compatibility
                bayesianProbability: bayesianProbabilities.variantB || 0
            };
        }
        
        return row;
    });
}

// Calculate and store business impact for all variants in localStorage
function calculateAndStoreBusinessImpact(data, config, analytics, globalVisits, atpNumber = null) {
    console.log('calculateAndStoreBusinessImpact called with:', {
        atpNumber: atpNumber,
        dataLength: data ? data.length : 'null',
        hasGlobalVisits: !!globalVisits,
        globalVisits: globalVisits
    });
    
    // Determine if we have multiple variants
    const hasVariantC = globalVisits && globalVisits.variantC !== undefined;
    const hasVariantD = globalVisits && globalVisits.variantD !== undefined;
    
    let businessImpacts = {};
    let maxBusinessImpact = 0;
    let bestVariant = null;
    
    // Calculate business impact for Variant B (or single variant for backward compatibility)
    const projectionB = Utils.calculateRevenueProjection(data, config, analytics, globalVisits, 'variantB');
    const businessImpactB = projectionB && projectionB.annualRevenue ? projectionB.annualRevenue : 0;
    businessImpacts.variantB = businessImpactB;
    
    // Store revenue change percentages
    let revenueChanges = {};
    revenueChanges.variantB = projectionB && projectionB.revenueChange ? projectionB.revenueChange : '0.00';
    
    if (Math.abs(businessImpactB) > Math.abs(maxBusinessImpact)) {
        maxBusinessImpact = businessImpactB;
        bestVariant = 'Variant-B';
    }
    
    // Calculate business impact for Variant C if it exists
    if (hasVariantC) {
        const projectionC = Utils.calculateRevenueProjection(data, config, analytics, globalVisits, 'variantC');
        const businessImpactC = projectionC && projectionC.annualRevenue ? projectionC.annualRevenue : 0;
        businessImpacts.variantC = businessImpactC;
        revenueChanges.variantC = projectionC && projectionC.revenueChange ? projectionC.revenueChange : '0.00';
        
        if (Math.abs(businessImpactC) > Math.abs(maxBusinessImpact)) {
            maxBusinessImpact = businessImpactC;
            bestVariant = 'Variant-C';
        }
    }
    
    // Calculate business impact for Variant D if it exists
    if (hasVariantD) {
        const projectionD = Utils.calculateRevenueProjection(data, config, analytics, globalVisits, 'variantD');
        const businessImpactD = projectionD && projectionD.annualRevenue ? projectionD.annualRevenue : 0;
        businessImpacts.variantD = businessImpactD;
        revenueChanges.variantD = projectionD && projectionD.revenueChange ? projectionD.revenueChange : '0.00';
        
        if (Math.abs(businessImpactD) > Math.abs(maxBusinessImpact)) {
            maxBusinessImpact = businessImpactD;
            bestVariant = 'Variant-D';
        }
    }
    
    // Store in the configuration
    const targetAtp = atpNumber || currentExperiment.atp;
    const storageData = JSONConverter.loadAndConvertData('atpConfigurations');
    if (storageData && storageData.experiments && storageData.experiments[targetAtp]) {
        // Store individual variant impacts and revenue changes
        storageData.experiments[targetAtp].businessImpacts = businessImpacts;
        storageData.experiments[targetAtp].revenueChanges = revenueChanges;
        storageData.experiments[targetAtp].businessImpact = maxBusinessImpact; // Keep for backward compatibility
        storageData.experiments[targetAtp].bestVariant = bestVariant;
        storageData.experiments[targetAtp].lastCalculated = Date.now();
        JSONConverter.saveV2Data('atpConfigurations', storageData);
    }
    
    return maxBusinessImpact; // Return the highest impact for backward compatibility
}

// Calculate and store primary KPI validation status in localStorage
function calculateAndStorePrimaryValidation(data, config) {
    if (!config.primary) return false;
    
    // Convert v2 ID to name for validation
    const storageData = JSONConverter.loadAndConvertData('atpConfigurations');
    const primaryMetricName = JSONConverter.getMetricName(config.primary, storageData.metrics);
    
    const primaryMetric = data.find(item => item.label === primaryMetricName);
    const isPrimaryValidated = primaryMetric && primaryMetric.hasBayesianData && primaryMetric.bayesianProbability >= 0.95;
    
    // Store in the configuration
    if (storageData && storageData.experiments && storageData.experiments[currentExperiment.atp]) {
        storageData.experiments[currentExperiment.atp].isPrimaryValidated = isPrimaryValidated;
        storageData.experiments[currentExperiment.atp].lastCalculated = Date.now();
        JSONConverter.saveV2Data('atpConfigurations', storageData);
    }
    
    return isPrimaryValidated;
}

// Display results
function displayResults(data, config, globalVisits) {
    // Use stored analytics - never recalculate
    const analytics = config.analytics || {};

    console.log("Displaying results for atp " + currentExperiment.atp);
    
    // Calculate and store primary KPI validation (business impact already calculated in saveConfigurationWithMetrics)
    const isPrimaryValidated = calculateAndStorePrimaryValidation(data, config);
    
    // Remove any existing SRM warnings first
    const existingSrmWarnings = document.querySelectorAll('.srm-warning');
    existingSrmWarnings.forEach(warning => warning.remove());
    
    // Generate SRM warning if needed for multi-variant experiments
    let srmWarningHtml = '';
    if (config.hasSampleRatioMismatch && globalVisits && globalVisits.control) {
        const affectedVariants = config.srmVariants || [];
        console.log('SRM Display - affectedVariants:', affectedVariants);
        console.log('SRM Display - config.srmAnalysisResults:', config.srmAnalysisResults);
        const variantText = affectedVariants.length > 0 ? affectedVariants.join(', ') : 'Unknown variants';
        
        // Determine overall severity (critical if any variant is critical)
        const hasCritical = config.srmAnalysisResults && config.srmAnalysisResults.some(r => r.severity === 'critical');
        const warningClass = hasCritical ? 'srm-warning-critical' : 'srm-warning-moderate';
        const warningIcon = hasCritical ? '🚨' : '⚠️';
        const warningTitle = hasCritical ? 'Critical Sample Ratio Mismatch' : 'Sample Ratio Mismatch Warning';
        let warningMessage = hasCritical 
            ? 'Critical sample ratio mismatch detected. Investigate data collection or randomisation issues immediately.'
            : 'Sample ratio mismatch detected. Consider investigating data collection or randomisation issues.';
        
        // Add probability explanation for critical warnings
        if (hasCritical && config.srmAnalysisResults && config.srmAnalysisResults.length > 0) {
            // Find the lowest p-value (most significant)
            const lowestPValue = Math.min(...config.srmAnalysisResults.map(r => r.pValue));
            const randomChancePercent = (lowestPValue * 100).toFixed(4);
            warningMessage += ` There is ${randomChancePercent}% chance that this difference is due to random fluctuation. There is something causing this issue.`;
        }
        
        // Format stored SRM analysis results into HTML
        let detailedStats = '';
        if (config.srmAnalysisResults && config.srmAnalysisResults.length > 0) {
            detailedStats = config.srmAnalysisResults.map(result => 
                `<p><strong>${result.variant}:</strong> Control ${result.controlRatio} | Variant ${result.variantRatio} (p = ${result.pValue.toFixed(4)})</p>`
            ).join('');
        }
        
        // Add dismiss button for developer mode
        const debugMode = isDeveloperModeActive();
        const dismissButton = debugMode ? '<button class="srm-dismiss-btn" onclick="this.parentElement.style.display=\'none\'" title="Dismiss warning (dev mode only)">×</button>' : '';
        
        srmWarningHtml = `
            <div class="srm-warning ${warningClass}">
                ${dismissButton}
                <h4>${warningIcon} ${warningTitle}</h4>
                <p><strong>Affected variants:</strong> ${variantText}</p>
                <div class="srm-stats">
                    ${detailedStats}
                </div>
                <p class="srm-footer-message">${warningMessage}</p>
            </div>
        `;
    }
    
    // Generate experiment info
    document.getElementById('experimentInfo').innerHTML = generateExperimentInfo(analytics, config, globalVisits, data);
    
    // Add SRM warning above experiment info if needed
    if (srmWarningHtml) {
        const srmWarningElement = document.createElement('div');
        srmWarningElement.innerHTML = srmWarningHtml;
        document.getElementById('experimentInfo').parentNode.insertBefore(srmWarningElement, document.getElementById('experimentInfo'));
    }
    
    // Generate results table
    document.getElementById('resultsTable').innerHTML = generateResultsTable(data, config);
    
    // Generate actions bar
    document.getElementById('actionsBar').innerHTML = generateActionsBar(data, config);
    
    // Generate extra metrics

    document.getElementById('extraMetrics').innerHTML = generateExtraMetrics(data, config);
    
    // Add data upload timestamp
    const uploadTimestamp = config.timestamp ? Utils.formatDate(new Date(config.timestamp)) : 'Unknown';
    const uploadInfo = document.createElement('div');
    uploadInfo.style.cssText = 'margin-top: 20px; padding: 10px; font-size: 12px; color: #666;';
    uploadInfo.innerHTML = `Data last uploaded on ${uploadTimestamp}`;
    document.getElementById('actionsBar').appendChild(uploadInfo);
    
    Utils.showScreen('resultsSection');
    setupResultsEventListeners(data, config);
}

// Generate experiment info
function generateExperimentInfo(analytics, config, globalVisits, data) {
    console.log("Generating experiment info for atp " + currentExperiment.atp);
    
    let html = `
        <div class="experiment-info">
            <div class="experiment-meta">
                <h3 class="experiment-name-clickable" onclick="toggleRevenue()">${config.name || 'ATP ' + currentExperiment.atp}</h3>
                ${config.startDate ? `<p>Started: ${Utils.formatDate(config.startDate)}</p>` : ''}
            </div>
    `;
    
    // Revenue projection - always generate but hidden by default, now with multi-variant support
    const hasMultipleVariants = globalVisits && (globalVisits.variantC !== undefined || globalVisits.variantD !== undefined);
    
    if (hasMultipleVariants) {
        // Multi-variant business impact breakdown
        html += `
            <div class="revenue-projection revenue-hidden" id="revenue-section">
                <h4>Business Impact by Variant</h4>
                <p class="disclaimer">NOT official formula, loose guide only, do not expect it to be completely accurate.</p>
        `;
        
        // Get stored business impacts from configuration
        const storageData = JSONConverter.loadAndConvertData('atpConfigurations');
        const experimentConfig = storageData?.experiments?.[currentExperiment.atp];
        const businessImpacts = experimentConfig?.businessImpacts || {};
        
        // Display impact for each variant using stored values only
        if (businessImpacts.variantB !== undefined) {
            const revenueChangeB = experimentConfig?.revenueChanges?.variantB || '0.00';
            html += `<p><strong>Variant-B:</strong> €${businessImpacts.variantB.toLocaleString()} (${revenueChangeB}% change)</p>`;
        }
        
        if (businessImpacts.variantC !== undefined && globalVisits.variantC !== undefined) {
            const revenueChangeC = experimentConfig?.revenueChanges?.variantC || '0.00';
            html += `<p><strong>Variant-C:</strong> €${businessImpacts.variantC.toLocaleString()} (${revenueChangeC}% change)</p>`;
        }
        
        if (businessImpacts.variantD !== undefined && globalVisits.variantD !== undefined) {
            const revenueChangeD = experimentConfig?.revenueChanges?.variantD || '0.00';
            html += `<p><strong>Variant-D:</strong> €${businessImpacts.variantD.toLocaleString()} (${revenueChangeD}% change)</p>`;
        }
        
        html += `</div>`;
        } else {
        // Single variant (backward compatibility) - use stored values only
        const storageData = JSONConverter.loadAndConvertData('atpConfigurations');
        const experimentConfig = storageData?.experiments?.[currentExperiment.atp];
        const storedBusinessImpact = experimentConfig?.businessImpact || 0;
        const storedRevenueChange = experimentConfig?.revenueChanges?.variantB || '0.00';
        
        if (storedBusinessImpact !== 0) {
            html += `
                <div class="revenue-projection revenue-hidden" id="revenue-section">
                    <h4>Revenue Projection</h4>
                        <p class="disclaimer">NOT official formula, loose guide only, do not expect it to be completely accurate.</p>
                    <p>Annual Revenue Impact: €${storedBusinessImpact.toLocaleString()}</p>
                    <p>Based on ${storedRevenueChange}% change in <em>Revenue (incl. C&C) - SPR</em></p>
                </div>
            `;
        }
    }
    
    // Experiment stats - 2 column layout
    if (analytics.daysRunning !== null && analytics.daysRunning !== undefined) {
        // Determine variant configuration (A/B, A/B/C, A/B/C/D)
        let variantConfig = 'A/B'; // Default
        if (globalVisits) {
            const variants = ['A', 'B'];
            if (globalVisits.variantC !== null && globalVisits.variantC !== undefined) variants.push('C');
            if (globalVisits.variantD !== null && globalVisits.variantD !== undefined) variants.push('D');
            variantConfig = variants.join('/');
        }
        
        // Left column: Days Running, Daily Traffic Rate, and Variant Config
        let leftColumn = `
            <div class="stats-left">
                <div><strong>Days Running:</strong> ${analytics.daysRunning}</div>
                ${analytics.dailyTrafficRate ? `<div><strong>Daily Traffic Rate:</strong> ${analytics.dailyTrafficRate.toLocaleString()} visits</div>` : ''}
                <div><strong>Variant Config:</strong> ${variantConfig}</div>
            </div>
        `;
        
        // Right column: Projected End dates
        let rightColumn = '';
        if (analytics.projectedEndDate) {
                    const isComplete = checkIfSampleSizeReached(currentExperiment.atp, config, currentExperiment.data);
            const debugMode = isDeveloperModeActive();
            
                    if (isComplete) {
                rightColumn = `<div class="stats-right"><strong>Projected End:<br></strong> <span style="color: #28a745; font-weight: bold;">Complete</span></div>`;
                    } else {
                // Check if experiment has run for >= 5 days
                const hasRunFiveDays = analytics.daysRunning >= 5;
                
                if (debugMode) {
                    // In debug mode, always show projected end dates
                    const colorStyle = hasRunFiveDays ? '' : ' style="color: red;"';
                    const sampleSizeDate = typeof analytics.projectedEndDate === 'string' ? Utils.formatDate(new Date(analytics.projectedEndDate)) : Utils.formatDate(analytics.projectedEndDate);
                    
                    // Calculate days remaining for sample size date
                    const sampleSizeDateObj = typeof analytics.projectedEndDate === 'string' ? new Date(analytics.projectedEndDate) : analytics.projectedEndDate;
                    const sampleSizeDaysRemaining = Math.floor((sampleSizeDateObj - new Date()) / (1000 * 60 * 60 * 24));
                    
                    rightColumn = `<div class="stats-right"${colorStyle}><div><strong>Projected End:<br></strong> <span class="date-tooltip">${sampleSizeDaysRemaining} days<span class="date-tooltip-text">${sampleSizeDate}</span></span> - sample size reached</div>`;
                    
                    if (analytics.projectedEndDateWeekCycle) {
                        const weekCycleDate = typeof analytics.projectedEndDateWeekCycle === 'string' ? Utils.formatDate(new Date(analytics.projectedEndDateWeekCycle)) : Utils.formatDate(analytics.projectedEndDateWeekCycle);
                        
                        // Calculate days remaining for week cycle date
                        const weekCycleDateObj = typeof analytics.projectedEndDateWeekCycle === 'string' ? new Date(analytics.projectedEndDateWeekCycle) : analytics.projectedEndDateWeekCycle;
                        const weekCycleDaysRemaining = Math.floor((weekCycleDateObj - new Date()) / (1000 * 60 * 60 * 24));
                        
                        rightColumn += `<div><span class="date-tooltip">${weekCycleDaysRemaining} days<span class="date-tooltip-text">${weekCycleDate}</span></span> - sample size + full week cycle <span style="color: #28a745; font-style: italic;">(recommended)</span></div>`;
                    }
                    rightColumn += `</div>`;
                } else {
                    // In normal mode, only show projected end dates after 5 days
                    if (hasRunFiveDays) {
                        const sampleSizeDate = typeof analytics.projectedEndDate === 'string' ? Utils.formatDate(new Date(analytics.projectedEndDate)) : Utils.formatDate(analytics.projectedEndDate);
                        
                        // Calculate days remaining for sample size date
                        const sampleSizeDateObj = typeof analytics.projectedEndDate === 'string' ? new Date(analytics.projectedEndDate) : analytics.projectedEndDate;
                        const sampleSizeDaysRemaining = Math.floor((sampleSizeDateObj - new Date()) / (1000 * 60 * 60 * 24));
                        
                        rightColumn = `<div class="stats-right"><div><strong>Projected End:<br></strong> <span class="date-tooltip">${sampleSizeDaysRemaining} days<span class="date-tooltip-text">${sampleSizeDate}</span></span> - sample size reached</div>`;
                        
                        if (analytics.projectedEndDateWeekCycle) {
                            const weekCycleDate = typeof analytics.projectedEndDateWeekCycle === 'string' ? Utils.formatDate(new Date(analytics.projectedEndDateWeekCycle)) : Utils.formatDate(analytics.projectedEndDateWeekCycle);
                            
                            // Calculate days remaining for week cycle date
                            const weekCycleDateObj = typeof analytics.projectedEndDateWeekCycle === 'string' ? new Date(analytics.projectedEndDateWeekCycle) : analytics.projectedEndDateWeekCycle;
                            const weekCycleDaysRemaining = Math.floor((weekCycleDateObj - new Date()) / (1000 * 60 * 60 * 24));
                            
                            rightColumn += `<div><span class="date-tooltip">${weekCycleDaysRemaining} days<span class="date-tooltip-text">${weekCycleDate}</span></span> - sample size + full week cycle <span style="color: #28a745; font-style: italic;">(recommended)</span></div>`;
                        }
                        rightColumn += `</div>`;
                    } else {
                        rightColumn = `<div class="stats-right"><strong>Projected End:<br></strong> ⏳ after 5 days</div>`;
                    }
                }
            }
        }
        
        html += `
            <div class="experiment-stats two-column">
                ${leftColumn}
                ${rightColumn}
            </div>
        `;
    }
    
    // Progress bar
    if (config.sampleSize && (globalVisits || config.sampleSizeMetric)) {
        let currentSampleSize = 0;
        let progressText;
        const storageData = JSONConverter.loadAndConvertData('atpConfigurations');

        if (config.sampleSizeMetric && storageData && storageData.metrics) {
            const sampleSizeMetricName = JSONConverter.getMetricName(config.sampleSizeMetric, storageData.metrics);
            const metricData = data.find(item => item.label === sampleSizeMetricName);
            if (metricData) {
                // Use multi-variant structure: find minimum across all variants
                const variants = [metricData.control];
                if (metricData.variantB !== null && metricData.variantB !== undefined) variants.push(metricData.variantB);
                if (metricData.variantC !== null && metricData.variantC !== undefined) variants.push(metricData.variantC);
                if (metricData.variantD !== null && metricData.variantD !== undefined) variants.push(metricData.variantD);
                currentSampleSize = Math.min(...variants);
                progressText = `${(currentSampleSize / config.sampleSize * 100).toFixed(0)}% of ${sampleSizeMetricName} collected`;
            } else {
                progressText = `Metric '${sampleSizeMetricName}' not found in data.`;
            }
        } else if (globalVisits) {
            // Use multi-variant structure: find minimum across all variants
            const variants = [globalVisits.control];
            if (globalVisits.variantB !== null && globalVisits.variantB !== undefined) variants.push(globalVisits.variantB);
            if (globalVisits.variantC !== null && globalVisits.variantC !== undefined) variants.push(globalVisits.variantC);
            if (globalVisits.variantD !== null && globalVisits.variantD !== undefined) variants.push(globalVisits.variantD);
            currentSampleSize = Math.min(...variants);
            progressText = `${(currentSampleSize / config.sampleSize * 100).toFixed(0)}% of sample size collected`;
        }

        const percentage = Math.min(100, (currentSampleSize / config.sampleSize) * 100);
        const isComplete = percentage >= 100;

        if(isComplete) {
            progressText = 'SAMPLE SIZE REACHED';
        } else {
            progressText += `, ${currentSampleSize.toLocaleString()} out of ${config.sampleSize.toLocaleString()}`;
        }
        
        html += `
            <div class="progress-bar">
                <div class="progress-fill${isComplete ? ' complete' : ''}" style="width: ${percentage}%"></div>
                <div class="progress-markers">
                    <div class="progress-marker" style="left: 25%"></div>
                    <div class="progress-marker" style="left: 50%"></div>
                    <div class="progress-marker" style="left: 75%"></div>
                </div>
                <div class="progress-text">
                    ${progressText}
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

// Generate results table
function generateResultsTable(data, config) {
    // Convert v2 IDs to names for display
    const storageData = JSONConverter.loadAndConvertData('atpConfigurations');
    const primaryMetricName = JSONConverter.getMetricName(config.primary, storageData.metrics);
    const secondaryMetricNames = (config.secondary || []).map(metricId => JSONConverter.getMetricName(metricId, storageData.metrics)).filter(Boolean);
    
    const primaryData = data.filter(item => item.label === primaryMetricName);
    const secondaryData = data.filter(item => secondaryMetricNames.includes(item.label));
    
    let html = '<table>';
    
    if (primaryData.length > 0) {
        html += createTableSection('PRIMARY KPI', primaryData, true);
    }
    
    if (secondaryData.length > 0) {
        html += createTableSection('SECONDARY KPIs', secondaryData, false);
    }
    
    html += '</table>';
    return html;
}

// Create table section with multi-variant support
function createTableSection(title, data, isPrimary) {
    const debugMode = isDeveloperModeActive();
    const isOtherMetrics = title === 'Other Metrics';
    
    // Determine how many variants we have by checking the first data row
    let hasVariantC = false, hasVariantD = false;
    if (data.length > 0) {
        hasVariantC = data[0].variantC !== null && data[0].variantC !== undefined;
        hasVariantD = data[0].variantD !== null && data[0].variantD !== undefined;
    }
    
    // Calculate column count for wide table: Metric + Control + (Variant + % Change + Prob) for each variant
    const columnCount = 2 + // Metric + Control
                       3 + // Variant A + % Change + Prob  
                       (hasVariantC ? 3 : 0) + // Variant B + % Change + Prob
                       (hasVariantD ? 3 : 0); // Variant C + % Change + Prob
    
    let headerHtml = `<tr><th colspan="${columnCount}" class="section">${title}`;
    
    // Add "go fish 🐟" link for Other Metrics in debug mode
    if (debugMode && isOtherMetrics) {
        headerHtml += ` <a href="#" class="go-fish-link" style="color: #007bff; text-decoration: none; margin-left: 10px; font-size: 12px;">go fish 🐟</a>`;
    }
    
    headerHtml += `</th></tr>`;
    
    // Create tooltip for probability thresholds
    const probTooltipText = isPrimary ? 
        'Primary Metric Thresholds:\n0–5%: Red (Unfavourable)\n5–15%: Yellow (Inconclusive)\n85–95%: Yellow (Inconclusive)\n95–100%: Green (Conclusive)' :
        'Secondary Metric Thresholds:\n0–2%: Red (Unfavourable)\n2–10%: Yellow (Inconclusive)\n90–98%: Yellow (Inconclusive)\n98–100%: Green (Conclusive)';
    
    const probHeaderTooltip = `<span class="prob-header-tooltip" data-tooltip="${probTooltipText}">Prob<span class="prob-tooltip-text" style="white-space: pre-line;">${probTooltipText}</span><span class="tooltip-icon">?</span></span>`;
    
    // Create wide table header: Control-A | Variant-B | % Change | Prob | Variant-C | % Change | Prob | etc.
    let tableHeaders = `
        <tr>
            <th>Metric</th>
            <th>Control-A</th>
            <th>Variant-B</th>
            <th>% Change</th>
            <th>${probHeaderTooltip}</th>`;
    
    if (hasVariantC) {
        tableHeaders += `
            <th>Variant-C</th>
            <th>% Change</th>
            <th>${probHeaderTooltip}</th>`;
    }
    if (hasVariantD) {
        tableHeaders += `
            <th>Variant-D</th>
            <th>% Change</th>
            <th>${probHeaderTooltip}</th>`;
    }
    
    tableHeaders += `
        </tr>
    `;
    
    // Setup tooltip positioning for fixed positioning
    setTimeout(() => {
        const tooltips = document.querySelectorAll('.prob-header-tooltip');
        tooltips.forEach(tooltip => {
            tooltip.addEventListener('mouseenter', function() {
                const tooltipText = this.querySelector('.prob-tooltip-text');
                if (tooltipText) {
                    const rect = this.getBoundingClientRect();
                    tooltipText.style.top = (rect.top - tooltipText.offsetHeight - 5) + 'px';
                    tooltipText.style.left = (rect.left + rect.width / 2 - tooltipText.offsetWidth / 2) + 'px';
                }
            });
        });
    }, 100);
    
    let html = headerHtml + tableHeaders;
    
    data.forEach(row => {
        // Calculate percentage changes for each variant vs control
        let changeBText = '–', changeCText = '–', changeDText = '–';
        let changeB = null, changeC = null, changeD = null;
        
        // Calculate Variant B vs Control
        if (!isAlreadyAveragedMetric(row.label) && row.controlVisits > 0 && row.variantBVisits > 0) {
            const controlRate = row.control / row.controlVisits;
            const variantBRate = row.variantB / row.variantBVisits;
            if (controlRate > 0) {
                changeB = ((variantBRate - controlRate) / controlRate) * 100;
            } else if (variantBRate > 0) {
                changeB = Infinity;
            } else {
                changeB = 0;
            }
        } else if (row.variantB !== null) {
            changeB = Utils.calculatePercentageChange(row.control, row.variantB);
        }
        changeBText = changeB !== null ? (changeB === Infinity ? '∞' : changeB.toFixed(2) + '%') : '–';
        
                // Calculate Variant C vs Control (if exists)
        if (hasVariantC && row.variantC !== null) {
            if (!isAlreadyAveragedMetric(row.label) && row.controlVisits > 0 && row.variantCVisits > 0) {
                const controlRate = row.control / row.controlVisits;
                const variantCRate = row.variantC / row.variantCVisits;
                if (controlRate > 0) {
                    changeC = ((variantCRate - controlRate) / controlRate) * 100;
                } else if (variantCRate > 0) {
                    changeC = Infinity;
        } else {
                    changeC = 0;
                }
            } else {
                changeC = Utils.calculatePercentageChange(row.control, row.variantC);
            }
            changeCText = changeC !== null ? (changeC === Infinity ? '∞' : changeC.toFixed(2) + '%') : '–';
        }
        
        // Calculate Variant D vs Control (if exists)
        if (hasVariantD && row.variantD !== null) {
            if (!isAlreadyAveragedMetric(row.label) && row.controlVisits > 0 && row.variantDVisits > 0) {
                const controlRate = row.control / row.controlVisits;
                const variantDRate = row.variantD / row.variantDVisits;
                if (controlRate > 0) {
                    changeD = ((variantDRate - controlRate) / controlRate) * 100;
                } else if (variantDRate > 0) {
                    changeD = Infinity;
                } else {
                    changeD = 0;
                }
            } else {
                changeD = Utils.calculatePercentageChange(row.control, row.variantD);
            }
            changeDText = changeD !== null ? (changeD === Infinity ? '∞' : changeD.toFixed(2) + '%') : '–';
        }
        
        // For now, show the best performing variant's change in the % Change column
        const changes = [changeB, changeC, changeD].filter(c => c !== null);
        const bestChange = changes.length > 0 ? Math.max(...changes) : changeB;
        const changeText = bestChange !== null ? (bestChange === Infinity ? '∞' : bestChange.toFixed(2) + '%') : '–';
        
        // Bayesian probability - for now, show Variant B's probability (we'll update this later)
        let bayesianText = '–';
        let bayesianStyle = '';
        let isDirectional = false;
        
        // Check if ANY variant would be considered directional for "go fish" functionality
        // This includes both Bayesian-based directional and potentially high percentage changes
        if (row.hasBayesianData && row.bayesianProbabilities) {
            // Show all Bayesian probabilities
            const probabilities = [];
            let bestProbability = 0;
            let hasSignificantVariant = false;
            
            if (row.bayesianProbabilities.variantB !== undefined) {
                const prob = row.bayesianProbabilities.variantB;
                probabilities.push(`B: ${(prob * 100).toFixed(1)}%`);
                if (prob > bestProbability) bestProbability = prob;
                if (Bayesian.getBayesianCellColor(prob, isPrimary)) hasSignificantVariant = true;
            }
            
            if (row.bayesianProbabilities.variantC !== undefined) {
                const prob = row.bayesianProbabilities.variantC;
                probabilities.push(`C: ${(prob * 100).toFixed(1)}%`);
                if (prob > bestProbability) bestProbability = prob;
                if (Bayesian.getBayesianCellColor(prob, isPrimary)) hasSignificantVariant = true;
            }
            
            if (row.bayesianProbabilities.variantD !== undefined) {
                const prob = row.bayesianProbabilities.variantD;
                probabilities.push(`D: ${(prob * 100).toFixed(1)}%`);
                if (prob > bestProbability) bestProbability = prob;
                if (Bayesian.getBayesianCellColor(prob, isPrimary)) hasSignificantVariant = true;
            }
            
            bayesianText = probabilities.join(' | ');
            
            // Style based on the best probability
            const bgColor = Bayesian.getBayesianCellColor(bestProbability, isPrimary);
            if (bgColor && hasSignificantVariant) {
                bayesianStyle = `style="background-color: ${bgColor}; color: white; font-weight: bold;"`;
                isDirectional = true;
            }
        } else if (row.hasBayesianData && row.bayesianProbability !== null) {
            // Backward compatibility for single variant
            bayesianText = (row.bayesianProbability * 100).toFixed(1) + '%';
            const bgColor = Bayesian.getBayesianCellColor(row.bayesianProbability, isPrimary);
            if (bgColor) {
                bayesianStyle = `style="background-color: ${bgColor}; color: white; font-weight: bold;"`;
                isDirectional = true;
            }
        }
        
        // Also consider a metric directional if any variant has a significant change (>10% or <-10%)
        // This helps with "go fish" when Bayesian data isn't available
        if (!isDirectional) {
            const significantChanges = [changeB, changeC, changeD].filter(change => 
                change !== null && (Math.abs(change) >= 10)
            );
            if (significantChanges.length > 0) {
                isDirectional = true;
            }
        }
        
        // Use smart formatting for consistent decimal places across all variants
        const formattedValues = Utils.formatMetricRow(
            row.control, 
            row.variantB, 
            hasVariantC ? row.variantC : null, 
            hasVariantD ? row.variantD : null
        );
        
        // Create tooltips with smart formatted values
        const controlTooltip = Utils.createTooltip(
            formattedValues.control,
            row.controlVisits ? `${row.controlVisits.toLocaleString()} visits` : 'Visit count not available'
        );
        
        const variantBTooltip = Utils.createTooltip(
            formattedValues.variantB,
            row.variantBVisits ? `${row.variantBVisits.toLocaleString()} visits` : 'Visit count not available'
        );
        
        let variantCTooltip = '', variantDTooltip = '';
        if (hasVariantC) {
            variantCTooltip = Utils.createTooltip(
                formattedValues.variantC,
                row.variantCVisits ? `${row.variantCVisits.toLocaleString()} visits` : 'Visit count not available'
            );
        }
        if (hasVariantD) {
            variantDTooltip = Utils.createTooltip(
                formattedValues.variantD,
                row.variantDVisits ? `${row.variantDVisits.toLocaleString()} visits` : 'Visit count not available'
            );
        }
        
        // Build wide table row: Control | VariantA | % Change | Prob | VariantB | % Change | Prob | etc.
        let rowHtml = `
            <tr class="metric-row" data-directional="${isDirectional}">
                <td>${row.label}</td>
                <td>${controlTooltip}</td>
                <td>${variantBTooltip}</td>
                <td>${changeBText}</td>`;
        
        // Get individual Bayesian probabilities for the wide format
        let bayesianBText = '–', bayesianCText = '–', bayesianDText = '–';
        let bayesianBStyle = '', bayesianCStyle = '', bayesianDStyle = '';
        
        if (row.hasBayesianData && row.bayesianProbabilities) {
            if (row.bayesianProbabilities.variantB !== undefined) {
                const prob = row.bayesianProbabilities.variantB;
                bayesianBText = `${(prob * 100).toFixed(1)}%`;
                const bgColor = Bayesian.getBayesianCellColor(prob, isPrimary);
                if (bgColor) {
                    bayesianBStyle = `style="background-color: ${bgColor}; color: white; font-weight: bold;"`;
                }
            }
            if (row.bayesianProbabilities.variantC !== undefined) {
                const prob = row.bayesianProbabilities.variantC;
                bayesianCText = `${(prob * 100).toFixed(1)}%`;
                const bgColor = Bayesian.getBayesianCellColor(prob, isPrimary);
                if (bgColor) {
                    bayesianCStyle = `style="background-color: ${bgColor}; color: white; font-weight: bold;"`;
                }
            }
            if (row.bayesianProbabilities.variantD !== undefined) {
                const prob = row.bayesianProbabilities.variantD;
                bayesianDText = `${(prob * 100).toFixed(1)}%`;
                const bgColor = Bayesian.getBayesianCellColor(prob, isPrimary);
                if (bgColor) {
                    bayesianDStyle = `style="background-color: ${bgColor}; color: white; font-weight: bold;"`;
                }
            }
        } else if (row.hasBayesianData && row.bayesianProbability !== null) {
            // Backward compatibility for single variant - assume it's variantB
            bayesianBText = (row.bayesianProbability * 100).toFixed(1) + '%';
            const bgColor = Bayesian.getBayesianCellColor(row.bayesianProbability, isPrimary);
            if (bgColor) {
                bayesianBStyle = `style="background-color: ${bgColor}; color: white; font-weight: bold;"`;
            }
        }
        
        rowHtml += `<td ${bayesianBStyle}>${bayesianBText}</td>`;
        
        if (hasVariantC) {
            rowHtml += `
                <td>${variantCTooltip}</td>
                <td>${changeCText}</td>
                <td ${bayesianCStyle}>${bayesianCText}</td>`;
        }
        if (hasVariantD) {
            rowHtml += `
                <td>${variantDTooltip}</td>
                <td>${changeDText}</td>
                <td ${bayesianDStyle}>${bayesianDText}</td>`;
        }
        
        rowHtml += `
            </tr>
        `;
        
        html += rowHtml;
    });
    
    return html;
}

// Get most commonly selected metrics from saved configurations
function getMostCommonlySelectedMetrics() {
    const data = JSONConverter.loadAndConvertData('atpConfigurations');
    if (!data || !data.experiments) {
        return [];
    }
    
    // Count minimum 2 configs requirement
    const configCount = Object.keys(data.experiments).length;
    if (configCount < 2) {
        return [];
    }
    
    // Count metric selections across all saved configs
    const metricCounts = {};
    
    Object.values(data.experiments).forEach(config => {
        if (config.primary) {
            const metricName = JSONConverter.getMetricName(config.primary, data.metrics);
            if (metricName) {
                metricCounts[metricName] = (metricCounts[metricName] || 0) + 1;
            }
        }
        
        if (config.secondary && Array.isArray(config.secondary)) {
            config.secondary.forEach(metricId => {
                const metricName = JSONConverter.getMetricName(metricId, data.metrics);
                if (metricName) {
                    metricCounts[metricName] = (metricCounts[metricName] || 0) + 1;
                }
            });
        }
    });
    
    // Sort by count (descending) then alphabetically
    const sortedMetrics = Object.entries(metricCounts)
        .sort(([a, countA], [b, countB]) => {
            if (countB !== countA) {
                return countB - countA; // Higher count first
            }
            return a.localeCompare(b); // Alphabetical for ties
        })
        .map(([metricName, count]) => ({ name: metricName, count }));
    
    // Aim for 5, but include ties that would take us above 5
    if (sortedMetrics.length === 0) {
        return [];
    }
    
    const targetCount = 5;
    const targetMetric = sortedMetrics[targetCount - 1]; // 5th metric (0-indexed)
    
    if (!targetMetric) {
        // Less than 5 metrics total, return all
        return sortedMetrics.map(m => m.name);
    }
    
    // Find all metrics with the same count as the 5th metric
    const tieCount = targetMetric.count;
    const result = [];
    
    for (const metric of sortedMetrics) {
        if (metric.count > tieCount || (metric.count === tieCount && result.length < 8)) {
            result.push(metric.name);
        } else {
            break;
        }
    }
    
    return result;
}

// Auto-populate secondary metrics when a popular primary metric is selected
function autoPopulateSecondaryMetrics(metrics) {
    // Get the currently selected primary metric
    const primaryTypeahead = window.primaryTypeahead;
    if (!primaryTypeahead) return;
    
    const selectedPrimary = primaryTypeahead.getValue().trim();
    if (!selectedPrimary) return;
    
    // Check if there are already any secondary metrics selected
    const secondaryContainer = document.getElementById('secondaryKPIs');
    if (!secondaryContainer) return;
    
    const existingSecondaryItems = secondaryContainer.querySelectorAll('.secondary-kpi-item');
    let hasExistingSecondary = false;
    
    // Check if any secondary metric has a value
    existingSecondaryItems.forEach(item => {
        if (item.typeahead && item.typeahead.getValue().trim()) {
            hasExistingSecondary = true;
        }
    });
    
    // If user already has secondary metrics, don't auto-populate
    if (hasExistingSecondary) {
        return;
    }
    
    // Get the most popular metrics
    const mostPopular = getMostCommonlySelectedMetrics();
    
    // Check if the selected primary is in the most popular list
    if (!mostPopular.includes(selectedPrimary)) {
        return;
    }
    
    // Get the remaining popular metrics (excluding the selected primary)
    const remainingPopular = mostPopular.filter(metric => metric !== selectedPrimary);
    
    // Clear existing empty secondary slots
    secondaryContainer.innerHTML = '';
    
    // Add the remaining popular metrics as secondary metrics
    remainingPopular.forEach(metric => {
        addSecondaryKPI(secondaryContainer, metrics, metric);
    });
    
    // Ensure there's always at least one empty slot at the end
    ensureEmptySecondarySlot(secondaryContainer, metrics);
    
    // Update Bayesian options to include the newly populated secondary metrics
    setTimeout(() => {
        updateBayesianOptions();
    }, 100);
}

// Generate shareable link for individual experiment
function generateIndividualExperimentLink(atp, config) {
    try {
        // Get the full data for this experiment
        const storageData = JSONConverter.loadAndConvertData('atpConfigurations');
        if (!storageData || !storageData.experiments || !storageData.experiments[atp]) {
            Utils.showError('Experiment data not found.');
            return null;
        }
        
        // Create subset with only this experiment
        const subsetData = JSONConverter.createSubset(storageData, [atp]);
        
        // Minify the JSON
        const minifiedJson = JSON.stringify(subsetData);
        
        // Use URL-safe base64 encoding
        const base64 = btoa(unescape(encodeURIComponent(minifiedJson)));
        const encodedJson = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        
        // Create shareable URL
        const currentUrl = window.location.origin + window.location.pathname;
        const shareableUrl = `${currentUrl}?import=${encodedJson}`;
        
        return shareableUrl;
        
    } catch (error) {
        Utils.showError('Error generating shareable link: ' + error.message);
        return null;
    }
}

// Share link function (matching image share pattern)
function shareLink() {
    const shareableUrl = generateIndividualExperimentLink(currentExperiment.atp, currentExperiment.config);
    if (!shareableUrl) {
        return;
    }
    
    // Create overlay (same pattern as shareResults)
    const overlay = document.createElement('div');
    overlay.className = 'share-overlay';
    overlay.innerHTML = `
        <div class="share-dialog">
            <h3>Generating shareable link...</h3>
            <p>Please wait while we prepare your link.</p>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Try to copy to clipboard (same pattern as shareResults)
    navigator.clipboard.writeText(shareableUrl).then(() => {
        overlay.innerHTML = `
            <div class="share-dialog">
                <h3>✅ Success!</h3>
                <p>Shareable link has been copied to your clipboard.</p>
            </div>
        `;
        setTimeout(() => document.body.removeChild(overlay), 2000);
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareableUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        overlay.innerHTML = `
            <div class="share-dialog">
                <h3>✅ Success!</h3>
                <p>Shareable link has been copied to your clipboard.</p>
            </div>
        `;
        setTimeout(() => document.body.removeChild(overlay), 2000);
    });
}

// Generate actions bar
function generateActionsBar(data, config) {
    // Convert v2 IDs to names for filtering
    const storageData = JSONConverter.loadAndConvertData('atpConfigurations');
    const primaryMetricName = JSONConverter.getMetricName(config.primary, storageData.metrics);
    const secondaryMetricNames = (config.secondary || []).map(metricId => JSONConverter.getMetricName(metricId, storageData.metrics)).filter(Boolean);
    
    const everythingElse = data.filter(item => 
        item.label !== primaryMetricName && !secondaryMetricNames.includes(item.label)
    );
    
    return `
        <div class="actions-bar">
            <div class="left">
                ${everythingElse.length > 0 ? `<button id="toggleExtra" class="btn">Show Everything Else (${everythingElse.length} metrics)</button>` : ''}
            </div>
            <div class="right">
                <button id="shareLinkBtn" class="btn">🔗 Share Link</button>
                <button id="shareImageBtn" class="btn">📷 Share Image</button>
                <button id="settingsBtn" class="btn">⚙️ Settings</button>
            </div>
        </div>
    `;
}

// Generate extra metrics
function generateExtraMetrics(data, config) {

    let html = `
    <div class="extra-metrics-control">
        <label for="includeExtraMetricsInShare">
            <input type="checkbox" id="includeExtraMetricsInShare">
            Include in shareable image
        </label>
    </div>`;

    const everythingElse = data.filter(item => 
        item.label !== config.primary && !config.secondary.includes(item.label)
    );
    
    if (everythingElse.length === 0) return '';
    
    // Group by section
    const sections = {};
    everythingElse.forEach(item => {
        const section = item.section || 'Other Metrics';
        if (!sections[section]) sections[section] = [];
        sections[section].push(item);
    });
    
    html += '<table>';
    Object.entries(sections).forEach(([sectionName, sectionData]) => {
        html += createTableSection(sectionName, sectionData, false);
    });
    html += '</table>';
    
    return html;
}

// Setup results event listeners
function setupResultsEventListeners(data, config) {
    // Toggle extra metrics
    const toggleBtn = document.getElementById('toggleExtra');
    if (toggleBtn) {
        const extraMetrics = document.getElementById('extraMetrics');
        const everythingElse = data.filter(item => 
            item.label !== config.primary && !config.secondary.includes(item.label)
        );
        
        toggleBtn.addEventListener('click', () => {
            const isHidden = extraMetrics.classList.contains('hidden');
            extraMetrics.classList.toggle('hidden');
            toggleBtn.textContent = isHidden ? 'Hide Everything Else' : `Show Everything Else (${everythingElse.length} metrics)`;
        });
    }
    
    // Share link
    const shareLinkBtn = document.getElementById('shareLinkBtn');
    if (shareLinkBtn) {
        shareLinkBtn.addEventListener('click', () => shareLink());
    }
    
    // Share image
    const shareImageBtn = document.getElementById('shareImageBtn');
    if (shareImageBtn) {
        shareImageBtn.addEventListener('click', () => shareResults());
    }
    
    // Settings
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            // Use only the metrics from the current experiment's data, not all stored metrics
            const currentExperimentMetrics = data.map(item => item.label);
            showConfigurationScreen(currentExperiment.atp, currentExperimentMetrics, null);
        });
    }
    
    // go fish 🐟 filtering for Other Metrics in debug mode
    const goFishLinks = document.querySelectorAll('.go-fish-link');
    goFishLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const table = link.closest('table');
            const rows = table.querySelectorAll('.metric-row');
            const isFiltered = link.textContent === 'done fishing';
            
            if (isFiltered) {
                // Show all rows
                rows.forEach(row => {
                    row.style.display = '';
                });
                link.textContent = 'go fish 🐟';
            } else {
                // Show only directional rows
                rows.forEach(row => {
                    const isDirectional = row.getAttribute('data-directional') === 'true';
                    row.style.display = isDirectional ? '' : 'none';
                });
                link.textContent = 'done fishing';
            }
        });
    });
    

}

// Share results function
function shareResults() {
    const resultsElement = document.getElementById('resultsSection');
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'share-overlay';
    overlay.innerHTML = `
        <div class="share-dialog">
            <h3>Generating shareable image...</h3>
            <p>Please wait while we capture your results.</p>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Create clean version for sharing
    const cleanResults = resultsElement.cloneNode(true);
    cleanResults.querySelectorAll('.actions-bar').forEach(bar => bar.remove());
    
    // Check if extra metrics should be included in the shareable image
    const includeExtraMetrics = document.getElementById('includeExtraMetricsInShare').checked;
    if (!includeExtraMetrics) {
        cleanResults.querySelectorAll('#extraMetrics').forEach(elem => elem.remove());
    }
    cleanResults.querySelectorAll('.extra-metrics-control').forEach(bar => bar.remove());
    
    // Create temporary container
    const tempContainer = document.createElement('div');
   
    tempContainer.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        background: #EEE;
        padding: 20px;
        width: 820px;
        font-family: Arial, sans-serif;
    `;
    
    tempContainer.appendChild(cleanResults);
    document.body.appendChild(tempContainer);
    
    // Generate image
    html2canvas(tempContainer, {
        backgroundColor: '#EEE',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: 840,
        height: tempContainer.scrollHeight
    }).then(canvas => {
        document.body.removeChild(tempContainer);
        
        // Try to copy to clipboard
        canvas.toBlob(blob => {
            if (navigator.clipboard && window.ClipboardItem) {
                navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                    .then(() => {
                        overlay.innerHTML = `
                            <div class="share-dialog">
                                <h3>✅ Success!</h3>
                                <p>Results image has been copied to your clipboard.</p>
                            </div>
                        `;
                        setTimeout(() => document.body.removeChild(overlay), 2000);
                    })
                    .catch(() => showDownloadDialog(overlay, canvas));
            } else {
                showDownloadDialog(overlay, canvas);
            }
        });
    }).catch(error => {
        console.error('Error generating image:', error);
        //document.body.removeChild(tempContainer);
        overlay.innerHTML = `
            <div class="share-dialog">
                <h3>❌ Error</h3>
                <p>Failed to generate image. Please try again.</p>
                <button class="btn" onclick="this.closest('.share-overlay').remove()">Close</button>
            </div>
        `;
        setTimeout(() => document.body.removeChild(overlay), 3000);
    });
}

// Show download dialog
function showDownloadDialog(overlay, canvas) {
    overlay.innerHTML = `
        <div class="share-dialog">
            <h3>Share Results</h3>
            <p>Click below to download the results as an image.</p>
            <div class="share-actions">
                <button id="downloadImage" class="btn">Download Image</button>
                <button id="closeShare" class="btn">Close</button>
            </div>
        </div>
    `;
    
    document.getElementById('downloadImage').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `ATP_${currentExperiment.atp}_results_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL();
        link.click();
        document.body.removeChild(overlay);
    });
    
    document.getElementById('closeShare').addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
}

// Load saved experiment data and display it
function loadSavedExperiment(atp) {
    console.log("Function loadSavedExperiments is firing now");
    const data = JSONConverter.loadAndConvertData('atpConfigurations');
    const config = data?.experiments?.[atp];
    
    if (!config) {
        Utils.showError('No configuration found for ' + atp);
        return;
    }
    
    if (config.needsConfig) {
        // Set current experiment ATP for configuration screen
        currentExperiment.atp = atp;
        // Show configuration screen for experiments that need setup
        const metrics = Object.values(data.metrics || {});
        showConfigurationScreen(atp, metrics, config.csvDateInfo);
        return;
    }
    
    if (!config.metrics || Object.keys(config.metrics).length === 0) {
        Utils.showError('No metrics data found for ' + atp + '. Please upload the CSV file to load data.');
        return;
    }
    
    // Convert stored v2 metrics back to data array format with multi-variant support
    const dataArray = Object.entries(config.metrics).map(([metricId, metricData]) => {
        const metricName = JSONConverter.getMetricName(parseInt(metricId), data.metrics);
        
        // Backward compatibility: convert old visit format to new format
        let controlVisits, variantBVisits, variantCVisits, variantDVisits;
        
        if (metricData.aVisits !== undefined) {
            // New format
            controlVisits = metricData.aVisits;
            variantBVisits = metricData.bVisits;
            variantCVisits = metricData.cVisits;
            variantDVisits = metricData.dVisits;
        } else {
            // Old format - convert on-the-fly
            controlVisits = metricData.cVisits !== undefined ? metricData.cVisits : (config.globalVisits ? config.globalVisits.control : null);
            variantBVisits = metricData.vVisits !== undefined ? metricData.vVisits : 
                            metricData.vBVisits !== undefined ? metricData.vBVisits : 
                            (config.globalVisits ? (config.globalVisits.variantB || config.globalVisits.variant) : null);
            variantCVisits = metricData.vCVisits !== undefined ? metricData.vCVisits : 
                            (config.globalVisits ? config.globalVisits.variantC : null);
            variantDVisits = metricData.vDVisits !== undefined ? metricData.vDVisits : 
                            (config.globalVisits ? config.globalVisits.variantD : null);
        }
        
        return {
            label: metricName,
            section: null, // We don't store section info in the old format
            control: metricData.valA,
            variant: metricData.valB, // Keep for backward compatibility
            variantB: metricData.valB,
            variantC: metricData.valC,
            variantD: metricData.valD,
            controlVisits: controlVisits,
            variantVisits: variantBVisits, // Keep for backward compatibility
            variantBVisits: variantBVisits,
            variantCVisits: variantCVisits,
            variantDVisits: variantDVisits,
            hasBayesianData: metricData.hasBayesianData || false,
            bayesianProbability: metricData.bayesianProbability || null
        };
    });
    
    // Keep config in v2 format for display compatibility
    const v2Config = {
        name: config.name,
        primary: config.primary,  // Keep as numeric ID
        secondary: config.secondary || [],  // Keep as numeric IDs
        bayesian: config.bayesian || [],  // Keep as numeric IDs
        sampleSize: config.sampleSize,
        sampleSizeMetric: config.sampleSizeMetric,
        startDate: config.startDate,
        needsConfig: config.needsConfig,
        timestamp: config.timestamp,
        globalVisits: config.globalVisits,
        csvDateInfo: config.csvDateInfo,
        analytics: config.analytics,
        businessImpact: config.businessImpact,
        isPrimaryValidated: config.isPrimaryValidated,
        lastCalculated: config.lastCalculated,
        hasSampleRatioMismatch: config.hasSampleRatioMismatch || false,
        srmVariants: config.srmVariants || [],
        srmAnalysisResults: config.srmAnalysisResults || []
    };
    
    // Set current experiment
    currentExperiment.atp = atp;
    currentExperiment.data = dataArray;
    currentExperiment.config = v2Config;
    currentExperiment.globalVisits = config.globalVisits;
    // Generate full metrics list from stored data
    currentExperiment.metrics = Object.values(data.metrics || {});
    
    // Display results
    processAndDisplayResults();
    loadSavedExperiments(); // Refresh sidebar to show active state
}

// Load saved experiments
function loadSavedExperiments() {
    const data = JSONConverter.loadAndConvertData('atpConfigurations');
    const experimentsList = document.getElementById('experimentsList');
    
    if (!data || Object.keys(data.experiments || {}).length === 0) {
        experimentsList.innerHTML = '<p>No saved experiments</p>';
        return;
    }
    
    const configs = data.experiments;
    
    let html = '';
    const sortBy = document.getElementById('sortExperiments').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const searchTerm = document.getElementById('experimentSearch').value.toLowerCase();
    const debugMode = isDeveloperModeActive();
    
    // Filter experiments based on status and search
    let filteredExperiments = Object.entries(configs).filter(([atp, config]) => {
        const status = getExperimentStatus(config, atp, data);
        const name = (config.name || 'ATP ' + atp).toLowerCase();
        const atpLower = atp.toLowerCase();
        
        // Apply status filter
        if (statusFilter !== 'all' && status !== statusFilter) {
            return false;
        }
        
        // Apply search filter
        if (searchTerm && !name.includes(searchTerm) && !atpLower.includes(searchTerm)) {
            return false;
        }
        
        return true;
    });
    
    // Sort experiments based on selected option
    const sortedExperiments = filteredExperiments.sort(([atpA, a], [atpB, b]) => {
        switch(sortBy) {
            case 'recently-updated':
                const timestampA = a.timestamp || 0;
                const timestampB = b.timestamp || 0;
                return timestampB - timestampA; // Descending order (newest first)
            
            case 'ending-soon':
                // Only sort by end date if experiments are still active (not completed/stale)
                const statusA = getExperimentStatus(a, atpA, data);
                const statusB = getExperimentStatus(b, atpB, data);
                
                // If one is active and the other isn't, active comes first
                if (statusA === 'active' && statusB !== 'active') return -1;
                if (statusB === 'active' && statusA !== 'active') return 1;
                
                // If both are active, sort by end date
                if (statusA === 'active' && statusB === 'active') {
                    const endDateA = getProjectedEndDate(a);
                    const endDateB = getProjectedEndDate(b);
                    if (endDateA === null && endDateB === null) return 0;
                    if (endDateA === null) return 1;
                    if (endDateB === null) return -1;
                    return endDateA - endDateB; // Ascending order (ending soonest first)
                }
                
                // For non-active experiments, sort by last updated (newest first)
                return (b.timestamp || 0) - (a.timestamp || 0);
            
            case 'business-impact':
                if (!debugMode) return 0; // Only show in debug mode
                const impactA = getBusinessImpact(a);
                const impactB = getBusinessImpact(b);
                return impactB - impactA; // Descending order (highest impact first)
            
            default:
                return 0;
        }
    });
    
    sortedExperiments.forEach(([atp, config]) => {
        const isActive = atp === currentExperiment.atp;
        const needsConfig = config.needsConfig || false;
        const lastUpdated = config.timestamp ? getTimeAgo(config.timestamp) : 'Unknown';
        const isValidated = checkIfExperimentValidated(config);
        const isSampleSizeReached = checkIfSampleSizeReached(atp, config, data);
        const primaryMetricName = config.primary ? JSONConverter.getMetricName(config.primary, data.metrics) || `Metric ID: ${config.primary}` : 'Not set';
        const status = getExperimentStatus(config, atp, data);
        const statusIcon = getStatusIcon(status);
        const statusName = getStatusDisplayName(status);
        const daysRunning = Math.floor((new Date() - new Date(config.startDate)) / (1000 * 60 * 60 * 24));

        html += `
            <div class="experiment-item ${isActive ? 'active' : ''} ${needsConfig ? 'needs-config' : ''} status-${status}" data-atp="${atp}">
                <h4>${config.name || 'ATP ' + atp}</h4>
                ${needsConfig ? '<p style="color: #856404;">⚠️ Needs Configuration</p>' : ''}
                ${config.hasSampleRatioMismatch ? '<p style="color: #dc3545; font-weight: bold;">🚨 Sample Ratio Mismatch</p>' : ''}

                <p>Primary: <span style="color: #000;">${primaryMetricName.length > 25 ? primaryMetricName.substring(0, 25) + '...' : primaryMetricName}</span></p>
                ${config.startDate ? `<p>Started: <span style="color: #000;">${Utils.formatDate(config.startDate)}</span></p>` : ''}
                ${config.analytics?.projectedEndDate ? (() => {
                    const isComplete = checkIfSampleSizeReached(atp, config, data);
                    const debugMode = isDeveloperModeActive();
                    
                    if (isComplete) {
                        return `<p>Projected End: <span style="color: #28a745; font-weight: bold;">Complete</span></p>`;
                    } else {
                        // Check if experiment has run for >= 5 days
                        const hasRunFiveDays = daysRunning >= 5;
                        
                        if (debugMode) {
                            // In debug mode, always show projected end date
                            const colorStyle = hasRunFiveDays ? '' : ' style="color: red;"';
                            const sampleSizeDays = Math.floor((new Date(config.analytics.projectedEndDate) - new Date()) / (1000 * 60 * 60 * 24));
                            const sampleSizeDate = Utils.formatDate(config.analytics.projectedEndDate);
                            
                            if (config.analytics.projectedEndDateWeekCycle) {
                                const weekCycleDays = Math.floor((new Date(config.analytics.projectedEndDateWeekCycle) - new Date()) / (1000 * 60 * 60 * 24));
                                const weekCycleDate = Utils.formatDate(config.analytics.projectedEndDateWeekCycle);
                                const tooltipText = `Sample size: ${sampleSizeDate} | Full week: ${weekCycleDate}`;
                                return `<p${colorStyle}>Projected End: <span style="color: #000;" class="date-tooltip">${sampleSizeDays} / ${weekCycleDays} days<span class="date-tooltip-text">${tooltipText}</span></span></p>`;
                            } else {
                                return `<p${colorStyle}>Projected End: <span style="color: #000;" class="date-tooltip">${sampleSizeDays} days<span class="date-tooltip-text">Sample size: ${sampleSizeDate}</span></span></p>`;
                            }
                        } else {
                            // In normal mode, only show projected end date after 5 days
                            if (hasRunFiveDays) {
                                const sampleSizeDays = Math.floor((new Date(config.analytics.projectedEndDate) - new Date()) / (1000 * 60 * 60 * 24));
                                const sampleSizeDate = Utils.formatDate(config.analytics.projectedEndDate);
                                
                                if (config.analytics.projectedEndDateWeekCycle) {
                                    const weekCycleDays = Math.floor((new Date(config.analytics.projectedEndDateWeekCycle) - new Date()) / (1000 * 60 * 60 * 24));
                                    const weekCycleDate = Utils.formatDate(config.analytics.projectedEndDateWeekCycle);
                                    const tooltipText = `Sample size: ${sampleSizeDate} | Full week: ${weekCycleDate}`;
                                    return `<p>Projected End: <span style="color: #000;" class="date-tooltip">${sampleSizeDays} / ${weekCycleDays} days<span class="date-tooltip-text">${tooltipText}</span></span></p>`;
                                } else {
                                    return `<p>Projected End: <span style="color: #000;" class="date-tooltip">${sampleSizeDays} days<span class="date-tooltip-text">Sample size: ${sampleSizeDate}</span></span></p>`;
                                }
                            } else {
                                return `<p>Projected End: <span style="color: #000;">⏳ after 5 days</span></p>`;
                            }
                        }
                    }
                })() : ''}
                ${daysRunning > 6 && isValidated ? (() => {
                    const impact = config.businessImpact || 0;
                    const bestVariant = config.bestVariant;
                    
                    // Check if this is a multi-variant test
                    const hasMultipleVariants = config.globalVisits && (config.globalVisits.variantC !== undefined || config.globalVisits.variantD !== undefined);
                    
                    let valueText = `€${impact.toLocaleString()}`;
                    
                    // Only show variant label for multi-variant tests
                    if (hasMultipleVariants && bestVariant) {
                        // Convert to shortened format: Variant-B -> (v-B)
                        const shortVariant = bestVariant.replace('Variant-', 'v-');
                        valueText += ` (${shortVariant})`;
                    }
                    
                    return `<p>Business Impact: <span style="color: #000;">${valueText}</span></p>`;
                })() : ''}
                ${debugMode ? (() => {
                    const impact = config.businessImpact || 0;
                    const bestVariant = config.bestVariant;
                    const displayText = bestVariant && bestVariant !== 'Variant B' ? 
                        `Business Impact: €${impact.toLocaleString()} (${bestVariant})` : 
                        `Business Impact: €${impact.toLocaleString()}`;
                    return `<p style="color: red; font-size: 11px;">${displayText}</p>`;
                })() : ''}
                ${debugMode ? (() => {
                    const data = JSONConverter.loadAndConvertData('atpConfigurations');
                    if (data && data.experiments && data.experiments[atp] && data.experiments[atp].globalVisits) {
                        const globalVisits = data.experiments[atp].globalVisits;
                        if (globalVisits.control && globalVisits.variant) {
                            const srmAnalysis = SRM.analyzeSampleRatio(globalVisits.control, globalVisits.variant);
                            return `<p style="color: #dc3545; font-size: 11px;">SRM p-value: ${srmAnalysis.pValue.toFixed(4)}</p>`;
                        }
                    }
                    return '';
                })() : ''}
                <div class="icon-container">
                    ${isSampleSizeReached ? '<span title="Sample size reached">✅</span>' : ''}
                    ${isValidated ? '<span title="Primary metric is validated">🚀</span>' : ''}
                    ${config.hasSampleRatioMismatch ? '<span title="Sample ratio mismatch detected" style="color: #dc3545;">🚨</span>' : ''}
                    
                </div>
                <p class="last-updated">Last updated ${lastUpdated}</p>
            </div>
        `;
    });
    
    experimentsList.innerHTML = html;
    
    // Add click handlers
    experimentsList.querySelectorAll('.experiment-item').forEach(item => {
        item.addEventListener('click', () => {
            const atp = item.dataset.atp;
            loadSavedExperiment(atp);
        });
    });
}

// Helper functions for sorting
function getProjectedEndDate(config) {
    // Only use stored analytics data - no fallback calculations
    if (!config.analytics || !config.analytics.projectedEndDate) return null;
    
    const endDate = config.analytics.projectedEndDate;
    
    // Skip text responses like "Need 5 days data to estimate end date"
    if (typeof endDate === 'string' && endDate.includes('Need')) return null;
    
    // Convert to Date object for comparison
    try {
        return new Date(endDate);
    } catch (e) {
        return null;
    }
}

function getBusinessImpact(config) {
    // Only use stored business impact - no fallback calculations
    return config.businessImpact || 0;
}

// New status calculation functions
function getExperimentStatus(config, atp, data) {
    const now = new Date();
    const lastUpdated = config.timestamp ? new Date(config.timestamp) : null;
    const daysSinceUpdate = lastUpdated ? Math.floor((now - lastUpdated) / (1000 * 60 * 60 * 24)) : 999;
    
    // Check if experiment is completed (reached sample size) - use dynamic check
    const isCompleted = checkIfSampleSizeReached(atp, config, data);
    
    // Determine status
    if (daysSinceUpdate <= 5) {
        return 'active';
    } else if (isCompleted) {
        return 'completed';
    } else {
        return 'stale';
    }
}

function getStatusDisplayName(status) {
    switch (status) {
        case 'active': return 'Active';
        case 'completed': return 'Completed';
        case 'stale': return 'Stale';
        default: return 'Unknown';
    }
}

function getStatusColor(status) {
    switch (status) {
        case 'active': return '#28a745'; // Green
        case 'completed': return '#ffc107'; // Yellow
        case 'stale': return '#6c757d'; // Gray
        default: return '#dc3545'; // Red for unknown/error
    }
}

function getStatusIcon(status) {
    switch (status) {
        case 'active': return '🟢';
        case 'completed': return '🟡';
        case 'stale': return '⚫';
        default: return '🔴';
    }
}

function checkIfExperimentValidated(config) {
    // Only use stored validation status - no fallback calculations
    return config.isPrimaryValidated || false;
}

function checkIfSampleSizeReached(atp, config, data) {
    console.log("AGAIN Checking sample size is reached for atp" + atp);
    console.log(config.sampleSizeMetric);
    if (!config || !config.sampleSize) {
        return false;
    }

    let currentSampleSize = 0;
    
    // Handle metric-based sample size
    if (config.sampleSizeMetric) {
        // Check if data is in storage format (has experiments and metrics)
        if (data && data.metrics && data.experiments) {
        const experimentData = data.experiments[atp];
            if(experimentData && experimentData.metrics[config.sampleSizeMetric]) {
                console.log("REACHED HERE");
                const metric = experimentData.metrics[config.sampleSizeMetric];
                // Use multi-variant structure: find minimum across all variants
                const variants = [metric.valA];
                if (metric.valB !== null && metric.valB !== undefined) variants.push(metric.valB);
                if (metric.valC !== null && metric.valC !== undefined) variants.push(metric.valC);
                if (metric.valD !== null && metric.valD !== undefined) variants.push(metric.valD);
                currentSampleSize = Math.min(...variants);
            }
        } 
        // Check if data is in converted array format (from main view)
        else if (Array.isArray(data)) {
            const storageData = JSONConverter.loadAndConvertData('atpConfigurations');
            const metricName = JSONConverter.getMetricName(config.sampleSizeMetric, storageData.metrics);
            const metricData = data.find(item => item.label === metricName);
            if (metricData) {
                console.log("REACHED HERE - ARRAY FORMAT");
                // Use multi-variant structure: find minimum across all variants
                const variants = [metricData.control];
                if (metricData.variantB !== null && metricData.variantB !== undefined) variants.push(metricData.variantB);
                if (metricData.variantC !== null && metricData.variantC !== undefined) variants.push(metricData.variantC);
                if (metricData.variantD !== null && metricData.variantD !== undefined) variants.push(metricData.variantD);
                currentSampleSize = Math.min(...variants);
            }
        }
    } 
    // Handle traffic-based sample size
    else if (config.globalVisits) {
        // Use multi-variant structure: find minimum across all variants
        const variants = [config.globalVisits.control];
        if (config.globalVisits.variantB !== null && config.globalVisits.variantB !== undefined) variants.push(config.globalVisits.variantB);
        if (config.globalVisits.variantC !== null && config.globalVisits.variantC !== undefined) variants.push(config.globalVisits.variantC);
        if (config.globalVisits.variantD !== null && config.globalVisits.variantD !== undefined) variants.push(config.globalVisits.variantD);
        currentSampleSize = Math.min(...variants);
    }
    
    console.log(atp + " Current sample size is " + currentSampleSize);
    console.log(atp + " Sample size is " + config.sampleSize);
    console.log(atp + " Sample size is reached: " + (currentSampleSize >= config.sampleSize));

    return currentSampleSize >= config.sampleSize;
}

function convertMetricsToData(metrics) {
    return Object.entries(metrics).map(([label, data]) => ({
        label,
        control: data.valA,
        variant: data.valB,
        hasBayesianData: data.hasBayesianData || false,
        bayesianProbability: data.bayesianProbability || null
    }));
}

// Bulk cleanup functionality
function setupBulkCleanup() {
    const experimentsList = document.getElementById('experimentsList');
    
    // Add cleanup button if there are experiments
    const data = JSONConverter.loadAndConvertData('atpConfigurations');
    if (data && Object.keys(data.experiments || {}).length > 0) {
        const cleanupButton = document.createElement('div');
        cleanupButton.className = 'storage-progress';
        cleanupButton.id = 'storageProgress';
        cleanupButton.style.cssText = 'width: 100%; margin-top: 15px;';
        
        // Insert after the experiments list
        experimentsList.parentNode.insertBefore(cleanupButton, experimentsList.nextSibling);
        
        // Update the storage display
        updateStorageProgress();
    }
}

function updateStorageProgress() {
    const storageProgress = document.getElementById('storageProgress');
    if (!storageProgress) return;
    
    // Calculate storage usage
    const storageUsage = calculateStorageUsage();
    const usagePercent = (storageUsage / (5 * 1024 * 1024)) * 100; // 5MB max
    
    // Determine color based on usage
    let color = '#28a745'; // Green
    if (usagePercent > 80) color = '#dc3545'; // Red
    else if (usagePercent > 60) color = '#ffc107'; // Yellow
    
    storageProgress.innerHTML = `
        <div class="storage-info">
            <span class="storage-text">Storage: ${formatBytes(storageUsage)} / 5MB</span>
            <span class="storage-percent">${usagePercent.toFixed(1)}%</span>
        </div>
        <div class="storage-bar">
            <div class="storage-fill" style="width: ${Math.min(usagePercent, 100)}%; background-color: ${color};"></div>
        </div>
        <button class="cleanup-btn" style="width: 100%; margin-top: 8px; background-color: #6c757d; color: white; font-size: 11px; padding: 6px; border: none; border-radius: 4px; cursor: pointer;">
            🧹 Clean Up Old Experiments
        </button>
    `;
    
    // Add click handler to the button
    storageProgress.querySelector('.cleanup-btn').addEventListener('click', showCleanupModal);
}

function calculateStorageUsage() {
    let totalSize = 0;
    
    // Calculate size of atpConfigurations
    const data = JSONConverter.loadAndConvertData('atpConfigurations');
    if (data) {
        totalSize += new Blob([JSON.stringify(data)]).size;
    }
    
    // Add other localStorage items if they exist
    const keys = ['debug', 'debugTimestamp'];
    keys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
            totalSize += new Blob([value]).size;
        }
    });
    
    return totalSize;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function showCleanupModal() {
    const data = JSONConverter.loadAndConvertData('atpConfigurations');
    if (!data || !data.experiments) return;
    
    const now = new Date();
    const staleExperiments = Object.entries(data.experiments).filter(([atp, config]) => {
        const lastUpdated = config.timestamp ? new Date(config.timestamp) : null;
        const daysSinceUpdate = lastUpdated ? Math.floor((now - lastUpdated) / (1000 * 60 * 60 * 24)) : 999;
        return daysSinceUpdate >= 90; // 90+ days old
    });
    
    if (staleExperiments.length === 0) {
        alert('No experiments older than 90 days found.');
        return;
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Clean Up Old Experiments</h3>
            <p>The following experiments haven't been updated in 90+ days:</p>
            <div style="max-height: 300px; overflow-y: auto; margin: 15px 0;">
                ${staleExperiments.map(([atp, config]) => `
                    <div style="padding: 8px; border: 1px solid #ddd; margin: 5px 0; border-radius: 4px;">
                        <strong>${config.name || 'ATP ' + atp}</strong><br>
                        <small>Last updated: ${config.timestamp ? new Date(config.timestamp).toLocaleDateString() : 'Unknown'}</small>
                    </div>
                `).join('')}
            </div>
            <p><strong>Warning:</strong> This will permanently delete these experiments from your tool.</p>
            <div class="modal-buttons">
                <button id="confirmCleanup" class="btn btn-danger">Delete ${staleExperiments.length} Experiments</button>
                <button id="cancelCleanup" class="btn">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    document.getElementById('confirmCleanup').addEventListener('click', () => {
        performCleanup(staleExperiments.map(([atp]) => atp));
        document.body.removeChild(modal);
    });
    
    document.getElementById('cancelCleanup').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

function performCleanup(experimentsToDelete) {
    const data = JSONConverter.loadAndConvertData('atpConfigurations');
    if (!data || !data.experiments) return;
    
    // Remove experiments
    experimentsToDelete.forEach(atp => {
        delete data.experiments[atp];
    });
    
    // Save updated data
    JSONConverter.saveV2Data('atpConfigurations', data);
    
    // Reload experiments list
    loadSavedExperiments();
    
    // Update storage progress indicator
    updateStorageProgress();
    
    // Show success message
    alert(`Successfully deleted ${experimentsToDelete.length} old experiments.`);
}
