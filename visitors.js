(() => {
  "use strict";

  const loader = document.currentScript;
  const endpoint = loader?.dataset.endpoint?.trim() || "";
  const mapElement = document.getElementById("visitor-map");
  const totalElement = document.getElementById("map-total-views");
  const updatedElement = document.getElementById("map-updated");
  const numberFormatter = new Intl.NumberFormat("en");
  const coordinateSource = "https://cdn.jsdelivr.net/npm/country-json@2.3.0/src/country-by-geo-coordinates.json";
  const countryAliases = {
    GB: "United Kingdom",
    KR: "South Korea",
    KP: "North Korea",
    RU: "Russia",
    TR: "Turkey",
    US: "United States",
  };
  let analyticsPayload;
  let chartsReady = false;
  let coordinatesReady = false;
  let coordinateBounds;
  let resizeTimer;

  if (!endpoint || !mapElement || !totalElement) {
    return;
  }

  google.charts.load("current", { packages: ["geochart"] });
  google.charts.setOnLoadCallback(() => {
    chartsReady = true;
    renderMap();
  });
  loadCoordinates();

  window.renderProjectAnalytics = (payload) => {
    if (payload?.error) {
      showError("Visitor data is temporarily unavailable.");
      return;
    }

    analyticsPayload = payload;
    const totalViews = Number(payload?.totalViews);

    if (Number.isFinite(totalViews)) {
      totalElement.textContent = numberFormatter.format(totalViews);
    }

    if (payload.generatedAt && updatedElement) {
      updatedElement.textContent = `Updated ${new Date(payload.generatedAt).toLocaleString()}`;
    }

    renderMap();
  };

  function renderMap() {
    if (!chartsReady || !coordinatesReady || !analyticsPayload) {
      return;
    }

    const countries = Array.isArray(analyticsPayload.countries)
      ? analyticsPayload.countries.filter((country) => (
        /^[A-Z]{2}$/.test(country?.code) && Number(country?.views) > 0
      ))
      : [];

    if (!countries.length) {
      showError("No country-level visitor data is available yet.");
      return;
    }

    const chart = new google.visualization.GeoChart(mapElement);
    const locations = coordinateBounds
      ? countries.map(countryLocation).filter(Boolean)
      : [];

    if (!locations.length) {
      drawRegionFallback(chart, countries);
      return;
    }

    const data = new google.visualization.DataTable();
    data.addColumn("number", "Latitude");
    data.addColumn("number", "Longitude");
    data.addColumn("number", "Views");
    data.addColumn("number", "Views");
    data.addRows(locations.map((location) => [
      { v: location.latitude, f: location.name },
      location.longitude,
      location.views,
      location.views,
    ]));

    chart.draw(data, {
      backgroundColor: { fill: "#f8fbff", stroke: "#f8fbff" },
      colorAxis: { colors: ["#f59e0b", "#ef4444"] },
      datalessRegionColor: "#e8edf4",
      defaultColor: "#bfdbfe",
      displayMode: "markers",
      legend: { textStyle: { color: "#6b7280", fontSize: 11 } },
      keepAspectRatio: true,
      magnifyingGlass: { enable: true, zoomFactor: 6 },
      region: "world",
      sizeAxis: { minSize: 5, maxSize: 24 },
      tooltip: { textStyle: { color: "#172033", fontSize: 12 } },
    });
  }

  function countryLocation(country) {
    const lookupName = countryAliases[country.code] || country.name;
    const bounds = coordinateBounds.get(lookupName);

    if (!bounds) {
      return null;
    }

    return {
      latitude: (Number(bounds.north) + Number(bounds.south)) / 2,
      longitude: (Number(bounds.east) + Number(bounds.west)) / 2,
      name: country.name,
      views: Number(country.views),
    };
  }

  function drawRegionFallback(chart, countries) {
    const data = google.visualization.arrayToDataTable([
      ["Country", "Views"],
      ...countries.map((country) => [country.code, Number(country.views)]),
    ]);

    chart.draw(data, {
      backgroundColor: { fill: "#f8fbff", stroke: "#f8fbff" },
      colorAxis: { colors: ["#bfdbfe", "#2563eb", "#172554"] },
      datalessRegionColor: "#e8edf4",
      legend: { textStyle: { color: "#6b7280", fontSize: 11 } },
      keepAspectRatio: true,
    });
  }

  async function loadCoordinates() {
    try {
      const response = await fetch(coordinateSource);

      if (!response.ok) {
        throw new Error(`Coordinate request failed: ${response.status}`);
      }

      const countries = await response.json();
      coordinateBounds = new Map(countries.map((country) => [country.country, country]));
    } catch (error) {
      console.warn("Using the region-map fallback.", error);
    } finally {
      coordinatesReady = true;
      renderMap();
    }
  }

  function showError(message) {
    mapElement.innerHTML = `<p id="map-status">${message}</p>`;
  }

  function requestAnalytics() {
    const request = document.createElement("script");
    request.src = `${endpoint}?prefix=renderProjectAnalytics&t=${Date.now()}`;
    request.async = true;
    request.onerror = () => showError("Visitor data is temporarily unavailable.");
    document.head.appendChild(request);
  }

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(renderMap, 150);
  });

  requestAnalytics();
})();
