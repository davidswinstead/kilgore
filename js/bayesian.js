// Bayesian calculation functions - Original working version
function calculateBayesianProb(controlVisits, controlConversions, variantVisits, variantConversions) {
    //console.log("Bayesian calc:", controlVisits, controlConversions, variantVisits, variantConversions);

    // Validate inputs
    if (controlVisits <= 0 || variantVisits <= 0 ||
        controlConversions < 0 || variantConversions < 0 ||
        controlConversions > controlVisits || variantConversions > variantVisits) {
        console.warn('Invalid Bayesian inputs:', { controlVisits, controlConversions, variantVisits, variantConversions });
        return 0.5;
    }

    const alpha1 = 1 + controlConversions;
    const beta1 = 1 + controlVisits - controlConversions;
    const alpha2 = 1 + variantConversions;
    const beta2 = 1 + variantVisits - variantConversions;

    // Use normal approximation for large sample sizes
    if (controlVisits > 30 && variantVisits > 30) {
        const mean1 = alpha1 / (alpha1 + beta1);
        const mean2 = alpha2 / (alpha2 + beta2);
        const var1 = (alpha1 * beta1) / ((alpha1 + beta1) * (alpha1 + beta1) * (alpha1 + beta1 + 1));
        const var2 = (alpha2 * beta2) / ((alpha2 + beta2) * (alpha2 + beta2) * (alpha2 + beta2 + 1));

        const diffMean = mean2 - mean1;
        const diffVar = var1 + var2;
        const diffStd = Math.sqrt(diffVar);

        if (diffStd === 0) return 0.5;

        const z = diffMean / diffStd;
        return normalCDF(z);
    }

    // For smaller samples, use simplified Monte Carlo
    const samples = 10000;
    let variantBetterCount = 0;

    for (let i = 0; i < samples; i++) {
        const sampleA = simpleBetaSample(alpha1, beta1);
        const sampleB = simpleBetaSample(alpha2, beta2);

        if (sampleB > sampleA) {
            variantBetterCount++;
        }
    }

    return variantBetterCount / samples;
}

function simpleBetaSample(alpha, beta) {
    let sum = 0;
    for (let i = 0; i < alpha; i++) {
        sum += -Math.log(Math.random());
    }
    for (let i = 0; i < beta; i++) {
        sum += -Math.log(Math.random());
    }
    const x = -Math.log(Math.random());
    return x / (x + sum);
}

function normalCDF(x) {
    return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

function erf(x) {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
}

function getBayesianCellColor(probability, isPrimary) {
    const prob = probability * 100; // Convert to percentage

    if (isPrimary) {
        // Primary metrics thresholds
        if (prob >= 0 && prob <= 5) return '#df4d2d';
        if (prob > 5 && prob <= 15) return '#f0be3c';
        if (prob >= 85 && prob < 95) return '#f0be3c';
        if (prob >= 95 && prob <= 100) return '#52b47e';
    } else {
        // Secondary metrics thresholds
        if (prob >= 0 && prob <= 2) return '#df4d2d';
        if (prob > 2 && prob <= 10) return '#f0be3c';
        if (prob >= 90 && prob < 98) return '#f0be3c';
        if (prob >= 98 && prob <= 100) return '#52b47e';
    }

    return ''; // No highlighting for middle ranges
}

// Make functions available globally
window.Bayesian = {
    calculateBayesianProb,
    getBayesianCellColor
};
