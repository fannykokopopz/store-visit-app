// ============================================================
// TC Acoustic Store Intelligence — Sheets Writer
// File: sheets_writer.gs
// Reads and writes all data to Google Sheets
// ============================================================

// Sheet tab names
const SHEETS = {
  VISITS: 'Visit Log',
  STORES: 'Store Master',
  CM_ROSTER: 'CM Roster',
  ANALYSIS: 'Latest Analysis'
};

// ── Write a visit + analysis result to the Visit Log ─────────────────────────
function writeVisitToSheet(data) {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SHEET_ID')
  );

  const sheet = getOrCreateSheet(ss, SHEETS.VISITS);

  // Write headers on first row if empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Timestamp', 'CM Name', 'User ID', 'Country', 'Store Name',
      'Raw Notes', 'Overall Health', 'Stock Status', 'Stock Summary',
      'SKUs at Risk', 'Momentum', 'Momentum Summary',
      'Competitor Level', 'Competitor Threats', 'Training Urgency',
      'Training Gaps', 'Follow Ups', 'Key Insight', 'Recommended Action',
      'Staff Relationship', 'Visit Quality'
    ]);
    // Freeze header row
    sheet.setFrozenRows(1);
    // Format header
    sheet.getRange(1, 1, 1, 21)
      .setBackground('#1D1D1F')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
  }

  // Append the visit row
  sheet.appendRow([
    data.timestamp,
    data.cm_name,
    data.user_id,
    data.country,
    data.store_name,
    data.raw_notes,
    data.overall_health,
    data.stock_status,
    data.stock_summary,
    (data.stock_skus_at_risk || []).join('; '),
    data.momentum,
    data.momentum_summary,
    data.competitor_level,
    (data.competitor_threats || []).join('; '),
    data.training_urgency,
    (data.training_gaps || []).join('; '),
    (data.follow_ups || []).join('; '),
    data.key_insight,
    data.recommended_action,
    data.staff_relationship,
    data.visit_quality
  ]);

  // Also update the Latest Analysis sheet — one row per store (upsert)
  updateLatestAnalysis(ss, data);
}

// ── Upsert latest analysis per store ─────────────────────────────────────────
function updateLatestAnalysis(ss, data) {
  const sheet = getOrCreateSheet(ss, SHEETS.ANALYSIS);

  // Write headers if empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Store Name', 'Country', 'CM Name', 'Last Visit', 'Days Since Visit',
      'Overall Health', 'Stock Status', 'Stock Summary', 'SKUs at Risk',
      'Momentum', 'Momentum Summary', 'Competitor Level', 'Competitor Threats',
      'Training Urgency', 'Training Gaps', 'Key Insight', 'Recommended Action',
      'Staff Relationship', 'Total Visits'
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 19)
      .setBackground('#1D1D1F')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
  }

  const lastRow = sheet.getLastRow();
  const storeNames = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(r => r[0])
    : [];

  const existingIdx = storeNames.indexOf(data.store_name);
  const totalVisits = getTotalVisitCount(ss, data.store_name);

  const rowData = [
    data.store_name,
    data.country,
    data.cm_name,
    new Date().toLocaleDateString('en-GB'),
    0, // days since visit — always 0 when just logged
    data.overall_health,
    data.stock_status,
    data.stock_summary,
    (data.stock_skus_at_risk || []).join('; '),
    data.momentum,
    data.momentum_summary,
    data.competitor_level,
    (data.competitor_threats || []).join('; '),
    data.training_urgency,
    (data.training_gaps || []).join('; '),
    data.key_insight,
    data.recommended_action,
    data.staff_relationship,
    totalVisits
  ];

  if (existingIdx >= 0) {
    // Update existing row
    sheet.getRange(existingIdx + 2, 1, 1, rowData.length).setValues([rowData]);
  } else {
    // Append new row
    sheet.appendRow(rowData);
  }

  // Colour-code the health column
  colourHealthRows(sheet);
}

// ── Get all latest analyses (for dashboard rebuild) ───────────────────────────
function getAllLatestAnalyses() {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SHEET_ID')
  );
  const sheet = ss.getSheetByName(SHEETS.ANALYSIS);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const headers = [
    'store_name', 'country', 'cm_name', 'last_visit', 'days_ago',
    'overall_health', 'stock_status', 'stock_summary', 'stock_skus_at_risk',
    'momentum', 'momentum_summary', 'competitor_level', 'competitor_threats',
    'training_urgency', 'training_gaps', 'key_insight', 'recommended_action',
    'staff_relationship', 'total_visits'
  ];
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();

  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    // Parse semicolon-separated arrays back
    ['stock_skus_at_risk', 'competitor_threats', 'training_gaps'].forEach(field => {
      obj[field] = obj[field] ? obj[field].split('; ').filter(Boolean) : [];
    });
    // Calculate days since last visit
    if (obj.last_visit) {
      const lastDate = obj.last_visit instanceof Date
        ? obj.last_visit
        : new Date(obj.last_visit.split('/').reverse().join('-'));
      obj.days_ago = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
    }
    return obj;
  });
}

// ── Get store list for a CM (from CM Roster sheet) ───────────────────────────
function getStoreListForChat(chatId) {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SHEET_ID')
  );
  const sheet = ss.getSheetByName(SHEETS.CM_ROSTER);
  // Return null (not the default list) when the roster sheet doesn't exist yet,
  // so callers can correctly distinguish "no assignment" from "assigned stores".
  if (!sheet || sheet.getLastRow() < 2) return null;

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  // Columns: Telegram Chat ID | CM Name | Store Name | Country | Active
  const stores = data
    .filter(row => row[0].toString() === chatId.toString() && row[4].toString().toLowerCase() !== 'no')
    .map(row => row[2])
    .filter(Boolean);

  // Return null when not found so callers can distinguish "assigned" from "fallback"
  return stores.length > 0 ? stores : null;
}

// ── Get CM's stores with their current health ─────────────────────────────────
function getMyStoresSummary(chatId) {
  const stores = getStoreListForChat(chatId) || getDefaultStoreList();
  const allAnalyses = getAllLatestAnalyses();

  return stores.map(storeName => {
    const analysis = allAnalyses.find(a => a.store_name === storeName);
    if (analysis) {
      return {
        store: storeName,
        health: analysis.overall_health,
        momentum: analysis.momentum,
        key_insight: analysis.key_insight,
        days_ago: analysis.days_ago
      };
    }
    return { store: storeName, health: 'watch', momentum: 'flat', key_insight: 'No visits logged yet', days_ago: 999 };
  });
}

// ── Get total visit count for a store ────────────────────────────────────────
function getTotalVisitCount(ss, storeName) {
  const sheet = ss.getSheetByName(SHEETS.VISITS);
  if (!sheet || sheet.getLastRow() < 2) return 1;

  const storeCol = sheet.getRange(2, 5, sheet.getLastRow() - 1, 1).getValues();
  return storeCol.filter(row => row[0] === storeName).length + 1;
}

// ── Colour health rows in Latest Analysis sheet ───────────────────────────────
function colourHealthRows(sheet) {
  if (sheet.getLastRow() < 2) return;
  const healthCol = sheet.getRange(2, 6, sheet.getLastRow() - 1, 1).getValues();
  const colours = { 'at-risk': '#FEE2E2', 'watch': '#FEF3C7', 'healthy': '#D1FAE5', 'strong': '#D1FAE5' };

  healthCol.forEach((row, i) => {
    const colour = colours[row[0]] || '#FFFFFF';
    sheet.getRange(i + 2, 1, 1, 19).setBackground(colour);
  });
}

// ── Helper: get or create a sheet tab ────────────────────────────────────────
function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

// ── Default store list (fallback if CM Roster not set up yet) ─────────────────
function getDefaultStoreList() {
  return [
    'Harvey Norman @ West Gate',
    'Harvey Norman @ Parkway Parade',
    'Harvey Norman @ Millenia Walk',
    'Harvey Norman @ Northpoint',
    'Harvey Norman @ Suntec City',
    'Harvey Norman @ Jurong Point',
    'Best Denki @ Vivocity',
    'Best Denki @ Ngee Ann City',
    'Best Denki @ Plaza Singapura',
    'Sprint-Cass @ T1 (#02-52)',
    'Sprint-Cass @ T1 (#02-36)',
    'Sprint-Cass @ T2 (#02-186)',
    'Sprint-Cass @ T2 (#02-150)',
    'Sprint-Cass @ T3 (#02-30)',
    'Sprint-Cass @ T3 (#02-61/62)',
    'Sprint-Cass @ T4 (#02-51)',
    'Challenger @ ION',
    'Challenger @ Plaza Singapura',
    'Challenger @ Vivocity',
    'Challenger @ Bugis B1',
    'Challenger @ JEM',
    'Challenger @ NEX',
    'Challenger @ Jurong Point',
    'Challenger @ Causeway Point'
  ];
}

// ── Setup function: create the Google Sheet structure ─────────────────────────
// Run this ONCE manually to initialise the spreadsheet
function setupSpreadsheet() {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SHEET_ID')
  );

  // Create all tabs
  Object.values(SHEETS).forEach(name => getOrCreateSheet(ss, name));

  // Set up CM Roster headers
  const rosterSheet = ss.getSheetByName(SHEETS.CM_ROSTER);
  if (rosterSheet.getLastRow() === 0) {
    rosterSheet.appendRow(['Telegram Chat ID', 'CM Name', 'Store Name', 'Country', 'Active']);
    rosterSheet.setFrozenRows(1);
    rosterSheet.getRange(1, 1, 1, 5)
      .setBackground('#1D1D1F')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
  }

  // Set up Store Master headers
  const storeSheet = ss.getSheetByName(SHEETS.STORES);
  if (storeSheet.getLastRow() === 0) {
    storeSheet.appendRow(['Store Name', 'Country', 'Tier', 'Chain', 'Active']);
    storeSheet.setFrozenRows(1);
    storeSheet.getRange(1, 1, 1, 5)
      .setBackground('#1D1D1F')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');

    // Pre-populate SG stores
    getDefaultStoreList().forEach(store => {
      const chain = store.split(' @ ')[0];
      storeSheet.appendRow([store, 'SG', 'Tier 1', chain, 'Yes']);
    });
  }

  Logger.log('Spreadsheet setup complete.');
  return ss.getUrl();
}
