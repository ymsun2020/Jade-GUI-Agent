(() => {
  "use strict";

  const loader = document.currentScript;
  const endpoint = loader?.dataset.endpoint?.trim() || "";
  const viewCount = document.getElementById("cumulative-views");
  const numberFormatter = new Intl.NumberFormat("en");
  let requestScript;

  if (!viewCount || !endpoint) {
    return;
  }

  window.renderProjectAnalytics = (payload) => {
    const totalViews = Number(payload?.totalViews);

    if (!payload?.error && Number.isFinite(totalViews)) {
      viewCount.textContent = numberFormatter.format(totalViews);

      if (payload.generatedAt) {
        viewCount.title = `Updated ${new Date(payload.generatedAt).toLocaleString()}`;
      }
    }
  };

  function requestViewCount() {
    requestScript?.remove();
    requestScript = document.createElement("script");
    requestScript.src = `${endpoint}?prefix=renderProjectAnalytics&t=${Date.now()}`;
    requestScript.async = true;
    document.head.appendChild(requestScript);
  }

  requestViewCount();
  window.setInterval(requestViewCount, 300_000);
})();
