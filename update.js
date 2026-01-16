const axios = require('axios');
const fs = require('fs');

const API_URL = 'https://plausible.io/api/v2/query';
const SITE_ID = 'simplepage.eth.link';
const PERIODS = ['7d', '30d', '12mo'];

const API_KEY = process.env.PLAUSIBLE_API_KEY;
if (!API_KEY) {
  console.error('PLAUSIBLE_API_KEY environment variable is required');
  process.exit(1);
}

function normalizeHostname(hostname) {
  if (hostname.endsWith('.eth.link') || hostname.endsWith('.eth.limo')) {
    const domain = hostname.slice(0, -9); // remove .eth.link or .eth.limo
    return domain + '.eth';
  }
  return null; // ignore
}

async function fetchData(period) {
  const body = {
    site_id: SITE_ID,
    metrics: ['visitors'],
    date_range: period,
    dimensions: ['event:hostname']
  };

  try {
    const response = await axios.post(API_URL, body, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = {};
    response.data.results.forEach(row => {
      const hostname = row.dimensions[0];
      const visitors = row.metrics[0];
      const normalized = normalizeHostname(hostname);
      if (normalized) {
        data[normalized] = (data[normalized] || 0) + visitors;
      }
    });

    const sorted = Object.entries(data)
      .map(([domain, visitors]) => ({ domain, visitors }))
      .sort((a, b) => b.visitors - a.visitors || a.domain.localeCompare(b.domain));

    return sorted;
  } catch (error) {
    console.error(`Error fetching data for ${period}:`, error.message);
    return [];
  }
}

async function main() {
  const data = {};
  for (const period of PERIODS) {
    console.log(`Fetching data for ${period}...`);
    data[period] = await fetchData(period);
  }

  // Write data.json
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
  console.log('data.json written');

  // Generate index.html
  const html = generateHTML(data);
  fs.writeFileSync('index.html', html);
  console.log('index.html generated');
}

function generateHTML(data) {
  const periods = Object.keys(data);
  let body = '<body><h1>SimplePage Leaderboard</h1>';

  periods.forEach(period => {
    body += `<h2>${period}</h2><table><thead><tr><th>Rank</th><th>Domain</th><th>Visitors</th></tr></thead><tbody>`;
    data[period].forEach((item, index) => {
      body += `<tr><td>${index + 1}</td><td>${item.domain}</td><td>${item.visitors}</td></tr>`;
    });
    body += '</tbody></table>';
  });

  body += '</body>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SimplePage Leaderboard</title>
  <link rel="stylesheet" href="styles.css">
</head>
${body}
</html>`;
}

main().catch(console.error);