const fetch = require('node-fetch');

// This is where Netlify will securely inject
// the secret key you add to its dashboard.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

exports.handler = async (event, context) => {
    // 1. Get the city name from the request
    const { city } = event.queryStringParameters;
    if (!city) {
        return { statusCode: 400, body: JSON.stringify({ error: 'City is required.' }) };
    }

    // Check if the key is loaded
    if (!GEMINI_API_KEY) {
        console.error("! FATAL ERROR: GEMINI_API_KEY is not set in environment.");
        return { statusCode: 500, body: JSON.stringify({ error: "Server is not configured. AI key is missing." }) };
    }

    try {
        // --- 2. Get Lat/Lon from Open-Meteo ---
        const { latitude, longitude } = await fetchGeocoding(city);

        // --- 3. Fetch Weather & AQI from Open-Meteo ---
        const [weatherResult, aqiResult] = await Promise.allSettled([
            fetchWeatherData(latitude, longitude),
            fetchAirQuality(latitude, longitude)
        ]);

        const weatherData = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
        const aqiData = aqiResult.status === 'fulfilled' ? aqiResult.value : null;

        if (!weatherData && !aqiData) {
            throw new Error("All data sources (Open-Meteo) failed.");
        }

        // --- 4. Call Gemini with the data (SECURELY) ---
        const summary = await callGeminiAPI(weatherData, aqiData);

        // --- 5. Return everything to the client ---
        return {
            statusCode: 200,
            body: JSON.stringify({
                weather: weatherData,
                aqi: aqiData,
                summary: summary
            }),
        };

    } catch (error) {
        console.error("! FATAL ERROR in serverless function:", error.message);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

/* --- Helper: Get Lat/Lon --- */
async function fetchGeocoding(city) {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
    const geoResponse = await fetch(geoUrl);
    if (!geoResponse.ok) throw new Error(`Geocoding API failed`);
    const geoData = await geoResponse.json();
    if (!geoData || !geoData.results || geoData.results.length === 0) {
        throw new Error(`Could not find location for "${city}".`);
    }
    return geoData.results[0];
}

/* --- Helper: Get Weather & UV --- */
async function fetchWeatherData(lat, lon) {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m&daily=uv_index_max&timezone=auto&forecast_days=1`;
    const weatherResponse = await fetch(weatherUrl);
    if (!weatherResponse.ok) throw new Error(`Weather API failed`);
    const data = await weatherResponse.json();
    return {
        temp: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        uv: data.daily.uv_index_max[0]
    };
}

/* --- Helper: Get Air Quality --- */
async function fetchAirQuality(lat, lon) {
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=auto`;
    const aqiResponse = await fetch(aqiUrl);
    if (!aqiResponse.ok) throw new Error(`Air Quality API failed`);
    const data = await aqiResponse.json();
    if (data.current.us_aqi === null) {
        return { aqi: "N/A" };
    }
    return { aqi: data.current.us_aqi };
}

/* --- Helper: Call Gemini API --- */
async function callGeminiAPI(weather, aqi) {
    const prompt = `
        Act as an environmental health analyst for "PlanetPulse."
        Given this live data, write a 2-sentence summary for a citizen.
        - Air Quality (AQI): ${aqi ? aqi.aqi : 'N/A'} (Lower is better. >100 is unhealthy)
        - Temperature: ${weather ? weather.temp : 'N/A'} °C
        - UV Index: ${weather ? weather.uv : 'N/A'} (Higher is more harmful)
    `;

    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
             const errorBody = await response.text();
             console.error("Gemini API Error Body:", errorBody);
             throw new Error(`Gemini API error: ${response.statusText}`);
        }
        
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || "Could not generate AI summary.";

    } catch (error) {
        console.error("! ERROR: Gemini API call failed:", error.message);
        return "Failed to connect to AI.";
    }
}

