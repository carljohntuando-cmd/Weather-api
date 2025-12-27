# Classy Weather Forecast

Simple single-page weather app using OpenWeatherMap and Leaflet.

Files:
- `index.html` — UI markup
- `style.css` — styles and theme
- `script.js` — app logic, geocoding and weather fetching

Usage:
1. Open `index.html` in a browser.
2. Enter a city (or country) and click Search.

Notes:
- The app uses the provided OpenWeatherMap API key in `script.js`.
- Remove or replace the API key with your own for production use.

**Output**

- **Current weather:** shows `location`, `datetime`, a large `temperature` (°C), short `description`, `humidity` (%), `wind` (m/s), `feels like` and `UV` when available, and `sunrise`/`sunset` times.
- **Map:** displays a Leaflet map centered on the chosen location with a marker and an optional temperature overlay (from OpenWeatherMap tiles).
- **5-Day Forecast:** shows up to 5 daily cards with weekday/date, weather `icon`, high/low temperatures (°C), and precipitation probability (percent).
- **Icons & data sources:** weather icons are served from OpenWeatherMap; geocoding uses OpenWeatherMap and (for country lookups) REST Countries.
- **Units & defaults:** temperatures are in metric (°C). On first load the app searches for "Manila, PH" by default.
- **Fallback behavior:** if the OneCall API is unavailable the app attempts a fallback using the current weather + 3-hour forecast to build daily summaries.
- **Theme:** a light/dark toggle is provided; theme preference is saved to `localStorage` when available.

