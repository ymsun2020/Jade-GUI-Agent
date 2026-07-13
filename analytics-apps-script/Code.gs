const GA4_PROPERTY_ID = "545207619";
const GA4_PROPERTY = `properties/${GA4_PROPERTY_ID}`;
const JSONP_CALLBACK = "renderProjectAnalytics";
const TOTALS_START_DATE = "2020-01-01";

function doGet(event) {
  const callback = String(event?.parameter?.prefix || "");

  if (callback !== JSONP_CALLBACK) {
    return ContentService.createTextOutput("Invalid callback").setMimeType(
      ContentService.MimeType.TEXT,
    );
  }

  let payload;

  try {
    payload = buildPublicPayload_();
  } catch (error) {
    console.error(error);
    payload = {
      error: true,
      generatedAt: new Date().toISOString(),
    };
  }

  return ContentService.createTextOutput(
    `${callback}(${JSON.stringify(payload)});`,
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function buildPublicPayload_() {
  return {
    generatedAt: new Date().toISOString(),
    totalVisitors: cached_("lifetime-total-users-v1", 300, readTotalVisitors_),
  };
}

function readTotalVisitors_() {
  const report = AnalyticsData.Properties.runReport(
    {
      dateRanges: [
        {
          startDate: TOTALS_START_DATE,
          endDate: "today",
        },
      ],
      metrics: [{ name: "totalUsers" }],
    },
    GA4_PROPERTY,
  );

  return metricValue_(report, 0);
}

function metricValue_(report, metricIndex) {
  const value = report.rows?.[0]?.metricValues?.[metricIndex]?.value;
  return Number(value) || 0;
}

function cached_(key, ttlSeconds, producer) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `${GA4_PROPERTY_ID}-${key}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const value = producer();
  cache.put(cacheKey, JSON.stringify(value), ttlSeconds);
  return value;
}

function testPublicData() {
  console.log(JSON.stringify(buildPublicPayload_(), null, 2));
}
