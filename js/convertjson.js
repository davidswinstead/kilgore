// JSON version conversion utilities for ATP Experiment Tool

// Current version
const CURRENT_VERSION = 'v2';

// Convert v1 JSON to v2 format
function convertV1ToV2(v1Data) {
    console.log('Converting v1 JSON to v2 format...');
    console.log('Original data size:', JSON.stringify(v1Data).length, 'characters');
    
    const v2Data = {
        version: CURRENT_VERSION,
        metrics: {}, // Global metric map with static IDs
        experiments: {}
    };
    
    // Build global metric list from all experiments
    const allMetrics = new Set();
    Object.values(v1Data).forEach(config => {
        if (config.metrics) {
            Object.keys(config.metrics).forEach(metric => {
                allMetrics.add(metric);
            });
        }
    });
    
    // Convert to sorted array and assign static IDs
    const sortedMetrics = Array.from(allMetrics).sort();
    sortedMetrics.forEach((metric, index) => {
        v2Data.metrics[index] = metric; // Static ID is the index in the sorted list
    });
    
    // Convert each experiment
    Object.entries(v1Data).forEach(([atp, config]) => {
        v2Data.experiments[atp] = convertExperimentV1ToV2(config, v2Data.metrics);
    });
    
    console.log(`Conversion complete. ${Object.keys(v2Data.metrics).length} unique metrics found.`);
    console.log('New data size:', JSON.stringify(v2Data).length, 'characters');
    const compressionRatio = ((JSON.stringify(v1Data).length - JSON.stringify(v2Data).length) / JSON.stringify(v1Data).length * 100).toFixed(1);
    console.log(`Compression achieved: ${compressionRatio}% reduction`);
    return v2Data;
}

// Convert a single experiment from v1 to v2
function convertExperimentV1ToV2(v1Config, globalMetrics) {
    const v2Config = {
        name: v1Config.name || '',
        primary: getMetricId(v1Config.primary, globalMetrics),
        secondary: (v1Config.secondary || []).map(metric => getMetricId(metric, globalMetrics)),
        bayesian: (v1Config.bayesian || []).map(metric => getMetricId(metric, globalMetrics)),
        sampleSize: v1Config.sampleSize || null,
        startDate: v1Config.startDate || null,
        needsConfig: v1Config.needsConfig || false,
        timestamp: v1Config.timestamp,
        globalVisits: v1Config.globalVisits || null,
        csvDateInfo: v1Config.csvDateInfo || null,
        analytics: v1Config.analytics || null,
        businessImpact: v1Config.businessImpact || null,
        isPrimaryValidated: v1Config.isPrimaryValidated || false,
        lastCalculated: v1Config.lastCalculated || null,
        metrics: {}
    };
    
    // Convert metrics data
    if (v1Config.metrics) {
        Object.entries(v1Config.metrics).forEach(([metricName, metricData]) => {
            const metricId = getMetricId(metricName, globalMetrics);
            if (metricId !== null) {
                const v2Metric = {
                    valA: metricData.valA,
                    valB: metricData.valB
                };
                
                // Only include visits if they differ from global visits
                if (v1Config.globalVisits) {
                    if (metricData.controlVisits !== undefined && metricData.controlVisits !== v1Config.globalVisits.control) {
                        v2Metric.cVisits = metricData.controlVisits;
                    }
                    if (metricData.variantVisits !== undefined && metricData.variantVisits !== v1Config.globalVisits.variant) {
                        v2Metric.vVisits = metricData.variantVisits;
                    }
                } else {
                    // No global visits, include all visit data
                    if (metricData.controlVisits !== undefined) {
                        v2Metric.cVisits = metricData.controlVisits;
                    }
                    if (metricData.variantVisits !== undefined) {
                        v2Metric.vVisits = metricData.variantVisits;
                    }
                }
                
                // Include Bayesian data if present
                if (metricData.hasBayesianData) {
                    v2Metric.hasBayesianData = true;
                    v2Metric.bayesianProbability = metricData.bayesianProbability;
                }
                
                v2Config.metrics[metricId] = v2Metric;
            }
        });
    }
    
    return v2Config;
}

// Get metric ID (static ID) from metric name
function getMetricId(metricName, globalMetrics) {
    if (!metricName) return null;
    // Find the static ID by searching through the metrics object
    for (const [id, name] of Object.entries(globalMetrics)) {
        if (name === metricName) {
            return parseInt(id);
        }
    }
    return null;
}

// Get metric name from metric ID
function getMetricName(metricId, globalMetrics) {
    if (metricId === null || metricId === undefined) return null;
    return globalMetrics[metricId] || null;
}

// Convert v2 JSON back to v1 format (for backward compatibility if needed)
function convertV2ToV1(v2Data) {
    console.log('Converting v2 JSON to v1 format...');
    
    const v1Data = {};
    
    Object.entries(v2Data.experiments).forEach(([atp, v2Config]) => {
        v1Data[atp] = convertExperimentV2ToV1(v2Config, v2Data.metrics);
    });
    
    return v1Data;
}

// Convert a single experiment from v2 to v1
function convertExperimentV2ToV1(v2Config, globalMetrics) {
    const v1Config = {
        name: v2Config.name || '',
        primary: getMetricName(v2Config.primary, globalMetrics),
        secondary: (v2Config.secondary || []).map(metricId => getMetricName(metricId, globalMetrics)).filter(Boolean),
        bayesian: (v2Config.bayesian || []).map(metricId => getMetricName(metricId, globalMetrics)).filter(Boolean),
        sampleSize: v2Config.sampleSize || null,
        startDate: v2Config.startDate || null,
        needsConfig: v2Config.needsConfig || false,
        timestamp: v2Config.timestamp,
        globalVisits: v2Config.globalVisits || null,
        csvDateInfo: v2Config.csvDateInfo || null,
        analytics: v2Config.analytics || null,
        businessImpact: v2Config.businessImpact || null,
        isPrimaryValidated: v2Config.isPrimaryValidated || false,
        lastCalculated: v2Config.lastCalculated || null,
        metrics: {}
    };
    
    // Convert metrics data back to full names
    if (v2Config.metrics) {
        Object.entries(v2Config.metrics).forEach(([metricId, metricData]) => {
            const metricName = getMetricName(parseInt(metricId), globalMetrics);
            if (metricName) {
                const v1Metric = {
                    valA: metricData.valA,
                    valB: metricData.valB
                };
                
                // Convert visits back to full names
                if (metricData.cVisits !== undefined) {
                    v1Metric.controlVisits = metricData.cVisits;
                } else if (v2Config.globalVisits && v2Config.globalVisits.control !== undefined) {
                    v1Metric.controlVisits = v2Config.globalVisits.control;
                }
                
                if (metricData.vVisits !== undefined) {
                    v1Metric.variantVisits = metricData.vVisits;
                } else if (v2Config.globalVisits && v2Config.globalVisits.variant !== undefined) {
                    v1Metric.variantVisits = v2Config.globalVisits.variant;
                }
                
                // Include Bayesian data if present
                if (metricData.hasBayesianData) {
                    v1Metric.hasBayesianData = true;
                    v1Metric.bayesianProbability = metricData.bayesianProbability;
                }
                
                v1Config.metrics[metricName] = v1Metric;
            }
        });
    }
    
    return v1Config;
}

// Check if data needs conversion
function needsConversion(data) {
    return !data.version || data.version !== CURRENT_VERSION;
}

// Get current version from data
function getVersion(data) {
    return data.version || 'v1';
}

// Main conversion function
function convertData(data) {
    if (!data) return null;
    
    const version = getVersion(data);
    
    if (version === CURRENT_VERSION) {
        return data; // Already current version
    }
    
    if (version === 'v1') {
        return convertV1ToV2(data);
    }
    
    console.warn(`Unknown version: ${version}. Cannot convert.`);
    return data;
}

// Save data in v2 format
function saveV2Data(key, data) {
    const v2Data = {
        version: CURRENT_VERSION,
        metrics: data.metrics || {},
        experiments: data.experiments || {}
    };
    
    Utils.saveToStorage(key, v2Data);
    return v2Data;
}

// Load and convert data if needed
function loadAndConvertData(key) {
    const data = Utils.loadFromStorage(key);
    
    if (!data) {
        return null;
    }
    
    if (needsConversion(data)) {
        console.log(`Converting data from ${getVersion(data)} to ${CURRENT_VERSION}`);
        const convertedData = convertData(data);
        saveV2Data(key, convertedData);
        return convertedData;
    }
    
    // Handle legacy v2 format (array-based metrics) and convert to new format
    if (data.version === CURRENT_VERSION && Array.isArray(data.metrics)) {
        console.log('Converting legacy v2 format to new static ID format...');
        const newData = {
            version: CURRENT_VERSION,
            metrics: {},
            experiments: data.experiments || {}
        };
        
        // Convert array to object with static IDs
        data.metrics.forEach((metric, index) => {
            newData.metrics[index] = metric;
        });
        
        saveV2Data(key, newData);
        return newData;
    }
    
    return data;
}

// Test function to verify conversion works correctly
function testConversion() {
    console.log('Testing JSON conversion...');
    
    // Create sample v1 data with fixed timestamp
    const testTimestamp = 1704067200000; // Fixed timestamp for consistent testing
    const v1Data = {
        'ATP-001': {
            name: 'Test Experiment',
            primary: 'Revenue (incl. C&C) - SPR',
            secondary: ['Orders', 'Conversion Rate'],
            bayesian: ['Revenue (incl. C&C) - SPR'],
            sampleSize: 10000,
            startDate: '2024-01-01',
            needsConfig: false,
            timestamp: testTimestamp,
            globalVisits: { control: 5000, variant: 5000 },
            metrics: {
                'Revenue (incl. C&C) - SPR': {
                    valA: 1000,
                    valB: 1100,
                    controlVisits: 5000,
                    variantVisits: 5000
                },
                'Orders': {
                    valA: 100,
                    valB: 105,
                    controlVisits: 5000,  // Same as global
                    variantVisits: 5000   // Same as global
                },
                'Conversion Rate': {
                    valA: 0.02,
                    valB: 0.021,
                    controlVisits: 5000,
                    variantVisits: 5000
                }
            }
        }
    };
    
    console.log('=== V1 DATA ===');
    console.log(JSON.stringify(v1Data, null, 2));
    
    // Convert to v2
    const v2Data = convertV1ToV2(v1Data);
    
    console.log('=== V2 DATA (Static IDs) ===');
    console.log(JSON.stringify(v2Data, null, 2));
    
    // Convert back to v1
    const v1DataBack = convertV2ToV1(v2Data);
    
    console.log('=== V1 DATA BACK ===');
    console.log(JSON.stringify(v1DataBack, null, 2));
    
    // Compare
    const originalStr = JSON.stringify(v1Data, null, 2);
    const convertedStr = JSON.stringify(v1DataBack, null, 2);
    
    console.log('Conversion successful:', originalStr === convertedStr);
    
    // Detailed comparison
    if (originalStr !== convertedStr) {
        console.log('=== DETAILED COMPARISON ===');
        console.log('Original keys:', Object.keys(v1Data['ATP-001']));
        console.log('Converted keys:', Object.keys(v1DataBack['ATP-001']));
        console.log('Original metrics keys:', Object.keys(v1Data['ATP-001'].metrics));
        console.log('Converted metrics keys:', Object.keys(v1DataBack['ATP-001'].metrics));
        
        // Compare each metric
        Object.keys(v1Data['ATP-001'].metrics).forEach(metricName => {
            const original = v1Data['ATP-001'].metrics[metricName];
            const converted = v1DataBack['ATP-001'].metrics[metricName];
            console.log(`Metric ${metricName}:`, {
                original: original,
                converted: converted,
                match: JSON.stringify(original) === JSON.stringify(converted)
            });
        });
    }
    
    return {
        original: v1Data,
        v2: v2Data,
        convertedBack: v1DataBack,
        success: originalStr === convertedStr
    };
}

// Test function to verify conversion works correctly
function testConversionStepByStep() {
    console.log('Testing JSON conversion step by step...');
    
    // Create sample v1 data with fixed timestamp
    const testTimestamp = 1704067200000; // Fixed timestamp for consistent testing
    const v1Data = {
        'ATP-001': {
            name: 'Test Experiment',
            primary: 'Revenue (incl. C&C) - SPR',
            secondary: ['Orders', 'Conversion Rate'],
            bayesian: ['Revenue (incl. C&C) - SPR'],
            sampleSize: 10000,
            startDate: '2024-01-01',
            needsConfig: false,
            timestamp: testTimestamp,
            globalVisits: { control: 5000, variant: 5000 },
            metrics: {
                'Revenue (incl. C&C) - SPR': {
                    valA: 1000,
                    valB: 1100,
                    controlVisits: 5000,
                    variantVisits: 5000
                },
                'Orders': {
                    valA: 100,
                    valB: 105,
                    controlVisits: 4800,  // Different from global
                    variantVisits: 5200   // Different from global
                },
                'Conversion Rate': {
                    valA: 0.02,
                    valB: 0.021,
                    controlVisits: 5000,
                    variantVisits: 5000
                }
            }
        }
    };
    
    console.log('=== V1 DATA ===');
    console.log(JSON.stringify(v1Data, null, 2));
    
    // Convert to v2
    const v2Data = convertV1ToV2(v1Data);
    
    console.log('=== V2 DATA ===');
    console.log(JSON.stringify(v2Data, null, 2));
    
    // Convert back to v1
    const v1DataBack = convertV2ToV1(v2Data);
    
    console.log('=== V1 DATA BACK ===');
    console.log(JSON.stringify(v1DataBack, null, 2));
    
    // Compare
    const originalStr = JSON.stringify(v1Data, null, 2);
    const convertedStr = JSON.stringify(v1DataBack, null, 2);
    
    console.log('Conversion successful:', originalStr === convertedStr);
    
    return {
        original: v1Data,
        v2: v2Data,
        convertedBack: v1DataBack,
        success: originalStr === convertedStr
    };
}

// Create a subset of data for partial import/export
function createSubset(data, experimentIds) {
    if (!data || !data.experiments) return null;
    
    const subset = {
        version: data.version,
        metrics: {},
        experiments: {}
    };
    
    // Get all metrics used by the selected experiments
    const usedMetricIds = new Set();
    experimentIds.forEach(atp => {
        const experiment = data.experiments[atp];
        if (experiment) {
            // Add primary metric
            if (experiment.primary !== null && experiment.primary !== undefined) {
                usedMetricIds.add(experiment.primary);
            }
            // Add secondary metrics
            if (experiment.secondary) {
                experiment.secondary.forEach(metricId => {
                    if (metricId !== null && metricId !== undefined) {
                        usedMetricIds.add(metricId);
                    }
                });
            }
            // Add bayesian metrics
            if (experiment.bayesian) {
                experiment.bayesian.forEach(metricId => {
                    if (metricId !== null && metricId !== undefined) {
                        usedMetricIds.add(metricId);
                    }
                });
            }
            // Add metrics used in the experiment data
            if (experiment.metrics) {
                Object.keys(experiment.metrics).forEach(metricId => {
                    usedMetricIds.add(parseInt(metricId));
                });
            }
        }
    });
    
    // Copy only the used metrics
    usedMetricIds.forEach(metricId => {
        if (data.metrics[metricId]) {
            subset.metrics[metricId] = data.metrics[metricId];
        }
    });
    
    // Copy only the selected experiments
    experimentIds.forEach(atp => {
        if (data.experiments[atp]) {
            subset.experiments[atp] = data.experiments[atp];
        }
    });
    
    return subset;
}

// Merge subset data into existing data
function mergeSubset(existingData, subsetData) {
    if (!existingData || !subsetData) return existingData;
    
    const merged = {
        version: existingData.version,
        metrics: { ...existingData.metrics },
        experiments: { ...existingData.experiments }
    };
    
    // Merge metrics
    Object.entries(subsetData.metrics || {}).forEach(([id, metric]) => {
        merged.metrics[id] = metric;
    });
    
    // Merge experiments
    Object.entries(subsetData.experiments || {}).forEach(([atp, experiment]) => {
        merged.experiments[atp] = experiment;
    });
    
    return merged;
}

// Export functions
window.JSONConverter = {
    convertV1ToV2,
    convertV2ToV1,
    convertData,
    needsConversion,
    getVersion,
    saveV2Data,
    loadAndConvertData,
    getMetricId,
    getMetricName,
    createSubset,
    mergeSubset,
    testConversion,
    testConversionStepByStep,
    CURRENT_VERSION
}; 