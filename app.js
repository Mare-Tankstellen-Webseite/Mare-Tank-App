fetch('./tankstellen_preise_kw6_50.json')
  .then(r => r.json())
  .then(data => {
    document.getElementById('status').textContent =
      `Stationen: ${data.stations.length}`;

    const root = document.getElementById('stations');

    data.stations.forEach(s => {
      const d = s.preise?.diesel || {};
      const a = s.preise?.adblue || {};

      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <strong>${s.name}</strong><br>
        ${s.adresse}<br><br>
        Diesel AS24: ${d.as24 ?? '-'} €<br>
        Diesel Eurowag: ${d.eurowag ?? '-'} €<br>
        AdBlue AS24: ${a.as24 ?? '-'} €<br>
        AdBlue Eurowag: ${a.eurowag ?? '-'} €
      `;
      root.appendChild(div);
    });
  })
  .catch(() => {
    document.getElementById('status').textContent =
      'FEHLER: JSON nicht geladen';
  });
