const JSON_FILE = './tankstellen.json';

const el = {
  status: document.getElementById('status'),
  error: document.getElementById('error'),
  root: document.getElementById('stations'),
  q: document.getElementById('q'),
  sort: document.getElementById('sort'),
  onlyOpen: document.getElementById('onlyOpen'),
  toast: document.getElementById('toast'),
};

let ALL = [];
let CURRENT_POS = null; // {lat, lon}

function norm(s){ return (s ?? '').toString().toLowerCase().trim(); }

function toast(msg){
  if (!el.toast) return;
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.remove('show'), 1800);
}

function is247(openStr){
  const t = norm(openStr).replace(/\s/g,'');
  return t.includes('24') || t === '00.00-24.00' || t === '00:00-24:00' || t === '00.00-00.00';
}

function fmtPrice(v){
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return '-';
  return n.toFixed(3).replace('.', ',');
}

function fmtKm(km){
  if (km === null || km === undefined || !Number.isFinite(km)) return '-';
  return km.toFixed(1).replace('.', ',');
}

function minOf(obj){
  const vals = Object.values(obj || {}).filter(v => typeof v === 'number' && !Number.isNaN(v));
  if (!vals.length) return Infinity;
  return Math.min(...vals);
}

function badge(label, ok){
  return `<span class="pill ${ok ? '' : 'off'}">${ok ? '✅' : '—'} ${label}</span>`;
}

function getAkzeptanz(a){
  const as24 = !!a?.as24_karte;
  const eurowag = !!a?.eurowag_karte;
  const gutmann = !!(a?.gutmann_karte ?? a?.gutmann_lieferant);
  return { as24, eurowag, gutmann };
}

function getDestination(s){
  const lat = s?.coords?.lat;
  const lon = s?.coords?.lon;
  if (typeof lat === 'number' && typeof lon === 'number') return `${lat},${lon}`;
  return s?.adresse ?? '';
}

/* Google Maps links (works on phone/tablet/web) */
function googleMapsSearchUrl(query){
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
function googleMapsDirUrl(dest, origin){
  const o = origin ? `&origin=${encodeURIComponent(origin)}` : '';
  return `https://www.google.com/maps/dir/?api=1${o}&destination=${encodeURIComponent(dest)}`;
}
function primaryRouteUrl(dest, origin=null){
  // If origin (GPS) -> directions. Else -> search.
  if (origin) return googleMapsDirUrl(dest, origin);
  return googleMapsSearchUrl(dest);
}

/* Distance (Haversine) */
function haversineKm(lat1, lon1, lat2, lon2){
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function computeDistances(){
  if (!CURRENT_POS) return;
  for (const s of ALL){
    const lat = s?.coords?.lat;
    const lon = s?.coords?.lon;
    if (typeof lat === 'number' && typeof lon === 'number'){
      s._distKm = haversineKm(CURRENT_POS.lat, CURRENT_POS.lon, lat, lon);
    } else {
      s._distKm = Infinity;
    }
  }
}

/* GPS */
function ensureGeo(){
  return new Promise((resolve, reject) => {
    if (CURRENT_POS) return resolve(CURRENT_POS);
    if (!navigator.geolocation) return reject(new Error('GPS nicht verfügbar'));

    navigator.geolocation.getCurrentPosition(
      pos => {
        CURRENT_POS = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        resolve(CURRENT_POS);
      },
      err => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

async function initGeoNonBlocking(){
  try{
    // ask once on load (browser may prompt). If denied, we just don't show distances.
    const pos = await ensureGeo();
    toast('Standort aktiv ✅');
    computeDistances();
    apply(); // re-render with distances
  } catch {
    // no prompt spam
    el.status.textContent = `Stationen: ${ALL.length}`;
  }
}

function render(list){
  el.root.innerHTML = '';

  if (!list.length){
    el.root.innerHTML = `<div class="error">Keine Treffer.</div>`;
    return;
  }

  const frag = document.createDocumentFragment();

  for (const s of list){
    const diesel = s.preise?.diesel || {};
    const adblue = s.preise?.adblue || {};
    const akz = getAkzeptanz(s.akzeptanz);

    const openTxt = s.oeffnungszeiten ?? '-';
    const openTag = is247(openTxt) ? `<span class="tag">24/7</span>` : `<span class="tag">⏱ ${openTxt}</span>`;

    const minDiesel = minOf(diesel);
    const minAdblue = minOf(adblue);

    const dest = getDestination(s);
    const dist = (CURRENT_POS && Number.isFinite(s._distKm) && s._distKm !== Infinity) ? s._distKm : null;
    const distTag = CURRENT_POS
      ? `<span class="tag">📍 ${dist === null ? '-' : fmtKm(dist)} km</span>`
      : '';

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-head">
        <div class="card-title">${s.name ?? '-'}</div>
        <div class="card-sub">${s.adresse ?? '-'}</div>
      </div>

      <div class="card-body">
        <div class="row">
          ${openTag}
          ${distTag}
          <span class="tag">Best Diesel: ${minDiesel === Infinity ? '-' : fmtPrice(minDiesel)} €</span>
        </div>

        <div class="row">
          ${badge('AS24', akz.as24)}
          ${badge('Eurowag', akz.eurowag)}
          ${badge('Gutmann', akz.gutmann)}
        </div>

        <div class="pricebox">
          <h4>Diesel</h4>
          <div class="pricegrid">
            <div class="kv"><span>AS24</span><b>${fmtPrice(diesel.as24)} €</b></div>
            <div class="kv"><span>Eurowag</span><b>${fmtPrice(diesel.eurowag)} €</b></div>
            <div class="kv"><span>Gutmann</span><b>${fmtPrice(diesel.gutmann)} €</b></div>
            <div class="kv"><span>Best</span><b>${minDiesel === Infinity ? '-' : fmtPrice(minDiesel)} €</b></div>
          </div>
        </div>

        <div class="pricebox">
          <h4>AdBlue</h4>
          <div class="pricegrid">
            <div class="kv"><span>AS24</span><b>${fmtPrice(adblue.as24)} €</b></div>
            <div class="kv"><span>Eurowag</span><b>${fmtPrice(adblue.eurowag)} €</b></div>
            <div class="kv"><span>Gutmann</span><b>${fmtPrice(adblue.gutmann)} €</b></div>
            <div class="kv"><span>Best</span><b>${minAdblue === Infinity ? '-' : fmtPrice(minAdblue)} €</b></div>
          </div>
        </div>

        <div class="btnrow">
          <button class="btn route-btn" data-dest="${encodeURIComponent(dest)}">🧭 Route</button>
        </div>
      </div>
    `;

    frag.appendChild(card);
  }

  el.root.appendChild(frag);

  // Route button:
  // - tries GPS for origin
  // - if denied/unavailable, opens Google Maps search
  el.root.querySelectorAll('.route-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const dest = decodeURIComponent(btn.dataset.dest || '');
      if (!dest) return toast('Kein Ziel');
      try{
        toast('GPS wird abgefragt…');
        const pos = await ensureGeo();
        const origin = `${pos.lat},${pos.lon}`;
        window.open(primaryRouteUrl(dest, origin), '_blank', 'noopener,noreferrer');
      } catch {
        window.open(primaryRouteUrl(dest), '_blank', 'noopener,noreferrer');
      }
    });
  });
}

function apply(){
  const q = norm(el.q.value);
  const only247 = el.onlyOpen.checked;
  const sortMode = el.sort.value;

  let list = ALL.slice();

  if (q){
    list = list.filter(s => norm(s.name).includes(q) || norm(s.adresse).includes(q));
  }

  if (only247){
    list = list.filter(s => is247(s.oeffnungszeiten));
  }

  if (sortMode === 'name_asc'){
    list.sort((a,b) => (a.name ?? '').localeCompare((b.name ?? ''), 'de'));
  } else if (sortMode === 'diesel_asc'){
    list.sort((a,b) => minOf(a.preise?.diesel) - minOf(b.preise?.diesel));
  } else if (sortMode === 'adblue_asc'){
    list.sort((a,b) => minOf(a.preise?.adblue) - minOf(b.preise?.adblue));
  } else if (sortMode === 'distance_asc'){
    // Requires coords + GPS; missing coords go to bottom
    list.sort((a,b) => (a._distKm ?? Infinity) - (b._distKm ?? Infinity));
  }

  const gpsInfo = CURRENT_POS ? ' • Standort aktiv' : '';
  el.status.textContent = `Stationen: ${list.length} / ${ALL.length}${gpsInfo}`;
  render(list);
}

async function load(){
  try{
    el.error.hidden = true;
    el.status.textContent = 'lade Daten…';

    const r = await fetch(JSON_FILE, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);

    const data = await r.json();
    if (!data || !Array.isArray(data.stations)) throw new Error('JSON-Format: stations[] fehlt');

    ALL = data.stations;

    // init distances placeholder
    for (const s of ALL) s._distKm = Infinity;

    el.q.addEventListener('input', apply);
    el.sort.addEventListener('change', apply);
    el.onlyOpen.addEventListener('change', apply);

    apply();

    // Non-blocking GPS (once)
    initGeoNonBlocking();
  } catch (e){
    el.error.hidden = false;
    el.error.textContent = 'FEHLER: JSON nicht geladen (' + (e?.message ?? e) + ')';
    el.status.textContent = 'Fehler';
    console.error(e);
  }
}

/* 🌙☀️ Theme toggle (from previous version) */
const themeBtn = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('theme');

if (savedTheme === 'light') {
  document.body.classList.add('light');
  if (themeBtn) themeBtn.textContent = '☀️ Tag';
}

themeBtn?.addEventListener('click', () => {
  document.body.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  themeBtn.textContent = isLight ? '☀️ Tag' : '🌙 Nacht';
});

load();
