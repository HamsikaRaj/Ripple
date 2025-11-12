import React, { useState, useEffect } from 'react';
import { BarChart, Bar, ScatterChart, Scatter, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Users, DollarSign, Home, TrendingUp, AlertCircle, PlayCircle, RefreshCw, Leaf, Car, GraduationCap, Building2, MapPin, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';
import './App.css';

import { generatePolicyRecommendation, generateEquityInsights, generateEnvironmentalInsights } from './geminiService';

const FairSimExplorer = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Policy Controls
  const [minWage, setMinWage] = useState(15);
  const [carbonTax, setCarbonTax] = useState(0);
  const [housingSubsidy, setHousingSubsidy] = useState(0);
  const [taxRate, setTaxRate] = useState(0.22);
  const [educationSubsidy, setEducationSubsidy] = useState(0);
  const [transitSubsidy, setTransitSubsidy] = useState(0);
  const [evIncentive, setEVIncentive] = useState(0);
  const [greenJobsIncentive, setGreenJobsIncentive] = useState(0);
  
  const [simulating, setSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationResults, setSimulationResults] = useState(null);
  const [monteCarloRuns, setMonteCarloRuns] = useState(100);
  const [baselineMetrics, setBaselineMetrics] = useState(null);

  // 🆕 ADD THESE THREE STATE VARIABLES
  const [aiPolicyRecommendation, setAiPolicyRecommendation] = useState(null);
  const [aiEquityInsights, setAiEquityInsights] = useState(null);
  const [aiEnvironmentalInsights, setAiEnvironmentalInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // ==================== HELPER FUNCTIONS (defined first) ====================
  
  const calculateGini = (incomes) => {
    const sorted = [...incomes].sort((a, b) => a - b);
    const n = sorted.length;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += (2 * (i + 1) - n - 1) * sorted[i];
    }
    const totalIncome = sorted.reduce((a, b) => a + b, 0);
    return totalIncome > 0 ? sum / (n * totalIncome) : 0;
  };

  const calculateDistribution = (data, ...fields) => {
    const counts = {};
    data.forEach(person => {
      let value = 'Unknown';
      for (const field of fields) {
        if (person[field]) {
          value = person[field];
          break;
        }
      }
      counts[value] = (counts[value] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const calculateIncomeBrackets = (incomes) => {
    const brackets = {
      'Under $25k': 0,
      '$25k-$50k': 0,
      '$50k-$75k': 0,
      '$75k-$100k': 0,
      'Over $100k': 0
    };
    
    incomes.forEach(income => {
      if (income < 25000) brackets['Under $25k']++;
      else if (income < 50000) brackets['$25k-$50k']++;
      else if (income < 75000) brackets['$50k-$75k']++;
      else if (income < 100000) brackets['$75k-$100k']++;
      else brackets['Over $100k']++;
    });
    
    return Object.entries(brackets).map(([name, value]) => ({ name, value }));
  };

  const calculatePersonEmissions = (person) => {
    const commuteDistance = person.Commute_Distance || person.commute_distance || 10;
    const commuteMode = (person.Commute_Mode || person.commute_mode || 'Drive').toLowerCase();
    
    const emissionFactors = {
      'drive': 0.4,
      'car': 0.4,
      'transit': 0.15,
      'public transit': 0.15,
      'bike': 0,
      'walk': 0,
      'ev': 0.1
    };
    
    return commuteDistance * (emissionFactors[commuteMode] || 0.4) * 250;
  };

  const calculateAvgCommuteEmissions = (data) => {
    return data.reduce((sum, person) => {
      return sum + calculatePersonEmissions(person);
    }, 0) / data.length;
  };

  const calculateTotalEmissions = (data) => {
    return data.reduce((sum, person) => {
      return sum + calculatePersonEmissions(person);
    }, 0);
  };

  // ==================== VEHICLE OWNERSHIP CHECKER ====================
  
  const getVehicleOwnership = (person, defaultValue = false) => {
    // ✅ FIXED: Check for Vehicle_Own column (your column name!)
    const ownership = person.Vehicle_Own || person.vehicle_own ||
                     person.Vehicle_Ownership || person.vehicle_ownership || 
                     person.Vehic_Own || person.vehic_own || 
                     person.VehicleOwnership || person.vehicleownership || 
                     person.Own_Vehicle || person.own_vehicle || 
                     person.Car_Ownership || person.car_ownership ||
                     person.Has_Vehicle || person.has_vehicle ||
                     person.Owns_Car || person.owns_car;
    
    // If no column found, return default
    if (ownership === undefined || ownership === null) {
      return defaultValue;
    }
    
    // Handle multiple formats: "Yes", "yes", "Y", "y", 1, true
    const ownStr = String(ownership).toLowerCase().trim();
    return (ownStr === 'yes' || ownStr === 'y' || ownStr === '1' || 
            ownStr === 'true' || ownership === 1 || ownership === true);
  };

  // ==================== FILE UPLOAD ====================
  
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) {
      console.log('❌ No file selected');
      return;
    }

    console.log('📁 File selected:', file.name);
    setLoading(true);
    setError(null);
    
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        console.log('📖 Reading file...');
        const arrayBuffer = e.target.result;
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('No sheets found in Excel file');
        }
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        console.log('✅ Data parsed successfully');
        console.log('   - Rows:', jsonData.length);
        console.log('   - Sample row:', jsonData[0]);
        console.log('   - Available columns:', Object.keys(jsonData[0] || {}));
        
        if (!jsonData || jsonData.length === 0) {
          throw new Error('Excel file is empty or has no data rows');
        }
        
        // Set data first
        setData(jsonData);
        console.log('✅ Data state updated');
        
        // Then calculate baseline metrics
        try {
          calculateBaselineMetrics(jsonData);
          console.log('✅ Baseline metrics calculated');
        } catch (metricsError) {
          console.error('❌ Error calculating baseline metrics:', metricsError);
          setError(`Error calculating metrics: ${metricsError.message}`);
        }
        
        setLoading(false);
        
      } catch (err) {
        console.error('❌ Error loading file:', err);
        setError(`Failed to load file: ${err.message}`);
        setData(null);
        setBaselineMetrics(null);
        setLoading(false);
      }
    };

    reader.onerror = () => {
      console.error('❌ FileReader error');
      setError('Failed to read file - file may be corrupted');
      setData(null);
      setBaselineMetrics(null);
      setLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // ==================== BASELINE METRICS CALCULATION ====================
  
  const calculateBaselineMetrics = (populationData) => {
    console.log('🔢 Calculating baseline metrics for', populationData.length, 'people...');
    
    try {
      const incomes = populationData.map(p => p.Income || p.income || 30000);
      const rents = populationData.map(p => p.Rent || p.rent || 1200);
      const employed = populationData.filter(p => p.Employed !== false && p.employed !== false);
      
      // Calculate group-specific baseline incomes for accurate percentage changes
      const baselineByRace = {};
      const baselineByCounty = {};
      const baselineBySector = {};
      const baselineByEducation = {};
      const baselineByIncomeBracket = {
        'Under $25k': { totalIncome: 0, count: 0 },
        '$25k-$50k': { totalIncome: 0, count: 0 },
        '$50k-$75k': { totalIncome: 0, count: 0 },
        '$75k-$100k': { totalIncome: 0, count: 0 },
        'Over $100k': { totalIncome: 0, count: 0 }
      };
      
      populationData.forEach(person => {
        const income = person.Income || person.income || 30000;
        const race = person.Race_Ethnicity || person.race_ethnicity || person.Race || person.race || 'Unknown';
        const county = person.County || person.county || 'Unknown';
        const sector = person.Employment_Sector || person.employment_sector || 'Unknown';
        const education = person.Education_Level || person.education_level || 'High School';
        
        // By Race
        if (!baselineByRace[race]) {
          baselineByRace[race] = { totalIncome: 0, count: 0 };
        }
        baselineByRace[race].totalIncome += income;
        baselineByRace[race].count++;
        
        // By County
        if (!baselineByCounty[county]) {
          baselineByCounty[county] = { totalIncome: 0, count: 0 };
        }
        baselineByCounty[county].totalIncome += income;
        baselineByCounty[county].count++;
        
        // By Sector
        if (!baselineBySector[sector]) {
          baselineBySector[sector] = { totalIncome: 0, count: 0 };
        }
        baselineBySector[sector].totalIncome += income;
        baselineBySector[sector].count++;
        
        // By Education
        if (!baselineByEducation[education]) {
          baselineByEducation[education] = { totalIncome: 0, count: 0 };
        }
        baselineByEducation[education].totalIncome += income;
        baselineByEducation[education].count++;
        
        // By Income Bracket
        if (income < 25000) {
          baselineByIncomeBracket['Under $25k'].totalIncome += income;
          baselineByIncomeBracket['Under $25k'].count++;
        } else if (income < 50000) {
          baselineByIncomeBracket['$25k-$50k'].totalIncome += income;
          baselineByIncomeBracket['$25k-$50k'].count++;
        } else if (income < 75000) {
          baselineByIncomeBracket['$50k-$75k'].totalIncome += income;
          baselineByIncomeBracket['$50k-$75k'].count++;
        } else if (income < 100000) {
          baselineByIncomeBracket['$75k-$100k'].totalIncome += income;
          baselineByIncomeBracket['$75k-$100k'].count++;
        } else {
          baselineByIncomeBracket['Over $100k'].totalIncome += income;
          baselineByIncomeBracket['Over $100k'].count++;
        }
      });
      
      // Calculate average incomes for each group
      const avgIncomeByRace = {};
      Object.keys(baselineByRace).forEach(race => {
        avgIncomeByRace[race] = baselineByRace[race].totalIncome / baselineByRace[race].count;
      });
      
      const avgIncomeByCounty = {};
      Object.keys(baselineByCounty).forEach(county => {
        avgIncomeByCounty[county] = baselineByCounty[county].totalIncome / baselineByCounty[county].count;
      });
      
      const avgIncomeBySector = {};
      Object.keys(baselineBySector).forEach(sector => {
        avgIncomeBySector[sector] = baselineBySector[sector].totalIncome / baselineBySector[sector].count;
      });
      
      const avgIncomeByEducation = {};
      Object.keys(baselineByEducation).forEach(education => {
        avgIncomeByEducation[education] = baselineByEducation[education].totalIncome / baselineByEducation[education].count;
      });
      
      const avgIncomeByBracket = {};
      Object.keys(baselineByIncomeBracket).forEach(bracket => {
        if (baselineByIncomeBracket[bracket].count > 0) {
          avgIncomeByBracket[bracket] = baselineByIncomeBracket[bracket].totalIncome / baselineByIncomeBracket[bracket].count;
        }
      });
      
      const baseline = {
        // Economic Variables
        avgIncome: incomes.reduce((a, b) => a + b, 0) / incomes.length,
        medianIncome: [...incomes].sort((a, b) => a - b)[Math.floor(incomes.length / 2)],
        avgDisposableIncome: incomes.reduce((a, b) => a + b * (1 - 0.22), 0) / incomes.length,
        avgRent: rents.reduce((a, b) => a + b, 0) / rents.length,
        avgRentBurden: populationData.reduce((sum, p) => {
          const income = p.Income || p.income || 30000;
          const rent = p.Rent || p.rent || 1200;
          return sum + (rent * 12 / income);
        }, 0) / populationData.length,
        giniCoefficient: calculateGini(incomes),
        employmentRate: employed.length / populationData.length,
        povertyRate: incomes.filter(i => i < 25000).length / incomes.length,
        
        // Behavioral Variables
        commuteModeDist: calculateDistribution(populationData, 'Commute_Mode', 'commute_mode'),
        vehicleOwnershipRate: (() => {
          let ownCount = 0;
          let withDataCount = 0;
          
          populationData.forEach(p => {
            const hasVehicle = getVehicleOwnership(p, null); // null = "no data"
            
            if (hasVehicle !== null) {
              withDataCount++;
              if (hasVehicle) {
                ownCount++;
              }
            }
          });
          
          // If no one has vehicle data, assume 80% ownership (US average)
          if (withDataCount === 0) {
            console.log('⚠️ No vehicle ownership column found - using 80% default');
            return 0.80;
          }
          
          const rate = ownCount / withDataCount;
          console.log(`🚗 Vehicle Ownership: ${ownCount} / ${withDataCount} = ${(rate * 100).toFixed(1)}%`);
          return rate;
        })(),
        avgCommuteEmissions: calculateAvgCommuteEmissions(populationData),
        avgRentPaid: populationData.reduce((sum, p) => 
          sum + (p.Rent_Paid || p.rent_paid || p.Rent || p.rent || 1200), 0
        ) / populationData.length,
        avgEnergyUse: populationData.reduce((sum, p) => 
          sum + (p.Energy_Use || p.energy_use || 100), 0
        ) / populationData.length,
        
        // Demographic Variables
        avgHouseholdSize: populationData.reduce((sum, p) => 
          sum + (p.Household_Size || p.household_size || 2), 0
        ) / populationData.length,
        educationDist: calculateDistribution(populationData, 'Education_Level', 'education_level'),
        incomeBracketDist: calculateIncomeBrackets(incomes),
        
        // Environmental Variables
        totalCO2Emissions: calculateTotalEmissions(populationData),
        avgCO2PerCapita: calculateTotalEmissions(populationData) / populationData.length,
        
        // Employment Sectors
        sectorDist: calculateDistribution(populationData, 'Employment_Sector', 'employment_sector'),
        
        // Equity Analysis
        raceDistribution: calculateDistribution(populationData, 'Race_Ethnicity', 'race_ethnicity', 'Race', 'race'),
        countyDistribution: calculateDistribution(populationData, 'County', 'county'),
        
        // Group-specific baseline incomes (for accurate percentage calculations)
        avgIncomeByRace,
        avgIncomeByCounty,
        avgIncomeBySector,
        avgIncomeByEducation,
        avgIncomeByBracket,
        
        // Total population
        totalPopulation: populationData.length
      };
      
      setBaselineMetrics(baseline);
      console.log('✅ Baseline metrics set:', {
        avgIncome: baseline.avgIncome.toFixed(0),
        gini: baseline.giniCoefficient.toFixed(3),
        employmentRate: (baseline.employmentRate * 100).toFixed(1) + '%'
      });
      
      return baseline;
    } catch (error) {
      console.error('❌ Error in calculateBaselineMetrics:', error);
      throw error;
    }
  };

  // ==================== MONTE CARLO SIMULATION ====================
  
  const runMonteCarloSimulation = () => {
    console.log('🎲 Starting Monte Carlo simulation...');
    console.log('   - Data available:', !!data);
    console.log('   - Baseline metrics available:', !!baselineMetrics);
    
    if (!data || data.length === 0) {
      alert('Please upload data first. No population data loaded.');
      console.error('❌ No data available');
      return;
    }
    
    if (!baselineMetrics) {
      console.warn('⚠️ Baseline metrics not available, recalculating...');
      try {
        calculateBaselineMetrics(data);
        // Give it a moment for state to update
        setTimeout(() => runMonteCarloSimulation(), 100);
        return;
      } catch (error) {
        alert('Error calculating baseline metrics. Please reload the data.');
        console.error('❌ Failed to calculate baseline metrics:', error);
        return;
      }
    }
    
        setSimulating(true);
    setSimulationProgress(0);
    // 🆕 ADD THESE THREE LINES
    setAiPolicyRecommendation(null);
    setAiEquityInsights(null);
    setAiEnvironmentalInsights(null);
    console.log(`🎲 Running ${monteCarloRuns} simulations...`);
    
    // ✅ NEW: Run simulation in chunks to keep UI responsive
    const results = [];
    const detailedResults = {
      byRace: {},
      byCounty: {},
      byIncomeBracket: {},
      bySector: {},
      byEducation: {}
    };
    
    let currentRun = 0;
    const CHUNK_SIZE = 10; // Process 10 runs at a time
    
    const processChunk = () => {
      const startRun = currentRun;
      const endRun = Math.min(currentRun + CHUNK_SIZE, monteCarloRuns);
      
      try {
        for (let run = startRun; run < endRun; run++) {
          // Randomized elasticity parameters
          const wageElasticity = 0.7 + (Math.random() * 0.6);
          const rentElasticity = 0.02 + (Math.random() * 0.04);
          const employmentElasticity = -0.03 + (Math.random() * 0.02);
          const transitShiftProb = transitSubsidy > 0 ? 0.1 + (transitSubsidy / 500) * 0.3 : 0;
          const evAdoptionProb = evIncentive > 0 ? 0.05 + (evIncentive / 5000) * 0.2 : 0;
          const educationEffectiveness = 0.8 + (Math.random() * 0.4);
          const sectorShiftProb = greenJobsIncentive > 0 ? 0.05 + (greenJobsIncentive / 100) * 0.15 : 0;
          
          const simulatedData = data.map(person => {
            // Extract baseline person data
            let newIncome = person.Income || person.income || 30000;
            let newRent = person.Rent || person.rent || 1200;
            let employed = person.Employed !== false && person.employed !== false;
            let commuteMode = (person.Commute_Mode || person.commute_mode || 'Drive').toLowerCase();
            
            // ✅ FIXED: Use consistent vehicle ownership function
            let vehicleOwnership = getVehicleOwnership(person, baselineMetrics.vehicleOwnershipRate > 0.5);
            
            let educationLevel = person.Education_Level || person.education_level || 'High School';
            let employmentSector = person.Employment_Sector || person.employment_sector || 'Retail';
            let householdSize = person.Household_Size || person.household_size || 2;
            const commuteDistance = person.Commute_Distance || person.commute_distance || 10;
            const race = person.Race_Ethnicity || person.race_ethnicity || person.Race || person.race || 'Unknown';
            const county = person.County || person.county || 'Unknown';
            const originalRentPaid = person.Rent_Paid || person.rent_paid || person.Rent || person.rent || 1200;
            const originalEnergyUse = person.Energy_Use || person.energy_use || 100;
            
            // 1. MINIMUM WAGE EFFECT
            if (newIncome < minWage * 2080) {
              const wageIncrease = (minWage - 15) / 15;
              newIncome = newIncome * (1 + wageIncrease * wageElasticity);
            }
            
            // 2. EDUCATION SUBSIDY EFFECT
            if (educationSubsidy > 0 && Math.random() < (educationSubsidy / 1000) * educationEffectiveness) {
              if (educationLevel === 'High School') {
                educationLevel = 'Some College';
                newIncome *= 1.15;
              } else if (educationLevel === 'Some College') {
                educationLevel = 'Bachelor';
                newIncome *= 1.25;
              }
            }
            
            // 3. GREEN JOBS INCENTIVE
            if (greenJobsIncentive > 0 && Math.random() < sectorShiftProb) {
              if (employmentSector !== 'Green Energy' && employmentSector !== 'Tech') {
                employmentSector = Math.random() < 0.5 ? 'Green Energy' : 'Tech';
                newIncome *= 1.1;
              }
            }
            
            // 4. RENT INCREASE
            newRent = newRent * (1 + ((minWage - 15) / 15) * rentElasticity);
            
            // 5. HOUSING SUBSIDY
            if (housingSubsidy > 0 && newIncome < 50000) {
              newRent = Math.max(0, newRent - housingSubsidy);
            }
            
            // 6. EMPLOYMENT EFFECT
            if (Math.random() < Math.abs(employmentElasticity * (minWage - 15) / 15)) {
              employed = false;
              newIncome *= 0.3;
            }
            
            // 7. TAX EFFECT
            const disposableIncome = newIncome * (1 - taxRate);
            
            // 8. TRANSIT SUBSIDY
            if (transitSubsidy > 0 && commuteMode === 'drive' && Math.random() < transitShiftProb) {
              commuteMode = 'transit';
            }
            
            // 9. EV INCENTIVE
            if (evIncentive > 0 && commuteMode === 'drive' && Math.random() < evAdoptionProb) {
              commuteMode = 'ev';
              vehicleOwnership = true;
            }
            
            // 10. CARBON TAX COST
            const carbonCost = carbonTax * commuteDistance * 0.4;
            const adjustedIncome = newIncome - carbonCost * 250;
            
            // 11. ENERGY USE CHANGES
            let newEnergyUse = originalEnergyUse;
            const incomeEnergyFactor = Math.min(1.3, 0.8 + (adjustedIncome / 100000) * 0.5);
            newEnergyUse *= incomeEnergyFactor;
            newEnergyUse *= (1 + (householdSize - 2) * 0.15);
            
            if (commuteMode === 'ev') {
              newEnergyUse += commuteDistance * 0.3 * 30;
            }
            
            if (employmentSector === 'Green Energy' && Math.random() < 0.3) {
              newEnergyUse *= 0.93;
            }
            
            // 12. NEW EMISSIONS
            const emissionFactors = {
              'drive': 0.4,
              'car': 0.4,
              'transit': 0.15,
              'public transit': 0.15,
              'bike': 0,
              'walk': 0,
              'ev': 0.1
            };
            const newCommuteEmissions = commuteDistance * (emissionFactors[commuteMode] || 0.4) * 250;
            const rentBurden = (newRent * 12) / adjustedIncome;
            
            // Store detailed results by demographic groups
            const incomeChange = adjustedIncome - (person.Income || person.income || 30000);
            
            // By Race
            if (!detailedResults.byRace[race]) {
              detailedResults.byRace[race] = { totalIncomeChange: 0, count: 0 };
            }
            detailedResults.byRace[race].totalIncomeChange += incomeChange;
            detailedResults.byRace[race].count++;
            
            // By County
            if (!detailedResults.byCounty[county]) {
              detailedResults.byCounty[county] = { totalIncomeChange: 0, count: 0 };
            }
            detailedResults.byCounty[county].totalIncomeChange += incomeChange;
            detailedResults.byCounty[county].count++;
            
            // By Income Bracket
            const originalIncome = person.Income || person.income || 30000;
            let bracket;
            if (originalIncome < 25000) bracket = 'Under $25k';
            else if (originalIncome < 50000) bracket = '$25k-$50k';
            else if (originalIncome < 75000) bracket = '$50k-$75k';
            else if (originalIncome < 100000) bracket = '$75k-$100k';
            else bracket = 'Over $100k';
            
            if (!detailedResults.byIncomeBracket[bracket]) {
              detailedResults.byIncomeBracket[bracket] = { totalIncomeChange: 0, count: 0 };
            }
            detailedResults.byIncomeBracket[bracket].totalIncomeChange += incomeChange;
            detailedResults.byIncomeBracket[bracket].count++;
            
            // By Sector
            if (!detailedResults.bySector[employmentSector]) {
              detailedResults.bySector[employmentSector] = { totalIncomeChange: 0, count: 0 };
            }
            detailedResults.bySector[employmentSector].totalIncomeChange += incomeChange;
            detailedResults.bySector[employmentSector].count++;
            
            // By Education
            if (!detailedResults.byEducation[educationLevel]) {
              detailedResults.byEducation[educationLevel] = { totalIncomeChange: 0, count: 0 };
            }
            detailedResults.byEducation[educationLevel].totalIncomeChange += incomeChange;
            detailedResults.byEducation[educationLevel].count++;
            
            return {
              ...person,
              newIncome: adjustedIncome,
              newRent,
              employed,
              commuteMode,
              vehicleOwnership,
              educationLevel,
              employmentSector,
              householdSize,
              commuteEmissions: newCommuteEmissions,
              disposableIncome,
              rentBurden,
              energyUse: newEnergyUse
            };
          });
          
          // Calculate metrics for this run
          const incomes = simulatedData.map(p => p.newIncome);
          const rents = simulatedData.map(p => p.newRent);
          const employed = simulatedData.filter(p => p.employed);
          const avgRentPaid = simulatedData.reduce((sum, p) => sum + p.newRent, 0) / simulatedData.length;
          const avgRentBurden = simulatedData.reduce((sum, p) => sum + p.rentBurden, 0) / simulatedData.length;
          const avgEnergyUse = simulatedData.reduce((sum, p) => sum + p.energyUse, 0) / simulatedData.length;
          
          results.push({
            run: run + 1,
            avgIncome: incomes.reduce((a, b) => a + b, 0) / incomes.length,
            avgDisposableIncome: simulatedData.reduce((sum, p) => sum + p.disposableIncome, 0) / simulatedData.length,
            gini: calculateGini(incomes),
            employmentRate: employed.length / simulatedData.length,
            avgRent: rents.reduce((a, b) => a + b, 0) / rents.length,
            avgRentPaid,
            avgRentBurden,
            avgEmissions: simulatedData.reduce((sum, p) => sum + p.commuteEmissions, 0) / simulatedData.length,
            avgEnergyUse
          });
        }
        
        currentRun = endRun;
        const progress = (currentRun / monteCarloRuns) * 100;
        setSimulationProgress(progress);
        
        // ✅ Continue processing or finish
        if (currentRun < monteCarloRuns) {
          setTimeout(processChunk, 0); // Schedule next chunk (keeps UI responsive!)
        } else {
          finishSimulation();
        }
      } catch (error) {
        console.error('❌ Error during simulation chunk:', error);
        setError(`Simulation error: ${error.message}`);
        setSimulating(false);
        setSimulationProgress(0);
      }
    };
    
    const finishSimulation = () => {
      try {
        // Calculate summary statistics
        const ci95Lower = Math.floor(monteCarloRuns * 0.025);
        const ci95Upper = Math.floor(monteCarloRuns * 0.975);
        
        const sortedIncome = results.map(r => r.avgIncome).sort((a, b) => a - b);
        const sortedDisposableIncome = results.map(r => r.avgDisposableIncome).sort((a, b) => a - b);
        const sortedGini = results.map(r => r.gini).sort((a, b) => a - b);
        const sortedEmployment = results.map(r => r.employmentRate).sort((a, b) => a - b);
        const sortedRent = results.map(r => r.avgRent).sort((a, b) => a - b);
        const sortedRentPaid = results.map(r => r.avgRentPaid).sort((a, b) => a - b);
        const sortedRentBurden = results.map(r => r.avgRentBurden).sort((a, b) => a - b);
        const sortedEmissions = results.map(r => r.avgEmissions).sort((a, b) => a - b);
        const sortedEnergyUse = results.map(r => r.avgEnergyUse).sort((a, b) => a - b);
        
        // Calculate equity analysis
        const raceImpact = Object.keys(detailedResults.byRace).map(race => {
          const avgChange = detailedResults.byRace[race].totalIncomeChange / detailedResults.byRace[race].count;
          const baselineIncome = baselineMetrics.avgIncomeByRace[race] || baselineMetrics.avgIncome;
          return {
            race,
            avgIncomeChange: avgChange,
            baselineIncome,
            percentChange: (avgChange / baselineIncome) * 100
          };
        }).sort((a, b) => b.avgIncomeChange - a.avgIncomeChange);
        
        const countyImpact = Object.keys(detailedResults.byCounty).map(county => {
          const avgChange = detailedResults.byCounty[county].totalIncomeChange / detailedResults.byCounty[county].count;
          const baselineIncome = baselineMetrics.avgIncomeByCounty[county] || baselineMetrics.avgIncome;
          return {
            county,
            avgIncomeChange: avgChange,
            baselineIncome,
            percentChange: (avgChange / baselineIncome) * 100
          };
        }).sort((a, b) => b.avgIncomeChange - a.avgIncomeChange);
        
        const incomeBracketImpact = Object.keys(detailedResults.byIncomeBracket).map(bracket => {
          const avgChange = detailedResults.byIncomeBracket[bracket].totalIncomeChange / detailedResults.byIncomeBracket[bracket].count;
          const baselineIncome = baselineMetrics.avgIncomeByBracket[bracket] || baselineMetrics.avgIncome;
          return {
            bracket,
            avgIncomeChange: avgChange,
            baselineIncome,
            percentChange: (avgChange / baselineIncome) * 100
          };
        }).sort((a, b) => b.avgIncomeChange - a.avgIncomeChange);
        
        const sectorImpact = Object.keys(detailedResults.bySector).map(sector => {
          const avgChange = detailedResults.bySector[sector].totalIncomeChange / detailedResults.bySector[sector].count;
          const baselineIncome = baselineMetrics.avgIncomeBySector[sector] || baselineMetrics.avgIncome;
          return {
            sector,
            avgIncomeChange: avgChange,
            baselineIncome,
            percentChange: (avgChange / baselineIncome) * 100
          };
        }).sort((a, b) => b.avgIncomeChange - a.avgIncomeChange);
        
        const educationImpact = Object.keys(detailedResults.byEducation).map(education => {
          const avgChange = detailedResults.byEducation[education].totalIncomeChange / detailedResults.byEducation[education].count;
          const baselineIncome = baselineMetrics.avgIncomeByEducation[education] || baselineMetrics.avgIncome;
          return {
            education,
            avgIncomeChange: avgChange,
            baselineIncome,
            percentChange: (avgChange / baselineIncome) * 100
          };
        }).sort((a, b) => b.avgIncomeChange - a.avgIncomeChange);
        
        const simulationSummary = {
          runs: results,
          summary: {
            gini: {
              mean: results.reduce((a, b) => a + b.gini, 0) / monteCarloRuns,
              ci95: [sortedGini[ci95Lower], sortedGini[ci95Upper]]
            },
            income: {
              mean: results.reduce((a, b) => a + b.avgIncome, 0) / monteCarloRuns,
              ci95: [sortedIncome[ci95Lower], sortedIncome[ci95Upper]]
            },
            disposableIncome: {
              mean: results.reduce((a, b) => a + b.avgDisposableIncome, 0) / monteCarloRuns,
              ci95: [sortedDisposableIncome[ci95Lower], sortedDisposableIncome[ci95Upper]]
            },
            employment: {
              mean: results.reduce((a, b) => a + b.employmentRate, 0) / monteCarloRuns,
              ci95: [sortedEmployment[ci95Lower], sortedEmployment[ci95Upper]]
            },
            rent: {
              mean: results.reduce((a, b) => a + b.avgRent, 0) / monteCarloRuns,
              ci95: [sortedRent[ci95Lower], sortedRent[ci95Upper]]
            },
            rentPaid: {
              mean: results.reduce((a, b) => a + b.avgRentPaid, 0) / monteCarloRuns,
              ci95: [sortedRentPaid[ci95Lower], sortedRentPaid[ci95Upper]]
            },
            rentBurden: {
              mean: results.reduce((a, b) => a + b.avgRentBurden, 0) / monteCarloRuns,
              ci95: [sortedRentBurden[ci95Lower], sortedRentBurden[ci95Upper]]
            },
            emissions: {
              mean: results.reduce((a, b) => a + b.avgEmissions, 0) / monteCarloRuns,
              ci95: [sortedEmissions[ci95Lower], sortedEmissions[ci95Upper]]
            },
            energyUse: {
              mean: results.reduce((a, b) => a + b.avgEnergyUse, 0) / monteCarloRuns,
              ci95: [sortedEnergyUse[ci95Lower], sortedEnergyUse[ci95Upper]]
            }
          },
          equityAnalysis: {
            byRace: raceImpact,
            byCounty: countyImpact,
            byIncomeBracket: incomeBracketImpact,
            bySector: sectorImpact,
            byEducation: educationImpact
          }
        };
        
        setSimulationResults(simulationSummary);
        console.log('✅ Simulation complete:', simulationSummary.summary);
        setSimulating(false);
        setSimulationProgress(0);
        // 🆕 ADD THIS LINE
        generateAIInsights(simulationSummary);
      } catch (error) {
        console.error('❌ Error finishing simulation:', error);
        setError(`Simulation error: ${error.message}`);
        setSimulating(false);
        setSimulationProgress(0);
      }
    };
    
    // ✅ Start the chunked processing
    setTimeout(processChunk, 100);
  };

  // 🆕 ADD THIS ENTIRE FUNCTION
  const generateAIInsights = async (simulationSummary) => {
    setLoadingInsights(true);
    
    const policySettings = {
      minWage,
      carbonTax,
      housingSubsidy,
      taxRate,
      educationSubsidy,
      transitSubsidy,
      evIncentive,
      greenJobsIncentive
    };
    
    try {
      console.log('🤖 Generating AI insights...');
      
      // Generate all insights in parallel
      const [policyRec, equityInsights, envInsights] = await Promise.all([
        generatePolicyRecommendation(simulationSummary, baselineMetrics, policySettings),
        generateEquityInsights(simulationSummary.equityAnalysis, baselineMetrics),
        generateEnvironmentalInsights(simulationSummary, baselineMetrics, policySettings)
      ]);
      
      setAiPolicyRecommendation(policyRec);
      setAiEquityInsights(equityInsights);
      setAiEnvironmentalInsights(envInsights);
      
      console.log('✅ AI insights generated successfully');
    } catch (error) {
      console.error('❌ Error generating AI insights:', error);
    } finally {
      setLoadingInsights(false);
    }
  };

  // ==================== RENDER: UPLOAD SCREEN ====================
  
  if (!data && !loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-2xl">
          <Users className="w-20 h-20 text-blue-600 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ripple Policy Simulator</h2>
          <p className="text-gray-600 mb-6">Upload your synthetic population Excel file to begin</p>
          
          <label className="block">
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
            <div className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all cursor-pointer">
              Choose Excel File
            </div>
          </label>
          
          <p className="text-sm text-gray-500 mt-4">Expected columns: Income, Rent, Commute_Distance, etc.</p>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== RENDER: LOADING SCREEN ====================
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <RefreshCw className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-xl text-gray-700">Loading Population Data...</p>
        </div>
      </div>
    );
  }

  // ==================== RENDER: ERROR SCREEN ====================
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => { setData(null); setError(null); setBaselineMetrics(null); }}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ==================== RENDER: MAIN APPLICATION ====================
  
  // If we have data but no baseline metrics, show a loading indicator
  if (data && !baselineMetrics) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <RefreshCw className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-xl text-gray-700">Calculating Baseline Metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Ripple Policy Simulator</h1>
              <p className="text-gray-600">Explore policy impacts with Monte Carlo simulation</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Population Size</div>
              <div className="text-3xl font-bold text-blue-600">{data.length.toLocaleString()}</div>
              <button
                onClick={() => { setData(null); setBaselineMetrics(null); setSimulationResults(null); }}
                className="mt-2 text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Upload New Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex space-x-2 bg-white rounded-lg p-2 shadow">
          {['overview', 'simulator', 'results'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-600">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">📊 Baseline Metrics</h2>
              <p className="text-gray-600 mb-4">
                These are the starting conditions before any policy changes. All simulations compare against these baseline values.
              </p>
            </div>

            {/* Key Economic Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Average Income</p>
                    <p className="text-3xl font-bold text-gray-900">${(baselineMetrics.avgIncome / 1000).toFixed(1)}k</p>
                    <p className="text-xs text-gray-500 mt-1">Median: ${(baselineMetrics.medianIncome / 1000).toFixed(1)}k</p>
                  </div>
                  <DollarSign className="w-10 h-10 text-blue-600 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Gini Index</p>
                    <p className="text-3xl font-bold text-gray-900">{baselineMetrics.giniCoefficient.toFixed(3)}</p>
                    <p className="text-xs text-gray-500 mt-1">Inequality measure</p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-green-600 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Employment Rate</p>
                    <p className="text-3xl font-bold text-gray-900">{(baselineMetrics.employmentRate * 100).toFixed(1)}%</p>
                    <p className="text-xs text-gray-500 mt-1">{(baselineMetrics.employmentRate * data.length).toFixed(0)} employed</p>
                  </div>
                  <Users className="w-10 h-10 text-purple-600 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Avg Rent</p>
                    <p className="text-3xl font-bold text-gray-900">${baselineMetrics.avgRent.toFixed(0)}</p>
                    <p className="text-xs text-gray-500 mt-1">Burden: {(baselineMetrics.avgRentBurden * 100).toFixed(1)}%</p>
                  </div>
                  <Home className="w-10 h-10 text-orange-600 opacity-20" />
                </div>
              </div>
            </div>

            {/* Environmental & Behavioral Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center mb-3">
                  <Leaf className="w-6 h-6 text-green-600 mr-2" />
                  <h3 className="text-lg font-bold text-gray-900">Emissions</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">{(baselineMetrics.avgCO2PerCapita / 1000).toFixed(2)} tons/yr</p>
                <p className="text-sm text-gray-500">Per capita CO₂</p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center mb-3">
                  <Car className="w-6 h-6 text-blue-600 mr-2" />
                  <h3 className="text-lg font-bold text-gray-900">Vehicle Ownership</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">{(baselineMetrics.vehicleOwnershipRate * 100).toFixed(1)}%</p>
                <p className="text-sm text-gray-500">{(baselineMetrics.vehicleOwnershipRate * data.length).toFixed(0)} own vehicles</p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center mb-3">
                  <GraduationCap className="w-6 h-6 text-purple-600 mr-2" />
                  <h3 className="text-lg font-bold text-gray-900">Avg Household Size</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900">{baselineMetrics.avgHouseholdSize.toFixed(2)}</p>
                <p className="text-sm text-gray-500">people per household</p>
              </div>
            </div>

            {/* Charts: Income Distribution & Commute Modes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Income Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={baselineMetrics.incomeBracketDist}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-15} textAnchor="end" height={70} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Commute Modes</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={baselineMetrics.commuteModeDist}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {baselineMetrics.commuteModeDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Education & Sector Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Education Levels</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={baselineMetrics.educationDist}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-15} textAnchor="end" height={70} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#9333ea" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Employment Sectors</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={baselineMetrics.sectorDist}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-15} textAnchor="end" height={70} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* SIMULATOR TAB */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Policy Controls</h3>
              
              <div className="space-y-8">
                {/* Minimum Wage */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-lg font-medium text-gray-700">Minimum Wage</label>
                    <span className="text-2xl font-bold text-blue-600">${minWage}/hr</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="25" 
                    step="0.5" 
                    value={minWage} 
                    onChange={(e) => setMinWage(parseFloat(e.target.value))} 
                  />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>$10</span>
                    <span>$25</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Current baseline: $15/hr. Raising wages helps low-income workers but may affect employment.</p>
                </div>

                {/* Carbon Tax */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-lg font-medium text-gray-700">Carbon Tax (per mile/year)</label>
                    <span className="text-2xl font-bold text-green-600">${carbonTax}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5" 
                    value={carbonTax} 
                    onChange={(e) => setCarbonTax(parseFloat(e.target.value))} 
                  />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>$0</span>
                    <span>$100</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Charges commuters based on miles driven. Encourages cleaner transportation but may burden lower-income households.</p>
                </div>

                {/* Housing Subsidy */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-lg font-medium text-gray-700">Housing Subsidy (monthly)</label>
                    <span className="text-2xl font-bold text-purple-600">${housingSubsidy}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="500" 
                    step="25" 
                    value={housingSubsidy} 
                    onChange={(e) => setHousingSubsidy(parseFloat(e.target.value))} 
                  />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>$0</span>
                    <span>$500</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Monthly rent assistance for households earning under $50k. Reduces rent burden.</p>
                </div>

                {/* Tax Rate */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-lg font-medium text-gray-700">Income Tax Rate</label>
                    <span className="text-2xl font-bold text-orange-600">{(taxRate * 100).toFixed(0)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.10" 
                    max="0.40" 
                    step="0.01" 
                    value={taxRate} 
                    onChange={(e) => setTaxRate(parseFloat(e.target.value))} 
                  />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>10%</span>
                    <span>40%</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Current baseline: 22%. Affects disposable income.</p>
                </div>

                {/* Education Subsidy */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-lg font-medium text-gray-700">Education/Training Subsidy (annual)</label>
                    <span className="text-2xl font-bold text-pink-600">${educationSubsidy}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="2000" 
                    step="100" 
                    value={educationSubsidy} 
                    onChange={(e) => setEducationSubsidy(parseFloat(e.target.value))} 
                  />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>$0</span>
                    <span>$2,000</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Helps workers upgrade education levels, increasing income potential.</p>
                </div>

                {/* Transit Subsidy */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-lg font-medium text-gray-700">Public Transit Subsidy (annual)</label>
                    <span className="text-2xl font-bold text-cyan-600">${transitSubsidy}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1000" 
                    step="50" 
                    value={transitSubsidy} 
                    onChange={(e) => setTransitSubsidy(parseFloat(e.target.value))} 
                  />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>$0</span>
                    <span>$1,000</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Encourages shift from driving to public transit, reducing emissions.</p>
                </div>

                {/* EV Incentive */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-lg font-medium text-gray-700">EV Purchase Incentive</label>
                    <span className="text-2xl font-bold text-teal-600">${evIncentive}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="10000" 
                    step="500" 
                    value={evIncentive} 
                    onChange={(e) => setEVIncentive(parseFloat(e.target.value))} 
                  />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>$0</span>
                    <span>$10,000</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">One-time incentive to adopt electric vehicles, reducing commute emissions.</p>
                </div>

                {/* Green Jobs Incentive */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-lg font-medium text-gray-700">Green Jobs Incentive (% wage bonus)</label>
                    <span className="text-2xl font-bold text-lime-600">{greenJobsIncentive}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="20" 
                    step="1" 
                    value={greenJobsIncentive} 
                    onChange={(e) => setGreenJobsIncentive(parseFloat(e.target.value))} 
                  />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>0%</span>
                    <span>20%</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Encourages employment shifts to green energy and tech sectors.</p>
                </div>

                {/* Monte Carlo Runs */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-lg font-medium text-gray-700">Monte Carlo Simulations</label>
                    <span className="text-2xl font-bold text-orange-600">{monteCarloRuns}</span>
                  </div>
                  <input 
                    type="range" 
                    min="50" 
                    max="500" 
                    step="50" 
                    value={monteCarloRuns} 
                    onChange={(e) => setMonteCarloRuns(parseInt(e.target.value))} 
                  />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>50 runs</span>
                    <span>500 runs</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">More runs = better confidence intervals but slower simulation.</p>
                </div>
              </div>

              {/* Run Button */}
              <button
                onClick={runMonteCarloSimulation}
                disabled={simulating}
                className="mt-8 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
                style={{opacity: simulating ? 0.7 : 1, cursor: simulating ? 'not-allowed' : 'pointer'}}
              >
                {simulating ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center space-x-3">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                      <span>Running Simulation...</span>
                    </div>
                    {/* ✅ NEW: Progress Bar */}
                    <div className="w-full bg-white bg-opacity-20 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-white h-full transition-all duration-300 rounded-full"
                        style={{width: `${simulationProgress}%`}}
                      />
                    </div>
                    <div className="text-sm text-white text-opacity-90">
                      {simulationProgress.toFixed(0)}% complete
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-3">
                    <PlayCircle className="w-6 h-6" />
                    <span>Run Monte Carlo Simulation</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        )}

        {/* RESULTS TAB */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            {simulationResults ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-600">
                    <p className="text-sm text-gray-500 mb-1">Avg Income</p>
                    <p className="text-2xl font-bold text-gray-900">${(simulationResults.summary.income.mean / 1000).toFixed(1)}k</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Baseline: ${(baselineMetrics.avgIncome / 1000).toFixed(1)}k
                    </p>
                    <p className={`text-sm font-bold mt-1 ${simulationResults.summary.income.mean > baselineMetrics.avgIncome ? 'text-green-600' : 'text-red-600'}`}>
                      {((simulationResults.summary.income.mean - baselineMetrics.avgIncome) / baselineMetrics.avgIncome * 100).toFixed(1)}% change
                    </p>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-600">
                    <p className="text-sm text-gray-500 mb-1">Gini Index</p>
                    <p className="text-2xl font-bold text-gray-900">{simulationResults.summary.gini.mean.toFixed(3)}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Baseline: {baselineMetrics.giniCoefficient.toFixed(3)}
                    </p>
                    <p className={`text-sm font-bold mt-1 ${simulationResults.summary.gini.mean < baselineMetrics.giniCoefficient ? 'text-green-600' : 'text-red-600'}`}>
                      {((simulationResults.summary.gini.mean - baselineMetrics.giniCoefficient) / baselineMetrics.giniCoefficient * 100).toFixed(1)}% change
                    </p>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-600">
                    <p className="text-sm text-gray-500 mb-1">Employment</p>
                    <p className="text-2xl font-bold text-gray-900">{(simulationResults.summary.employment.mean * 100).toFixed(1)}%</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Baseline: {(baselineMetrics.employmentRate * 100).toFixed(1)}%
                    </p>
                    <p className={`text-sm font-bold mt-1 ${simulationResults.summary.employment.mean > baselineMetrics.employmentRate ? 'text-green-600' : 'text-red-600'}`}>
                      {((simulationResults.summary.employment.mean - baselineMetrics.employmentRate) / baselineMetrics.employmentRate * 100).toFixed(1)}% change
                    </p>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-600">
                    <p className="text-sm text-gray-500 mb-1">Emissions</p>
                    <p className="text-2xl font-bold text-gray-900">{(simulationResults.summary.emissions.mean / 1000).toFixed(2)} tons</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Baseline: {(baselineMetrics.avgCO2PerCapita / 1000).toFixed(2)} tons
                    </p>
                    <p className={`text-sm font-bold mt-1 ${simulationResults.summary.emissions.mean < baselineMetrics.avgCO2PerCapita ? 'text-green-600' : 'text-red-600'}`}>
                      {((simulationResults.summary.emissions.mean - baselineMetrics.avgCO2PerCapita) / baselineMetrics.avgCO2PerCapita * 100).toFixed(1)}% change
                    </p>
                  </div>
                </div>

                {/* Additional Metrics Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-pink-600">
                    <p className="text-sm text-gray-500 mb-1">Avg Rent Paid</p>
                    <p className="text-2xl font-bold text-gray-900">${simulationResults.summary.rentPaid.mean.toFixed(0)}/mo</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Baseline: ${baselineMetrics.avgRentPaid.toFixed(0)}/mo
                    </p>
                    <p className={`text-sm font-bold mt-1 ${simulationResults.summary.rentPaid.mean < baselineMetrics.avgRentPaid ? 'text-green-600' : 'text-red-600'}`}>
                      {((simulationResults.summary.rentPaid.mean - baselineMetrics.avgRentPaid) / baselineMetrics.avgRentPaid * 100).toFixed(1)}% change
                    </p>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-cyan-600">
                    <p className="text-sm text-gray-500 mb-1">Avg Energy Use</p>
                    <p className="text-2xl font-bold text-gray-900">{simulationResults.summary.energyUse.mean.toFixed(0)} kWh/mo</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Baseline: {baselineMetrics.avgEnergyUse.toFixed(0)} kWh/mo
                    </p>
                    <p className={`text-sm font-bold mt-1 ${simulationResults.summary.energyUse.mean < baselineMetrics.avgEnergyUse ? 'text-green-600' : 'text-red-600'}`}>
                      {((simulationResults.summary.energyUse.mean - baselineMetrics.avgEnergyUse) / baselineMetrics.avgEnergyUse * 100).toFixed(1)}% change
                    </p>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-teal-600">
                    <p className="text-sm text-gray-500 mb-1">Rent Burden</p>
                    <p className="text-2xl font-bold text-gray-900">{(simulationResults.summary.rentBurden.mean * 100).toFixed(1)}%</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Baseline: {(baselineMetrics.avgRentBurden * 100).toFixed(1)}%
                    </p>
                    <p className={`text-sm font-bold mt-1 ${simulationResults.summary.rentBurden.mean < baselineMetrics.avgRentBurden ? 'text-green-600' : 'text-red-600'}`}>
                      {((simulationResults.summary.rentBurden.mean - baselineMetrics.avgRentBurden) / baselineMetrics.avgRentBurden * 100).toFixed(1)}% change
                    </p>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Monte Carlo Distribution - Gini Index</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="run" name="Run" />
                        <YAxis dataKey="gini" name="Gini" domain={['auto', 'auto']} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter name="Gini Index" data={simulationResults.runs} fill="#3b82f6" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Income vs Employment Trade-off</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="avgIncome" name="Avg Income" />
                        <YAxis dataKey="employmentRate" name="Employment" domain={['auto', 'auto']} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter name="Scenarios" data={simulationResults.runs} fill="#8b5cf6" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Equity Analysis */}
                {simulationResults.equityAnalysis && (
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">📊 Equity Analysis: Who Wins and Who Loses?</h3>
                    
                    {/* 🆕 AI EQUITY INSIGHTS */}
                    {aiEquityInsights && (
                      <div className="mb-6 p-4 bg-purple-50 rounded-lg border-l-4 border-purple-600">
                        <div className="flex items-center mb-2">
                          <Sparkles className="w-5 h-5 text-purple-600 mr-2" />
                          <h4 className="font-bold text-gray-900">AI Equity Insights</h4>
                        </div>
                        <div className="text-gray-700 leading-relaxed" style={{whiteSpace: 'pre-line'}}>
                          {aiEquityInsights.replace(/\*\*/g, '')}
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* By Income Bracket */}
                      <div>
                        <h4 className="text-lg font-bold text-gray-800 mb-3">Impact by Income Bracket</h4>
                        <div className="space-y-2">
                          {simulationResults.equityAnalysis.byIncomeBracket.slice(0, 5).map((item, idx) => (
                            <div key={idx} className={`p-3 rounded-lg ${item.avgIncomeChange > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-medium text-gray-900">{item.bracket}</span>
                                <span className={`font-bold ${item.avgIncomeChange > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {item.avgIncomeChange > 0 ? '+' : ''}{(item.avgIncomeChange / 1000).toFixed(1)}k ({item.percentChange.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="text-xs text-gray-600">
                                Baseline: ${(item.baselineIncome / 1000).toFixed(1)}k → ${((item.baselineIncome + item.avgIncomeChange) / 1000).toFixed(1)}k
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* By Education Level */}
                      <div>
                        <h4 className="text-lg font-bold text-gray-800 mb-3">Impact by Education Level</h4>
                        <div className="space-y-2">
                          {simulationResults.equityAnalysis.byEducation.slice(0, 5).map((item, idx) => (
                            <div key={idx} className={`p-3 rounded-lg ${item.avgIncomeChange > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-medium text-gray-900">{item.education}</span>
                                <span className={`font-bold ${item.avgIncomeChange > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {item.avgIncomeChange > 0 ? '+' : ''}{(item.avgIncomeChange / 1000).toFixed(1)}k ({item.percentChange.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="text-xs text-gray-600">
                                Baseline: ${(item.baselineIncome / 1000).toFixed(1)}k → ${((item.baselineIncome + item.avgIncomeChange) / 1000).toFixed(1)}k
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* By Sector */}
                      <div>
                        <h4 className="text-lg font-bold text-gray-800 mb-3">Impact by Employment Sector</h4>
                        <div className="space-y-2">
                          {simulationResults.equityAnalysis.bySector.slice(0, 5).map((item, idx) => (
                            <div key={idx} className={`p-3 rounded-lg ${item.avgIncomeChange > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-medium text-gray-900">{item.sector}</span>
                                <span className={`font-bold ${item.avgIncomeChange > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {item.avgIncomeChange > 0 ? '+' : ''}{(item.avgIncomeChange / 1000).toFixed(1)}k ({item.percentChange.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="text-xs text-gray-600">
                                Baseline: ${(item.baselineIncome / 1000).toFixed(1)}k → ${((item.baselineIncome + item.avgIncomeChange) / 1000).toFixed(1)}k
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* By County */}
                      <div>
                        <h4 className="text-lg font-bold text-gray-800 mb-3">Impact by County</h4>
                        <div className="space-y-2">
                          {simulationResults.equityAnalysis.byCounty.slice(0, 5).map((item, idx) => (
                            <div key={idx} className={`p-3 rounded-lg ${item.avgIncomeChange > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-medium text-gray-900">{item.county}</span>
                                <span className={`font-bold ${item.avgIncomeChange > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {item.avgIncomeChange > 0 ? '+' : ''}{(item.avgIncomeChange / 1000).toFixed(1)}k ({item.percentChange.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="text-xs text-gray-600">
                                Baseline: ${(item.baselineIncome / 1000).toFixed(1)}k → ${((item.baselineIncome + item.avgIncomeChange) / 1000).toFixed(1)}k
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 🆕 AI-POWERED POLICY RECOMMENDATION */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-lg p-6 border-l-4 border-blue-600">
                  <div className="flex items-center mb-3">
                    <Sparkles className="w-6 h-6 text-blue-600 mr-2" />
                    <h3 className="text-xl font-bold text-gray-900">AI Policy Recommendation</h3>
                  </div>
                  {loadingInsights ? (
                    <div className="flex items-center space-x-3">
                      <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                      <p className="text-gray-600">Generating AI insights...</p>
                    </div>
                  ) : aiPolicyRecommendation ? (
                    <p className="text-gray-700 leading-relaxed">{aiPolicyRecommendation}</p>
                  ) : (
                    <p className="text-gray-500 italic">AI insights will appear after simulation completes.</p>
                  )}
                </div>

                {/* 🆕 AI ENVIRONMENTAL INSIGHTS */}
                {aiEnvironmentalInsights && (
                  <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl shadow-lg p-6 border-l-4 border-green-600">
                    <div className="flex items-center mb-3">
                      <Leaf className="w-6 h-6 text-green-600 mr-2" />
                      <h3 className="text-xl font-bold text-gray-900">Environmental Impact Analysis</h3>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{aiEnvironmentalInsights}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No Simulation Results Yet</h3>
                <p className="text-gray-600 mb-6">Run a Monte Carlo simulation to see policy impact predictions</p>
                <button 
                  onClick={() => setActiveTab('simulator')} 
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
                >
                  Go to Simulator
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FairSimExplorer;