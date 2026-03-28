const fetch = require('node-fetch');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

exports.handler = async (event) => {
  const { city, lat, lon, lang = 'en' } = event.queryStringParameters || {};

  if (!city && (!lat || !lon)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'City or coordinates are required.' })
    };
  }

  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server is not configured. AI key is missing.' })
    };
  }

  try {
    let latitude = lat;
    let longitude = lon;
    let locationName = city || 'your location';

    if (city && (!lat || !lon)) {
      const geoData = await fetchGeocoding(city);
      latitude = geoData.latitude;
      longitude = geoData.longitude;
      locationName = geoData.name;
    }

    const [weatherResult, aqiResult] = await Promise.allSettled([
      fetchWeatherData(latitude, longitude),
      fetchAirQuality(latitude, longitude)
    ]);

    const weatherData = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
    const aqiData = aqiResult.status === 'fulfilled' ? aqiResult.value : null;

    if (!weatherData && !aqiData) {
      throw new Error('All data sources failed.');
    }

    const aiResponse = await callGeminiAPI(weatherData, aqiData, locationName, lang);

    return {
      statusCode: 200,
      body: JSON.stringify({
        location: locationName,
        weather: weatherData,
        aqi: aqiData,
        aiData: aiResponse
      })
    };
  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function fetchGeocoding(city) {
  const geoUrl =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;

  const geoResponse = await fetch(geoUrl);
  if (!geoResponse.ok) {
    throw new Error('Geocoding API failed');
  }

  const geoData = await geoResponse.json();
  if (!geoData || !geoData.results || geoData.results.length === 0) {
    throw new Error(`Could not find location for "${city}".`);
  }

  return {
    latitude: geoData.results[0].latitude,
    longitude: geoData.results[0].longitude,
    name: geoData.results[0].name
  };
}

async function fetchWeatherData(lat, lon) {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,relative_humidity_2m' +
    '&daily=uv_index_max&hourly=temperature_2m&timezone=auto&forecast_days=2';

  const weatherResponse = await fetch(weatherUrl);
  if (!weatherResponse.ok) {
    throw new Error('Weather API failed');
  }

  const data = await weatherResponse.json();
  return {
    temp: data.current.temperature_2m,
    humidity: data.current.relative_humidity_2m,
    uv: data.daily.uv_index_max[0],
    hourly_time: data.hourly.time,
    hourly_temp: data.hourly.temperature_2m
  };
}

async function fetchAirQuality(lat, lon) {
  const aqiUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    '&current=us_aqi,pm10,pm2_5,carbon_monoxide,ozone' +
    '&hourly=us_aqi&timezone=auto&forecast_days=2';

  const aqiResponse = await fetch(aqiUrl);
  if (!aqiResponse.ok) {
    throw new Error('Air Quality API failed');
  }

  const data = await aqiResponse.json();
  return {
    aqi: data.current.us_aqi || 0,
    pm10: data.current.pm10 || 0,
    pm2_5: data.current.pm2_5 || 0,
    co: data.current.carbon_monoxide || 0,
    ozone: data.current.ozone || 0,
    hourly_time: data.hourly.time,
    hourly_aqi: data.hourly.us_aqi
  };
}

async function callGeminiAPI(weather, aqi, locationName, lang) {
  const prompt = `
Act as a strict, objective environmental health system for "PlanetPulse."
Given this live data for ${locationName}, provide a highly structured analysis.

LANGUAGE: ${lang.toUpperCase()}

LIVE DATA:
- US AQI: ${aqi ? aqi.aqi : 'N/A'}
- PM2.5: ${aqi ? aqi.pm2_5 : 'N/A'} μg/m³
- Ozone: ${aqi ? aqi.ozone : 'N/A'} μg/m³
- Temperature: ${weather ? weather.temp : 'N/A'} °C
- UV Index: ${weather ? weather.uv : 'N/A'}

You MUST respond with ONLY a valid JSON object matching this exact structure:
{
  "synopsis": "A bold, 2-sentence objective summary of the current conditions.",
  "checklist": ["Actionable step 1 (e.g., Wear an N95 mask)", "Actionable step 2", "Actionable step 3"],
  "ecoAdvice": "One specific, highly relevant piece of advice the user can do today to reduce their carbon footprint or environmental impact."
}
`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  const GEMINI_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    `gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Gemini API error');
    }

    const result = await response.json();
    const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (jsonText) {
      return JSON.parse(jsonText);
    }

    throw new Error('Empty response');
  } catch (error) {
    console.error('ERROR: Gemini API call failed:', error);
    return {
      synopsis: 'Failed to connect to AI telemetry.',
      checklist: ['Check connection', 'Refresh system'],
      ecoAdvice: 'System offline.'
    };
  }
}
