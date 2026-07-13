const GITHUB_TRAFFIC_CONFIG = Object.freeze({
  repositories: [
    "ymsun2020/Mobile-GUI-Security",
    "ymsun2020/Jade-GUI-Agent",
  ],
  tokenProperty: "GITHUB_TRAFFIC_TOKEN",
  spreadsheetIdProperty: "GITHUB_TRAFFIC_SPREADSHEET_ID",
  dailySheetName: "Daily Views",
  totalsSheetName: "Totals",
  triggerHandler: "collectGithubTraffic",
  apiVersion: "2026-03-10",
});

const GITHUB_DAILY_HEADERS = Object.freeze([
  "Repository",
  "Date (UTC)",
  "Views",
  "Daily unique visitors (informational)",
  "Collected at (UTC)",
]);

const GITHUB_TOTAL_HEADERS = Object.freeze([
  "Repository",
  "Archived since (UTC)",
  "Latest archived date (UTC)",
  "Cumulative views",
  "Last collection (UTC)",
]);

/**
 * Creates the private archive spreadsheet, imports the currently available
 * 14-day window, and installs one collector trigger that runs every six hours.
 *
 * Before running this function, add a Script Property named
 * GITHUB_TRAFFIC_TOKEN containing a fine-grained GitHub token with
 * Administration: Read-only access to every configured repository.
 */
function setupGithubTrafficCollector() {
  requireGithubToken_();
  const spreadsheet = getOrCreateTrafficSpreadsheet_();

  ensureTrafficSheets_(spreadsheet);
  const result = collectGithubTraffic();
  installGithubTrafficTrigger_();

  console.log(`Traffic archive: ${spreadsheet.getUrl()}`);
  console.log(JSON.stringify(result, null, 2));
  return spreadsheet.getUrl();
}

/**
 * Fetches GitHub's rolling daily view data and upserts it by repository/date.
 * Repeated dates are replaced, so overlapping 14-day windows are never added
 * twice and GitHub's later corrections to recent dates are preserved.
 */
function collectGithubTraffic() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const token = requireGithubToken_();
    const spreadsheet = getTrafficSpreadsheet_();
    const sheets = ensureTrafficSheets_(spreadsheet);
    const rowMap = readDailyRows_(sheets.daily);
    const collectedAt = new Date().toISOString();
    const failures = [];

    GITHUB_TRAFFIC_CONFIG.repositories.forEach((repository) => {
      try {
        const response = fetchGithubDailyViews_(repository, token);

        response.views.forEach((day) => {
          const date = normalizeGithubDate_(day.timestamp);
          const key = trafficRowKey_(repository, date);

          rowMap.set(key, [
            repository,
            date,
            toNonNegativeInteger_(day.count),
            toNonNegativeInteger_(day.uniques),
            collectedAt,
          ]);
        });
      } catch (error) {
        failures.push(`${repository}: ${error.message}`);
      }
    });

    writeDailyRows_(sheets.daily, rowMap);
    const totals = writeTotals_(sheets.totals, rowMap);
    SpreadsheetApp.flush();

    if (failures.length) {
      throw new Error(`Some repositories were not updated: ${failures.join(" | ")}`);
    }

    return {
      spreadsheetUrl: spreadsheet.getUrl(),
      collectedAt,
      totals,
    };
  } finally {
    lock.releaseLock();
  }
}

/** Returns the private archive spreadsheet URL. */
function getGithubTrafficSpreadsheetUrl() {
  const url = getTrafficSpreadsheet_().getUrl();
  console.log(url);
  return url;
}

/** Rebuilds the Totals sheet exclusively from the archived daily rows. */
function rebuildGithubTrafficTotals() {
  const spreadsheet = getTrafficSpreadsheet_();
  const sheets = ensureTrafficSheets_(spreadsheet);
  const totals = writeTotals_(sheets.totals, readDailyRows_(sheets.daily));

  SpreadsheetApp.flush();
  console.log(JSON.stringify(totals, null, 2));
  return totals;
}

/** Verifies that overlapping snapshots replace a day instead of duplicating it. */
function testGithubTrafficAggregation() {
  const rows = new Map();
  const repository = GITHUB_TRAFFIC_CONFIG.repositories[0];

  rows.set(trafficRowKey_(repository, "2026-07-12"), [
    repository,
    "2026-07-12",
    3,
    2,
    "2026-07-13T00:00:00.000Z",
  ]);
  rows.set(trafficRowKey_(repository, "2026-07-12"), [
    repository,
    "2026-07-12",
    5,
    3,
    "2026-07-13T06:00:00.000Z",
  ]);
  rows.set(trafficRowKey_(repository, "2026-07-13"), [
    repository,
    "2026-07-13",
    7,
    4,
    "2026-07-13T06:00:00.000Z",
  ]);

  const summary = summarizeTrafficRows_(rows).find(
    (item) => item.repository === repository,
  );

  if (!summary || summary.cumulativeViews !== 12) {
    throw new Error(`Aggregation test failed: ${JSON.stringify(summary)}`);
  }

  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

/** Removes the scheduled collector without deleting archived data. */
function removeGithubTrafficCollectorTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(
      (trigger) =>
        trigger.getHandlerFunction() === GITHUB_TRAFFIC_CONFIG.triggerHandler,
    )
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
}

function installGithubTrafficTrigger_() {
  removeGithubTrafficCollectorTrigger();
  ScriptApp.newTrigger(GITHUB_TRAFFIC_CONFIG.triggerHandler)
    .timeBased()
    .everyHours(6)
    .create();
}

function fetchGithubDailyViews_(repository, token) {
  const encodedRepository = repository
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const url = `https://api.github.com/repos/${encodedRepository}/traffic/views?per=day`;
  const options = {
    method: "get",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": GITHUB_TRAFFIC_CONFIG.apiVersion,
      "User-Agent": "Apps-Script-GitHub-Traffic-Collector",
    },
    muteHttpExceptions: true,
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = UrlFetchApp.fetch(url, options);
    const status = response.getResponseCode();
    const body = response.getContentText();

    if (status === 200) {
      const payload = JSON.parse(body);

      if (!Array.isArray(payload.views)) {
        throw new Error("GitHub returned no daily views array");
      }

      return payload;
    }

    if ((status === 429 || status >= 500) && attempt < 2) {
      Utilities.sleep(1000 * 2 ** attempt);
      continue;
    }

    throw new Error(`GitHub API ${status}: ${safeErrorBody_(body)}`);
  }

  throw new Error("GitHub API request exhausted all retries");
}

function requireGithubToken_() {
  const token = PropertiesService.getScriptProperties()
    .getProperty(GITHUB_TRAFFIC_CONFIG.tokenProperty)
    ?.trim();

  if (!token) {
    throw new Error(
      `Missing Script Property: ${GITHUB_TRAFFIC_CONFIG.tokenProperty}`,
    );
  }

  return token;
}

function getOrCreateTrafficSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty(
    GITHUB_TRAFFIC_CONFIG.spreadsheetIdProperty,
  );

  if (existingId) {
    return SpreadsheetApp.openById(existingId);
  }

  const spreadsheet = SpreadsheetApp.create("GitHub Traffic Archive");
  properties.setProperty(
    GITHUB_TRAFFIC_CONFIG.spreadsheetIdProperty,
    spreadsheet.getId(),
  );
  return spreadsheet;
}

function getTrafficSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
    GITHUB_TRAFFIC_CONFIG.spreadsheetIdProperty,
  );

  if (!spreadsheetId) {
    throw new Error("Run setupGithubTrafficCollector() first");
  }

  return SpreadsheetApp.openById(spreadsheetId);
}

function ensureTrafficSheets_(spreadsheet) {
  const daily = getOrCreateSheet_(
    spreadsheet,
    GITHUB_TRAFFIC_CONFIG.dailySheetName,
    GITHUB_DAILY_HEADERS,
  );
  const totals = getOrCreateSheet_(
    spreadsheet,
    GITHUB_TRAFFIC_CONFIG.totalsSheetName,
    GITHUB_TOTAL_HEADERS,
  );

  daily.getRange("B:B").setNumberFormat("@");
  totals.getRange("B:C").setNumberFormat("@");
  return { daily, totals };
}

function getOrCreateSheet_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

function readDailyRows_(sheet) {
  const rowMap = new Map();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return rowMap;
  }

  sheet
    .getRange(2, 1, lastRow - 1, GITHUB_DAILY_HEADERS.length)
    .getValues()
    .forEach((row) => {
      const repository = String(row[0] || "").trim();
      const date = normalizeStoredDate_(row[1]);

      if (!repository || !date) {
        return;
      }

      rowMap.set(trafficRowKey_(repository, date), [
        repository,
        date,
        toNonNegativeInteger_(row[2]),
        toNonNegativeInteger_(row[3]),
        normalizeCollectedAt_(row[4]),
      ]);
    });

  return rowMap;
}

function writeDailyRows_(sheet, rowMap) {
  const rows = Array.from(rowMap.values()).sort(
    (left, right) =>
      left[0].localeCompare(right[0]) || left[1].localeCompare(right[1]),
  );
  const oldDataRows = Math.max(0, sheet.getLastRow() - 1);

  if (oldDataRows) {
    sheet
      .getRange(2, 1, oldDataRows, GITHUB_DAILY_HEADERS.length)
      .clearContent();
  }

  ensureRowCapacity_(sheet, rows.length + 1);

  if (rows.length) {
    sheet
      .getRange(2, 1, rows.length, GITHUB_DAILY_HEADERS.length)
      .setValues(rows);
  }

  sheet.autoResizeColumns(1, GITHUB_DAILY_HEADERS.length);
}

function writeTotals_(sheet, rowMap) {
  const summaries = summarizeTrafficRows_(rowMap);
  const rows = summaries.map((summary) => [
    summary.repository,
    summary.firstDate,
    summary.lastDate,
    summary.cumulativeViews,
    summary.lastCollectedAt,
  ]);
  const oldDataRows = Math.max(0, sheet.getLastRow() - 1);

  if (oldDataRows) {
    sheet
      .getRange(2, 1, oldDataRows, GITHUB_TOTAL_HEADERS.length)
      .clearContent();
  }

  ensureRowCapacity_(sheet, rows.length + 1);
  sheet.getRange(2, 1, rows.length, GITHUB_TOTAL_HEADERS.length).setValues(rows);
  sheet.autoResizeColumns(1, GITHUB_TOTAL_HEADERS.length);
  return summaries;
}

function summarizeTrafficRows_(rowMap) {
  const grouped = new Map();

  Array.from(rowMap.values()).forEach((row) => {
    const repository = row[0];
    const current = grouped.get(repository) || {
      repository,
      firstDate: row[1],
      lastDate: row[1],
      cumulativeViews: 0,
      lastCollectedAt: row[4],
    };

    current.firstDate = current.firstDate < row[1] ? current.firstDate : row[1];
    current.lastDate = current.lastDate > row[1] ? current.lastDate : row[1];
    current.cumulativeViews += toNonNegativeInteger_(row[2]);
    current.lastCollectedAt =
      current.lastCollectedAt > row[4] ? current.lastCollectedAt : row[4];
    grouped.set(repository, current);
  });

  return GITHUB_TRAFFIC_CONFIG.repositories.map((repository) => {
    return (
      grouped.get(repository) || {
        repository,
        firstDate: "",
        lastDate: "",
        cumulativeViews: 0,
        lastCollectedAt: "",
      }
    );
  });
}

function ensureRowCapacity_(sheet, requiredRows) {
  const missingRows = requiredRows - sheet.getMaxRows();

  if (missingRows > 0) {
    sheet.insertRowsAfter(sheet.getMaxRows(), missingRows);
  }
}

function normalizeGithubDate_(timestamp) {
  const match = String(timestamp || "").match(/^(\d{4}-\d{2}-\d{2})T/);

  if (!match) {
    throw new Error(`Invalid GitHub timestamp: ${timestamp}`);
  }

  return match[1];
}

function normalizeStoredDate_(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Utilities.formatDate(value, "UTC", "yyyy-MM-dd");
  }

  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function normalizeCollectedAt_(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return String(value || "");
}

function trafficRowKey_(repository, date) {
  return `${repository}|${date}`;
}

function toNonNegativeInteger_(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function safeErrorBody_(body) {
  return String(body || "")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);
}
