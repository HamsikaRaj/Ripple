# 🌊 Ripple - Policy Simulator
**Simulating Fairness Before It Happens**

[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react)](https://reactjs.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-4285F4?logo=google)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Ripple is an AI-driven economic simulation platform that empowers policymakers, researchers, and civic technologists to explore the real-world impact of policy decisions before implementation. By combining Monte Carlo simulations with AI-powered insights, Ripple reveals the "ripple effects" of changes in minimum wage, tax rates, housing subsidies, and environmental policies across diverse populations.

---

## 🎯 Purpose

Policy decisions affect millions of lives, yet their outcomes are often uncertain. Ripple provides a **safe sandbox** for testing hypothetical economic policies by:

- 📊 **Quantifying trade-offs** between competing objectives (e.g., income growth vs. employment)
- ⚖️ **Revealing equity impacts** across income brackets, education levels, and geographic regions
- 🌍 **Measuring environmental outcomes** like CO₂ emissions and energy consumption
- 🤖 **Translating complex data** into actionable recommendations using Gemini AI

**Who is this for?**
- Local government officials evaluating living wage ordinances
- Policy researchers studying inequality and labor markets
- Urban planners assessing housing affordability interventions
- Students learning computational social science

---

## ✨ Features

### 🎲 Monte Carlo Simulation Engine
- Runs **50-500 parallel simulations** with randomized elasticity parameters
- Models complex interactions between wage policy, rent dynamics, employment, and behavioral responses
- Generates **95% confidence intervals** for all predicted outcomes

### 🧠 AI-Powered Insights (Gemini Integration)
- **Policy Recommendations** - Summarizes whether policies are progressive/regressive
- **Equity Analysis** - Identifies which demographic groups benefit or suffer most
- **Environmental Impact** - Evaluates emissions reductions and energy trade-offs
- Natural language explanations of statistical results

### 📊 Interactive Dashboard
- **Real-time visualization** with Recharts (bar charts, scatter plots, pie charts)
- **Policy control sliders** for 8+ parameters:
  - Minimum Wage ($10-$25/hr)
  - Carbon Tax ($0-$100/mile/year)
  - Housing Subsidy ($0-$500/month)
  - Income Tax Rate (10%-40%)
  - Education/Training Subsidy
  - Public Transit Subsidy
  - EV Purchase Incentive
  - Green Jobs Incentive
- **Baseline comparison** - All results measured against initial conditions

### 📈 Key Metrics Tracked
| Economic | Environmental | Equity |
|----------|--------------|--------|
| Average Income | CO₂ Emissions | Gini Coefficient |
| Employment Rate | Energy Use | Income by Race |
| Rent Burden | Commute Mode Shift | Income by Sector |
| Disposable Income | Vehicle Ownership | Income by County |

### 💾 Synthetic Population Dataset
- Upload custom Excel datasets with demographic profiles
- Expected columns: `Income`, `Rent`, `Commute_Distance`, `Education_Level`, `Employment_Sector`, `Race_Ethnicity`, etc.
- Automatically calculates baseline metrics (Gini, employment rate, emissions)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Installation
```bash
# Clone the repository
git clone https://github.com/swarat17/ripple.git
cd ripple

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### Configuration

Edit `.env` and add your Gemini API key:
```bash
REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here
```

### Run the App
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 Usage Guide

### 1️⃣ Upload Your Dataset
- Prepare an Excel file with synthetic population data
- Required columns: `Income`, `Rent`, `Commute_Distance`, `Employed`, `Education_Level`
- Optional columns: `Race_Ethnicity`, `County`, `Employment_Sector`, `Vehicle_Own`

Example row:
```csv
Income,Rent,Commute_Distance,Employed,Education_Level,Race_Ethnicity
45000,1200,15,TRUE,Bachelor,Hispanic
```

### 2️⃣ Review Baseline Metrics
The **Overview** tab shows your population's starting conditions:
- Average income, Gini coefficient, employment rate
- Commute mode distribution, vehicle ownership
- Education levels, employment sectors

### 3️⃣ Adjust Policy Parameters
Navigate to the **Simulator** tab and adjust:
- **Minimum Wage** - Affects low-income workers but may reduce employment
- **Carbon Tax** - Reduces emissions but increases commuting costs
- **Housing Subsidy** - Helps renters but may increase demand
- **Tax Rate** - Funds programs but reduces disposable income

### 4️⃣ Run Monte Carlo Simulation
- Choose number of runs (50-500) - more runs = better confidence intervals
- Click **"Run Monte Carlo Simulation"**
- Watch real-time progress bar

### 5️⃣ Analyze Results
The **Results** tab displays:
- **Summary cards** with % changes vs. baseline
- **AI recommendations** from Gemini (policy effectiveness, equity concerns)
- **Scatter plots** showing trade-offs (e.g., income vs. employment)
- **Equity breakdown** by race, income bracket, sector, and county

---

## 🧪 Example Scenario

**Research Question:** "What happens if we raise minimum wage to $20/hr while adding a $300 housing subsidy?"

**Input Settings:**
```json
{
  "minWage": 20.0,
  "housingSubsidy": 300,
  "taxRate": 0.22,
  "monteCarloRuns": 200
}
```

**Results:**
- ✅ Average income increases 8.3% ($42k → $45.5k)
- ⚠️ Employment decreases 2.1% (94.2% → 92.2%)
- ✅ Gini coefficient improves -4.6% (0.412 → 0.393)
- ✅ Rent burden decreases -18.2% (32% → 26%)

**AI Recommendation:**
> "This policy combination shows strong progressive outcomes, benefiting lower-income brackets (+12.3%) more than higher earners (+2.1%). However, employment losses suggest wage increases may price some workers out. Consider pairing with hiring tax credits to offset job losses while maintaining income gains."

---

## 🏗️ Architecture

### Tech Stack
- **Frontend:** React 18, Recharts, Lucide Icons
- **AI Integration:** Google Gemini API (gemini-1.5-flash)
- **Data Processing:** SheetJS (XLSX), Lodash
- **Simulation Engine:** Custom Monte Carlo algorithm in JavaScript
- **Styling:** Custom CSS (no Tailwind dependency)

### Project Structure
```
ripple/
├── src/
│   ├── App.js                 # Main React component
│   ├── App.css               # Styling
│   ├── geminiService.js      # AI integration
│   └── index.js              # Entry point
├── public/
│   └── index.html
├── .env.example              # Environment template
├── .gitignore
├── package.json
└── README.md
```

### Key Algorithms

**Gini Coefficient Calculation:**
```javascript
const calculateGini = (incomes) => {
  const sorted = [...incomes].sort((a, b) => a - b);
  const n = sorted.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return sum / (n * totalIncome);
};
```

**Monte Carlo Elasticities:**
- Wage elasticity: 0.7 - 1.3 (randomized per run)
- Rent elasticity: 0.02 - 0.06
- Employment elasticity: -0.01 to -0.05

---

## 🤖 AI Integration Details

### Gemini API Calls
Each simulation triggers 3 parallel API requests:
1. **Policy Recommendation** (1024 tokens) - Overall assessment
2. **Equity Insights** (512 tokens) - Demographic breakdown
3. **Environmental Analysis** (256 tokens) - Emissions impact

### Rate Limits
- Free tier: 60 requests/minute
- Cost per simulation: ~$0.001 (as of 2024)
- Fallback logic if API fails

### Customizing Prompts
Edit `geminiService.js` to adjust AI behavior:
```javascript
generationConfig: {
  temperature: 0.7,  // 0.0 = deterministic, 1.0 = creative
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 1024
}
```

---

## 📊 Sample Datasets

### Included Example
- `synthetic_population_50k.xlsx` - 50,000 synthetic residents
- Demographics: 5 income brackets, 4 racial/ethnic groups, 6 employment sectors
- Based on US Census Bureau distributions

### Creating Custom Datasets
Minimum required columns:
```
Income, Rent, Commute_Distance, Employed
```

Recommended additional columns:
```
Education_Level, Employment_Sector, Race_Ethnicity, County, 
Household_Size, Energy_Use, Vehicle_Own, Commute_Mode
```

---

## 🔒 Security & Privacy

- ✅ API keys stored in environment variables (never committed to Git)
- ✅ All simulations run client-side (no user data sent to servers)
- ✅ Synthetic data only - no real personal information
- ✅ Open-source code for transparency

---

## 🐛 Troubleshooting

### Common Issues

**"API Key Invalid" error**
```bash
# Verify .env file exists and has correct key
cat .env
# Should show: REACT_APP_GEMINI_API_KEY=AIza...
```

**Simulation freezes**
- Reduce Monte Carlo runs to 50-100
- Check browser console for JavaScript errors
- Ensure dataset has valid numeric columns

**Charts not rendering**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**AI insights not appearing**
- Check browser Network tab for 404/401 errors
- Verify API key has Gemini API enabled
- Review console logs for fallback triggers

---

## 🛣️ Roadmap

- [ ] Export simulation results to CSV/PDF
- [ ] Multi-year time-series projections
- [ ] Spatial visualizations (choropleth maps)
- [ ] Pre-built policy templates (UBI, carbon dividend, etc.)
- [ ] API endpoint for headless simulations
- [ ] Integration with real Census data APIs
- [ ] Mobile-responsive design improvements
- [ ] Multi-language support for AI summaries

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style (ESLint/Prettier)
- Add comments for complex simulation logic
- Test with multiple dataset sizes
- Update README for new features

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Inspiration:** Agent-based models in computational economics
- **AI Partner:** Google Gemini for natural language generation
- **Libraries:** Recharts, Lucide React, SheetJS
- **Community:** Open-source policy simulation projects

---

<div align="center">
  <strong>Made with ❤️ for policymakers who believe in evidence-based decision making</strong>
</div>
