const axios = require('axios');
const fs = require('fs');

const API_URL = 'https://plausible.io/api/v2/query';
const SITE_ID = 'simplepage.eth.link';
const PERIODS = [
  { key: '7d', label: 'Week', days: 7 },
  { key: '30d', label: 'Month', days: 30 },
  { key: '12mo', label: 'Year', days: 365 }
];

const API_KEY = process.env.PLAUSIBLE_API_KEY;

function normalizeHostname(hostname) {
  if (hostname.endsWith('.eth.link') || hostname.endsWith('.eth.limo')) {
    const domain = hostname.slice(0, -9); // remove .eth.link or .eth.limo
    const normalized = domain + '.eth';
    if (normalized.endsWith('.s.raffy.eth')) {
      return normalized.replace(/\.s\.raffy\.eth$/, '.sepoliaens.eth');
    }
    return normalized;
  }
  return null; // ignore
}

async function fetchData(period) {
  const today = new Date();

  // Current period: today - days to today
  const currentEnd = new Date(today);
  const currentStart = new Date(today);
  currentStart.setDate(today.getDate() - period.days);

  // Previous period: today - 2*days to today - days
  const prevEnd = new Date(currentStart);
  const prevStart = new Date(today);
  prevStart.setDate(today.getDate() - 2 * period.days);

  const formatDate = (date) => date.toISOString().split('T')[0];

  const currentRange = [formatDate(currentStart), formatDate(currentEnd)];
  const prevRange = [formatDate(prevStart), formatDate(prevEnd)];

  const baseBody = {
    site_id: SITE_ID,
    metrics: ['visitors'],
    dimensions: ['event:hostname']
  };

  try {
    const [currentRes, prevRes] = await Promise.all([
      axios.post(API_URL, { ...baseBody, date_range: currentRange }, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }),
      axios.post(API_URL, { ...baseBody, date_range: prevRange }, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }).catch(() => ({ data: { results: [] } })) // If prev fails, no change
    ]);

    const currentData = {};
    currentRes.data.results.forEach(row => {
      const hostname = row.dimensions[0];
      const visitors = row.metrics[0];
      const normalized = normalizeHostname(hostname);
      if (normalized) {
        currentData[normalized] = (currentData[normalized] || 0) + visitors;
      }
    });

    const prevData = {};
    prevRes.data.results.forEach(row => {
      const hostname = row.dimensions[0];
      const visitors = row.metrics[0];
      const normalized = normalizeHostname(hostname);
      if (normalized) {
        prevData[normalized] = (prevData[normalized] || 0) + visitors;
      }
    });

    const sorted = Object.entries(currentData)
      .map(([domain, visitors]) => {
        const prevVisitors = prevData[domain] || 0;
        const change = prevVisitors > 0 ? ((visitors - prevVisitors) / prevVisitors * 100).toFixed(1) : null;
        return { domain, visitors, change };
      })
      .sort((a, b) => b.visitors - a.visitors || a.domain.localeCompare(b.domain));

    return sorted;
  } catch (error) {
    console.error(`Error fetching data for ${period.key}:`, error.message);
    return [];
  }
}

async function main() {
  if (!API_KEY) {
    console.error('PLAUSIBLE_API_KEY environment variable is required');
    process.exit(1);
  }
  const data = {};
  for (const period of PERIODS) {
    console.log(`Fetching data for ${period.key}...`);
    data[period.key] = await fetchData(period);
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
  const timestamp = new Date().toLocaleString('sv-SE');
  const periods = PERIODS;
  const filter = `
  <div class="filter-row">
    <label class="testnet-toggle">
      <input type="checkbox" id="testnet-toggle">
      <span class="toggle-track" aria-hidden="true"></span>
      <span class="toggle-label">Show testnet</span>
    </label>
  </div>`;
  let tabs = '<div class="tabs">';
  periods.forEach((period, idx) => {
    tabs += `<button class="tab-button ${idx === 0 ? 'active' : ''}" onclick="showPeriod('${period.key}')">${period.label}</button>`;
  });
  tabs += '</div>';

  let tables = '';
  periods.forEach((period, idx) => {
    const display = idx === 0 ? 'block' : 'none';
    tables += `<div id="${period.key}" class="period-table" style="display: ${display}"><table><thead><tr><th>Rank</th><th>Domain</th><th>Visitors</th><th>Change</th></tr></thead><tbody>`;
    data[period.key].forEach((item, index) => {
      const changeClass = item.change ? (parseFloat(item.change) > 0 ? 'positive' : parseFloat(item.change) < 0 ? 'negative' : 'neutral') : '';
      const changeText = item.change ? `${item.change}%` : 'N/A';
      const domainLink = `https://${item.domain.replace('.eth', '.eth.link')}`;
      const netType = item.domain.endsWith('.eth.sepoliaens.eth') ? 'testnet' : 'mainnet';
      tables += `<tr data-net="${netType}"><td class="rank-cell">${index + 1}</td><td><a href="${domainLink}" target="_blank" rel="noopener">${item.domain}</a></td><td>${item.visitors.toLocaleString()}</td><td class="${changeClass}">${changeText}</td></tr>`;
    });
    tables += '</tbody></table></div>';
  });

  const script = `
<script>
function showPeriod(period) {
  document.querySelectorAll('.period-table').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.getElementById(period).style.display = 'block';
  event.target.classList.add('active');
  updateVisibleRanks();
}

function updateVisibleRanks() {
  document.querySelectorAll('.period-table').forEach(table => {
    if (table.style.display === 'none') return;
    let rank = 1;
    table.querySelectorAll('tbody tr').forEach(row => {
      if (row.style.display === 'none') return;
      const cell = row.querySelector('.rank-cell');
      if (cell) {
        cell.textContent = rank;
        rank += 1;
      }
    });
  });
}

function applyTestnetFilter() {
  const toggle = document.getElementById('testnet-toggle');
  if (!toggle) return;
  const showTestnetOnly = toggle.checked;
  document.querySelectorAll('tr[data-net="testnet"]').forEach(row => {
    row.style.display = showTestnetOnly ? '' : 'none';
  });
  document.querySelectorAll('tr[data-net="mainnet"]').forEach(row => {
    row.style.display = showTestnetOnly ? 'none' : '';
  });
  updateVisibleRanks();
}

window.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('testnet-toggle');
  if (!toggle) return;
  toggle.checked = false;
  applyTestnetFilter();
  toggle.addEventListener('change', applyTestnetFilter);
  updateVisibleRanks();
});
</script>
`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SimplePage Leaderboard</title>
  <link rel="icon" href="logo.svg">
  <link rel="stylesheet" href="styles.css">
</head>
 <body>
   <header>
     <div class="title-row">
       <img src="logo.svg" alt="SimplePage Logo" class="logo">
       <h1>SimplePage Leaderboard</h1>
     </div>
     <p>Top sites by number of visitors</p>
   </header>
   ${tabs}
   ${tables}
   ${filter}
   <footer>
     <p>Updated daily | Last update: ${timestamp}</p>
   </footer>
  ${script}
</body>
</html>`;
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { generateHTML };
