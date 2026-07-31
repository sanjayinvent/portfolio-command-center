import { Holding } from './types';

export interface SimulationSnapshot {
  monthIndex: number;
  dateLabel: string;
  totalVal: number;
  stockVal: number;
  etfVal: number;
  stockPct: number;
  etfPct: number;
  monthlySweep: number;
  phaseTitle: string;
  phaseDesc: string;
  phaseBadge: string;
  isEarningsMonth: boolean;
  cumSwept: number;
  singleStockOptIncome: number;
  etfOptIncome: number;
  divIncome: number;
  monthlyTaxEst: number;
  calYearTaxEst: number;
  holdings: Holding[];
  trades: any[];
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function runSimulation(initialHoldings: Holding[]): SimulationSnapshot[] {
  let stocksState = initialHoldings.filter(h => h.asset_type === 'stock').map(h => ({ ...h }));
  let etfsState = initialHoldings.filter(h => h.asset_type === 'etf').map(h => ({ ...h, newShares: 0 }));

  const snapshots: SimulationSnapshot[] = [];
  let cumSweptTotal = 0;
  let runningYearTax = 0;

  // Day 1 Baseline values
  let stockVal0 = stocksState.reduce((sum, s) => sum + (s.shares * (s.current_price || 0)), 0);
  let etfVal0 = etfsState.reduce((sum, e) => sum + (e.shares * (e.current_price || 0)), 0);
  let totalVal0 = stockVal0 + etfVal0;

  snapshots.push({
    monthIndex: 0,
    dateLabel: "Day 1 Setup: August 2026",
    totalVal: totalVal0,
    stockVal: stockVal0,
    etfVal: etfVal0,
    stockPct: (stockVal0 / totalVal0) * 100,
    etfPct: (etfVal0 / totalVal0) * 100,
    monthlySweep: 0,
    phaseTitle: "PHASE 0: DAY 1 BULK CONSOLIDATION",
    phaseDesc: "Baseline portfolio snapshot based on actual DB holdings.",
    phaseBadge: "DAY 1 SETUP",
    isEarningsMonth: false,
    holdings: [...stocksState, ...etfsState],
    cumSwept: 0,
    singleStockOptIncome: 0,
    etfOptIncome: 0,
    divIncome: 0,
    monthlyTaxEst: 0,
    calYearTaxEst: 0,
    trades: []
  });

  // Months 1 to 60 Simulation
  for (let m = 1; m <= 60; m++) {
    let currDate = new Date(2026, 7 + (m - 1), 1);
    let monthName = monthNames[currDate.getMonth()] + " " + currDate.getFullYear();
    let monthNum = currDate.getMonth() + 1;
    let isEarningsMonth = [1, 4, 7, 10].includes(monthNum);

    if (currDate.getMonth() === 0) {
      runningYearTax = 0;
    }

    stocksState.forEach(s => { if (s.current_price) s.current_price *= 1.005; });
    etfsState.forEach(e => { if (e.current_price) e.current_price *= 1.005; });

    let stockValSum = stocksState.reduce((sum, s) => sum + (s.shares * (s.current_price || 0)), 0);

    let singleStockOptIncome = 0;
    stocksState.forEach(s => {
      if (s.call_yield_estimate && s.call_yield_estimate > 0) {
        let yieldFactor = isEarningsMonth ? 0.60 : 1.0;
        let basePrice = (s.current_price || 0) / 1.005; 
        singleStockOptIncome += (s.call_yield_estimate * ((s.current_price || 0) / basePrice)) * yieldFactor;
      }
    });

    let etfOptIncome = 0;
    etfsState.forEach(e => {
      let totalSh = e.shares + (e as any).newShares;
      let lots = Math.floor(totalSh / 100);
      etfOptIncome += lots * (e.rate_per_lot || 0);
    });

    let etfValBefore = etfsState.reduce((sum, e) => sum + ((e.shares + (e as any).newShares) * (e.current_price || 0)), 0);
    let divIncome = (stockValSum + etfValBefore) * 0.0012;
    let totalCashSweep = 5000 + singleStockOptIncome + etfOptIncome + divIncome;
    cumSweptTotal += totalCashSweep;

    let monthlyTaxableIncome = singleStockOptIncome + etfOptIncome + divIncome;
    let monthlyTaxEst = monthlyTaxableIncome * 0.25;
    runningYearTax += monthlyTaxEst;

    let tradesThisMonth: any[] = [];
    let phaseTitle = "", phaseDesc = "", phaseBadge = "";

    if (m <= 4) {
      phaseTitle = "PHASE 1: ACCELERATED LOT UNLOCKING";
      phaseDesc = "Sweeping 100% of capital into QQQ to unlock 100-share option lot by Month 4.";
      phaseBadge = "QQQ SPRINT";

      let qqqObj = etfsState.find(e => e.ticker === "QQQ");
      if (qqqObj && qqqObj.current_price) {
        let qqqCurrentSh = qqqObj.shares + (qqqObj as any).newShares;
        let qqqNeededSh = 100.0 - qqqCurrentSh;

        if (qqqNeededSh > 0) {
          let qqqAlloc = Math.min(totalCashSweep, qqqNeededSh * qqqObj.current_price);
          let qqqBought = qqqAlloc / qqqObj.current_price;
          (qqqObj as any).newShares += qqqBought;
          tradesThisMonth.push({ action: "BUY", ticker: "QQQ", shares: qqqBought, price: qqqObj.current_price, val: qqqAlloc });

          let remainder = totalCashSweep - qqqAlloc;
          if (remainder > 0) {
            let calfObj = etfsState.find(e => e.ticker === "CALF");
            if (calfObj && calfObj.current_price) {
              let calfBought = remainder / calfObj.current_price;
              (calfObj as any).newShares += calfBought;
              tradesThisMonth.push({ action: "BUY", ticker: "CALF", shares: calfBought, price: calfObj.current_price, val: remainder });
            }
          }
        }
      }
    } else if (m <= 6) {
      phaseTitle = "PHASE 1: SEED SPRINT (CALF / IDVO)";
      phaseDesc = "QQQ 100-lot active! Sweeping remaining bulk funds to expand CALF & IDVO option lots.";
      phaseBadge = "SEED SPRINT";

      let calfObj = etfsState.find(e => e.ticker === "CALF");
      let idvoObj = etfsState.find(e => e.ticker === "IDVO");

      let calfAlloc = 5000.0;
      let idvoAlloc = totalCashSweep - calfAlloc;

      if (calfObj && calfObj.current_price && idvoObj && idvoObj.current_price) {
        let calfBought = calfAlloc / calfObj.current_price;
        let idvoBought = idvoAlloc / idvoObj.current_price;
        (calfObj as any).newShares += calfBought;
        (idvoObj as any).newShares += idvoBought;

        tradesThisMonth.push({ action: "BUY", ticker: "CALF", shares: calfBought, price: calfObj.current_price, val: calfAlloc });
        tradesThisMonth.push({ action: "BUY", ticker: "IDVO", shares: idvoBought, price: idvoObj.current_price, val: idvoAlloc });
      }
    } else {
      phaseTitle = "PHASE 2: EQUAL BASKET DISTRIBUTION";
      phaseDesc = `Splitting equally across core growth & income ETFs.`;
      phaseBadge = "EQUAL SPLIT";

      let targetTickers = ["VOO", "QQQ", "DIVO", "COWZ", "CALF", "IDVO", "VXUS", "SMH", "VHT"];
      let splitAlloc = totalCashSweep / targetTickers.length;

      targetTickers.forEach(ticker => {
        let etfObj = etfsState.find(e => e.ticker === ticker);
        if (etfObj && etfObj.current_price) {
          let boughtSh = splitAlloc / etfObj.current_price;
          (etfObj as any).newShares += boughtSh;
          tradesThisMonth.push({ action: "BUY", ticker: ticker, shares: boughtSh, price: etfObj.current_price, val: splitAlloc });
        }
      });
    }

    let etfValAfter = etfsState.reduce((sum, e) => sum + ((e.shares + (e as any).newShares) * (e.current_price || 0)), 0);
    let totalVal = stockValSum + etfValAfter;
    
    // Save state back to holdings format for snapshot
    const finalHoldingsThisMonth = [
      ...stocksState.map(s => ({...s})),
      ...etfsState.map(e => ({...e, shares: e.shares + (e as any).newShares}))
    ];

    snapshots.push({
      monthIndex: m,
      dateLabel: `Month ${m} of 60: ${monthName}`,
      totalVal: totalVal,
      stockVal: stockValSum,
      etfVal: etfValAfter,
      stockPct: (stockValSum / totalVal) * 100,
      etfPct: (etfValAfter / totalVal) * 100,
      monthlySweep: totalCashSweep,
      phaseTitle: phaseTitle,
      phaseDesc: phaseDesc,
      phaseBadge: phaseBadge,
      isEarningsMonth: isEarningsMonth,
      holdings: finalHoldingsThisMonth,
      cumSwept: cumSweptTotal,
      singleStockOptIncome: singleStockOptIncome,
      etfOptIncome: etfOptIncome,
      divIncome: divIncome,
      monthlyTaxEst: monthlyTaxEst,
      calYearTaxEst: runningYearTax,
      trades: tradesThisMonth
    });
  }

  return snapshots;
}
