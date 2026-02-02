
const JSON_PATH = "tankstellen_preise_kw6_50.json";

const elList = document.getElementById("list");
const elCount = document.getElementById("count");
const elHint = document.getElementById("hint");
const elSearch = document.getElementById("search");
const elSort = document.getElementById("sort");
const elSortDir = document.getElementById("sortDir");
const elFilterPay = document.getElementById("filterPay");
const themeToggle = document.getElementById("themeToggle");

function loadTheme(){
  const t = localStorage.getItem("mare_theme") || "dark";
  document.documentElement.dataset.theme = t === "light" ? "light" : "dark";
}
function toggleTheme(){
  const cur = document.documentElement.dataset.theme || "dark";
  const next = cur === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("mare_theme", next);
}
themeToggle.addEventListener("click", toggleTheme);
loadTheme();

function fmtPrice4(x){
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  // show 4 decimals as in PDF, but also show € interpretation in small text
  return Number(x).toFixed(4);
}
function fmtEuroHint(x){
  if (x === null || x === undefined || Number.isNaN(x)) return "";
  // Interpret 0.7360 -> 73,6 cent; 1.2000 -> 1,20 €
  const n = Number(x);
  const euros = n.toFixed(2).replace(".", ",");
  return euros + " €";
}

function cleanAddressForMaps(address){
  let a = String(address || "").trim();
  // remove duplicate leading city token like "Nussdorf Drautal ..." -> keep from street keyword onward
  a = a.replace(/^([A-Za-zÄÖÜäöüß\-]+)\s+(?=.*\d)/, (m,p1)=>{
    // if the rest contains a typical street keyword, drop the leading token
    const rest = a.slice(p1.length).trim();
    if (/\b(str\.|straße|strasse|weg|gasse|allee|platz|ring|autobahn|bundesstr\.|bundesstraße)\b/i.test(rest)) return rest;
    return a;
  });
  a = a.replace(/\s+,/g, ",");
  a = a.replace(/\s{2,}/g, " ").trim();
  return a;
}
function gmapsRouteLink(address){
  const dest = encodeURIComponent(cleanAddressForMaps(address));
  return `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${dest}`;
}

  const dest = encodeURIComponent(String(address || "").trim());
  return `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${dest}`;
}

function acceptBadges(a){
  const chips=[];
  if (!a) a = {as24:false, eurowag:false};
  chips.push(`<span class="chip">${a.as24 ? "✅" : "—"} AS24 (Karte)</span>`);
  chips.push(`<span class="chip">${a.eurowag ? "✅" : "—"} Eurowag (Karte)</span>`);
  return chips.join("");
}

function getSortableValue(s, key){
  const p = s.preise || {};
  const d = p.diesel || {};
  const a = p.adblue || {};
  switch(key){
    case "diesel_as24": return d.as24 ?? null;
    case "diesel_eurowag": return d.eurowag ?? null;
    case "diesel_gutmann": return d.gutmann ?? null;
    case "adblue_as24": return a.as24 ?? null;
    case "adblue_eurowag": return a.eurowag ?? null;
    case "adblue_gutmann": return a.gutmann ?? null;
    default: return null;
  }
}

function passesFilterPay(s, filter){
  if (filter === "all") return true;
  const a = s.akzeptanz || {};
  if (filter === "as24") return !!a.as24;
  if (filter === "eurowag") return !!a.eurowag;
  return true;
}

function render(stations){
  const q = (elSearch.value || "").trim().toLowerCase();
  const sortKey = elSort.value;
  const sortDir = elSortDir.value;
  const filterPay = elFilterPay.value;

  let view = stations.slice();

  if (q){
    view = view.filter(s => (s.name||"").toLowerCase().includes(q) || (s.adresse||"").toLowerCase().includes(q));
  }
  view = view.filter(s => passesFilterPay(s, filterPay));

  if (sortKey !== "none"){
    view.sort((a,b)=>{
      const va = getSortableValue(a, sortKey);
      const vb = getSortableValue(b, sortKey);
      const na = (va === null || va === undefined) ? Infinity : Number(va);
      const nb = (vb === null || vb === undefined) ? Infinity : Number(vb);
      return sortDir === "asc" ? (na - nb) : (nb - na);
    });
  }

  elList.innerHTML = view.map(s => {
    const d = (s.preise && s.preise.diesel) ? s.preise.diesel : {};
    const a = (s.preise && s.preise.adblue) ? s.preise.adblue : {};
    const hours = s.oeffnungszeiten ? `<span class="chip">🕒 ${s.oeffnungszeiten}</span>` : "";
    return `
      <div class="card">
        <h3>${s.name || "Tankstelle"}</h3>
        <div class="addr">${s.adresse || ""}</div>
        <div class="row">
          ${hours}
          ${acceptBadges(s.akzeptanz)}
        </div>

        <div class="priceGrid">
          <div class="tbl">
            <div class="t">Diesel AS24</div>
            <div class="v">${fmtPrice4(d.as24)}</div>
            <div class="small">${fmtEuroHint(d.as24)}</div>
          </div>
          <div class="tbl">
            <div class="t">Diesel Eurowag</div>
            <div class="v">${fmtPrice4(d.eurowag)}</div>
            <div class="small">${fmtEuroHint(d.eurowag)}</div>
          </div>
          <div class="small">${fmtEuroHint(d.gutmann)}</div>
          </div>
          <div class="tbl">
            <div class="t">AdBlue AS24</div>
            <div class="v">${fmtPrice4(a.as24)}</div>
            <div class="small">${fmtEuroHint(a.as24)}</div>
          </div>
          <div class="tbl">
            <div class="t">AdBlue Eurowag</div>
            <div class="v">${fmtPrice4(a.eurowag)}</div>
            <div class="small">${fmtEuroHint(a.eurowag)}</div>
          </div>
          <div class="small">${fmtEuroHint(a.gutmann)}</div>
          </div>
        </div>

        <div class="links">
          <a class="btnLink" target="_blank" rel="noopener" href="${gmapsRouteLink(s.adresse)}">🧭 Route</a>
        </div>
      </div>
    `;
  }).join("");

  elCount.textContent = `Anzeige: ${view.length} / ${stations.length} Tankstellen`;
}

async function main(){
  try{
    const r = await fetch(JSON_PATH, {cache:"no-store"});
    if (!r.ok) throw new Error("JSON konnte nicht geladen werden: " + JSON_PATH);
    const js = await r.json();
    const stations = js.stations || js.stationen || [];
    if (!Array.isArray(stations) || stations.length === 0){
      elHint.textContent = "Keine Tankstellen in der JSON gefunden.";
      return;
    }
    elHint.textContent = "Navigation läuft über Google Maps (Route) mit bereinigter Adresse.";
    render(stations);

    [elSearch, elSort, elSortDir, elFilterPay].forEach(el => el.addEventListener("input", ()=>render(stations)));
    [elSort, elSortDir, elFilterPay].forEach(el => el.addEventListener("change", ()=>render(stations)));
  }catch(e){
    elHint.textContent = "Fehler: " + e.message;
    console.error(e);
  }
}
main();
