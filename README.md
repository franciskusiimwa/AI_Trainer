# Sarah Learns AI

An interactive, self-paced AI literacy course. The original course is served from `public/`; a small Node.js server saves quiz answers, reflections, and checklist progress to a JSON file.

## Run locally

Requires Node.js 20 or newer. From this folder, run:

```powershell
node server.js
```

Then open http://127.0.0.1:3000. You can also use `npm.cmd start` on Windows if PowerShell blocks the `npm` script.

When running locally, progress is written to `data/progress.json` and cached in the browser for offline use. The first launch copies any browser-saved progress into the server when available. On a static host such as Netlify, progress stays in that browser's local storage; the Node server is not deployed there.

## Backend

- `GET /api/progress` returns the saved progress object.
- `PUT /api/progress` saves one supported progress key (`quiz`, `build`, `plan`, or a reflection key such as `r-l2`).
- Set `PORT`, `HOST`, or `PROGRESS_FILE` to change the server port, bind address, or data location.

This is a single-learner, no-login backend intended for local or otherwise private use. Do not expose it to the public internet as-is: anyone who can reach the server can read or change its saved progress. The server binds to `127.0.0.1` by default.

## Deploy to Netlify

Connect the GitHub repository to Netlify. The included `netlify.toml` publishes `public/` as a static site with no build command. Netlify hosting uses browser-only progress; the JSON backend remains available for local use.