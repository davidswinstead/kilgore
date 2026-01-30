// Utility functions for ATP Experiment Tool

// Message functions
function showMessage(message, type = 'info') {
    // Remove existing messages
    document.querySelectorAll('.error, .success, .processing').forEach(el => el.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = type;
    messageDiv.textContent = message;
    
    const content = document.querySelector('.content');
    content.insertBefore(messageDiv, content.firstChild);
    
    // Auto-remove after delay
    if (type !== 'processing') {
        const delay = type === 'error' ? 5000 : 3000;
        setTimeout(() => {
            if (document.body.contains(messageDiv)) {
                messageDiv.remove();
            }
        }, delay);
    }
    
    return messageDiv;
}

function showError(message) {
    return showMessage(message, 'error');
}

function showSuccess(message) {
    return showMessage(message, 'success');
}

function showProcessing(message) {
    const messageDiv = showMessage(message, 'processing');
    // Add spinner
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    messageDiv.insertBefore(spinner, messageDiv.firstChild);
    return messageDiv;
}

function hideProcessing() {
    const processingDiv = document.querySelector('.processing');
    if (processingDiv) {
        processingDiv.remove();
    }
}

// Screen navigation
function showScreen(screenId) {
    const screens = ['uploadSection', 'configSection', 'resultsSection'];
    screens.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.toggle('hidden', id !== screenId);
        }
    });
}

// Local storage helpers
function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
    }
}

function loadFromStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('Failed to load from localStorage:', e);
        return null;
    }
}

// Date formatting
function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

// Number formatting
function formatNumber(num) {
    if (num == null || num === undefined || isNaN(num)) return '–';
    if (num > 0 && num < 1) return num.toFixed(3);
    return num.toLocaleString();
}

// Smart number formatting functions
function determineDecimalPlaces(values) {
    const maxAbsValue = Math.max(...values.map(v => Math.abs(v)));
    
    // Determine base decimal places by magnitude
    let baseDecimals;
    if (maxAbsValue >= 10000) {
        baseDecimals = 0;
    } else if (maxAbsValue >= 1000) {
        baseDecimals = 1;
    } else if (maxAbsValue >= 10) {
        baseDecimals = 2;
    } else {
        baseDecimals = 3;
    }
    
    // Check if any value actually needs decimals at this precision level
    const needsDecimals = values.some(value => {
        const remainder = Math.abs(value - Math.round(value));
        return remainder >= Math.pow(10, -(baseDecimals + 1));
    });
    
    return needsDecimals ? baseDecimals : 0;
}

function formatMetricRow(controlValue, variantBValue, variantCValue = null, variantDValue = null) {
    // Collect all non-null values for this metric
    const allValues = [controlValue, variantBValue, variantCValue, variantDValue]
        .filter(v => v !== null && v !== undefined && !isNaN(v));
    
    if (allValues.length === 0) {
        return {
            control: '–',
            variantB: '–',
            variantC: '–',
            variantD: '–'
        };
    }
    
    const decimalPlaces = determineDecimalPlaces(allValues);
    const useCommas = Math.max(...allValues.map(v => Math.abs(v))) >= 10000;
    
    // Format all values consistently
    const formatValue = (value) => {
        if (value === null || value === undefined || isNaN(value)) return '–';
        
        const formatted = value.toFixed(decimalPlaces);
        
        if (useCommas && decimalPlaces === 0) {
            // Large integers with commas, no decimals
            return Math.round(value).toLocaleString();
        } else if (useCommas) {
            // Large numbers with decimals and commas
            return parseFloat(formatted).toLocaleString(undefined, {
                minimumFractionDigits: decimalPlaces,
                maximumFractionDigits: decimalPlaces
            });
        } else {
            // Regular formatting
            return formatted;
        }
    };
    
    return {
        control: formatValue(controlValue),
        variantB: formatValue(variantBValue),
        variantC: formatValue(variantCValue),
        variantD: formatValue(variantDValue)
    };
}

// Calculate percentage change
function calculatePercentageChange(control, variant) {
    if (!control || !variant) return null;
    return ((variant - control) / control * 100);
}

// CSV parsing
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        throw new Error('Invalid CSV file: No data found');
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        data.push(row);
    }
    
    return { headers, data };
}

// Create tooltip
function createTooltip(content, tooltipText) {
    return `<span class="debug-tooltip">${content}<span class="debug-tooltip-text">${tooltipText}</span></span>`;
}

// Analytics calculations
function calculateExperimentAnalytics(config, globalVisits, data) {
    const analytics = {
        daysRunning: null,
        dailyTrafficRate: null,
        projectedEndDate: null
    };

    if (!config.startDate) {
        return analytics;
    }

    const startDate = new Date(config.startDate);
    const currentDate = new Date();
    const timeDiff = currentDate.getTime() - startDate.getTime();
    const dayDifference = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

    analytics.daysRunning = dayDifference;

    if (analytics.daysRunning > 0) {
        let dailyRate = 0;
        let currentSampleSize = 0;
        
        if (config.sampleSizeMetric && data) {
            let sampleSizeMetricName = config.sampleSizeMetric;
            if (typeof sampleSizeMetricName === 'number') {
                const storageData = JSONConverter.loadAndConvertData('atpConfigurations');
                if (storageData && storageData.metrics) {
                    sampleSizeMetricName = JSONConverter.getMetricName(sampleSizeMetricName, storageData.metrics);
                }
            }
            
            const metricData = data.find(item => item.label === sampleSizeMetricName);
            if (metricData) {
                // Use multi-variant structure: find minimum across all variants
                const variants = [metricData.control];
                if (metricData.variantB !== null && metricData.variantB !== undefined) variants.push(metricData.variantB);
                if (metricData.variantC !== null && metricData.variantC !== undefined) variants.push(metricData.variantC);
                if (metricData.variantD !== null && metricData.variantD !== undefined) variants.push(metricData.variantD);
                currentSampleSize = Math.min(...variants);
                dailyRate = currentSampleSize / analytics.daysRunning;
                analytics.dailyTrafficRate = Math.round(dailyRate);
            }
        } else if (globalVisits) {
            // Use multi-variant structure: find minimum across all variants
            const variants = [globalVisits.control];
            if (globalVisits.variantB !== null && globalVisits.variantB !== undefined) variants.push(globalVisits.variantB);
            if (globalVisits.variantC !== null && globalVisits.variantC !== undefined) variants.push(globalVisits.variantC);
            if (globalVisits.variantD !== null && globalVisits.variantD !== undefined) variants.push(globalVisits.variantD);
            currentSampleSize = Math.min(...variants);
            dailyRate = currentSampleSize / analytics.daysRunning;
            analytics.dailyTrafficRate = Math.round(dailyRate);
        }

        if (config.sampleSize && dailyRate > 0) {
            const remaining = config.sampleSize - currentSampleSize;
            if (remaining > 0) {
                const daysRemaining = Math.ceil(remaining / dailyRate);
                const projectedEnd = new Date(currentDate);
                projectedEnd.setDate(projectedEnd.getDate() + daysRemaining);
                analytics.projectedEndDate = projectedEnd;
                
                // Calculate full week cycle end date
                const startDate = new Date(config.startDate);
                const daysSinceStart = Math.floor((projectedEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                const nextWeekMultiple = Math.ceil(daysSinceStart / 7) * 7;
                const weekCycleEnd = new Date(startDate);
                weekCycleEnd.setDate(weekCycleEnd.getDate() + nextWeekMultiple);
                analytics.projectedEndDateWeekCycle = weekCycleEnd;
            } else {
                analytics.projectedEndDate = currentDate; // Already reached
                analytics.projectedEndDateWeekCycle = currentDate;
            }
        }
    }

    return analytics;
}

function calculateRevenueProjection(data, config, analytics, globalVisits, variant = 'variantB') {
    // Find the revenue metric by its fixed string name (unchanged)
    const revenueMetric = data.find(item => item.label === "Revenue (incl. C&C) - SPR");
    
    if (!revenueMetric || !analytics.daysRunning) {
        return null;
    }
    
    // Get the primary metric name - handle both old and new format
    let primaryMetricName;
    if (typeof config.primary === 'number') {
        // New format: config.primary is an ID, convert to name
        const storageData = JSONConverter.loadAndConvertData('atpConfigurations');
        primaryMetricName = JSONConverter.getMetricName(config.primary, storageData.metrics);
    } else {
        // Old format: config.primary is already a string name
        primaryMetricName = config.primary;
    }
    
    // Find the main metric by its name
    const mainMetric = data.find(item => item.label === primaryMetricName);

    if (!mainMetric) {
        return null;
    }

    // Get the variant value and visits based on the specified variant
    let variantValue, variantVisits;
    
    if (variant === 'variantC' && mainMetric.variantC !== undefined) {
        variantValue = mainMetric.variantC;
        variantVisits = globalVisits && globalVisits.variantC ? globalVisits.variantC : null;
    } else if (variant === 'variantD' && mainMetric.variantD !== undefined) {
        variantValue = mainMetric.variantD;
        variantVisits = globalVisits && globalVisits.variantD ? globalVisits.variantD : null;
    } else {
        // Default to variantB or backward compatible variant
        variantValue = mainMetric.variantB || mainMetric.variant;
        variantVisits = globalVisits && (globalVisits.variantB || globalVisits.variant) ? 
                       (globalVisits.variantB || globalVisits.variant) : null;
    }

    // Calculate the uplift on the main metric
    let mainMetricChange;
    if (!window.isContinuousMetric(mainMetric.label) && globalVisits && globalVisits.control > 0 && variantVisits > 0) {
        // Rate-based calculation for binomial metrics (e.g., conversion, add to cart)
        const controlRate = mainMetric.control / globalVisits.control;
        const variantRate = variantValue / variantVisits;
        if (controlRate > 0) {
            mainMetricChange = ((variantRate - controlRate) / controlRate) * 100;
        } else if (variantRate > 0) {
            mainMetricChange = Infinity;
        } else {
            mainMetricChange = 0;
        }
    } else {
        // Absolute calculation for continuous metrics
        mainMetricChange = calculatePercentageChange(mainMetric.control, variantValue);
    }
    
    // Apply the main metric uplift to revenue (stakeholder agreement: use primary metric uplift for revenue impact)
    let revenueChange = mainMetricChange;
    
    // Calculate daily revenue impact based on main metric uplift applied to revenue
    let dailyImpact;
    if (globalVisits && globalVisits.control > 0 && variantVisits > 0) {
        // Calculate revenue per visitor for control
        const controlRevenueRate = revenueMetric.control / globalVisits.control;
        
        // Apply main metric uplift percentage to revenue rate
        const variantRevenueRate = controlRevenueRate * (1 + (mainMetricChange / 100));
        
        // Debug logging
        console.log('Business Impact Debug (applying main metric uplift to revenue):', {
            primaryMetric: primaryMetricName,
            mainMetricChange: mainMetricChange,
            controlRevenue: revenueMetric.control,
            controlVisits: globalVisits.control,
            variantVisits: variantVisits,
            controlRevenueRate: controlRevenueRate,
            variantRevenueRate: variantRevenueRate,
            daysRunning: analytics.daysRunning
        });
        
        // Calculate daily impact based on assumed revenue change
        const totalVisitors = globalVisits.control + (globalVisits.variantB || globalVisits.variant || 0) + 
                             (globalVisits.variantC || 0) + (globalVisits.variantD || 0);
        const totalDailyVisitors = totalVisitors / analytics.daysRunning;
        
        // Current daily revenue (all traffic at control rate)
        const currentDailyRevenue = totalDailyVisitors * controlRevenueRate;
        
        // Future daily revenue (all traffic at variant rate, based on main metric uplift)
        const futureDailyRevenue = totalDailyVisitors * variantRevenueRate;
        
        // Daily impact is the difference
        dailyImpact = futureDailyRevenue - currentDailyRevenue;
        
        console.log('Daily Impact Calculation:', {
            totalVisitors: totalVisitors,
            totalDailyVisitors: totalDailyVisitors,
            controlRevenueRate: controlRevenueRate,
            variantRevenueRate: variantRevenueRate,
            currentDailyRevenue: currentDailyRevenue,
            futureDailyRevenue: futureDailyRevenue,
            dailyImpact: dailyImpact
        });
    } else {
        // Fallback if missing visit data
        dailyImpact = 0;
        console.log('Unable to calculate daily impact: missing visit data');
    }
    
    const annualRevenue = Math.round(dailyImpact * 365);
    console.log('Final Annual Revenue:', annualRevenue);

    return {
        annualRevenue,
        mainMetricChange: mainMetricChange.toFixed(2),
        revenueChange: revenueChange.toFixed(2)
    };
}

// Make functions available globally
window.Utils = {
    showMessage,
    showError,
    showSuccess,
    showProcessing,
    hideProcessing,
    showScreen,
    saveToStorage,
    loadFromStorage,
    formatDate,
    formatNumber,
    formatMetricRow,
    calculatePercentageChange,
    parseCSV,
    createTooltip,
    calculateExperimentAnalytics,
    calculateRevenueProjection
}; 