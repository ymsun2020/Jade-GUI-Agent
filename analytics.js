(() => {
  "use strict";

  const loader = document.currentScript;
  const endpoint = loader?.dataset.endpoint?.trim() || "";
  const visitorCount = document.getElementById("cumulative-visitors");
  const numberFormatter = new Intl.NumberFormat("en");
  let requestScript;

  if (!visitorCount || !endpoint) {
    return;
  }

  window.renderProjectAnalytics = (payload) => {
    const totalVisitors = Number(payload?.totalVisitors);

    if (!payload?.error && Number.isFinite(totalVisitors)) {
      visitorCount.textContent = numberFormatter.format(totalVisitors);

      if (payload.generatedAt) {
        visitorCount.title = `Updated ${new Date(payload.generatedAt).toLocaleString()}`;
      }
    }
  };

  function requestVisitorCount() {
    requestScript?.remove();
    requestScript = document.createElement("script");
    requestScript.src = `${endpoint}?prefix=renderProjectAnalytics&t=${Date.now()}`;
    requestScript.async = true;
    document.head.appendChild(requestScript);
  }

  requestVisitorCount();
  window.setInterval(requestVisitorCount, 300_000);
})();
