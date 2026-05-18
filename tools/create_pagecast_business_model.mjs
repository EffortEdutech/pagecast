import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "outputs/pagecast_business_model";
const outputPath = `${outputDir}/PageCast_Business_Model.xlsx`;

const wb = Workbook.create();

const theme = {
  navy: "#172033",
  slate: "#25324A",
  purple: "#6D5DFB",
  gold: "#F4C542",
  green: "#1F8A70",
  red: "#C2410C",
  bg: "#F7F8FB",
  soft: "#EDEFF7",
  line: "#CBD5E1",
  white: "#FFFFFF",
  text: "#111827",
  muted: "#64748B",
  input: "#FFF2CC",
  inputFont: "#0000FF",
};

const years = [2026, 2027, 2028];
const scenarioRows = {
  Downside: 6,
  Base: 7,
  Upside: 8,
};

function addSheet(name) {
  const s = wb.worksheets.add(name);
  s.showGridLines = false;
  return s;
}

function setCols(sheet, widths) {
  widths.forEach((w, i) => {
    sheet.getRangeByIndexes(0, i, 1, 1).format.columnWidthPx = w;
  });
}

function title(sheet, range, text, subtitle = "") {
  const r = sheet.getRange(range);
  r.merge();
  r.values = [[text]];
  r.format = {
    fill: theme.navy,
    font: { bold: true, color: theme.white, size: 18 },
    horizontalAlignment: "left",
    verticalAlignment: "middle",
  };
  r.format.rowHeightPx = 34;
  if (subtitle) {
    const row = Number(range.match(/\d+/)[0]) + 1;
    const sub = sheet.getRange(`A${row}:H${row}`);
    sub.merge();
    sub.values = [[subtitle]];
    sub.format = {
      fill: theme.slate,
      font: { color: "#D9E2F3", italic: true, size: 10 },
      horizontalAlignment: "left",
    };
    sub.format.rowHeightPx = 22;
  }
}

function section(sheet, range, text) {
  const r = sheet.getRange(range);
  r.merge();
  r.values = [[text]];
  r.format = {
    fill: theme.slate,
    font: { bold: true, color: theme.white },
    horizontalAlignment: "left",
  };
}

function header(range) {
  range.format = {
    fill: theme.purple,
    font: { bold: true, color: theme.white },
    horizontalAlignment: "center",
    verticalAlignment: "middle",
    wrapText: true,
  };
}

function body(range) {
  range.format = {
    fill: theme.white,
    font: { color: theme.text },
    wrapText: true,
    verticalAlignment: "top",
  };
}

function inputStyle(range) {
  range.format = {
    fill: theme.input,
    font: { color: theme.inputFont },
  };
}

function formulaStyle(range) {
  range.format = { font: { color: "#000000" } };
}

function linkStyle(range) {
  range.format = { font: { color: "#008000" } };
}

function money(range) {
  range.format.numberFormat = "$#,##0;[Red]($#,##0);-";
}

function pct(range) {
  range.format.numberFormat = "0.0%;[Red](0.0%);-";
}

function countFmt(range) {
  range.format.numberFormat = "#,##0;[Red](#,##0);-";
}

function decimal(range) {
  range.format.numberFormat = "0.0";
}

// Sheets
const dashboard = addSheet("Dashboard");
const canvas = addSheet("Business Model Canvas");
const assumptions = addSheet("Assumptions");
const revenue = addSheet("Revenue Model");
const costs = addSheet("Costs & COGS");
const funnel = addSheet("Marketing Funnel");
const scenarios = addSheet("Scenarios");
const unit = addSheet("Unit Economics");
const roadmap = addSheet("Launch Roadmap");
const competitors = addSheet("Competitor Matrix");
const sources = addSheet("Sources & Notes");
const checks = addSheet("Checks");

// Assumptions
setCols(assumptions, [210, 120, 120, 120, 130, 310]);
title(assumptions, "A1:F1", "PageCast Business Model Assumptions", "Blue/yellow cells are editable. Revenue and cost sheets are formula-driven from these assumptions.");
section(assumptions, "A4:F4", "Scenario Selector");
assumptions.getRange("A5:F5").values = [["Selected Case", "Base", "", "Model Currency", "USD", ""]];
inputStyle(assumptions.getRange("B5"));
inputStyle(assumptions.getRange("E5"));
assumptions.getRange("B5").dataValidation = { rule: { type: "list", values: ["Downside", "Base", "Upside"] } };
body(assumptions.getRange("A5:F5"));
inputStyle(assumptions.getRange("B5"));
inputStyle(assumptions.getRange("E5"));

section(assumptions, "A10:F10", "Market and Product Assumptions");
assumptions.getRange("A11:F11").values = [["Driver", "Downside", "Base", "Upside", "Unit", "Notes"]];
header(assumptions.getRange("A11:F11"));
const assumptionData = [
  ["Launch focus", "Children's stories", "Children's Islamic stories", "Children's Islamic + language learning", "text", "Primary wedge for launch positioning"],
  ["Average story unlock price", 2.99, 3.99, 4.99, "$ / story", "Paid one-time unlock; avoid coins/tokens at launch"],
  ["Family subscription price", 4.99, 5.99, 7.99, "$ / month", "Later catalog/family plan after enough content exists"],
  ["Creator Pro price", 8, 12, 19, "$ / month", "Advanced studio/export/branding/audio tools"],
  ["Education / faith bundle price", 150, 250, 450, "$ / org / year", "Schools, teachers, masjids, homeschool groups"],
  ["Creator payout share on unlocks", 0.65, 0.6, 0.55, "% of unlock GMV", "PageCast retains platform share after creator payout"],
  ["Payment processing fee", 0.035, 0.035, 0.032, "% gross billings", "Stripe/payment estimate"],
  ["AI voice / storage COGS", 0.1, 0.07, 0.05, "% gross billings", "Cloud, TTS, storage, bandwidth"],
  ["Support / moderation COGS", 0.035, 0.025, 0.02, "% gross billings", "Customer support, rights review, takedown handling"],
  ["Starting cash", 15000, 25000, 75000, "$", "Bootstrap or seed cash before launch"],
];
assumptions.getRange(`A12:F${11 + assumptionData.length}`).values = assumptionData;
body(assumptions.getRange(`A12:F${11 + assumptionData.length}`));
inputStyle(assumptions.getRange(`B12:D${11 + assumptionData.length}`));
money(assumptions.getRange("B13:D16"));
pct(assumptions.getRange("B17:D20"));
money(assumptions.getRange("B21:D21"));

section(assumptions, "H4:L4", "Active Reader Ramp");
assumptions.getRange("H5:L5").values = [["Year", "Downside", "Base", "Upside", "Unit"]];
header(assumptions.getRange("H5:L5"));
assumptions.getRange("H6:L8").values = [
  [2026, 2500, 5000, 12000, "active readers"],
  [2027, 15000, 35000, 90000, "active readers"],
  [2028, 65000, 150000, 350000, "active readers"],
];
body(assumptions.getRange("H6:L8"));
inputStyle(assumptions.getRange("I6:K8"));
countFmt(assumptions.getRange("I6:K8"));

section(assumptions, "H11:L11", "Reader Conversion and Consumption");
assumptions.getRange("H12:L12").values = [["Year", "Paid Conv.", "Stories / Paid Reader", "Family Subs", "Creator Accounts"]];
header(assumptions.getRange("H12:L12"));
assumptions.getRange("H13:L15").values = [
  [2026, 0.04, 2.2, 100, 50],
  [2027, 0.07, 3.0, 1200, 400],
  [2028, 0.1, 4.0, 8000, 2500],
];
body(assumptions.getRange("H13:L15"));
inputStyle(assumptions.getRange("I13:L15"));
pct(assumptions.getRange("I13:I15"));
decimal(assumptions.getRange("J13:J15"));
countFmt(assumptions.getRange("K13:L15"));

section(assumptions, "H18:L18", "Operating Expense Plan - Base Case");
assumptions.getRange("H19:L19").values = [["Opex Line", "2026", "2027", "2028", "Notes"]];
header(assumptions.getRange("H19:L19"));
assumptions.getRange("H20:L26").values = [
  ["Founder / core payroll", 36000, 90000, 180000, "Lean team; expand after proof of demand"],
  ["Engineering & infrastructure", 12000, 30000, 75000, "Product, hosting, observability, tools"],
  ["Content seeding / production", 10000, 30000, 80000, "Launch catalog, flagship PageCasts, localization"],
  ["Marketing spend", 15000, 65000, 220000, "Creator demos, parent/community channels, paid tests"],
  ["Legal, compliance, admin", 8000, 18000, 45000, "Copyright, child privacy, payments, accounting"],
  ["Customer success / moderation", 5000, 18000, 60000, "Support and rights review"],
  ["Other G&A", 4000, 10000, 25000, "Software and operations buffer"],
];
body(assumptions.getRange("H20:L26"));
inputStyle(assumptions.getRange("I20:K26"));
money(assumptions.getRange("I20:K26"));

// Revenue Model
setCols(revenue, [240, 120, 120, 120, 110, 310]);
title(revenue, "A1:F1", "Revenue Model", "Gross billings and platform revenue by stream. Change assumptions on the Assumptions tab.");
revenue.getRange("A4:F4").values = [["Metric", 2026, 2027, 2028, "Unit", "Formula / Notes"]];
header(revenue.getRange("A4:F4"));
const revRows = [
  ["Active readers", "", "", "", "users", "From active reader ramp"],
  ["Paid reader conversion", "", "", "", "%", "Editable on Assumptions"],
  ["Paid readers", "", "", "", "users", "Active readers x paid conversion"],
  ["Stories unlocked per paid reader", "", "", "", "stories", "Editable on Assumptions"],
  ["Average story unlock price", "", "", "", "$", "Scenario-driven"],
  ["Reader unlock gross billings", "", "", "", "$", "Paid readers x unlocks x price"],
  ["Family subscription accounts", "", "", "", "accounts", "Editable on Assumptions"],
  ["Family subscription price / month", "", "", "", "$", "Scenario-driven"],
  ["Family subscription revenue", "", "", "", "$", "Accounts x monthly price x 12"],
  ["Creator accounts", "", "", "", "creators", "Editable on Assumptions"],
  ["Creator Pro adoption", 0.1, 0.18, 0.25, "%", "Share of creators on paid studio plan"],
  ["Creator Pro price / month", "", "", "", "$", "Scenario-driven"],
  ["Creator Pro revenue", "", "", "", "$", "Creators x adoption x monthly price x 12"],
  ["Education / faith bundle accounts", 5, 35, 180, "orgs", "Manual launch plan assumption"],
  ["Bundle price / org / year", "", "", "", "$", "Scenario-driven"],
  ["Education / faith bundle revenue", "", "", "", "$", "Accounts x annual bundle price"],
  ["Marketplace / audio tool revenue", 1000, 12000, 75000, "$", "Templates, premium voices, custom services"],
  ["Total gross billings", "", "", "", "$", "All streams before creator payout and COGS"],
];
revenue.getRange(`A5:F${4 + revRows.length}`).values = revRows;
body(revenue.getRange(`A5:F${4 + revRows.length}`));
inputStyle(revenue.getRange("B15:D15"));
inputStyle(revenue.getRange("B18:D18"));
inputStyle(revenue.getRange("B21:D21"));

for (let i = 0; i < years.length; i++) {
  const col = String.fromCharCode("B".charCodeAt(0) + i);
  const yearRow = 6 + i;
  const activeRow = 6 + i;
  revenue.getRange(`${col}5`).formulas = [[`=INDEX(Assumptions!$I$6:$K$8,MATCH(${col}$4,Assumptions!$H$6:$H$8,0),MATCH(Assumptions!$B$5,Assumptions!$I$5:$K$5,0))`]];
  revenue.getRange(`${col}6`).formulas = [[`=INDEX(Assumptions!$I$13:$I$15,MATCH(${col}$4,Assumptions!$H$13:$H$15,0))`]];
  revenue.getRange(`${col}7`).formulas = [[`=${col}5*${col}6`]];
  revenue.getRange(`${col}8`).formulas = [[`=INDEX(Assumptions!$J$13:$J$15,MATCH(${col}$4,Assumptions!$H$13:$H$15,0))`]];
  revenue.getRange(`${col}9`).formulas = [[`=INDEX(Assumptions!$B$13:$D$13,1,MATCH(Assumptions!$B$5,Assumptions!$B$11:$D$11,0))`]];
  revenue.getRange(`${col}10`).formulas = [[`=${col}7*${col}8*${col}9`]];
  revenue.getRange(`${col}11`).formulas = [[`=INDEX(Assumptions!$K$13:$K$15,MATCH(${col}$4,Assumptions!$H$13:$H$15,0))`]];
  revenue.getRange(`${col}12`).formulas = [[`=INDEX(Assumptions!$B$14:$D$14,1,MATCH(Assumptions!$B$5,Assumptions!$B$11:$D$11,0))`]];
  revenue.getRange(`${col}13`).formulas = [[`=${col}11*${col}12*12`]];
  revenue.getRange(`${col}14`).formulas = [[`=INDEX(Assumptions!$L$13:$L$15,MATCH(${col}$4,Assumptions!$H$13:$H$15,0))`]];
  revenue.getRange(`${col}16`).formulas = [[`=INDEX(Assumptions!$B$15:$D$15,1,MATCH(Assumptions!$B$5,Assumptions!$B$11:$D$11,0))`]];
  revenue.getRange(`${col}17`).formulas = [[`=${col}14*${col}15*${col}16*12`]];
  revenue.getRange(`${col}19`).formulas = [[`=INDEX(Assumptions!$B$16:$D$16,1,MATCH(Assumptions!$B$5,Assumptions!$B$11:$D$11,0))`]];
  revenue.getRange(`${col}20`).formulas = [[`=${col}18*${col}19`]];
  revenue.getRange(`${col}22`).formulas = [[`=SUM(${col}10,${col}13,${col}17,${col}20,${col}21)`]];
}
formulaStyle(revenue.getRange("B5:D22"));
linkStyle(revenue.getRange("B5:D14"));
linkStyle(revenue.getRange("B16:D17"));
linkStyle(revenue.getRange("B19:D20"));
countFmt(revenue.getRange("B5:D5"));
pct(revenue.getRange("B6:D6"));
countFmt(revenue.getRange("B7:D7"));
decimal(revenue.getRange("B8:D8"));
money(revenue.getRange("B9:D10"));
countFmt(revenue.getRange("B11:D11"));
money(revenue.getRange("B12:D13"));
countFmt(revenue.getRange("B14:D14"));
pct(revenue.getRange("B15:D15"));
money(revenue.getRange("B16:D17"));
countFmt(revenue.getRange("B18:D18"));
money(revenue.getRange("B19:D22"));
revenue.getRange("A22:F22").format = { fill: theme.soft, font: { bold: true } };

// Costs
setCols(costs, [250, 120, 120, 120, 110, 310]);
title(costs, "A1:F1", "Costs, Gross Profit, and Cash Runway", "Formula-driven COGS, operating expenses, EBITDA, and ending cash.");
costs.getRange("A4:F4").values = [["Metric", 2026, 2027, 2028, "Unit", "Formula / Notes"]];
header(costs.getRange("A4:F4"));
const costRows = [
  ["Total gross billings", "", "", "", "$", "From Revenue Model"],
  ["Creator payouts", "", "", "", "$", "Payout share applied to reader unlock GMV only"],
  ["Payment processing", "", "", "", "$", "Payment fee x gross billings"],
  ["AI voice / storage COGS", "", "", "", "$", "COGS rate x gross billings"],
  ["Support / moderation COGS", "", "", "", "$", "COGS rate x gross billings"],
  ["Total COGS", "", "", "", "$", "Creator payouts + platform COGS"],
  ["Gross profit", "", "", "", "$", "Gross billings - COGS"],
  ["Gross margin", "", "", "", "%", "Gross profit / gross billings"],
  ["Founder / core payroll", "", "", "", "$", "From Assumptions"],
  ["Engineering & infrastructure", "", "", "", "$", "From Assumptions"],
  ["Content seeding / production", "", "", "", "$", "From Assumptions"],
  ["Marketing spend", "", "", "", "$", "From Assumptions"],
  ["Legal, compliance, admin", "", "", "", "$", "From Assumptions"],
  ["Customer success / moderation", "", "", "", "$", "From Assumptions"],
  ["Other G&A", "", "", "", "$", "From Assumptions"],
  ["Total operating expenses", "", "", "", "$", "Opex subtotal"],
  ["EBITDA", "", "", "", "$", "Gross profit - operating expenses"],
  ["EBITDA margin", "", "", "", "%", "EBITDA / gross billings"],
  ["Starting cash / prior ending cash", "", "", "", "$", "Starting cash then prior year cash"],
  ["Ending cash before financing", "", "", "", "$", "Prior cash + EBITDA"],
  ["Minimum funding required", "", "", "", "$", "Cash needed to avoid negative ending cash"],
];
costs.getRange(`A5:F${4 + costRows.length}`).values = costRows;
body(costs.getRange(`A5:F${4 + costRows.length}`));
for (let i = 0; i < years.length; i++) {
  const col = String.fromCharCode("B".charCodeAt(0) + i);
  const opexCol = String.fromCharCode("I".charCodeAt(0) + i);
  costs.getRange(`${col}5`).formulas = [[`='Revenue Model'!${col}22`]];
  costs.getRange(`${col}6`).formulas = [[`='Revenue Model'!${col}10*INDEX(Assumptions!$B$17:$D$17,1,MATCH(Assumptions!$B$5,Assumptions!$B$11:$D$11,0))`]];
  costs.getRange(`${col}7`).formulas = [[`=${col}5*INDEX(Assumptions!$B$18:$D$18,1,MATCH(Assumptions!$B$5,Assumptions!$B$11:$D$11,0))`]];
  costs.getRange(`${col}8`).formulas = [[`=${col}5*INDEX(Assumptions!$B$19:$D$19,1,MATCH(Assumptions!$B$5,Assumptions!$B$11:$D$11,0))`]];
  costs.getRange(`${col}9`).formulas = [[`=${col}5*INDEX(Assumptions!$B$20:$D$20,1,MATCH(Assumptions!$B$5,Assumptions!$B$11:$D$11,0))`]];
  costs.getRange(`${col}10`).formulas = [[`=SUM(${col}6:${col}9)`]];
  costs.getRange(`${col}11`).formulas = [[`=${col}5-${col}10`]];
  costs.getRange(`${col}12`).formulas = [[`=IFERROR(${col}11/${col}5,0)`]];
  for (let row = 13; row <= 19; row++) {
    const sourceRow = 20 + (row - 13);
    costs.getRange(`${col}${row}`).formulas = [[`=Assumptions!${opexCol}${sourceRow}`]];
  }
  costs.getRange(`${col}20`).formulas = [[`=SUM(${col}13:${col}19)`]];
  costs.getRange(`${col}21`).formulas = [[`=${col}11-${col}20`]];
  costs.getRange(`${col}22`).formulas = [[`=IFERROR(${col}21/${col}5,0)`]];
  if (i === 0) {
    costs.getRange(`${col}23`).formulas = [[`=INDEX(Assumptions!$B$21:$D$21,1,MATCH(Assumptions!$B$5,Assumptions!$B$11:$D$11,0))`]];
  } else {
    const prev = String.fromCharCode(col.charCodeAt(0) - 1);
    costs.getRange(`${col}23`).formulas = [[`=${prev}24`]];
  }
  costs.getRange(`${col}24`).formulas = [[`=${col}23+${col}21`]];
  costs.getRange(`${col}25`).formulas = [[`=MAX(0,-${col}24)`]];
}
formulaStyle(costs.getRange("B5:D25"));
linkStyle(costs.getRange("B5:D5"));
linkStyle(costs.getRange("B13:D19"));
money(costs.getRange("B5:D11"));
pct(costs.getRange("B12:D12"));
money(costs.getRange("B13:D21"));
pct(costs.getRange("B22:D22"));
money(costs.getRange("B23:D25"));
costs.getRange("A10:F11").format = { fill: theme.soft, font: { bold: true } };
costs.getRange("A20:F21").format = { fill: theme.soft, font: { bold: true } };
costs.getRange("A25:F25").format = { fill: "#FEE2E2", font: { bold: true, color: "#7F1D1D" } };

// Marketing Funnel
setCols(funnel, [210, 120, 120, 120, 120, 290]);
title(funnel, "A1:F1", "Marketing Funnel and Growth Economics", "Channel assumptions for launch testing and CAC discipline.");
funnel.getRange("A4:F4").values = [["Channel", "Budget 2026", "CPC / Cost", "Lead Conv.", "Paid Conv.", "Notes"]];
header(funnel.getRange("A4:F4"));
const funnelRows = [
  ["TikTok / Reels paid tests", 6000, 0.55, 0.08, 0.04, "Short demos comparing ebook vs PageCast"],
  ["Parent / Islamic community creators", 3500, 0.4, 0.12, 0.06, "WhatsApp, Facebook, creator collabs"],
  ["Teacher / homeschool outreach", 2500, 1.5, 0.18, 0.08, "Demo bundles and classroom trials"],
  ["Organic content / SEO", 1500, 0.15, 0.06, 0.03, "Story samples, read-aloud articles"],
  ["Creator acquisition", 1500, 1.2, 0.1, 0.05, "Authors, narrators, educators"],
];
funnel.getRange("A5:F9").values = funnelRows;
body(funnel.getRange("A5:F9"));
inputStyle(funnel.getRange("B5:E9"));
money(funnel.getRange("B5:C9"));
pct(funnel.getRange("D5:E9"));
funnel.getRange("H4:M4").values = [["Channel", "Clicks", "Leads", "Paid Users", "CAC", "2026 Revenue Payback"]];
header(funnel.getRange("H4:M4"));
for (let r = 5; r <= 9; r++) {
  funnel.getRange(`H${r}`).formulas = [[`=A${r}`]];
  funnel.getRange(`I${r}`).formulas = [[`=IFERROR(B${r}/C${r},0)`]];
  funnel.getRange(`J${r}`).formulas = [[`=I${r}*D${r}`]];
  funnel.getRange(`K${r}`).formulas = [[`=J${r}*E${r}`]];
  funnel.getRange(`L${r}`).formulas = [[`=IFERROR(B${r}/K${r},0)`]];
  funnel.getRange(`M${r}`).formulas = [[`=IFERROR(('Revenue Model'!B22/'Revenue Model'!B7)/L${r},0)`]];
}
funnel.getRange("H10:M10").values = [["Total / Weighted", "", "", "", "", ""]];
funnel.getRange("I10").formulas = [["=SUM(I5:I9)"]];
funnel.getRange("J10").formulas = [["=SUM(J5:J9)"]];
funnel.getRange("K10").formulas = [["=SUM(K5:K9)"]];
funnel.getRange("L10").formulas = [["=IFERROR(SUM(B5:B9)/K10,0)"]];
funnel.getRange("M10").formulas = [["=IFERROR(('Revenue Model'!B22/'Revenue Model'!B7)/L10,0)"]];
body(funnel.getRange("H5:M10"));
formulaStyle(funnel.getRange("H5:M10"));
countFmt(funnel.getRange("I5:K10"));
money(funnel.getRange("L5:L10"));
decimal(funnel.getRange("M5:M10"));
funnel.getRange("H10:M10").format = { fill: theme.soft, font: { bold: true } };

// Unit Economics
setCols(unit, [250, 120, 120, 120, 120, 300]);
title(unit, "A1:F1", "Unit Economics", "Key per-user, per-story, creator, and payback metrics.");
unit.getRange("A4:F4").values = [["Metric", 2026, 2027, 2028, "Unit", "Notes"]];
header(unit.getRange("A4:F4"));
const unitRows = [
  ["ARPU - active reader", "", "", "", "$ / active reader", "Gross billings / active readers"],
  ["ARPPU - paid reader", "", "", "", "$ / paid reader", "Gross billings / paid readers"],
  ["Gross profit per active reader", "", "", "", "$", "Gross profit / active readers"],
  ["Gross profit per paid reader", "", "", "", "$", "Gross profit / paid reader"],
  ["Marketing CAC - blended", "", "", "", "$ / paid user", "Uses 2026 channel model; later uses annual marketing spend / new paid users"],
  ["CAC payback", "", "", "", "years", "CAC / gross profit per paid reader"],
  ["Creator revenue per creator", "", "", "", "$ / creator", "Creator Pro revenue / creator accounts"],
  ["Platform take rate", "", "", "", "%", "Gross profit / gross billings"],
  ["Stories needed at launch", 10, 20, 40, "stories", "Catalog quality target"],
];
unit.getRange("A5:F13").values = unitRows;
body(unit.getRange("A5:F13"));
inputStyle(unit.getRange("B13:D13"));
for (let i = 0; i < years.length; i++) {
  const col = String.fromCharCode("B".charCodeAt(0) + i);
  const prev = i === 0 ? null : String.fromCharCode(col.charCodeAt(0) - 1);
  unit.getRange(`${col}5`).formulas = [[`=IFERROR('Revenue Model'!${col}22/'Revenue Model'!${col}5,0)`]];
  unit.getRange(`${col}6`).formulas = [[`=IFERROR('Revenue Model'!${col}22/'Revenue Model'!${col}7,0)`]];
  unit.getRange(`${col}7`).formulas = [[`=IFERROR('Costs & COGS'!${col}11/'Revenue Model'!${col}5,0)`]];
  unit.getRange(`${col}8`).formulas = [[`=IFERROR('Costs & COGS'!${col}11/'Revenue Model'!${col}7,0)`]];
  if (i === 0) {
    unit.getRange(`${col}9`).formulas = [[`='Marketing Funnel'!L10`]];
  } else {
    unit.getRange(`${col}9`).formulas = [[`=IFERROR('Costs & COGS'!${col}16/('Revenue Model'!${col}7-'Revenue Model'!${prev}7),0)`]];
  }
  unit.getRange(`${col}10`).formulas = [[`=IFERROR(${col}9/${col}8,0)`]];
  unit.getRange(`${col}11`).formulas = [[`=IFERROR('Revenue Model'!${col}17/'Revenue Model'!${col}14,0)`]];
  unit.getRange(`${col}12`).formulas = [[`=IFERROR('Costs & COGS'!${col}11/'Revenue Model'!${col}22,0)`]];
}
money(unit.getRange("B5:D9"));
decimal(unit.getRange("B10:D10"));
money(unit.getRange("B11:D11"));
pct(unit.getRange("B12:D12"));
countFmt(unit.getRange("B13:D13"));

// Scenarios
setCols(scenarios, [230, 120, 120, 120, 110, 300]);
title(scenarios, "A1:F1", "Scenario Summary", "Three scenario views using the 2028 year as the target outcome.");
scenarios.getRange("A4:F4").values = [["Scenario", "2028 Revenue", "2028 EBITDA", "2028 Ending Cash", "Gross Margin", "Strategic Meaning"]];
header(scenarios.getRange("A4:F4"));
scenarios.getRange("A5:F7").values = [
  ["Downside", "", "", "", "", "Validates survival plan and cost discipline"],
  ["Base", "", "", "", "", "Primary operating plan for launch and fundraising"],
  ["Upside", "", "", "", "", "Shows scale potential with stronger conversion/content flywheel"],
];
body(scenarios.getRange("A5:F7"));
// Static scenario summary using simple direct formulas for 2028, aligned with base model mechanics.
const scenarioFormula = (row, metric) => {
  const sc = `A${row}`;
  const active = `INDEX(Assumptions!$I$8:$K$8,1,MATCH(${sc},Assumptions!$I$5:$K$5,0))`;
  const price = `INDEX(Assumptions!$B$13:$D$13,1,MATCH(${sc},Assumptions!$B$11:$D$11,0))`;
  const famPrice = `INDEX(Assumptions!$B$14:$D$14,1,MATCH(${sc},Assumptions!$B$11:$D$11,0))`;
  const proPrice = `INDEX(Assumptions!$B$15:$D$15,1,MATCH(${sc},Assumptions!$B$11:$D$11,0))`;
  const bundlePrice = `INDEX(Assumptions!$B$16:$D$16,1,MATCH(${sc},Assumptions!$B$11:$D$11,0))`;
  const payout = `INDEX(Assumptions!$B$17:$D$17,1,MATCH(${sc},Assumptions!$B$11:$D$11,0))`;
  const proc = `INDEX(Assumptions!$B$18:$D$18,1,MATCH(${sc},Assumptions!$B$11:$D$11,0))`;
  const ai = `INDEX(Assumptions!$B$19:$D$19,1,MATCH(${sc},Assumptions!$B$11:$D$11,0))`;
  const sup = `INDEX(Assumptions!$B$20:$D$20,1,MATCH(${sc},Assumptions!$B$11:$D$11,0))`;
  const paid = `(${active}*Assumptions!$I$15)`;
  const unlock = `(${paid}*Assumptions!$J$15*${price})`;
  const sub = `(Assumptions!$K$15*${famPrice}*12)`;
  const pro = `(Assumptions!$L$15*Assumptions!$K$15*${proPrice}*12/Assumptions!$K$15*0+Assumptions!$L$15*0.25*${proPrice}*12)`;
  const edu = `(180*${bundlePrice})`;
  const tools = `75000`;
  const rev = `(${unlock}+${sub}+${pro}+${edu}+${tools})`;
  const cogs = `(${unlock}*${payout}+${rev}*(${proc}+${ai}+${sup}))`;
  const gp = `(${rev}-${cogs})`;
  const opex = `SUM(Assumptions!$K$20:$K$26)`;
  if (metric === "rev") return `=${rev}`;
  if (metric === "ebitda") return `=${gp}-${opex}`;
  if (metric === "cash") return `=INDEX(Assumptions!$B$21:$D$21,1,MATCH(${sc},Assumptions!$B$11:$D$11,0))+(${gp}-${opex})`;
  if (metric === "gm") return `=${gp}/${rev}`;
};
for (let row = 5; row <= 7; row++) {
  scenarios.getRange(`B${row}`).formulas = [[scenarioFormula(row, "rev")]];
  scenarios.getRange(`C${row}`).formulas = [[scenarioFormula(row, "ebitda")]];
  scenarios.getRange(`D${row}`).formulas = [[scenarioFormula(row, "cash")]];
  scenarios.getRange(`E${row}`).formulas = [[scenarioFormula(row, "gm")]];
}
money(scenarios.getRange("B5:D7"));
pct(scenarios.getRange("E5:E7"));

// Canvas
setCols(canvas, [210, 210, 210, 210, 210]);
title(canvas, "A1:E1", "PageCast Business Model Canvas", "A complete operating model view for launch planning and investor conversations.");
const blocks = [
  ["Customer Segments", "Parents of children 5-10\nIslamic / values-based family content buyers\nLanguage learners\nTeachers and homeschool groups\nIndie authors and educators"],
  ["Value Proposition", "Read + listen in one browser story\nCharacter voices, music, SFX, atmosphere\nNo app or hardware needed\nCreator studio lowers audio-story production cost\nFaith-friendly and family-safe launch wedge"],
  ["Channels", "TikTok/Reels demos\nWhatsApp sharing\nParent and Islamic communities\nTeacher/homeschool outreach\nCreator and author communities\nSEO story samples"],
  ["Customer Relationships", "First story free\nEmail/WhatsApp nurture\nParent/teacher beta feedback\nCreator onboarding and templates\nRights/compliance trust signals"],
  ["Revenue Streams", "Story unlocks\nFamily subscription\nCreator Pro studio plan\nEducation/faith bundles\nMarketplace audio tools and premium assets"],
  ["Key Resources", "Reader app\nCreator Studio\nPBF story format\nLaunch catalog\nCompliance workflows\nCreator/audio asset library"],
  ["Key Activities", "Seed flagship stories\nAcquire parent readers\nAcquire creators\nImprove audio sync/editor workflow\nModerate and verify content rights\nBuild distribution partnerships"],
  ["Key Partners", "Islamic educators and authors\nNarrators/voice talent\nSchools/masjids/homeschool groups\nPayment provider\nTTS/audio providers\nParent creators/influencers"],
  ["Cost Structure", "Creator payouts\nPayment fees\nAI/TTS/storage\nEngineering\nContent production\nMarketing\nLegal/privacy/compliance\nSupport and moderation"],
  ["Moat / Differentiation", "Browser-native shareability\nText + audio + cast format\nCreator-friendly production tools\nNiche launch catalog\nCompliance-first publishing\nFuture PBF format ecosystem"],
];
let blockRow = 4;
for (let i = 0; i < blocks.length; i++) {
  const col = i % 2 === 0 ? "A" : "D";
  const end = i % 2 === 0 ? "B" : "E";
  if (i % 2 === 0 && i > 0) blockRow += 5;
  section(canvas, `${col}${blockRow}:${end}${blockRow}`, blocks[i][0]);
  const b = canvas.getRange(`${col}${blockRow + 1}:${end}${blockRow + 4}`);
  b.merge();
  b.values = [[blocks[i][1]]];
  body(b);
  b.format.wrapText = true;
  b.format.rowHeightPx = 82;
}

// Roadmap
setCols(roadmap, [130, 210, 230, 230, 130, 130]);
title(roadmap, "A1:F1", "Launch Roadmap", "Milestones tied to catalog, audience, compliance, and monetization readiness.");
roadmap.getRange("A4:F4").values = [["Phase", "Timeline", "Goal", "Key Work", "Owner", "Status"]];
header(roadmap.getRange("A4:F4"));
roadmap.getRange("A5:F12").values = [
  ["Beta Prep", "Now - Launch - 4 weeks", "Prove core story experience", "Finish 10 flagship PageCasts, test payments, verify compliance gates", "Founders", "In Progress"],
  ["Private Beta", "Launch - 4 weeks", "Validate parent and teacher demand", "Recruit 50-100 families, collect testimonials, track completion rates", "Growth", "Planned"],
  ["Creator Pilot", "Month 2", "Validate creator workflow", "Invite 20 authors/educators, publish first external stories", "Creator Ops", "Planned"],
  ["Public Launch", "Month 3", "First paid unlocks", "Launch demos, free story, paid story bundle, email capture", "Growth", "Planned"],
  ["Bundle Sales", "Months 4-6", "Education/faith org revenue", "Sell school/masjid/homeschool access codes", "Partnerships", "Planned"],
  ["Family Plan", "Months 6-9", "Recurring revenue", "Launch family subscription after enough catalog depth", "Product", "Planned"],
  ["Creator Pro", "Months 9-12", "Creator SaaS revenue", "Add pro tools, templates, branded story pages", "Product", "Planned"],
  ["Scale", "Year 2", "Repeatable growth engine", "Localization, more genres, partnerships, creator marketplace", "Leadership", "Planned"],
];
body(roadmap.getRange("A5:F12"));
roadmap.getRange("F5:F12").dataValidation = { rule: { type: "list", values: ["Planned", "In Progress", "Done", "Blocked"] } };

// Competitor Matrix
setCols(competitors, [170, 170, 185, 170, 190, 230]);
title(competitors, "A1:F1", "Competitor Matrix", "Positioning map for PageCast launch messaging.");
competitors.getRange("A4:F4").values = [["Competitor", "Category", "Strength", "Weakness / Opening", "PageCast Response", "Marketing Lesson"]];
header(competitors.getRange("A4:F4"));
competitors.getRange("A5:F15").values = [
  ["Audible", "Audiobooks", "Huge catalog and trusted audio brand", "Audio-only; expensive creator production", "Text + cast + browser-native story format", "Do not fight catalog size; fight format gap"],
  ["Spotify Audiobooks", "Audio bundle", "Massive existing audio audience", "Audiobooks are a feature inside a broader app", "Focused story product with visible text", "Audio demand is mainstream"],
  ["Yoto", "Kids audio hardware", "Parent trust and screen-free positioning", "Needs hardware/cards; no text layer", "Browser access plus reading support", "Use parent calm/safe story-time language"],
  ["Tonies", "Kids audio toy", "Simple child-friendly controls", "Hardware cost and younger skew", "No hardware, flexible story links", "Physical charm matters; design should feel warm"],
  ["Epic", "Kids digital library", "Large child reading catalog", "Library-first, less cinematic creator publishing", "Immersive stories and creator studio", "Reading support is a proven need"],
  ["Novel Effect", "Read-aloud SFX", "Adds atmosphere to live reading", "Requires adult live reading/microphone", "Prebuilt voiced stories that can be replayed", "Soundscapes are compelling"],
  ["Wattpad", "Social fiction", "Huge creator/readership culture", "Text-first; limited built-in audio production", "Performance-ready story publishing", "Creator community is essential"],
  ["Galatea", "Immersive fiction", "Proves demand for SFX/visual/haptic fiction", "App-dependent and curated", "Open creator platform with web links", "Immersive fiction can convert"],
  ["WebNovel/Tapas", "Serialized fiction", "Mobile genre fiction monetization", "Frictional coins/episodes, text-first", "Simple unlocks and richer format", "Avoid confusing token model at launch"],
  ["Kindle/KDP", "Self-publishing", "Largest ebook ecosystem", "Ebooks are mostly silent", "Complement Kindle with voiced web stories", "Creators already understand publishing"],
  ["PageCast", "Cinematic story platform", "Text + voices + atmosphere + commerce", "Needs launch catalog and trust", "Niche-first, compliance-first launch", "Own the format, not the shelf"],
];
body(competitors.getRange("A5:F15"));

// Sources
setCols(sources, [210, 170, 120, 390, 290]);
title(sources, "A1:E1", "Sources and Notes", "External data points and internal planning assumptions used in the workbook.");
sources.getRange("A4:E4").values = [["Topic", "Source", "As-of / Period", "URL", "How Used"]];
header(sources.getRange("A4:E4"));
sources.getRange("A5:E18").values = [
  ["Audiobook market", "Deloitte", "2024 prediction", "https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2024/consumer-audio-market-trends-predict-more-global-consumers-in-2024.html", "Market tailwind for audio storytelling"],
  ["US audiobook sales", "Publishers Weekly / APA", "2024", "https://www.publishersweekly.com/pw/by-topic/industry-news/audio-books/article/97920-audiobook-sales-rose-13-in-2024-to-2-2-billion.html", "Audiobook growth proof point"],
  ["Audiobook age adoption", "Pew Research Center", "Oct 2025 survey", "https://www.pewresearch.org/short-reads/2026/04/09/americans-still-opt-for-print-books-over-digital-or-audio-versions-few-are-in-book-clubs/", "Age and adult audiobook adoption context"],
  ["Children screen time", "Common Sense Media", "2025", "https://www.commonsensemedia.org/research/the-2025-common-sense-census-media-use-by-kids-zero-to-eight", "Parent pain point and positioning"],
  ["Read-aloud behavior", "Scholastic", "Kids & Family Reading Report", "https://www.scholastic.com/newsroom/all-news/press-release/scholastic-kids---family-reading-report--releases-new-data-to-su.html", "Parent reading support need"],
  ["Children audio enjoyment", "National Literacy Trust", "2024", "https://nlt.hacdn.org/media/documents/Children_and_young_peoples_listening_in_2024_MgzFHgw.pdf", "Audio as bridge into reading"],
  ["Spotify audiobooks", "Spotify", "2024/2025", "https://www.spotify.com/us/audiobooks/", "Competitive audio benchmark"],
  ["Yoto positioning", "Yoto", "2026 accessed", "https://us.yotoplay.com/pages/player", "Kids audio competitor benchmark"],
  ["Tonies positioning", "Tonies", "2025", "https://www.mynewsdesk.com/us/tonies/pressreleases/tonies-r-introduces-new-toniebox-2-and-tonieplay-next-generation-of-interactive-audio-entertainment-redefines-how-children-grow-through-independent-listening-touch-and-play-3401125", "Kids audio competitor benchmark"],
  ["Epic positioning", "Epic Help Center", "2026 accessed", "https://support.getepic.com/hc/en-us", "Kids reading library competitor"],
  ["Novel Effect", "Apple App Store", "2026 accessed", "https://apps.apple.com/us/app/novel-effect-read-aloud-books-app/id1057374139", "Read-aloud soundscape competitor"],
  ["Galatea", "Inkitt / Galatea", "2026 accessed", "https://www.inkitt.com/galatea-app", "Immersive fiction competitor"],
  ["Internal product docs", "PageCast workspace", "2026-05-16", "docs/pagecast-documentation.md", "Product positioning, launch niche, business model design"],
  ["Internal research", "PageCast workspace", "2026-05-16", "docs/MARKETING_COMPETITOR_RESEARCH.md", "Competitor and marketing research brief"],
];
body(sources.getRange("A5:E18"));

// Checks
setCols(checks, [260, 140, 140, 140, 110, 300]);
title(checks, "A1:F1", "Model Checks", "Formula and logic checks for workbook confidence.");
checks.getRange("A4:F4").values = [["Check", "Actual", "Expected", "Difference", "Status", "Notes"]];
header(checks.getRange("A4:F4"));
checks.getRange("A5:F11").values = [
  ["Revenue total ties to components - 2028", "", "", "", "", "Revenue Model row 22 equals sum of revenue lines"],
  ["COGS subtotal ties - 2028", "", "", "", "", "Costs row 10 equals rows 6:9"],
  ["Gross profit formula - 2028", "", "", "", "", "Revenue minus COGS"],
  ["Opex subtotal ties - 2028", "", "", "", "", "Costs row 20 equals rows 13:19"],
  ["EBITDA formula - 2028", "", "", "", "", "Gross profit minus opex"],
  ["Cash roll-forward - 2028", "", "", "", "", "Ending cash equals starting/prior cash plus EBITDA"],
  ["Model status", "", "", "", "", "All checks should show OK"],
];
body(checks.getRange("A5:F11"));
checks.getRange("B5").formulas = [["='Revenue Model'!D22"]];
checks.getRange("C5").formulas = [["=SUM('Revenue Model'!D10,'Revenue Model'!D13,'Revenue Model'!D17,'Revenue Model'!D20,'Revenue Model'!D21)"]];
checks.getRange("D5").formulas = [["=B5-C5"]];
checks.getRange("B6").formulas = [["='Costs & COGS'!D10"]];
checks.getRange("C6").formulas = [["=SUM('Costs & COGS'!D6:D9)"]];
checks.getRange("D6").formulas = [["=B6-C6"]];
checks.getRange("B7").formulas = [["='Costs & COGS'!D11"]];
checks.getRange("C7").formulas = [["='Costs & COGS'!D5-'Costs & COGS'!D10"]];
checks.getRange("D7").formulas = [["=B7-C7"]];
checks.getRange("B8").formulas = [["='Costs & COGS'!D20"]];
checks.getRange("C8").formulas = [["=SUM('Costs & COGS'!D13:D19)"]];
checks.getRange("D8").formulas = [["=B8-C8"]];
checks.getRange("B9").formulas = [["='Costs & COGS'!D21"]];
checks.getRange("C9").formulas = [["='Costs & COGS'!D11-'Costs & COGS'!D20"]];
checks.getRange("D9").formulas = [["=B9-C9"]];
checks.getRange("B10").formulas = [["='Costs & COGS'!D24"]];
checks.getRange("C10").formulas = [["='Costs & COGS'!D23+'Costs & COGS'!D21"]];
checks.getRange("D10").formulas = [["=B10-C10"]];
for (let row = 5; row <= 10; row++) {
  checks.getRange(`E${row}`).formulas = [[`=IF(ABS(D${row})<1,"OK","Check")`]];
}
checks.getRange("E11").formulas = [["=IF(COUNTIF(E5:E10,\"Check\")=0,\"OK\",\"Review\")"]];
money(checks.getRange("B5:D10"));
checks.getRange("E5:E11").format = { font: { bold: true } };

// Dashboard after model sheets exist
setCols(dashboard, [190, 130, 130, 130, 45, 170, 150, 150, 150, 150]);
title(dashboard, "A1:J1", "PageCast Business Model Dashboard", "Cinematic read-and-listen story platform | Base model with editable assumptions and scenarios.");
dashboard.getRange("A4:D4").values = [["KPI", 2026, 2027, 2028]];
header(dashboard.getRange("A4:D4"));
dashboard.getRange("A5:D13").values = [
  ["Active readers", "", "", ""],
  ["Paid readers", "", "", ""],
  ["Gross billings", "", "", ""],
  ["Gross profit", "", "", ""],
  ["Gross margin", "", "", ""],
  ["Operating expenses", "", "", ""],
  ["EBITDA", "", "", ""],
  ["Ending cash", "", "", ""],
  ["Funding required", "", "", ""],
];
body(dashboard.getRange("A5:D13"));
for (let i = 0; i < years.length; i++) {
  const col = String.fromCharCode("B".charCodeAt(0) + i);
  dashboard.getRange(`${col}5`).formulas = [[`='Revenue Model'!${col}5`]];
  dashboard.getRange(`${col}6`).formulas = [[`='Revenue Model'!${col}7`]];
  dashboard.getRange(`${col}7`).formulas = [[`='Revenue Model'!${col}22`]];
  dashboard.getRange(`${col}8`).formulas = [[`='Costs & COGS'!${col}11`]];
  dashboard.getRange(`${col}9`).formulas = [[`='Costs & COGS'!${col}12`]];
  dashboard.getRange(`${col}10`).formulas = [[`='Costs & COGS'!${col}20`]];
  dashboard.getRange(`${col}11`).formulas = [[`='Costs & COGS'!${col}21`]];
  dashboard.getRange(`${col}12`).formulas = [[`='Costs & COGS'!${col}24`]];
  dashboard.getRange(`${col}13`).formulas = [[`='Costs & COGS'!${col}25`]];
}
countFmt(dashboard.getRange("B5:D6"));
money(dashboard.getRange("B7:D8"));
pct(dashboard.getRange("B9:D9"));
money(dashboard.getRange("B10:D13"));
dashboard.getRange("F4:J4").values = [["Strategic Lens", "PageCast Answer", "", "", ""]];
header(dashboard.getRange("F4:J4"));
dashboard.getRange("F5:J12").values = [
  ["Launch wedge", "Children's Islamic stories, bedtime/moral stories, language learning", "", "", ""],
  ["Primary buyer", "Parents first; teachers and faith educators second", "", "", ""],
  ["Revenue model", "Story unlocks now; subscription and Creator Pro after catalog depth", "", "", ""],
  ["Differentiator", "Text + character voices + atmosphere + browser commerce", "", "", ""],
  ["Go-to-market", "Short-form demos, WhatsApp sharing, parent communities, creator pilots", "", "", ""],
  ["Catalog target", "10 strong flagship PageCasts before public launch", "", "", ""],
  ["Main risk", "Cold-start catalog and trust around child safety, copyright, and AI voice disclosure", "", "", ""],
  ["Model status", "", "", "", ""],
];
for (let r = 5; r <= 12; r++) {
  dashboard.getRange(`F${r}:J${r}`).merge(true);
}
body(dashboard.getRange("F5:J12"));
dashboard.getRange("F12").formulas = [["='Checks'!E11"]];
dashboard.getRange("A16:D19").values = [
  ["Revenue Mix", 2026, 2027, 2028],
  ["Story unlocks", "", "", ""],
  ["Family subscription", "", "", ""],
  ["Creator + education + tools", "", "", ""],
];
header(dashboard.getRange("A16:D16"));
body(dashboard.getRange("A17:D19"));
for (let i = 0; i < years.length; i++) {
  const col = String.fromCharCode("B".charCodeAt(0) + i);
  dashboard.getRange(`${col}17`).formulas = [[`='Revenue Model'!${col}10`]];
  dashboard.getRange(`${col}18`).formulas = [[`='Revenue Model'!${col}13`]];
  dashboard.getRange(`${col}19`).formulas = [[`=SUM('Revenue Model'!${col}17,'Revenue Model'!${col}20,'Revenue Model'!${col}21)`]];
}
money(dashboard.getRange("B17:D19"));

dashboard.getRange("F16:J20").values = [
  ["Year", "Revenue", "Gross Profit", "EBITDA", "Ending Cash"],
  [2026, "", "", "", ""],
  [2027, "", "", "", ""],
  [2028, "", "", "", ""],
  ["", "", "", "", ""],
];
header(dashboard.getRange("F16:J16"));
body(dashboard.getRange("F17:J19"));
for (let r = 17; r <= 19; r++) {
  const sourceCol = String.fromCharCode("B".charCodeAt(0) + (r - 17));
  dashboard.getRange(`G${r}`).formulas = [[`=B${7 + (r - 17) * 0}`]];
  dashboard.getRange(`G${r}`).formulas = [[`='Revenue Model'!${sourceCol}22`]];
  dashboard.getRange(`H${r}`).formulas = [[`='Costs & COGS'!${sourceCol}11`]];
  dashboard.getRange(`I${r}`).formulas = [[`='Costs & COGS'!${sourceCol}21`]];
  dashboard.getRange(`J${r}`).formulas = [[`='Costs & COGS'!${sourceCol}24`]];
}
money(dashboard.getRange("G17:J19"));

dashboard.getRange("A22:D22").values = [["Revenue Mix Chart Data", 2026, 2027, 2028]];
header(dashboard.getRange("A22:D22"));
dashboard.getRange("A23:D25").formulas = [
  ["=A17", "=B17", "=C17", "=D17"],
  ["=A18", "=B18", "=C18", "=D18"],
  ["=A19", "=B19", "=C19", "=D19"],
];
body(dashboard.getRange("A23:D25"));
money(dashboard.getRange("B23:D25"));
dashboard.getRange("F22:J22").values = [["Trend Chart Data", "Revenue", "Gross Profit", "EBITDA", "Ending Cash"]];
header(dashboard.getRange("F22:J22"));
dashboard.getRange("F23:J25").formulas = [
  ["=F17", "=G17", "=H17", "=I17", "=J17"],
  ["=F18", "=G18", "=H18", "=I18", "=J18"],
  ["=F19", "=G19", "=H19", "=I19", "=J19"],
];
body(dashboard.getRange("F23:J25"));
money(dashboard.getRange("G23:J25"));

// Tables and freeze panes
for (const s of [assumptions, revenue, costs, funnel, scenarios, unit, roadmap, competitors, sources, checks, dashboard]) {
  try { s.freezePanes.freezeRows(4); } catch {}
}

// Conditional formatting for status cells
checks.getRange("E5:E11").format = { fill: "#DCFCE7", font: { color: "#166534", bold: true } };

// Final visual/format tuning
for (const s of [dashboard, canvas, assumptions, revenue, costs, funnel, scenarios, unit, roadmap, competitors, sources, checks]) {
  const used = s.getUsedRange();
  used.format.font = { size: 10, color: theme.text };
  s.getRange("A1:J1").format.font = { size: 18, bold: true, color: theme.white };
}

await fs.mkdir(outputDir, { recursive: true });

const inspectDashboard = await wb.inspect({
  kind: "table",
  range: "Dashboard!A1:J20",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 10,
  maxChars: 3000,
});
console.log(inspectDashboard.ndjson);

const errorScan = await wb.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errorScan.ndjson);

for (const sheetName of ["Dashboard", "Assumptions", "Revenue Model", "Costs & COGS", "Marketing Funnel", "Scenarios", "Unit Economics", "Business Model Canvas", "Competitor Matrix", "Launch Roadmap", "Checks"]) {
  const preview = await wb.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/${sheetName.replaceAll(" ", "_").replaceAll("&", "and")}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(outputPath);
console.log(`Saved ${outputPath}`);
