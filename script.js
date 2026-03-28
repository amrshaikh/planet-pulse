// App state
let currentTheme = localStorage.getItem('organicTheme') || 'dawn';
let debounceTimer;
let chartInstance = null;
let lastData = {};

const aqiLabels = {
  good: 'Pure',
  moderate: 'Fair',
  unhealthySg: 'Hazy',
  unhealthy: 'Unhealthy',
  veryUnhealthy: 'Severe',
  hazardous: 'Toxic'
};

const els = {
  html: document.documentElement,
  themeBtn: document.getElementById('theme-toggle'),
  searchInput: document.getElementById('city-input'),
  dropdown: document.getElementById('autocomplete-results'),
  dashboard: document.getElementById('dashboard'),
  loader: document.getElementById('loader'),

  aqiVal: document.getElementById('aqi-val'),
  aqiLbl: document.getElementById('aqi-lbl'),

  aiSynopsis: document.getElementById('ai-synopsis'),
  aiChecklist: document.getElementById('ai-checklist'),
  aiAdvice: document.getElementById('ai-advice'),

  valPm25: document.getElementById('val-pm25'),
  barPm25: document.getElementById('bar-pm25'),
  valPm10: document.getElementById('val-pm10'),
  barPm10: document.getElementById('bar-pm10'),
  valO3: document.getElementById('val-o3'),
  barO3: document.getElementById('bar-o3'),
  valCo: document.getElementById('val-co'),
  barCo: document.getElementById('bar-co'),

  statTemp: document.getElementById('stat-temp'),
  statHum: document.getElementById('stat-hum'),
  statUv: document.getElementById('stat-uv'),
  ctx: document.getElementById('trendChart').getContext('2d')
};

function init() {
  setTheme(currentTheme);

  els.themeBtn.addEventListener('click', () => {
    currentTheme = currentTheme === 'dawn' ? 'dusk' : 'dawn';
    setTheme(currentTheme);
  });

  els.searchInput.addEventListener('input', handleInput);
  document.addEventListener('click', (e) => {
    if (!els.searchInput.contains(e.target) && !els.dropdown.contains(e.target)) {
      els.dropdown.style.display = 'none';
    }
  });
}

function setTheme(theme) {
  els.html.setAttribute('data-theme', theme);
  localStorage.setItem('organicTheme', theme);

  if (chartInstance && lastData.times && lastData.temps && lastData.aqis) {
    renderChart(lastData.times, lastData.temps, lastData.aqis);
  }
}

function handleInput(e) {
  const val = e.target.value.trim();
  clearTimeout(debounceTimer);

  if (val.length < 2) {
    els.dropdown.style.display = 'none';
    return;
  }

  debounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(val)}&count=4`
      );
      const data = await res.json();
      renderDropdown(data.results || []);
    } catch (err) {
      console.error('Autocomplete Error:', err);
    }
  }, 300);
}

function renderDropdown(results) {
  if (results.length === 0) {
    els.dropdown.style.display = 'none';
    return;
  }

  els.dropdown.innerHTML = results
    .map(
      (city) => `
      <div class="autocomplete-item" data-lat="${city.latitude}" data-lon="${city.longitude}" data-name="${city.name}">
        <span class="autocomplete-city">${city.name}</span>
        <span class="autocomplete-admin">${city.admin1 || ''}, ${city.country || ''}</span>
      </div>
    `
    )
    .join('');

  els.dropdown.style.display = 'flex';

  document.querySelectorAll('.autocomplete-item').forEach((item) => {
    item.addEventListener('click', () => {
      const name = item.getAttribute('data-name');
      const lat = item.getAttribute('data-lat');
      const lon = item.getAttribute('data-lon');

      els.searchInput.value = name;
      els.dropdown.style.display = 'none';
      executeSearch(name, lat, lon);
    });
  });
}

async function executeSearch(cityName, lat, lon) {
  els.dashboard.classList.remove('active');
  els.loader.style.display = 'block';

  try {
    const response = await fetch(
      `/.netlify/functions/getPulse?lat=${lat}&lon=${lon}&city=${encodeURIComponent(cityName)}`
    );

    if (!response.ok) {
      throw new Error('Connection interrupted.');
    }

    const data = await response.json();
    updateDashboard(data);
  } catch (err) {
    console.error(err);
    els.aiSynopsis.innerHTML =
      '<span style="color: #ef4444">Connection interrupted. Cannot fetch telemetry.</span>';
    els.aiChecklist.innerHTML = '';
    els.aiAdvice.textContent = '--';
    els.dashboard.classList.add('active');
  } finally {
    els.loader.style.display = 'none';
  }
}

function updateDashboard(data) {
  const aqiData = data.aqi || {};
  const aqi = aqiData.aqi || 0;
  els.aqiVal.textContent = aqi;

  let color;
  let label;

  if (aqi <= 50) {
    color = '#78a183';
    label = aqiLabels.good;
  } else if (aqi <= 100) {
    color = '#d4b472';
    label = aqiLabels.moderate;
  } else if (aqi <= 150) {
    color = '#d48c82';
    label = aqiLabels.unhealthySg;
  } else if (aqi <= 200) {
    color = '#c96a6a';
    label = aqiLabels.unhealthy;
  } else {
    color = '#8f779e';
    label = aqiLabels.hazardous;
  }

  els.aqiVal.style.color = color;
  els.aqiLbl.textContent = label;
  els.aqiLbl.style.color = color;
  els.aqiLbl.style.borderColor = color;

  const fillWidth = (val, max) => `${Math.min((val / max) * 100, 100)}%`;

  els.valPm25.textContent = `${aqiData.pm2_5} µg/m³`;
  els.barPm25.style.width = fillWidth(aqiData.pm2_5, 100);

  els.valPm10.textContent = `${aqiData.pm10} µg/m³`;
  els.barPm10.style.width = fillWidth(aqiData.pm10, 150);

  els.valO3.textContent = `${aqiData.ozone} µg/m³`;
  els.barO3.style.width = fillWidth(aqiData.ozone, 200);

  els.valCo.textContent = `${aqiData.co} µg/m³`;
  els.barCo.style.width = fillWidth(aqiData.co, 5000);

  const ai = data.aiData || {};

  const rawSynopsis = ai.synopsis || 'Atmospheric data retrieved. Summary unavailable.';
  els.aiSynopsis.innerHTML = rawSynopsis.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  els.aiChecklist.innerHTML = (ai.checklist || [])
    .map((item) => `<li><div class="organic-check-icon"></div> ${item}</li>`)
    .join('');

  els.aiAdvice.textContent =
    ai.ecoAdvice || 'Connect with nature today while being mindful of the air quality.';

  els.statTemp.textContent = `${data.weather.temp}°C`;
  els.statHum.textContent = `${data.weather.humidity}%`;
  els.statUv.textContent = data.weather.uv;

  lastData = {
    times: data.weather.hourly_time,
    temps: data.weather.hourly_temp,
    aqis: data.aqi.hourly_aqi
  };

  renderChart(lastData.times, lastData.temps, lastData.aqis);
  els.dashboard.classList.add('active');
}

function renderChart(timesArr, tempsArr, aqisArr) {
  if (!timesArr) {
    return;
  }

  if (chartInstance) {
    chartInstance.destroy();
  }

  const times = timesArr.slice(0, 24).map((t) => `${new Date(t).getHours()}:00`);
  const temps = tempsArr.slice(0, 24);
  const aqis = aqisArr.slice(0, 24);

  const isDawn = currentTheme === 'dawn';
  const textColor = isDawn ? '#7a7d74' : '#8b9088';
  const gridColor = isDawn ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)';

  const gradientTemp = els.ctx.createLinearGradient(0, 0, 0, 300);
  gradientTemp.addColorStop(0, isDawn ? 'rgba(110, 145, 160, 0.4)' : 'rgba(143, 185, 168, 0.4)');
  gradientTemp.addColorStop(1, 'rgba(255, 255, 255, 0)');

  const gradientAqi = els.ctx.createLinearGradient(0, 0, 0, 300);
  gradientAqi.addColorStop(0, isDawn ? 'rgba(212, 140, 130, 0.4)' : 'rgba(196, 150, 175, 0.4)');
  gradientAqi.addColorStop(1, 'rgba(255, 255, 255, 0)');

  Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
  Chart.defaults.color = textColor;

  chartInstance = new Chart(els.ctx, {
    type: 'line',
    data: {
      labels: times,
      datasets: [
        {
          label: 'Temp',
          data: temps,
          borderColor: isDawn ? '#6e91a0' : '#8fb9a8',
          backgroundColor: gradientTemp,
          yAxisID: 'y',
          tension: 0.5,
          borderWidth: 3,
          pointRadius: 0,
          fill: true
        },
        {
          label: 'AQI',
          data: aqis,
          borderColor: isDawn ? '#d48c82' : '#c496af',
          backgroundColor: gradientAqi,
          yAxisID: 'y1',
          tension: 0.5,
          borderWidth: 3,
          pointRadius: 0,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { usePointStyle: true, boxWidth: 8 }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: gridColor, drawBorder: false }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

init();
