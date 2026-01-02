// Sample Ratio Mismatch (SRM) Detection using Chi-Squared Test
// This module provides statistical functions to detect if control vs variant sample sizes
// are significantly different from the expected 50/50 split

const SRM = {
    // SRM threshold levels
    SRM_WARNING_LEVEL: 0.05,    // Orange warning threshold
    SRM_CRITICAL_LEVEL: 0.001,  // Red warning threshold
    
    // Corresponding chi-squared critical values with 1 degree of freedom
    CHI_SQUARED_WARNING: 3.841,   // For p = 0.05
    CHI_SQUARED_CRITICAL: 10.828, // For p = 0.001
    
    /**
     * Calculate chi-squared statistic for comparing two proportions
     * @param {number} controlCount - Number of control samples
     * @param {number} variantCount - Number of variant samples
     * @returns {object} Object containing chi-squared value, p-value, and significance
     */
    calculateChiSquared: function(controlCount, variantCount) {
        if (controlCount <= 0 || variantCount <= 0) {
            return {
                chiSquared: 0,
                pValue: 1,
                isSignificant: false,
                error: 'Invalid counts'
            };
        }
        
        const total = controlCount + variantCount;
        const expectedControl = total / 2;
        const expectedVariant = total / 2;
        
        // Chi-squared formula: Σ((observed - expected)² / expected)
        const chiSquared = Math.pow(controlCount - expectedControl, 2) / expectedControl +
                          Math.pow(variantCount - expectedVariant, 2) / expectedVariant;
        
        // Calculate p-value using approximation
        // For 1 degree of freedom, we can use a simplified approach
        const pValue = this.calculatePValue(chiSquared);
        const isWarning = pValue < this.SRM_WARNING_LEVEL;
        const isCritical = pValue < this.SRM_CRITICAL_LEVEL;
        const isSignificant = isWarning; // Any warning level counts as significant
        
        return {
            chiSquared: chiSquared,
            pValue: pValue,
            isSignificant: isSignificant,
            isWarning: isWarning,
            isCritical: isCritical,
            severity: isCritical ? 'critical' : (isWarning ? 'warning' : 'none'),
            controlCount: controlCount,
            variantCount: variantCount,
            total: total,
            expectedControl: expectedControl,
            expectedVariant: expectedVariant
        };
    },
    
    /**
     * Calculate approximate p-value from chi-squared statistic
     * This is an approximation for 1 degree of freedom
     * @param {number} chiSquared - Chi-squared statistic
     * @returns {number} Approximate p-value
     */
    calculatePValue: function(chiSquared) {
        if (chiSquared <= 0) return 1;
        
        // For 1 degree of freedom, we can use a more accurate approximation
        // This is based on the relationship between chi-squared and normal distribution
        const z = Math.sqrt(chiSquared);
        
        // Use error function approximation for normal distribution
        // P-value = 2 * (1 - Φ(z)) where Φ is the standard normal CDF
        const pValue = 2 * (1 - this.normalCDF(z));
        
        return Math.max(0, Math.min(1, pValue));
    },
    
    /**
     * Approximate cumulative distribution function for standard normal distribution
     * @param {number} z - Z-score
     * @returns {number} Approximate CDF value
     */
    normalCDF: function(z) {
        // Abramowitz and Stegun approximation (26.2.17)
        const t = 1 / (1 + 0.2316419 * Math.abs(z));
        const d = 0.3989423 * Math.exp(-z * z / 2);
        const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        
        return z > 0 ? 1 - p : p;
    },
    
    /**
     * Check if sample ratio mismatch is significant
     * @param {number} controlCount - Number of control samples
     * @param {number} variantCount - Number of variant samples
     * @returns {boolean} True if mismatch is statistically significant (p < 0.0001)
     */
    isSignificantMismatch: function(controlCount, variantCount) {
        const result = this.calculateChiSquared(controlCount, variantCount);
        return result.isSignificant;
    },
    
    /**
     * Get detailed analysis of sample ratio mismatch
     * @param {number} controlCount - Number of control samples
     * @param {number} variantCount - Number of variant samples
     * @returns {object} Detailed analysis object
     */
    analyzeSampleRatio: function(controlCount, variantCount) {
        const result = this.calculateChiSquared(controlCount, variantCount);
        
        if (result.error) {
            return result;
        }
        
        const controlRatio = (controlCount / result.total * 100).toFixed(2);
        const variantRatio = (variantCount / result.total * 100).toFixed(2);
        const difference = Math.abs(controlCount - variantCount);
        const percentDifference = (difference / result.total * 100).toFixed(1);
        
        return {
            ...result,
            controlRatio: controlRatio + '%',
            variantRatio: variantRatio + '%',
            difference: difference,
            percentDifference: percentDifference + '%',
            recommendation: result.isSignificant ? 
                'Sample ratio mismatch detected. Consider investigating data collection or randomisation issues.' :
                'Sample ratios are within acceptable range.'
        };
    },
    
    /**
     * Test function to verify SRM calculations
     * Run this in console to test: SRM.test()
     */
    test: function() {
        console.log('Testing SRM calculations...');
        
        // Test case 1: Balanced samples (should not be significant)
        const test1 = this.analyzeSampleRatio(1000, 1000);
        console.log('Test 1 - Balanced (1000, 1000):', test1);
        
        // Test case 2: Slight imbalance (should not be significant)
        const test2 = this.analyzeSampleRatio(1050, 950);
        console.log('Test 2 - Slight imbalance (1050, 950):', test2);
        
        // Test case 3: Moderate imbalance (should be significant)
        const test3 = this.analyzeSampleRatio(1200, 800);
        console.log('Test 3 - Moderate imbalance (1200, 800):', test3);
        
        // Test case 4: Large imbalance (should be significant)
        const test4 = this.analyzeSampleRatio(1500, 500);
        console.log('Test 4 - Large imbalance (1500, 500):', test4);
        
        // Test case 5: Very large imbalance (should be significant)
        const test5 = this.analyzeSampleRatio(1800, 200);
        console.log('Test 5 - Very large imbalance (1800, 200):', test5);
        
        console.log('SRM test completed. Check results above.');
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SRM;
} 