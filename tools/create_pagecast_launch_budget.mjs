import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "outputs/pagecast_launch_budget";
const outputPath = `${outputDir}/PageCast_Launch_Budget.xlsx`;

const wb = Workbook.create();

const c = {
  navy: "#172033",
  slate: "#25324A",
  purple: "#6D5DFB",
  gold: "#F4C542",
  green: "#1F8A70",
  red: "#C2410C",
  bg: "#F7F8FB",
  soft: "#EDEFF7",
  white: "#FFFFFF",
  text: "#111827",
  input: "#FFF2CC",
  inputFont: "#0000FF",
};

function addSheet(name) {
  const s = wb.worksheets.add(name);
  s.showGridLines = false;
  return s;
}

function setCols(sheet, widths) {
  widths.forEach((w, i) => sheet.getRangeByIndexes(0, i, 1, 1).format.columnWidthPx = w);
}

function title(sheet, range, text, subtitle = "") {
  const r = sheet.getRange(range);
  r.merge();
  r.values = [[text]];
  r.format = { fill: c.navy, font: { bold: true, color: c.white, size: 18 }, horizontalAlignment: "left" };
  r.format.rowHeightPx = 34;
  if (subtitle) {
    const row = Number(range.match(/\d+/)[0]) + 1;
    const sub = sheet.getRange(`A${row}:H${row}`);
    sub.merge();
    sub.values = [[subtitle]];
    sub.format = { fill: c.slate, font: { color: "#D9E2F3", italic: true, size: 10 } };
  }
}

function section(sheet, range, text) {
  const r = sheet.getRange(range);
  r.merge();
  r.values = [[text]];
  r.format = { fill: c.slate, font: { bold: true, color: c.white }, horizontalAlignment: "left" };
}

function header(range) {
  range.format = { fill: c.purple, font: { bold: true, color: c.white }, horizontalAlignment: "center", wrapText: true };
}

function body(range) {
  range.format = { fill: c.white, font: { color: c.text }, wrapText: true, verticalAlignment: "top" };
}

function input(range) {
  range.format = { fill: c.input, font: { color: c.inputFont } };
}

function money(range) { range.format.numberFormat = "$#,##0;[Red]($#,##0);-"; }
function pct(range) { range.format.numberFormat = "0.0%;[Red](0.0%);-"; }
function count(range) { range.format.numberFormat = "#,##0;[Red](#,##0);-"; }

const dashboard = addSheet("Dashboard");
const assumptions = addSheet("Assumptions");
const setup = addSheet("Setup Budget");
const monthly = addSheet("Monthly Opex");
const cash = addSheet("12-Month Cash Plan");
const stack = addSheet("Service Stack");
const marketing = addSheet("Launch Marketing");
const sources = addSheet("Sources");
const checks = addSheet("Checks");

// Assumptions
setCols(assumptions, [230, 120, 120, 120, 110, 340]);
title(assumptions, "A1:F1", "PageCast Launch Budget Assumptions", "Solopreneur launch budget. Blue/yellow cells are editable; model outputs update from this tab.");
section(assumptions, "A4:F4", "Scenario Selector");
assumptions.getRange("A5:F5").values = [["Selected Scenario", "Recommended", "", "Currency", "USD", ""]];
body(assumptions.getRange("A5:F5"));
input(assumptions.getRange("B5"));
input(assumptions.getRange("E5"));
assumptions.getRange("B5").dataValidation = { rule: { type: "list", values: ["Lean", "Recommended", "Safer Launch"] } };

section(assumptions, "A8:F8", "Setup and Pre-Launch Budget Inputs");
assumptions.getRange("A9:F9").values = [["Cost Item", "Lean", "Recommended", "Safer Launch", "Type", "Notes"]];
header(assumptions.getRange("A9:F9"));
const setupRows = [
  ["Domain registration / transfer", 12, 15, 25, "One-time", ".com or similar; renewal may vary"],
  ["Business email setup", 12, 84, 84, "One-time/annual", "Zoho low-cost or Google Workspace first year"],
  ["Legal policy review / templates", 300, 1000, 2500, "One-time", "Privacy, terms, creator terms, copyright/takedown"],
  ["Business registration / accounting setup", 150, 300, 700, "One-time", "Entity, bookkeeping, tax setup"],
  ["Branding / landing assets", 50, 250, 750, "One-time", "Logo polish, screenshots, social graphics"],
  ["Launch catalog production", 500, 1500, 3500, "One-time", "10 flagship stories, covers, audio passes, QA"],
  ["Initial audio/music/SFX library", 75, 250, 600, "One-time", "Licensed music, SFX, premium voice credits"],
  ["Compliance / child-safety review buffer", 200, 600, 1500, "One-time", "Extra review before family/children marketing"],
  ["Payment test budget", 30, 75, 150, "One-time", "Test transactions, refunds, payment edge cases"],
  ["Launch contingency", 0.1, 0.15, 0.2, "%", "Contingency applied to one-time setup subtotal"],
];
assumptions.getRange("A10:F19").values = setupRows;
body(assumptions.getRange("A10:F19"));
input(assumptions.getRange("B10:D19"));
money(assumptions.getRange("B10:D18"));
pct(assumptions.getRange("B19:D19"));

section(assumptions, "H4:M4", "Monthly Operating Budget Inputs");
assumptions.getRange("H5:M5").values = [["Cost Item", "Lean", "Recommended", "Safer Launch", "Category", "Notes"]];
header(assumptions.getRange("H5:M5"));
const monthlyRows = [
  ["Hosting - Vercel", 0, 20, 20, "Infrastructure", "Hobby for early tests; Pro for production/commercial use"],
  ["Database/Auth - Supabase", 0, 25, 25, "Infrastructure", "Free for early tests; Pro recommended before launch"],
  ["Object storage - Cloudflare R2", 3, 8, 20, "Infrastructure", "Audio/covers storage buffer; usage based"],
  ["Transactional email - Resend", 0, 20, 20, "Email", "Free tier initially; Pro if volume/branding requires"],
  ["Business email - Google/Zoho", 1, 7, 7, "Email", "One solopreneur inbox"],
  ["AI text / assistant tools", 20, 40, 80, "AI tools", "Writing, support, content ops"],
  ["AI voice / TTS credits", 6, 22, 99, "Audio", "Starter/creator/pro depending on production needs"],
  ["Design tools", 0, 15, 20, "Creative", "Canva or equivalent"],
  ["Analytics / monitoring", 0, 0, 20, "Infrastructure", "Free tier first; paid monitoring buffer"],
  ["Accounting / invoicing tools", 0, 15, 30, "Operations", "May start with spreadsheets"],
  ["Legal/compliance reserve", 50, 150, 300, "Operations", "Monthly reserve for reviews, notices, admin"],
  ["Customer support / moderation reserve", 0, 50, 150, "Operations", "Solo time plus occasional help"],
  ["Marketing tests", 150, 500, 1500, "Marketing", "Short-form demos, parent communities, creator tests"],
  ["Community / creator incentives", 50, 150, 400, "Marketing", "Beta rewards, small creator payments, giveaways"],
  ["Misc SaaS buffer", 25, 75, 150, "Operations", "Unexpected tools, plugins, templates"],
];
assumptions.getRange("H6:M20").values = monthlyRows;
body(assumptions.getRange("H6:M20"));
input(assumptions.getRange("I6:K20"));
money(assumptions.getRange("I6:K20"));

section(assumptions, "H23:M23", "Cash Plan Inputs");
assumptions.getRange("H24:M24").values = [["Input", "Lean", "Recommended", "Safer Launch", "Unit", "Notes"]];
header(assumptions.getRange("H24:M24"));
assumptions.getRange("H25:M29").values = [
  ["Starting cash available", 3000, 8000, 20000, "$", "Cash reserved specifically for PageCast launch"],
  ["Months before paid launch", 2, 3, 4, "months", "Pre-launch runway before first revenue"],
  ["Average paid unlock price", 2.99, 3.99, 4.99, "$", "Story unlock price"],
  ["Creator payout share", 0.65, 0.6, 0.55, "%", "Share of story unlock GMV paid to creators"],
  ["Payment processing variable fee", 0.035, 0.035, 0.032, "%", "Stripe/payment processing assumption"],
];
body(assumptions.getRange("H25:M29"));
input(assumptions.getRange("I25:K29"));
money(assumptions.getRange("I25:K27"));
pct(assumptions.getRange("I28:K29"));

// Setup budget
setCols(setup, [250, 120, 120, 120, 120, 330]);
title(setup, "A1:F1", "One-Time Setup Budget", "Pre-launch cash needed before public launch.");
setup.getRange("A4:F4").values = [["Item", "Lean", "Recommended", "Safer Launch", "Selected", "Notes"]];
header(setup.getRange("A4:F4"));
for (let r = 0; r < 9; r++) {
  const row = 5 + r;
  setup.getRange(`A${row}:D${row}`).formulas = [[`=Assumptions!A${10 + r}`, `=Assumptions!B${10 + r}`, `=Assumptions!C${10 + r}`, `=Assumptions!D${10 + r}`]];
  setup.getRange(`E${row}`).formulas = [[`=INDEX(B${row}:D${row},1,MATCH(Assumptions!$B$5,$B$4:$D$4,0))`]];
  setup.getRange(`F${row}`).formulas = [[`=Assumptions!F${10 + r}`]];
}
setup.getRange("A14:F14").values = [["Subtotal before contingency", "", "", "", "", ""]];
setup.getRange("B14").formulas = [["=SUM(B5:B13)"]];
setup.getRange("C14").formulas = [["=SUM(C5:C13)"]];
setup.getRange("D14").formulas = [["=SUM(D5:D13)"]];
setup.getRange("E14").formulas = [["=SUM(E5:E13)"]];
setup.getRange("A15:F15").values = [["Contingency", "", "", "", "", ""]];
setup.getRange("B15").formulas = [["=B14*Assumptions!B19"]];
setup.getRange("C15").formulas = [["=C14*Assumptions!C19"]];
setup.getRange("D15").formulas = [["=D14*Assumptions!D19"]];
setup.getRange("E15").formulas = [["=E14*INDEX(Assumptions!$B$19:$D$19,1,MATCH(Assumptions!$B$5,Assumptions!$B$9:$D$9,0))"]];
setup.getRange("A16:F16").values = [["Total setup budget", "", "", "", "", ""]];
setup.getRange("B16").formulas = [["=B14+B15"]];
setup.getRange("C16").formulas = [["=C14+C15"]];
setup.getRange("D16").formulas = [["=D14+D15"]];
setup.getRange("E16").formulas = [["=E14+E15"]];
body(setup.getRange("A5:F16"));
setup.getRange("A14:F16").format = { fill: c.soft, font: { bold: true } };
money(setup.getRange("B5:E16"));

// Monthly operating budget
setCols(monthly, [250, 120, 120, 120, 120, 140, 290]);
title(monthly, "A1:G1", "Monthly Operating Budget", "Recurring monthly cost to keep PageCast live as a solopreneur.");
monthly.getRange("A4:G4").values = [["Item", "Lean", "Recommended", "Safer Launch", "Selected", "Category", "Notes"]];
header(monthly.getRange("A4:G4"));
for (let r = 0; r < monthlyRows.length; r++) {
  const row = 5 + r;
  monthly.getRange(`A${row}:D${row}`).formulas = [[`=Assumptions!H${6 + r}`, `=Assumptions!I${6 + r}`, `=Assumptions!J${6 + r}`, `=Assumptions!K${6 + r}`]];
  monthly.getRange(`E${row}`).formulas = [[`=INDEX(B${row}:D${row},1,MATCH(Assumptions!$B$5,$B$4:$D$4,0))`]];
  monthly.getRange(`F${row}`).formulas = [[`=Assumptions!L${6 + r}`]];
  monthly.getRange(`G${row}`).formulas = [[`=Assumptions!M${6 + r}`]];
}
const mTotal = 5 + monthlyRows.length;
monthly.getRange(`A${mTotal}:G${mTotal}`).values = [["Total monthly opex", "", "", "", "", "", ""]];
monthly.getRange(`B${mTotal}`).formulas = [[`=SUM(B5:B${mTotal - 1})`]];
monthly.getRange(`C${mTotal}`).formulas = [[`=SUM(C5:C${mTotal - 1})`]];
monthly.getRange(`D${mTotal}`).formulas = [[`=SUM(D5:D${mTotal - 1})`]];
monthly.getRange(`E${mTotal}`).formulas = [[`=SUM(E5:E${mTotal - 1})`]];
body(monthly.getRange(`A5:G${mTotal}`));
monthly.getRange(`A${mTotal}:G${mTotal}`).format = { fill: c.soft, font: { bold: true } };
money(monthly.getRange(`B5:E${mTotal}`));

// Service Stack
setCols(stack, [170, 160, 130, 130, 150, 310]);
title(stack, "A1:F1", "Recommended Service Stack", "Practical default setup for a PageCast solopreneur launch.");
stack.getRange("A4:F4").values = [["Area", "Recommended Tool", "Monthly Budget", "Annual/Setup", "Priority", "Why"]];
header(stack.getRange("A4:F4"));
stack.getRange("A5:F18").values = [
  ["Domain/DNS", "Cloudflare Registrar + DNS", 0, 15, "Must-have", "Low-renewal domain, strong DNS, SSL/CDN basics"],
  ["Hosting", "Vercel Pro", 20, 0, "Must-have", "Production Next.js hosting for reader/studio apps"],
  ["Database/Auth", "Supabase Pro", 25, 0, "Must-have", "Postgres, Auth, Storage/RLS; Pro before serious public launch"],
  ["Object Storage", "Cloudflare R2", 8, 0, "Must-have", "Audio and cover storage with no egress fees"],
  ["Transactional Email", "Resend", 20, 0, "Should-have", "Login, purchase, creator/admin notifications"],
  ["Business Email", "Google Workspace", 7, 84, "Must-have", "Domain email and trust for support/legal contact"],
  ["Payments", "Stripe", 0, 0, "Must-have", "No fixed monthly fee; variable processing fees"],
  ["AI Text", "OpenAI API / ChatGPT", 40, 0, "Should-have", "Story editing, content ops, support, metadata"],
  ["AI Voice", "ElevenLabs or OpenAI TTS", 22, 0, "Should-have", "Narration/character voice production"],
  ["Design", "Canva or equivalent", 15, 0, "Could defer", "Launch graphics and social/video assets"],
  ["Analytics", "Free tier first", 0, 0, "Should-have", "Track funnel, activation, story completion"],
  ["Accounting", "Spreadsheet first", 0, 0, "Could defer", "Upgrade when revenue starts"],
  ["Legal", "Counsel/templates", 150, 1000, "Must-have", "Children/privacy/copyright risk management"],
  ["Marketing", "Paid test budget", 500, 0, "Must-have", "Validate parent and creator demand"],
];
body(stack.getRange("A5:F18"));
money(stack.getRange("C5:D18"));

// Launch Marketing
setCols(marketing, [210, 120, 120, 130, 130, 270]);
title(marketing, "A1:F1", "Launch Marketing Budget", "First 90-day launch spend plan focused on proof, not vanity.");
marketing.getRange("A4:F4").values = [["Channel / Activity", "Month 1", "Month 2", "Month 3", "Total", "Goal"]];
header(marketing.getRange("A4:F4"));
marketing.getRange("A5:F13").values = [
  ["Short-form demo production", 150, 150, 150, "", "Create 10-20 clips comparing ebook/audiobook/PageCast"],
  ["TikTok/Reels paid tests", 150, 250, 350, "", "Find parent/creator messages that convert"],
  ["Parent/community collaborations", 100, 150, 200, "", "Islamic parenting, homeschool, teacher groups"],
  ["Creator pilot incentives", 100, 150, 250, "", "Get early authors/educators to publish"],
  ["Beta family rewards/giveaways", 50, 75, 100, "", "Encourage testimonials and referrals"],
  ["Email/landing copy/tools", 25, 25, 25, "", "Lead capture and onboarding polish"],
  ["PR/community outreach", 0, 50, 100, "", "Local press, education communities"],
  ["Buffer", 25, 50, 75, "", "Unplanned creative tests"],
  ["Total", "", "", "", "", ""],
];
for (let r = 5; r <= 12; r++) marketing.getRange(`E${r}`).formulas = [[`=SUM(B${r}:D${r})`]];
marketing.getRange("B13").formulas = [["=SUM(B5:B12)"]];
marketing.getRange("C13").formulas = [["=SUM(C5:C12)"]];
marketing.getRange("D13").formulas = [["=SUM(D5:D12)"]];
marketing.getRange("E13").formulas = [["=SUM(E5:E12)"]];
body(marketing.getRange("A5:F13"));
marketing.getRange("A13:F13").format = { fill: c.soft, font: { bold: true } };
money(marketing.getRange("B5:E13"));

// 12-month cash plan
setCols(cash, [210, ...Array(12).fill(90), 120]);
title(cash, "A1:N1", "12-Month Cash Plan", "Simple cash runway model for the selected scenario.");
const months = Array.from({ length: 12 }, (_, i) => `M${i + 1}`);
cash.getRange("A4:N4").values = [["Metric", ...months, "Total"]];
header(cash.getRange("A4:N4"));
cash.getRange("A5:N14").values = [
  ["Beginning cash", ...Array(13).fill("")],
  ["One-time setup spend", ...Array(13).fill("")],
  ["Monthly opex", ...Array(13).fill("")],
  ["Gross revenue", ...Array(13).fill("")],
  ["Creator payouts", ...Array(13).fill("")],
  ["Payment fees", ...Array(13).fill("")],
  ["Net cash flow", ...Array(13).fill("")],
  ["Ending cash", ...Array(13).fill("")],
  ["Minimum extra funding needed", ...Array(13).fill("")],
  ["Runway status", ...Array(13).fill("")],
];
for (let i = 0; i < 12; i++) {
  const col = String.fromCharCode("B".charCodeAt(0) + i);
  const prev = i === 0 ? null : String.fromCharCode(col.charCodeAt(0) - 1);
  cash.getRange(`${col}5`).formulas = [[i === 0 ? `=INDEX(Assumptions!$I$25:$K$25,1,MATCH(Assumptions!$B$5,Assumptions!$I$24:$K$24,0))` : `=${prev}12`]];
  cash.getRange(`${col}6`).formulas = [[i === 0 ? `='Setup Budget'!E16` : `=0`]];
  cash.getRange(`${col}7`).formulas = [[`='Monthly Opex'!E${mTotal}`]];
  const launchDelay = `INDEX(Assumptions!$I$26:$K$26,1,MATCH(Assumptions!$B$5,Assumptions!$I$24:$K$24,0))`;
  const unlockPrice = `INDEX(Assumptions!$I$27:$K$27,1,MATCH(Assumptions!$B$5,Assumptions!$I$24:$K$24,0))`;
  const paidUsers = `MAX(0,(${i + 1}-${launchDelay})*25)`;
  cash.getRange(`${col}8`).formulas = [[`=IF(${i + 1}<=${launchDelay},0,${paidUsers}*${unlockPrice})`]];
  cash.getRange(`${col}9`).formulas = [[`=${col}8*INDEX(Assumptions!$I$28:$K$28,1,MATCH(Assumptions!$B$5,Assumptions!$I$24:$K$24,0))`]];
  cash.getRange(`${col}10`).formulas = [[`=${col}8*INDEX(Assumptions!$I$29:$K$29,1,MATCH(Assumptions!$B$5,Assumptions!$I$24:$K$24,0))`]];
  cash.getRange(`${col}11`).formulas = [[`=${col}8-${col}9-${col}10-${col}6-${col}7`]];
  cash.getRange(`${col}12`).formulas = [[`=${col}5+${col}11`]];
  cash.getRange(`${col}13`).formulas = [[`=MAX(0,-${col}12)`]];
  cash.getRange(`${col}14`).formulas = [[`=IF(${col}12>=0,"OK","Needs funding")`]];
}
for (let row = 5; row <= 13; row++) cash.getRange(`N${row}`).formulas = [[row === 5 || row === 12 ? `=M${row}` : `=SUM(B${row}:M${row})`]];
cash.getRange("N14").formulas = [["=IF(COUNTIF(B14:M14,\"Needs funding\")=0,\"OK\",\"Needs funding\")"]];
body(cash.getRange("A5:N14"));
money(cash.getRange("B5:N13"));
cash.getRange("A14:N14").format = { fill: c.soft, font: { bold: true } };

// Sources
setCols(sources, [190, 180, 380, 290]);
title(sources, "A1:D1", "Pricing Sources", "Current public pricing references checked on 2026-05-17. Confirm exact checkout pricing before purchase.");
sources.getRange("A4:D4").values = [["Cost Area", "Source", "URL", "Notes"]];
header(sources.getRange("A4:D4"));
sources.getRange("A5:D18").values = [
  ["Hosting", "Vercel Pricing", "https://vercel.com/pricing", "Pro listed at $20/month"],
  ["Hosting plan docs", "Vercel Account Plans", "https://vercel.com/docs/plans", "Hobby, Pro, Enterprise plan context"],
  ["Database/Auth", "Supabase Pricing", "https://supabase.com/pricing", "Pro commonly listed at $25/month; free tier available"],
  ["Object storage", "Cloudflare R2 Pricing", "https://developers.cloudflare.com/r2/pricing/", "Storage and Class A/B operations; no egress fees"],
  ["Domain registrar", "Cloudflare Registrar", "https://developers.cloudflare.com/registrar/", "At-cost domain registration/renewal model"],
  ["Domain alternative", "Namecheap Domains", "https://www.namecheap.com/domains/", "Domain search and registrar pricing reference"],
  ["Business email", "Google Workspace Pricing", "https://workspace.google.com/intl/en/pricing/", "Business Starter pricing and email/storage feature reference"],
  ["Low-cost email", "Zoho Workplace PDF", "https://www.zoho.com.cn/sites/default/files/workplace/zoho-workplace-plan-comparison-usd.pdf", "Mail Lite around $1/user/month annually"],
  ["Transactional email", "Resend Pricing", "https://resend.com/pricing", "Free/pro transactional email plans"],
  ["Payments", "Stripe Malaysia Pricing", "https://stripe.com/en-my/pricing", "Variable transaction fees; no fixed monthly fee assumed"],
  ["AI/API", "OpenAI API Pricing", "https://openai.com/api/pricing/", "AI text/audio cost reference"],
  ["AI voice", "ElevenLabs Pricing", "https://elevenlabs.io/pricing", "Voice generation paid tiers; verify current plan at checkout"],
  ["Internal research", "PageCast Marketing Research", "docs/MARKETING_COMPETITOR_RESEARCH.md", "Launch positioning, audience, and competitor research"],
  ["Internal model", "PageCast Business Model", "outputs/pagecast_business_model/PageCast_Business_Model.xlsx", "Business model workbook created earlier"],
];
body(sources.getRange("A5:D18"));

// Checks
setCols(checks, [260, 130, 130, 130, 110, 280]);
title(checks, "A1:F1", "Model Checks", "Budget tie-outs for launch budget workbook.");
checks.getRange("A4:F4").values = [["Check", "Actual", "Expected", "Difference", "Status", "Notes"]];
header(checks.getRange("A4:F4"));
checks.getRange("A5:F9").values = [
  ["Setup selected total ties", "", "", "", "", "Setup Budget selected equals subtotal plus contingency"],
  ["Monthly selected total ties", "", "", "", "", "Monthly Opex selected equals sum of selected items"],
  ["Cash plan total funding ties", "", "", "", "", "Total funding equals sum of monthly funding needs"],
  ["Ending cash formula final month", "", "", "", "", "Ending cash equals beginning cash plus net cash flow in M12"],
  ["Model status", "", "", "", "", "All checks should show OK"],
];
checks.getRange("B5").formulas = [["='Setup Budget'!E16"]];
checks.getRange("C5").formulas = [["='Setup Budget'!E14+'Setup Budget'!E15"]];
checks.getRange("D5").formulas = [["=B5-C5"]];
checks.getRange("B6").formulas = [[`='Monthly Opex'!E${mTotal}`]];
checks.getRange("C6").formulas = [[`=SUM('Monthly Opex'!E5:E${mTotal - 1})`]];
checks.getRange("D6").formulas = [["=B6-C6"]];
checks.getRange("B7").formulas = [["='12-Month Cash Plan'!N13"]];
checks.getRange("C7").formulas = [["=SUM('12-Month Cash Plan'!B13:M13)"]];
checks.getRange("D7").formulas = [["=B7-C7"]];
checks.getRange("B8").formulas = [["='12-Month Cash Plan'!M12"]];
checks.getRange("C8").formulas = [["='12-Month Cash Plan'!M5+'12-Month Cash Plan'!M11"]];
checks.getRange("D8").formulas = [["=B8-C8"]];
for (let r = 5; r <= 8; r++) checks.getRange(`E${r}`).formulas = [[`=IF(ABS(D${r})<1,"OK","Check")`]];
checks.getRange("E9").formulas = [["=IF(COUNTIF(E5:E8,\"Check\")=0,\"OK\",\"Review\")"]];
body(checks.getRange("A5:F9"));
money(checks.getRange("B5:D8"));
checks.getRange("E5:E9").format = { fill: "#DCFCE7", font: { color: "#166534", bold: true } };

// Dashboard
setCols(dashboard, [230, 140, 140, 140, 60, 230, 310]);
title(dashboard, "A1:G1", "PageCast Launch Budget Dashboard", "Solopreneur launch budget for domain, database, email, infrastructure, content, legal, and operations.");
dashboard.getRange("A4:D4").values = [["Budget Summary", "Lean", "Recommended", "Safer Launch"]];
header(dashboard.getRange("A4:D4"));
dashboard.getRange("A5:D11").values = [
  ["One-time setup total", "", "", ""],
  ["Monthly operating cost", "", "", ""],
  ["First 3 months cash needed", "", "", ""],
  ["First 6 months cash needed", "", "", ""],
  ["First 12 months cash needed", "", "", ""],
  ["Selected scenario", "", "", ""],
  ["Model status", "", "", ""],
];
dashboard.getRange("B5").formulas = [["='Setup Budget'!B16"]];
dashboard.getRange("C5").formulas = [["='Setup Budget'!C16"]];
dashboard.getRange("D5").formulas = [["='Setup Budget'!D16"]];
dashboard.getRange("B6").formulas = [[`='Monthly Opex'!B${mTotal}`]];
dashboard.getRange("C6").formulas = [[`='Monthly Opex'!C${mTotal}`]];
dashboard.getRange("D6").formulas = [[`='Monthly Opex'!D${mTotal}`]];
dashboard.getRange("B7").formulas = [["=B5+B6*3"]];
dashboard.getRange("C7").formulas = [["=C5+C6*3"]];
dashboard.getRange("D7").formulas = [["=D5+D6*3"]];
dashboard.getRange("B8").formulas = [["=B5+B6*6"]];
dashboard.getRange("C8").formulas = [["=C5+C6*6"]];
dashboard.getRange("D8").formulas = [["=D5+D6*6"]];
dashboard.getRange("B9").formulas = [["=B5+B6*12"]];
dashboard.getRange("C9").formulas = [["=C5+C6*12"]];
dashboard.getRange("D9").formulas = [["=D5+D6*12"]];
dashboard.getRange("B10:D10").formulas = [["=Assumptions!B5", "", ""]];
dashboard.getRange("B11:D11").formulas = [["='Checks'!E9", "", ""]];
body(dashboard.getRange("A5:D11"));
money(dashboard.getRange("B5:D9"));
dashboard.getRange("B10:D11").format = { fill: c.soft, font: { bold: true } };

dashboard.getRange("F4:G4").values = [["Recommended Launch Budget", "What It Means"]];
header(dashboard.getRange("F4:G4"));
dashboard.getRange("F5:G12").values = [
  ["Minimum viable cash target", "Use 3 months of selected scenario budget as the absolute floor."],
  ["Practical launch cash target", "Use 6 months of selected scenario budget so you can survive slow validation."],
  ["Recommended scenario", "Recommended: professional enough for public launch without pretending you have a team."],
  ["Domain", "Budget about $15/year for .com-style domain; confirm checkout price."],
  ["Database/Auth", "Supabase Pro at launch is safer than free tier once real users and payments arrive."],
  ["Email", "Use one business inbox plus transactional email for auth, receipts, and creator workflows."],
  ["Biggest optional spend", "Marketing and launch catalog quality. These can be throttled without breaking the platform."],
  ["Biggest risk", "Under-budgeting legal/compliance and content quality for a family/children product."],
];
body(dashboard.getRange("F5:G12"));

// Tuning
for (const s of [dashboard, assumptions, setup, monthly, cash, stack, marketing, sources, checks]) {
  try { s.freezePanes.freezeRows(4); } catch {}
  const used = s.getUsedRange();
  used.format.font = { size: 10, color: c.text };
  s.getRange("A1:N1").format.font = { size: 18, bold: true, color: c.white };
}

await fs.mkdir(outputDir, { recursive: true });

const inspectDashboard = await wb.inspect({
  kind: "table",
  range: "Dashboard!A1:G12",
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 7,
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

for (const sheetName of ["Dashboard", "Assumptions", "Setup Budget", "Monthly Opex", "12-Month Cash Plan", "Service Stack", "Launch Marketing", "Checks"]) {
  const preview = await wb.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/${sheetName.replaceAll(" ", "_").replaceAll("-", "_")}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(outputPath);
console.log(`Saved ${outputPath}`);
