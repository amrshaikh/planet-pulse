# **PlanetPulse** 🌍

PlanetPulse is an AI-powered sustainability dashboard that gives a clear, human-friendly environmental health check for any city.

Built for the Octopus Hackathon (October 2025), PlanetPulse aggregates weather, UV, and air-quality data and uses Google's Gemini to generate a concise 2-sentence summary citizens can act on.

---

## 🔎 What it does

- Fetches live location data (geocoding) for a given city.
- Retrieves current weather (temperature, humidity, UV index) and US AQI from Open-Meteo.
- Sends the consolidated data to Google Gemini (server-side) to produce a short, actionable summary.
- Presents both the raw numbers and a friendly AI summary in a clean, responsive UI.

## ✨ Key Features

- AI-powered 2-sentence summaries that translate numeric data into plain language.
- Live environmental snapshot: Temperature, Humidity, UV Index, and AQI.
- Secure serverless architecture (Netlify functions) — your Gemini API key stays server-side.
- Responsive, mobile-friendly UI with a simple animated AQI gauge.

## 🛠️ Tech Stack

- Frontend: HTML5, CSS3, JavaScript (ES6+)
- Backend: Netlify serverless functions (Node.js)
- APIs: Open-Meteo (weather, AQI, geocoding), Google Gemini (AI summaries)

## 🚀 Quick Start (Local)

1. Clone the repo:

    ```bash
    git clone https://github.com/YOUR_GITHUB_USERNAME_HERE/planet-pulse.git
    cd planet-pulse
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Install Netlify CLI (if you don't have it):

    ```bash
    npm install -g netlify-cli
    ```

4. Set up your environment and run locally:

    - Create a Netlify site or use `netlify dev` to run locally. When using Netlify, add the `GEMINI_API_KEY` as a site environment variable in the Netlify dashboard.

    ```bash
    netlify dev
    ```

5. Open your browser at http://localhost:8888 and try a city (e.g., "London").

    > Note: Without a configured `GEMINI_API_KEY` the app will still return weather/AQI data but the AI summary will show a placeholder message.

## ⚠️ Notes & Troubleshooting

- If the UI shows a persistent loading spinner after clicking "Check Pulse":
  - Open the browser DevTools Console and Network panel to inspect the request to `/.netlify/functions/getPulse`.
  - Ensure `GEMINI_API_KEY` is set in Netlify only if you want live AI summaries; otherwise the function returns a mock summary.
  - The Netlify function logs (visible in Netlify dashboard) show server-side errors and helpful diagnostics.

- The project is written to be defensive about API response shapes, but external APIs can change; check logs when data is missing.

## 🔮 Future improvements

- City autocomplete (typeahead) for faster searches
- Historical charts to visualize trends
- Favorites list for quick access to frequently checked cities
- Additional localization and unit options

## 👩‍💻 Contributing

Contributions are welcome! Please open issues or PRs with small, focused changes. If adding features that call external services, try to make them optional or mockable for local development.

---

Made with ❤️ for the Octopus Hackathon