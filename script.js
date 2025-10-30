document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const cityInput = document.getElementById('city-input');
    const searchButton = document.getElementById('search-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const resultsContainer = document.getElementById('results-container');
    const gaugeContainer = document.getElementById('gauge-container');
    const aqiGauge = document.getElementById('health-gauge');
    // const aqiGaugeLabel = document.getElementById('gauge-label'); // This variable wasn't used, so I've commented it out.
    const aiSummaryCard = document.getElementById('ai-summary');
    const summaryText = document.getElementById('summary-text');
    const rawDataCard = document.getElementById('raw-data');
    const dataList = document.getElementById('data-list');

    // --- Event Listener ---
    // We must check if searchButton exists before adding a listener
    if (searchButton) {
        searchButton.addEventListener('click', handleSearch);
    }
    
    // We must check if cityInput exists before adding a listener
    if (cityInput) {
        cityInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
    }

    /**
     * Main function to handle the search button click
     */
    async function handleSearch() {
        const city = cityInput.value.trim();
        if (!city) {
            alert("Please enter a city name."); // Using alert for simplicity
            return;
        }

        clearUI();
        showLoading();

        try {
            // --- Step 1: Get Geocoding (Lat/Lon) from city name ---
            const { latitude, longitude } = await fetchGeocoding(city);

            // --- Step 2: Fetch Weather & AQI data ---
            // We use Promise.all to fetch both at the same time
            const [weatherResult, aqiResult] = await Promise.allSettled([
                fetchWeatherData(latitude, longitude),
                fetchAirQuality(latitude, longitude)
            ]);

            // Process results
            const weatherData = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
            const aqiData = aqiResult.status === 'fulfilled' ? aqiResult.value : null;

            if (!weatherData && !aqiData) {
                throw new Error("Could not fetch any data for this location.");
            }

            // --- Step 3: Update the UI ---
            updateUI(weatherData, aqiData);

        } catch (error) {
            console.error("Error in handleSearch:", error);
            // Display a user-friendly error message
            if (dataList) {
                dataList.innerHTML = `<li>Error: ${error.message}</li>`;
            }
            if (rawDataCard) {
                rawDataCard.classList.remove('hidden');
            }
        } finally {
            hideLoading();
        }
    }

    /**
     * Fetches latitude and longitude from Open-Meteo
     */
    async function fetchGeocoding(city) {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
        const response = await fetch(geoUrl);
        
        if (!response.ok) {
            throw new Error(`Geocoding API failed (${response.status})`);
        }
        
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            throw new Error(`Could not find location for "${city}".`);
        }
        
        const { latitude, longitude } = data.results[0];
        return { latitude, longitude };
    }

    /**
     * Fetches weather and UV index from Open-Meteo
     */
    async function fetchWeatherData(lat, lon) {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m&daily=uv_index_max&timezone=auto&forecast_days=1`;
        const response = await fetch(weatherUrl);
        
        if (!response.ok) {
            throw new Error(`Weather API failed (${response.status})`);
        }
        
        const data = await response.json();
        return {
            temp: data.current.temperature_2m,
            humidity: data.current.relative_humidity_2m,
            uv: data.daily.uv_index_max[0]
        };
    }

    /**
     * Fetches Air Quality Index (AQI) from Open-Meteo
     */
    async function fetchAirQuality(lat, lon) {
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=auto`;
        const response = await fetch(aqiUrl);
        
        if (!response.ok) {
            throw new Error(`Air Quality API failed (${response.status})`);
        }
        
        const data = await response.json();
        const aqi = data.current.us_aqi;

        if (aqi === null || aqi === undefined) {
            console.warn("AQI data is null for this location.");
            return { aqi: "N/A" };
        }

        return { aqi: aqi };
    }

    // --- UI Helper Functions ---

    function updateUI(weather, aqi) {
        // --- 1. Update Raw Data List ---
        if (dataList) {
            dataList.innerHTML = ''; // Clear old data
            
            if (weather) {
                dataList.innerHTML += `<li><span class="data-label">Temperature:</span> ${weather.temp} °C</li>`;
                dataList.innerHTML += `<li><span class="data-label">Humidity:</span> ${weather.humidity} %</li>`;
                dataList.innerHTML += `<li><span class="data-label">Max UV Index:</span> ${weather.uv}</li>`;
            }
            if (aqi) {
                dataList.innerHTML += `<li><span class="data-label">US AQI:</span> ${aqi.aqi}</li>`;
            }
        }
        if (rawDataCard) {
            rawDataCard.classList.remove('hidden');
        }

        // --- 2. Update AQI Gauge ---
        if (aqi && aqi.aqi !== "N/A" && aqiGauge) {
            const aqiValue = parseInt(aqi.aqi);
            drawGauge(aqiValue);
            if (gaugeContainer) {
                gaugeContainer.classList.remove('hidden');
            }
        }

        // --- 3. Show AI Summary Placeholder ---
        // We will power this with a serverless function AFTER pushing to GitHub.
        if (summaryText) {
            summaryText.innerHTML = `
                <strong>AI Analysis Coming Soon!</strong>
                <p>To keep this app secure and free, the AI summary feature is powered by a serverless function.
                We'll enable this in the next step!</p>
            `;
        }
        if (aiSummaryCard) {
            aiSummaryCard.classList.remove('hidden');
        }
    }

    function drawGauge(aqi) {
        const ctx = aqiGauge.getContext('2d');
        const maxValue = 300; // AQI can go higher, but 300 is a good "Very Unhealthy" cap for a visual
        const value = Math.min(aqi, maxValue); // Cap the value
        const percent = value / maxValue;
        const angle = percent * Math.PI; // Full gauge is 180 degrees (PI radians)
        
        // Get colors based on AQI value
        const { color, label } = getAqiInfo(value);
        
        // Clear canvas
        ctx.clearRect(0, 0, aqiGauge.width, aqiGauge.height);
        
        // --- Draw Background Arc ---
        ctx.beginPath();
        ctx.arc(125, 125, 80, Math.PI, 2 * Math.PI); // Half circle
        ctx.lineWidth = 25;
        ctx.strokeStyle = '#eee';
        ctx.stroke();

        // --- Draw Value Arc ---
        ctx.beginPath();
        ctx.arc(125, 125, 80, Math.PI, Math.PI + angle);
        ctx.lineWidth = 25;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.stroke();

        // --- Draw Text (Value) ---
        ctx.fillStyle = color;
        ctx.font = 'bold 40px Poppins';
        ctx.textAlign = 'center';
        ctx.fillText(aqi, 125, 120);

        // --- Draw Text (Label) ---
        ctx.fillStyle = '#555';
        ctx.font = 'normal 16px Poppins';
        ctx.fillText(label, 125, 150);
    }

    function getAqiInfo(aqi) {
        if (aqi <= 50) return { color: '#00e400', label: 'Good' };
        if (aqi <= 100) return { color: '#ffff00', label: 'Moderate' };
        if (aqi <= 150) return { color: '#ff7e00', label: 'Unhealthy (SG)' };
        if (aqi <= 200) return { color: '#ff0000', label: 'Unhealthy' };
        if (aqi <= 300) return { color: '#8f3f97', label: 'Very Unhealthy' };
        return { color: '#7e0023', label: 'Hazardous' };
    }

    function showLoading() {
        if (searchButton) {
            searchButton.disabled = true;
            searchButton.textContent = 'Checking...';
        }
        if (loadingSpinner) {
            loadingSpinner.classList.remove('hidden');
        }
    }

    function hideLoading() {
        if (searchButton) {
            searchButton.disabled = false;
            searchButton.textContent = 'Check Pulse';
        }
        if (loadingSpinner) {
            loadingSpinner.classList.add('hidden');
        }
    }

    function clearUI() {
        if (aiSummaryCard) {
            aiSummaryCard.classList.add('hidden');
        }
        if (rawDataCard) {
            rawDataCard.classList.add('hidden');
        }
        if (gaugeContainer) {
            gaugeContainer.classList.add('hidden');
        }
        if (dataList) {
            dataList.innerHTML = '';
        }
    }
}); // End of DOMContentLoaded

