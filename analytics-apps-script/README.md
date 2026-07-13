# GA4 public analytics endpoint

This Apps Script web app reads GA4 property `545207619` and exposes only the cumulative visitor count used below the project-page title. Detailed geography, source, engagement, and path reports remain available only in the private GA4 dashboard.

## Deploy

1. Create a standalone project at <https://script.google.com/> using an account that can read the GA4 property.
2. Replace the default `Code.gs` with the contents of this directory's `Code.gs`.
3. In **Services**, add **Google Analytics Data API**.
4. Run `testPublicData` once and approve the requested read-only Analytics access.
5. Select **Deploy → New deployment → Web app**.
6. Set **Execute as** to yourself and **Who has access** to anyone, then deploy.
7. Copy the `/exec` URL into `index.html` as the `data-endpoint` value on the `analytics.js` script tag.

Never place an OAuth token or service-account credential in this repository.
