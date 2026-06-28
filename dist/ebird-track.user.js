// ==UserScript==
// @name         ebird-track
// @namespace    https://kennychou.github.io/
// @version      2.2.0
// @description  eBird GPS Track Download
// @author       Kenny Chou
// @grant        none
// @match        https://ebird.org/checklist/*
// @match        https://ebird.org/*/checklist/*
// ==/UserScript==

(function () {
  'use strict';

  // eBird server-renders the GPS track into the checklist HTML as
  //   data-maptrack-data="lng,lat,lng,lat,..."
  // (also as :path="[lng,lat,...]" on a <clo-map-google> element).
  // Its own JS reads that attribute and strips it from the live DOM almost
  // immediately, so it is unreliable to read from the rendered page. eBird does
  // NOT draw the track with google.maps.Polyline either — it renders via a
  // WebGL/custom overlay, so there is nothing to intercept there.
  //
  // Instead we re-fetch the checklist page on demand. We are logged in and the
  // track is visible to us, so the server includes the coordinates in the HTML
  // source — we parse them straight from there. No DOM race, no Maps hooking.

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton);
  } else {
    injectButton();
  }

  function injectButton() {
    if (document.getElementById('ebird-track-dl')) return;
    const anchor = document.getElementById('tracks-map-mini') || document.getElementById('tracks');
    if (!anchor) return;
    const btn = document.createElement('button');
    btn.id = 'ebird-track-dl';
    btn.type = 'button';
    btn.textContent = '下載軌跡';
    btn.className = 'Button Button--highlight';
    btn.style.cssText = 'display:block;margin:8px 0;';
    btn.addEventListener('click', onClick);
    anchor.after(btn);
  }

  async function onClick() {
    const btn = document.getElementById('ebird-track-dl');
    const label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '下載中…'; }
    try {
      const coords = await fetchTrack();
      if (!coords.length) {
        alert('找不到 GPS 軌跡資料 (請確認已登入，且此清單有可見的 GPS 軌跡)');
        return;
      }
      downloadKML(coords);
    } catch (e) {
      alert('下載軌跡失敗：' + (e && e.message ? e.message : e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = label; }
    }
  }

  // Fetch the current checklist page and parse the GPS track into [[lng, lat], ...].
  async function fetchTrack() {
    const res = await fetch(location.href, { credentials: 'include' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return parseTrack(await res.text());
  }

  function parseTrack(html) {
    let nums = null;
    // Primary: data-maptrack-data="lng,lat,lng,lat,..."
    let m = html.match(/data-maptrack-data="([^"]*)"/);
    if (m) {
      nums = m[1].split(',').map(Number);
    } else {
      // Fallback: <clo-map-google :path="[lng,lat,...]">
      m = html.match(/:path="(\[[^"]*\])"/);
      if (m) { try { nums = JSON.parse(m[1]); } catch (e) { nums = null; } }
    }
    if (!nums) return [];
    const coords = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const lng = nums[i], lat = nums[i + 1];
      if (Number.isFinite(lng) && Number.isFinite(lat)) coords.push([lng, lat]);
    }
    return coords;
  }

  function downloadKML(coords) {
    const sid = getSid();
    const timeEl = document.querySelector('time[datetime]');
    const [date, time] = (timeEl ? timeEl.getAttribute('datetime') : 'T').split('T');
    const locname = getLocname();

    const coordStr = coords.map((c) => c[0] + ',' + c[1] + ',0').join('\n');
    const placemarkName = [sid, date, time].filter(Boolean).join(' ');
    const kml = buildKML(locname, placemarkName, coordStr);
    downloadFile(kml, sanitizeFilename(locname) + '.kml', 'application/vnd.google-earth.kml+xml');
  }

  function getSid() {
    const m = location.pathname.match(/\/(S\d+)\b/);
    return m ? m[1] : '';
  }

  function getLocname() {
    const base = 'section[aria-labelledby="primary-details"] .Heading.Heading--h3.u-margin-none';
    const link = document.querySelector(base + ' a span');
    if (link) return link.textContent.trim();
    const span = document.querySelector(base + ' span');
    return span ? span.textContent.trim() : 'track';
  }

  function buildKML(docName, placemarkName, coordStr) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<kml xmlns="http://www.opengis.net/kml/2.2">\n' +
      '  <Document>\n' +
      '    <name>' + esc(docName) + '</name>\n' +
      '    <Style id="s">\n' +
      '      <LineStyle><color>ff0000ff</color><width>4</width></LineStyle>\n' +
      '    </Style>\n' +
      '    <Placemark>\n' +
      '      <name>' + esc(placemarkName) + '</name>\n' +
      '      <styleUrl>#s</styleUrl>\n' +
      '      <LineString><tessellate>1</tessellate>\n' +
      '        <coordinates>' + coordStr + '</coordinates>\n' +
      '      </LineString>\n' +
      '    </Placemark>\n' +
      '  </Document>\n' +
      '</kml>';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function sanitizeFilename(s) {
    return String(s).replace(/[\\/:*?"<>|]/g, '_').trim() || 'track';
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
})();
