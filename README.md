# SimplePage Stats Leaderboard

A GitHub-hosted static website that displays a leaderboard of SimplePage domains based on visitor data from Plausible Analytics.

## Setup

1. Clone this repository.
2. Run `npm install` to install dependencies.
3. Create a Plausible Analytics API key (Stats API) and set it as an environment variable: `export PLAUSIBLE_API_KEY=your_key_here`
4. Run `npm run update` to fetch data and generate the leaderboard.

## Local Testing

- Ensure `PLAUSIBLE_API_KEY` is set.
- Run `npm run update` to update `data.json` and `index.html`.
- Open `index.html` in a browser to view the leaderboard.

## Deployment

- Enable GitHub Pages in repository settings (deploy from main branch).
- Add `PLAUSIBLE_API_KEY` as a repository secret in GitHub (Settings > Secrets and variables > Actions).
- The workflow will run daily at midnight UTC, updating the site automatically.

## Structure

- `update.js`: Script to fetch data from Plausible API and generate leaderboard.
- `index.html`: The leaderboard page.
- `styles.css`: Styling for the page.
- `data.json`: JSON data for the leaderboards.
- `.github/workflows/update.yml`: GitHub Actions workflow for daily updates.