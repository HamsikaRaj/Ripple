// geminiService.js - Gemini API Integration for FairSim Policy Insights

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY; // Replace with your actual API key
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Generate policy recommendations using Gemini AI
 * @param {Object} simulationResults - The simulation results object
 * @param {Object} baselineMetrics - The baseline metrics object
 * @param {Object} policySettings - Current policy settings
 * @returns {Promise<string>} - AI-generated policy recommendation
 */
export const generatePolicyRecommendation = async (simulationResults, baselineMetrics, policySettings) => {
  try {
    const prompt = `You are a policy analysis expert. Analyze the following simulation results and provide a concise policy recommendation (2-3 sentences max).

**Policy Settings:**
- Minimum Wage: $${policySettings.minWage}/hr (baseline: $15/hr)
- Carbon Tax: $${policySettings.carbonTax}/mile/year
- Housing Subsidy: $${policySettings.housingSubsidy}/month
- Income Tax Rate: ${(policySettings.taxRate * 100).toFixed(0)}%
- Education Subsidy: $${policySettings.educationSubsidy}/year
- Transit Subsidy: $${policySettings.transitSubsidy}/year
- EV Incentive: $${policySettings.evIncentive}
- Green Jobs Incentive: ${policySettings.greenJobsIncentive}%

**Results vs Baseline:**
- Average Income: $${(simulationResults.summary.income.mean / 1000).toFixed(1)}k (was $${(baselineMetrics.avgIncome / 1000).toFixed(1)}k) - Change: ${((simulationResults.summary.income.mean - baselineMetrics.avgIncome) / baselineMetrics.avgIncome * 100).toFixed(1)}%
- Gini Coefficient: ${simulationResults.summary.gini.mean.toFixed(3)} (was ${baselineMetrics.giniCoefficient.toFixed(3)}) - Change: ${((simulationResults.summary.gini.mean - baselineMetrics.giniCoefficient) / baselineMetrics.giniCoefficient * 100).toFixed(1)}%
- Employment Rate: ${(simulationResults.summary.employment.mean * 100).toFixed(1)}% (was ${(baselineMetrics.employmentRate * 100).toFixed(1)}%) - Change: ${((simulationResults.summary.employment.mean - baselineMetrics.employmentRate) / baselineMetrics.employmentRate * 100).toFixed(1)}%
- CO2 Emissions: ${(simulationResults.summary.emissions.mean / 1000).toFixed(2)} tons (was ${(baselineMetrics.avgCO2PerCapita / 1000).toFixed(2)} tons) - Change: ${((simulationResults.summary.emissions.mean - baselineMetrics.avgCO2PerCapita) / baselineMetrics.avgCO2PerCapita * 100).toFixed(1)}%
- Rent Burden: ${(simulationResults.summary.rentBurden.mean * 100).toFixed(1)}% (was ${(baselineMetrics.avgRentBurden * 100).toFixed(1)}%) - Change: ${((simulationResults.summary.rentBurden.mean - baselineMetrics.avgRentBurden) / baselineMetrics.avgRentBurden * 100).toFixed(1)}%

**Equity Impact:**
- Most Benefited Income Bracket: ${simulationResults.equityAnalysis.byIncomeBracket[0].bracket} (+${(simulationResults.equityAnalysis.byIncomeBracket[0].avgIncomeChange / 1000).toFixed(1)}k, ${simulationResults.equityAnalysis.byIncomeBracket[0].percentChange.toFixed(1)}%)
- Most Negatively Impacted: ${simulationResults.equityAnalysis.byIncomeBracket[simulationResults.equityAnalysis.byIncomeBracket.length - 1].bracket} (${(simulationResults.equityAnalysis.byIncomeBracket[simulationResults.equityAnalysis.byIncomeBracket.length - 1].avgIncomeChange / 1000).toFixed(1)}k, ${simulationResults.equityAnalysis.byIncomeBracket[simulationResults.equityAnalysis.byIncomeBracket.length - 1].percentChange.toFixed(1)}%)

Provide a balanced assessment highlighting:
1. Main positive impacts
2. Main concerns or trade-offs
3. One specific recommendation to improve outcomes

Keep it concise and actionable.`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Gemini API full response:', JSON.stringify(data, null, 2)); // ADD THIS LINE
    
    // Check for error response
    if (data.error) {
      throw new Error(data.error.message || 'Gemini API error');
    }
    
    // Try multiple response formats
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      
      // Format 1: candidate.content.parts[0].text
      if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
        return candidate.content.parts[0].text;
      }
      
      // Format 2: candidate.text
      if (candidate.text) {
        return candidate.text;
      }
      
      // Format 3: candidate.output
      if (candidate.output) {
        return candidate.output;
      }
    }
    
    // Last resort: check if there's a direct text field
    if (data.text) {
      return data.text;
    }
    
    console.error('Unexpected Gemini API response:', data);
    throw new Error('Unexpected response format from Gemini API');
  } catch (error) {
    console.error('Error generating policy recommendation:', error);
    // Fallback to basic analysis if API fails
    return generateFallbackRecommendation(simulationResults, baselineMetrics);
  }
};

/**
 * Generate equity analysis insights using Gemini AI
 * @param {Object} equityAnalysis - The equity analysis object
 * @param {Object} baselineMetrics - The baseline metrics object
 * @returns {Promise<string>} - AI-generated equity insights
 */
export const generateEquityInsights = async (equityAnalysis, baselineMetrics) => {
  try {
    const prompt = `You are an equity policy analyst. Analyze the following demographic impacts and provide a brief analysis with clear sections.

Format your response like this:
**Overall Assessment:** [1-2 sentences on whether policy is progressive/regressive]

**Income Disparities:** [Key findings about income bracket impacts]

**Recommendation:** [One specific suggestion to improve equity]

Keep it concise - about 4-5 sentences total.

**Impact by Income Bracket:**
${equityAnalysis.byIncomeBracket.map(item => 
  `- ${item.bracket}: ${item.avgIncomeChange > 0 ? '+' : ''}$${(item.avgIncomeChange / 1000).toFixed(1)}k (${item.percentChange.toFixed(1)}%)`
).join('\n')}

**Impact by Employment Sector:**
${equityAnalysis.bySector.map(item => 
  `- ${item.sector}: ${item.avgIncomeChange > 0 ? '+' : ''}$${(item.avgIncomeChange / 1000).toFixed(1)}k (${item.percentChange.toFixed(1)}%)`
).join('\n')}

Focus on: 1) Which groups benefit most/least, 2) Any concerning disparities, 3) Whether the policy is progressive or regressive overall.`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 512,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Gemini API full response:', JSON.stringify(data, null, 2)); // ADD THIS LINE
    
    // Check for error response
    if (data.error) {
      throw new Error(data.error.message || 'Gemini API error');
    }
    
    // Try multiple response formats
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      
      // Format 1: candidate.content.parts[0].text
      if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
        return candidate.content.parts[0].text;
      }
      
      // Format 2: candidate.text
      if (candidate.text) {
        return candidate.text;
      }
      
      // Format 3: candidate.output
      if (candidate.output) {
        return candidate.output;
      }
    }
    
    // Last resort: check if there's a direct text field
    if (data.text) {
      return data.text;
    }
    
    console.error('Unexpected Gemini API response:', data);
    throw new Error('Unexpected response format from Gemini API');
  } catch (error) {
    console.error('Error generating equity insights:', error);
    return generateFallbackEquityInsights(equityAnalysis);
  }
};

/**
 * Generate environmental impact summary using Gemini AI
 * @param {Object} simulationResults - The simulation results object
 * @param {Object} baselineMetrics - The baseline metrics object
 * @param {Object} policySettings - Current policy settings
 * @returns {Promise<string>} - AI-generated environmental insights
 */
export const generateEnvironmentalInsights = async (simulationResults, baselineMetrics, policySettings) => {
  try {
    const emissionsChange = ((simulationResults.summary.emissions.mean - baselineMetrics.avgCO2PerCapita) / baselineMetrics.avgCO2PerCapita * 100).toFixed(1);
    const energyChange = ((simulationResults.summary.energyUse.mean - baselineMetrics.avgEnergyUse) / baselineMetrics.avgEnergyUse * 100).toFixed(1);

    const prompt = `As an environmental policy analyst, provide a brief 2-sentence assessment of these environmental impacts:

**Emissions:** ${emissionsChange}% change (now ${(simulationResults.summary.emissions.mean / 1000).toFixed(2)} tons CO2/person/year)
**Energy Use:** ${energyChange}% change (now ${simulationResults.summary.energyUse.mean.toFixed(0)} kWh/month)

**Policy Factors:**
- Carbon Tax: $${policySettings.carbonTax}/mile/year
- Transit Subsidy: $${policySettings.transitSubsidy}/year
- EV Incentive: $${policySettings.evIncentive}
- Green Jobs Incentive: ${policySettings.greenJobsIncentive}%

Highlight: 1) Overall environmental impact, 2) Most effective policy lever.`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 256,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Gemini API full response:', JSON.stringify(data, null, 2)); // ADD THIS LINE
    // Check for error response
    if (data.error) {
      throw new Error(data.error.message || 'Gemini API error');
    }
    
    // Try multiple response formats
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      
      // Format 1: candidate.content.parts[0].text
      if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
        return candidate.content.parts[0].text;
      }
      
      // Format 2: candidate.text
      if (candidate.text) {
        return candidate.text;
      }
      
      // Format 3: candidate.output
      if (candidate.output) {
        return candidate.output;
      }
    }
    
    // Last resort: check if there's a direct text field
    if (data.text) {
      return data.text;
    }
    
    console.error('Unexpected Gemini API response:', data);
    throw new Error('Unexpected response format from Gemini API');
  } catch (error) {
    console.error('Error generating environmental insights:', error);
    return generateFallbackEnvironmentalInsights(simulationResults, baselineMetrics);
  }
};

// ==================== FALLBACK FUNCTIONS ====================

/**
 * Fallback recommendation if API fails
 */
const generateFallbackRecommendation = (simulationResults, baselineMetrics) => {
  const giniChange = simulationResults.summary.gini.mean - baselineMetrics.giniCoefficient;
  const incomeChange = simulationResults.summary.income.mean - baselineMetrics.avgIncome;
  const emissionsChange = simulationResults.summary.emissions.mean - baselineMetrics.avgCO2PerCapita;

  if (giniChange > 0.01) {
    return `This policy combination increases inequality by ${((giniChange / baselineMetrics.giniCoefficient) * 100).toFixed(1)}%. Consider adding progressive measures like higher housing subsidies or education programs to offset regressive effects.`;
  } else if (incomeChange < -1000) {
    return `While inequality improves, average income declines by $${Math.abs(incomeChange / 1000).toFixed(1)}k. Consider balancing wage policies with employment support to maintain income levels.`;
  } else if (emissionsChange < -500) {
    return `This policy shows strong environmental benefits with ${((Math.abs(emissionsChange) / baselineMetrics.avgCO2PerCapita) * 100).toFixed(1)}% emissions reduction, while maintaining economic stability. Consider scaling up green incentives further.`;
  } else {
    return `This policy combination shows positive results with income increasing to $${(simulationResults.summary.income.mean / 1000).toFixed(1)}k and inequality decreasing by ${((baselineMetrics.giniCoefficient - simulationResults.summary.gini.mean) / baselineMetrics.giniCoefficient * 100).toFixed(1)}%. The trade-offs appear balanced.`;
  }
};

/**
 * Fallback equity insights if API fails
 */
const generateFallbackEquityInsights = (equityAnalysis) => {
  const topBracket = equityAnalysis.byIncomeBracket[0];
  const bottomBracket = equityAnalysis.byIncomeBracket[equityAnalysis.byIncomeBracket.length - 1];
  
  if (topBracket.percentChange < bottomBracket.percentChange) {
    return `Higher income groups benefit more (+${topBracket.percentChange.toFixed(1)}% for ${topBracket.bracket}) compared to lower income groups (${bottomBracket.percentChange.toFixed(1)}% for ${bottomBracket.bracket}), suggesting regressive impacts. Consider strengthening progressive measures.`;
  } else {
    return `Lower income groups see greater relative benefits (+${topBracket.percentChange.toFixed(1)}% for ${topBracket.bracket}), indicating progressive policy outcomes. The policy effectively targets those most in need.`;
  }
};

/**
 * Fallback environmental insights if API fails
 */
const generateFallbackEnvironmentalInsights = (simulationResults, baselineMetrics) => {
  const emissionsChange = ((simulationResults.summary.emissions.mean - baselineMetrics.avgCO2PerCapita) / baselineMetrics.avgCO2PerCapita * 100);
  
  if (emissionsChange < -10) {
    return `Emissions decrease significantly by ${Math.abs(emissionsChange).toFixed(1)}%, demonstrating strong environmental benefits. Transit and EV incentives are working effectively to shift commuter behavior.`;
  } else if (emissionsChange > 5) {
    return `Emissions increase by ${emissionsChange.toFixed(1)}%, suggesting environmental policies need strengthening. Consider increasing carbon taxes or transit subsidies to drive cleaner transportation choices.`;
  } else {
    return `Emissions remain relatively stable with ${Math.abs(emissionsChange).toFixed(1)}% change. Additional environmental incentives may be needed to achieve meaningful emission reductions.`;
  }
};

export default {
  generatePolicyRecommendation,
  generateEquityInsights,
  generateEnvironmentalInsights
};