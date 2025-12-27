const API_KEY = "b67e9c150e80916e99585dd284b92663";

const searchBtn = document.getElementById("searchBtn");
const cityInput = document.getElementById("cityInput");

const currentEl = document.getElementById("current");
const forecastEl = document.getElementById("forecast");

// Defensive checks to avoid "null" DOM errors when elements are missing
if (!currentEl || !forecastEl) {
  console.error("Required UI elements (#current or #forecast) not found in DOM.");
}

let map;
let tempLayer;
const themeToggle = document.getElementById('themeToggle');

function applyTheme(theme){
  if(theme === 'light') document.body.classList.add('light-theme');
  else document.body.classList.remove('light-theme');
  try{ localStorage.setItem('theme', theme); }catch(e){}
  updateToggleIcon(theme);
}

function updateToggleIcon(theme){
  if(!themeToggle) return;
  const sun = themeToggle.querySelector('.icon.sun');
  const moon = themeToggle.querySelector('.icon.moon');
  if(sun) sun.style.opacity = theme === 'light' ? '1' : '0';
  if(moon) moon.style.opacity = theme === 'light' ? '0' : '1';
}

if(themeToggle){
  themeToggle.addEventListener('click', ()=>{
    const current = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
  });
}

async function geocode(city){
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`;
  try{
    const res = await fetch(url);
    if(!res.ok){
      console.error("Geocoding API error:", res.status, res.statusText);
      return null;
    }
    const data = await res.json();
    return data[0] || null;
  }catch(err){
    console.error("Geocoding fetch failed:", err);
    return null;
  }
}


async function fetchCountryInfo(name){
  if(!name) return null;
  const base = 'https://restcountries.com/v3.1/name/';
  try{
  
    let res = await fetch(`${base}${encodeURIComponent(name)}?fullText=true`);
    if(!res.ok){
      
      res = await fetch(`${base}${encodeURIComponent(name)}`);
      if(!res.ok) return null;
    }
    const data = await res.json();
    const entry = Array.isArray(data) && data.length ? data[0] : null;
    if(!entry) return null;
    
    const latlng = (entry.latlng && entry.latlng.length===2)
      ? entry.latlng
      : (entry.capitalInfo && entry.capitalInfo.latlng && entry.capitalInfo.latlng.length===2 ? entry.capitalInfo.latlng : null);
    if(!latlng) return null;
    return {
      name: entry.name?.common || name,
      lat: latlng[0],
      lon: latlng[1],
      country: entry.cca2 || ''
    };
  }catch(err){
    console.error('Country lookup failed', err);
    return null;
  }
}


async function fetchWeather(lat,lon){
  const url = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&units=metric&exclude=minutely,hourly,alerts&appid=${API_KEY}`;
  try{
    const res = await fetch(url);
    const data = await res.json();

    if(res.ok && data && data.current){
      return data;
    }

    
    console.warn("OneCall failed or returned unexpected shape, attempting fallback.", res.status, data);

    const curUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
    const forUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;

    const [curRes, forRes] = await Promise.all([fetch(curUrl), fetch(forUrl)]);
    const curData = await curRes.json();
    const forData = await forRes.json();

    if(!curRes.ok || !forRes.ok){
      console.error("Fallback API error", curRes.status, curData, forRes.status, forData);
      return null;
    }

    
    const days = {};
    (forData.list || []).forEach(item => {
      const dayKey = new Date(item.dt * 1000).toISOString().slice(0,10);
      if(!days[dayKey]) days[dayKey] = [];
      days[dayKey].push(item);
    });

    const daily = Object.keys(days).slice(0,5).map(dayKey => {
      const items = days[dayKey];
      let max = -Infinity, min = Infinity, pop = 0;
      items.forEach(it => {
        const t = (it.main && typeof it.main.temp === 'number') ? it.main.temp : null;
        if(t !== null){
          if(t > max) max = t;
          if(t < min) min = t;
        }
        if(typeof it.pop === 'number') pop = Math.max(pop, it.pop);
      });
      const mid = items[Math.floor(items.length/2)];
      return {
        dt: Math.floor(new Date(dayKey).getTime()/1000),
        temp: { max: isFinite(max) ? max : (mid?.main?.temp || 0), min: isFinite(min) ? min : (mid?.main?.temp || 0) },
        weather: [ { icon: mid?.weather?.[0]?.icon || '01d' } ],
        pop: pop
      };
    });

    const result = {
      current: {
        temp: curData.main.temp,
        weather: curData.weather,
        humidity: curData.main.humidity,
        wind_speed: curData.wind.speed
      },
      daily
    };

    return result;

  }catch(err){
    console.error("Weather fetch failed:", err);
    return null;
  }
}


function ensureMap(lat=14.6, lon=120.98){
  if(map){
    map.setView([lat,lon], 8);
    return;
  }

  map = L.map("map").setView([lat,lon], 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
    maxZoom:19
  }).addTo(map);

  tempLayer = L.tileLayer(
    `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${API_KEY}`,
    { opacity:0.55 }
  ).addTo(map);
}


function renderCurrent(name,data){
  const cur = data.current;

  currentEl.querySelector(".location").textContent = name;
  currentEl.querySelector(".temp").textContent = Math.round(cur.temp)+"°C";
  currentEl.querySelector(".desc").textContent = cur.weather[0].description;
  currentEl.querySelector(".extra").textContent =
    `Humidity: ${cur.humidity}% | Wind: ${cur.wind_speed} m/s`;
}


function renderForecast(daily){
  forecastEl.innerHTML = "";

  daily.slice(0,5).forEach(d=>{
    const div = document.createElement("div");
    div.className = "day glass";

    const date = new Date(d.dt*1000).toLocaleDateString(undefined,{
      weekday:"short",
      month:"short",
      day:"numeric"
    });

    div.innerHTML = `
      <div class="d">${date}</div>
      <img src="https://openweathermap.org/img/wn/${d.weather[0].icon}@2x.png">
      <div>${Math.round(d.temp.max)}° / ${Math.round(d.temp.min)}°</div>
      <div>Precip: ${Math.round((d.pop||0)*100)}%</div>
    `;

    forecastEl.appendChild(div);
  });
}


async function search(city){
  if(!city) return;
  
  let usedGeo = null;
  const countryInfo = await fetchCountryInfo(city);
  if(countryInfo && (countryInfo.name.toLowerCase() === city.toLowerCase() || (countryInfo.country && countryInfo.country.toLowerCase() === city.toLowerCase()))){
    usedGeo = { name: countryInfo.name, lat: countryInfo.lat, lon: countryInfo.lon, country: countryInfo.country };
  } else {
    
    const geo = await geocode(city);
    usedGeo = geo;
    
    if(!usedGeo){
      if(countryInfo){
        usedGeo = { name: countryInfo.name, lat: countryInfo.lat, lon: countryInfo.lon, country: countryInfo.country };
      }else{
        alert("City or country not found.");
        return;
      }
    }
  }

  const wx = await fetchWeather(usedGeo.lat, usedGeo.lon);
  if(!wx || !wx.current){
    alert("Weather data unavailable for the selected location.");
    return;
  }
  renderCurrent(`${usedGeo.name}${usedGeo.country ? (', '+usedGeo.country) : ''}`, wx);
  renderForecast(wx.daily);
  ensureMap(usedGeo.lat, usedGeo.lon);

  L.marker([usedGeo.lat, usedGeo.lon])
    .addTo(map)
    .bindPopup(`${usedGeo.name}${usedGeo.country ? (', '+usedGeo.country) : ''}`)
    .openPopup();
}


if (searchBtn && cityInput) {
  searchBtn.addEventListener("click", ()=> search(cityInput.value.trim()));

  cityInput.addEventListener("keyup", e=>{
    if(e.key==="Enter") search(cityInput.value.trim());
  });
} else {
  console.warn("Search UI elements not found; skipping event wiring.");
}


document.addEventListener("DOMContentLoaded", ()=>{
  if(cityInput){
    cityInput.value = "";
    cityInput.focus();
  }


  const savedTheme = (()=>{ try{ return localStorage.getItem('theme') }catch(e){return null} })();
  if(savedTheme) applyTheme(savedTheme);
  else if(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) applyTheme('light');

  search("Manila, PH");
});
