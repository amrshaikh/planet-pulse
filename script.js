document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const cityInput = document.getElementById('city-input');
    const searchButton = document.getElementById('search-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const gaugeContainer = document.getElementById('gauge-container');
    const aqiGauge = document.getElementById('health-gauge');
    const aiSummaryCard = document.getElementById('ai-summary');
    const summaryText = document.getElementById('summary-text');
    const rawDataCard = document.getElementById('raw-data');
    const dataList = document.getElementById('data-list');

    // --- Event Listeners ---
    if (searchButton) {
        searchButton.addEventListener('click', handleSearch);
    }
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
            alert("Please enter a city name.");
            return;
        }

        clearUI();
        showLoading();

        try {
            // --- Step 1: Call our NEW Serverless Function ---
            // This one-line call is safer and gets all data at once
            const response = await fetch(`/.netlify/functions/getPulse?city=${encodeURIComponent(city)}`);
            
            if (!response.ok) {
                // Try to get a nice error message from the server
                const errorData = await response.json();
                throw new Error(errorData.error || `Server error: ${response.statusText}`);
            }

            const data = await response.json();
            
            // --- Step 2: Update the UI ---
            updateUI(data.weather, data.aqi, data.summary);

        } catch (error) {
            console.error("Error in handleSearch:", error);
            dataList.innerHTML = `<li>Error: ${error.message}</li>`;
            rawDataCard.classList.remove('hidden');
        } finally {
            hideLoading();
        }
    }

    // --- UI Helper Functions ---

    function updateUI(weather, aqi, summary) {
        // --- 1. Update Raw Data List ---
        dataList.innerHTML = ''; // Clear old data
        
        if (weather) {
            dataList.innerHTML += `<li><span class="data-label">Temperature:</span> ${weather.temp} °C</li>`;
            dataList.innerHTML += `<li><span class="data-label">Humidity:</span> ${weather.humidity} %</li>`;
            dataList.innerHTML += `<li><span class="data-label">Max UV Index:</span> ${weather.uv}</li>`;
        }
        if (aqi) {
            dataList.innerHTML += `<li><span class="data-label">US AQI:</span> ${aqi.aqi}</li>`;
        }
        rawDataCard.classList.remove('hidden');

        // --- 2. Update AQI Gauge ---
        if (aqi && aqi.aqi !== "N/A" && aqiGauge) {
            const aqiValue = parseInt(aqi.aqi);
            drawGauge(aqiValue);
            gaugeContainer.classList.remove('hidden');
        }

        // --- 3. Show AI Summary ---
        // This will now be the REAL summary from Gemini!
        summaryText.innerHTML = summary || "AI analysis could not be generated.";
        aiSummaryCard.classList.remove('hidden');
    }

    function drawGauge(aqi) {
        const ctx = aqiGauge.getContext('2d');
        const maxValue = 300; 
        const value = Math.min(aqi, maxValue);
        const percent = value / maxValue;
        const angle = percent * Math.PI; 
        
        const { color, label } = getAqiInfo(value);
        
        ctx.clearRect(0, 0, aqiGauge.width, aqiGauge.height);
        
        ctx.beginPath();
        ctx.arc(125, 125, 80, Math.PI, 2 * Math.PI);
        ctx.lineWidth = 25;
        ctx.strokeStyle = '#eee';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(125, 125, 80, Math.PI, Math.PI + angle);
        ctx.lineWidth = 25;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.font = 'bold 40px Poppins';
        ctx.textAlign = 'center';
        ctx.fillText(aqi, 125, 120);

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

