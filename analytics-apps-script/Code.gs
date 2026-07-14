const GA4_PROPERTY_ID = "545207619";
const GA4_PROPERTY = `properties/${GA4_PROPERTY_ID}`;
const JSONP_CALLBACK = "renderProjectAnalytics";
const TOTALS_START_DATE = "2020-01-01";

function doGet(event) {
  const callback = String(
    (event && event.parameter && event.parameter.prefix) || ""
  );

  if (callback !== JSONP_CALLBACK) {
    return ContentService.createTextOutput("Invalid callback").setMimeType(
      ContentService.MimeType.TEXT
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
    `${callback}(${JSON.stringify(payload)});`
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function buildPublicPayload_() {
  return {
    generatedAt: new Date().toISOString(),
    totalViews: cached_("lifetime-page-views-v1", 300, readTotalViews_),
    countries: cached_("lifetime-country-views-v1", 300, readCountryViews_),
  };
}

function readTotalViews_() {
  const report = AnalyticsData.Properties.runReport(
    {
      dateRanges: [
        {
          startDate: TOTALS_START_DATE,
          endDate: "today",
        },
      ],
      metrics: [{ name: "screenPageViews" }],
    },
    GA4_PROPERTY
  );

  return metricValue_(report, 0);
}

function readCountryViews_() {
  const report = AnalyticsData.Properties.runReport(
    {
      dateRanges: [
        {
          startDate: TOTALS_START_DATE,
          endDate: "today",
        },
      ],
      dimensions: [{ name: "countryId" }, { name: "country" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [
        {
          metric: { metricName: "screenPageViews" },
          desc: true,
        },
      ],
      limit: 250,
    },
    GA4_PROPERTY
  );

  return (report.rows || [])
    .map(function (row) {
      return {
        code: row.dimensionValues[0].value,
        name: row.dimensionValues[1].value,
        views: Number(row.metricValues[0].value) || 0,
      };
    })
    .filter(function (country) {
      return /^[A-Z]{2}$/.test(country.code) && country.views > 0;
    });
}

function metricValue_(report, metricIndex) {
  const row = report.rows && report.rows[0];
  const metric = row && row.metricValues && row.metricValues[metricIndex];
  const value = metric && metric.value;
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
