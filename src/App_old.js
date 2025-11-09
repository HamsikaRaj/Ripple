import React, { useState, useEffect } from 'react';
import { BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, DollarSign, Home, TrendingUp, AlertCircle, PlayCircle, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import './App.css'; // Import the CSS file

const FairSimExplorer = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  const [minWage, setMinWage] = useState(15);
  const [carbonTax, setCarbonTax] = useState(0);
  const [housingSubsidy, setHousingSubsidy] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [simulationResults, setSimulationResults] = useState(null);
  const [monteCarloRuns, setMonteCarloRuns] = useState(100);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target.result;
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        console.log('Data loaded:', jsonData.length, 'rows');
        console.log('Sample row:', jsonData[0]);
        
        setData(jsonData);
        setLoading(false);
        setError(null);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Failed to read file');
      setLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

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

  const runMonteCarloSimulation = () => {
    setSimulating(true);
    
    setTimeout(() => {
      const results = [];
      
      for (let run = 0; run < monteCarloRuns; run++) {
        const wageElasticity = 0.7 + (Math.random() * 0.6);
        const rentElasticity = 0.02 + (Math.random() * 0.04);
        const employmentElasticity = -0.03 + (Math.random() * 0.02);
        
        const simulatedData = data.map(person => {
          let newIncome = person.income || person.Income || 30000;
          let newRent = person.rent || person.Rent || 1200;
          let employed = person.employed !== false;
          
          if (newIncome < minWage * 2080) {
            const wageIncrease = (minWage - 15) / 15;
            newIncome = newIncome * (1 + wageIncrease * wageElasticity);
          }
          
          newRent = newRent * (1 + ((minWage - 15) / 15) * rentElasticity);
          
          if (housingSubsidy > 0 && newIncome < 50000) {
            newRent = Math.max(0, newRent - housingSubsidy);
          }
          
          if (Math.random() < Math.abs(employmentElasticity * (minWage - 15) / 15)) {
            employed = false;
            newIncome *= 0.3;
          }
          
          const commuteDistance = person.commute_distance || person.CommuteDistance || 10;
          const carbonCost = carbonTax * commuteDistance * 0.4;
          newIncome -= carbonCost * 250;
          
          return { ...person, newIncome, newRent, employed };
        });
        
        const incomes = simulatedData.map(p => p.newIncome);
        const gini = calculateGini(incomes);
        const avgIncome = incomes.reduce((a, b) => a + b, 0) / incomes.length;
        const employmentRate = simulatedData.filter(p => p.employed).length / simulatedData.length;
        const avgRent = simulatedData.reduce((a, b) => a + (b.newRent || 0), 0) / simulatedData.length;
        
        results.push({
          run: run + 1,
          gini,
          avgIncome,
          employmentRate,
          avgRent,
          povertyRate: incomes.filter(i => i < 25000).length / incomes.length
        });
      }
      
      const sortedGini = results.map(r => r.gini).sort((a, b) => a - b);
      const sortedIncome = results.map(r => r.avgIncome).sort((a, b) => a - b);
      const sortedEmployment = results.map(r => r.employmentRate).sort((a, b) => a - b);
      
      const ci95Lower = Math.floor(monteCarloRuns * 0.025);
      const ci95Upper = Math.floor(monteCarloRuns * 0.975);
      
      setSimulationResults({
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
          employment: {
            mean: results.reduce((a, b) => a + b.employmentRate, 0) / monteCarloRuns,
            ci95: [sortedEmployment[ci95Lower], sortedEmployment[ci95Upper]]
          }
        }
      });
      
      setSimulating(false);
    }, 500);
  };

  if (!data && !loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-2xl">
          <Users className="w-20 h-20 text-blue-600 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 mb-4">FairSim Policy Simulator</h2>
          <p className="text-gray-600 mb-6">Upload your synthetic population Excel file to begin</p>
          
          <label className="block">
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
            <div className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all cursor-pointer">
              Choose Excel File
            </div>
          </label>
          
          <p className="text-sm text-gray-500 mt-4">Expected: NY_Synthetic_Population_50k.xlsx</p>
        </div>
      </div>
    );
  }

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

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => { setData(null); setError(null); }}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const incomes = data.map(p => p.income || p.Income || 30000);
  const baselineGini = calculateGini(incomes);
  const baselineAvgIncome = incomes.reduce((a, b) => a + b, 0) / incomes.length;
  const baselineEmployment = data.filter(p => p.employed !== false).length / data.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">FairSim Policy Simulator</h1>
              <p className="text-gray-600">Explore policy impacts with Monte Carlo simulation</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Population Size</div>
              <div className="text-3xl font-bold text-blue-600">{data.length.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

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

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Gini Index</p>
                    <p className="text-3xl font-bold text-gray-900">{baselineGini.toFixed(3)}</p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-blue-600 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Avg Income</p>
                    <p className="text-3xl font-bold text-gray-900">${(baselineAvgIncome / 1000).toFixed(0)}k</p>
                  </div>
                  <DollarSign className="w-10 h-10 text-green-600 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Employment</p>
                    <p className="text-3xl font-bold text-gray-900">{(baselineEmployment * 100).toFixed(1)}%</p>
                  </div>
                  <Users className="w-10 h-10 text-purple-600 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Poverty Rate</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {((incomes.filter(i => i < 25000).length / incomes.length) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <Home className="w-10 h-10 text-orange-600 opacity-20" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Income Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  { range: '<$25k', count: incomes.filter(i => i < 25000).length },
                  { range: '$25-50k', count: incomes.filter(i => i >= 25000 && i < 50000).length },
                  { range: '$50-75k', count: incomes.filter(i => i >= 50000 && i < 75000).length },
                  { range: '$75-100k', count: incomes.filter(i => i >= 75000 && i < 100000).length },
                  { range: '>$100k', count: incomes.filter(i => i >= 100000).length }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Policy Controls</h3>
              
              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-lg font-medium text-gray-700">Minimum Wage</label>
                    <span className="text-2xl font-bold text-blue-600">${minWage}/hr</span>
                  </div>
                  <input type="range" min="10" max="25" step="0.5" value={minWage} onChange={(e) => setMinWage(parseFloat(e.target.value))} />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>$10</span>
                    <span>$25</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-lg font-medium text-gray-700">Carbon Tax (per mile/year)</label>
                    <span className="text-2xl font-bold text-green-600">${carbonTax}</span>
                  </div>
                  <input type="range" min="0" max="100" step="5" value={carbonTax} onChange={(e) => setCarbonTax(parseFloat(e.target.value))} />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>$0</span>
                    <span>$100</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-lg font-medium text-gray-700">Housing Subsidy (monthly)</label>
                    <span className="text-2xl font-bold text-purple-600">${housingSubsidy}</span>
                  </div>
                  <input type="range" min="0" max="500" step="25" value={housingSubsidy} onChange={(e) => setHousingSubsidy(parseFloat(e.target.value))} />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>$0</span>
                    <span>$500</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-lg font-medium text-gray-700">Monte Carlo Simulations</label>
                    <span className="text-2xl font-bold text-orange-600">{monteCarloRuns}</span>
                  </div>
                  <input type="range" min="50" max="500" step="50" value={monteCarloRuns} onChange={(e) => setMonteCarloRuns(parseInt(e.target.value))} />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>50 runs</span>
                    <span>500 runs</span>
                  </div>
                </div>
              </div>

              <button
                onClick={runMonteCarloSimulation}
                disabled={simulating}
                className="mt-8 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center space-x-3"
                style={{opacity: simulating ? 0.5 : 1}}
              >
                {simulating ? (
                  <>
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span>Running {monteCarloRuns} Simulations...</span>
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-6 h-6" />
                    <span>Run Monte Carlo Simulation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-6">
            {simulationResults ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h4 className="text-sm text-gray-500 mb-2">Gini Index</h4>
                    <p className="text-3xl font-bold text-gray-900 mb-2">
                      {simulationResults.summary.gini.mean.toFixed(3)}
                    </p>
                    <p className="text-sm text-gray-600">
                      95% CI: [{simulationResults.summary.gini.ci95[0].toFixed(3)}, {simulationResults.summary.gini.ci95[1].toFixed(3)}]
                    </p>
                    <p className={`text-sm mt-2 font-medium ${
                      simulationResults.summary.gini.mean < baselineGini ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {((simulationResults.summary.gini.mean - baselineGini) / baselineGini * 100).toFixed(1)}% change
                    </p>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h4 className="text-sm text-gray-500 mb-2">Average Income</h4>
                    <p className="text-3xl font-bold text-gray-900 mb-2">
                      ${(simulationResults.summary.income.mean / 1000).toFixed(1)}k
                    </p>
                    <p className="text-sm text-gray-600">
                      95% CI: [${(simulationResults.summary.income.ci95[0] / 1000).toFixed(1)}k, ${(simulationResults.summary.income.ci95[1] / 1000).toFixed(1)}k]
                    </p>
                    <p className={`text-sm mt-2 font-medium ${
                      simulationResults.summary.income.mean > baselineAvgIncome ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {((simulationResults.summary.income.mean - baselineAvgIncome) / baselineAvgIncome * 100).toFixed(1)}% change
                    </p>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h4 className="text-sm text-gray-500 mb-2">Employment Rate</h4>
                    <p className="text-3xl font-bold text-gray-900 mb-2">
                      {(simulationResults.summary.employment.mean * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-gray-600">
                      95% CI: [{(simulationResults.summary.employment.ci95[0] * 100).toFixed(1)}%, {(simulationResults.summary.employment.ci95[1] * 100).toFixed(1)}%]
                    </p>
                    <p className={`text-sm mt-2 font-medium ${
                      simulationResults.summary.employment.mean > baselineEmployment ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {((simulationResults.summary.employment.mean - baselineEmployment) / baselineEmployment * 100).toFixed(1)}% change
                    </p>
                  </div>
                </div>

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
                      <YAxis dataKey="employmentRate" name="Employment" domain={[0.99, 1.0]} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                      <Scatter name="Scenarios" data={simulationResults.runs} fill="#8b5cf6" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Policy Impact Breakdown</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { 
                        metric: 'Income',
                        baseline: baselineAvgIncome / 1000,
                        simulated: simulationResults.summary.income.mean / 1000
                      },
                      {
                        metric: 'Employment',
                        baseline: baselineEmployment * 100,
                        simulated: simulationResults.summary.employment.mean * 100
                      },
                      {
                        metric: 'Inequality (Gini×100)',
                        baseline: baselineGini * 100,
                        simulated: simulationResults.summary.gini.mean * 100
                      }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="metric" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="baseline" fill="#94a3b8" name="Baseline" />
                      <Bar dataKey="simulated" fill="#3b82f6" name="After Policy" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Uncertainty Analysis</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      {
                        metric: 'Gini Index',
                        lower: simulationResults.summary.gini.ci95[0],
                        mean: simulationResults.summary.gini.mean,
                        upper: simulationResults.summary.gini.ci95[1]
                      },
                      {
                        metric: 'Avg Income ($k)',
                        lower: simulationResults.summary.income.ci95[0] / 1000,
                        mean: simulationResults.summary.income.mean / 1000,
                        upper: simulationResults.summary.income.ci95[1] / 1000
                      },
                      {
                        metric: 'Employment %',
                        lower: simulationResults.summary.employment.ci95[0] * 100,
                        mean: simulationResults.summary.employment.mean * 100,
                        upper: simulationResults.summary.employment.ci95[1] * 100
                      }
                    ]} margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="metric" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="lower" fill="#93c5fd" name="Lower 95% CI" />
                      <Bar dataKey="mean" fill="#3b82f6" name="Mean" />
                      <Bar dataKey="upper" fill="#1e40af" name="Upper 95% CI" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Winners & Losers Analysis</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-bold text-green-800 mb-2">✓ Positive Impacts</h4>
                      <ul className="text-sm text-green-700 space-y-1">
                        {simulationResults.summary.income.mean > baselineAvgIncome && 
                          <li>• Avg income increased ${((simulationResults.summary.income.mean - baselineAvgIncome)/1000).toFixed(1)}k</li>}
                        {simulationResults.summary.gini.mean < baselineGini && 
                          <li>• Inequality decreased {((baselineGini - simulationResults.summary.gini.mean) / baselineGini * 100).toFixed(1)}%</li>}
                        {simulationResults.summary.employment.mean > baselineEmployment && 
                          <li>• Employment increased {((simulationResults.summary.employment.mean - baselineEmployment) * 50000).toFixed(0)} jobs</li>}
                        {housingSubsidy > 0 && 
                          <li>• Low-income families save ${housingSubsidy}/mo on rent</li>}
                      </ul>
                    </div>
                    
                    <div className="p-4 bg-red-50 rounded-lg">
                      <h4 className="font-bold text-red-800 mb-2">✗ Negative Impacts</h4>
                      <ul className="text-sm text-red-700 space-y-1">
                        {simulationResults.summary.income.mean < baselineAvgIncome && 
                          <li>• Avg income decreased ${((baselineAvgIncome - simulationResults.summary.income.mean)/1000).toFixed(1)}k</li>}
                        {simulationResults.summary.gini.mean > baselineGini && 
                          <li>• Inequality increased {((simulationResults.summary.gini.mean - baselineGini) / baselineGini * 100).toFixed(1)}%</li>}
                        {simulationResults.summary.employment.mean < baselineEmployment && 
                          <li>• Employment decreased {((baselineEmployment - simulationResults.summary.employment.mean) * 50000).toFixed(0)} jobs</li>}
                        {carbonTax > 0 && 
                          <li>• Carbon tax costs ~${(carbonTax * 10 * 250).toFixed(0)}/year per worker</li>}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-lg p-6 border-l-4 border-blue-600">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">💡 Policy Recommendation</h3>
                  <p className="text-gray-700 leading-relaxed">
                    {simulationResults.summary.gini.mean > baselineGini && carbonTax > 0 ? (
                      <>The carbon tax of <strong>${carbonTax}/mile/year</strong> is regressive and increases inequality. Consider pairing it with a larger housing subsidy or direct cash transfers to offset the burden on low-income households. Current subsidy of ${housingSubsidy}/month provides only ${housingSubsidy * 12}/year, while carbon costs average ${(carbonTax * 10 * 250).toFixed(0)}/year.</>
                    ) : simulationResults.summary.income.mean < baselineAvgIncome ? (
                      <>While the minimum wage increase to <strong>${minWage}/hr</strong> helps workers, the overall income decline suggests the carbon tax and employment effects are too strong. Consider reducing the carbon tax or increasing the housing subsidy.</>
                    ) : (
                      <>This policy combination shows positive results with income increasing to <strong>${(simulationResults.summary.income.mean / 1000).toFixed(1)}k</strong> while maintaining {(simulationResults.summary.employment.mean * 100).toFixed(1)}% employment. The trade-offs appear balanced.</>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No Simulation Results Yet</h3>
                <p className="text-gray-600 mb-6">Run a Monte Carlo simulation to see policy impact predictions</p>
                <button onClick={() => setActiveTab('simulator')} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all">
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