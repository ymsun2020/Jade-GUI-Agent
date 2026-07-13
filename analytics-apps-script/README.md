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

## Archive cumulative GitHub views

`GithubTraffic.gs` keeps an exact cumulative page-view total from the earliest day GitHub still exposes when collection starts. It imports the current rolling 14-day window and then runs every six hours. Each response is upserted by repository and UTC date, so overlapping windows and later corrections are not double-counted.

1. Create a fine-grained GitHub personal access token for `Mobile-GUI-Security` and `Jade-GUI-Agent` with **Administration: Read-only** repository permission.
2. In the Apps Script project, open **Project Settings → Script properties** and add `GITHUB_TRAFFIC_TOKEN`. Paste the token as its value. Do not add the token to a source file.
3. Add `GithubTraffic.gs` to the same Apps Script project.
4. Run `setupGithubTrafficCollector` once and approve the Google Sheets, external request, and trigger permissions.
5. Open the spreadsheet URL printed in the execution log. `Daily Views` contains the immutable archive and `Totals` contains the cumulative counts.

Run `getGithubTrafficSpreadsheetUrl` later to print the private spreadsheet URL again. Historical views older than GitHub's initial 14-day response cannot be reconstructed.
