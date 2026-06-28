// ==UserScript==
// @name         ebird-track
// @namespace    https://kennychou.github.io/
// @version      2.0.0
// @description  eBird GPS Track Download
// @author       Kenny Chou
// @grant        none
// @run-at       document-start
// @match        https://ebird.org/checklist/*
// @match        https://ebird.org/*/checklist/*
// ==/UserScript==

(function () {
  'use strict';

  let gpsData = null;

  // Capture GPS data from data-maptrack-data before eBird's Vue removes it
  const gpsObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        const candidates = node.dataset && node.dataset.maptrackData
          ? [node]
          : Array.from(node.querySelectorAll('[data-maptrack-data]'));
        for (const el of candidates) {
          if (el.dataset.maptrackData) {
            gpsData = el.dataset.maptrackData;
            gpsObserver.disconnect();
            return;
          }
        }
      }
    }
  });

  gpsObserver.observe(document, { childList: true, subtree: true });

  // Inject download button once DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    const anchor = document.getElementById('tracks');
    if (!anchor) return;

    const btn = document.createElement('button');
    btn.textContent = '下載軌跡';
    btn.className = 'Button Button--highlight';
    btn.style.cssText = 'display:block;margin:8px 0;';
    btn.addEventListener('click', downloadTrack);
    anchor.after(btn);
  });

  function downloadTrack() {
    if (!gpsData) {
      alert('找不到 GPS 軌跡資料');
      return;
    }

    const sid = (document.getElementById('chk-tools-delete') || {}).dataset?.subid || '';
    const timeEl = document.querySelector('time');
    const [d, t] = (timeEl ? timeEl.dateTime : 'T').split('T');
    const locname = getLocname();

    const parts = gpsData.split(',');
    const coords = [];
    for (let i = 0; i + 1 < parts.length; i += 2) {
      coords.push(parseFloat(parts[i]) + ',' + parseFloat(parts[i + 1]) + ',0');
    }

    const kml = buildKML(locname, [sid, d, t].filter(Boolean).join(' '), coords.join('\n'));
    downloadFile(kml, locname + '.kml', 'text/xml');
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
      '    <name>' + x(docName) + '</name>\n' +
      '    <Style id="trackStyle">\n' +
      '      <LineStyle><color>ff0000ff</color><width>4</width></LineStyle>\n' +
      '    </Style>\n' +
      '    <Placemark>\n' +
      '      <name>' + x(placemarkName) + '</name>\n' +
      '      <styleUrl>#trackStyle</styleUrl>\n' +
      '      <LineString>\n' +
      '        <tessellate>1</tessellate>\n' +
      '        <coordinates>' + coordStr + '</coordinates>\n' +
      '      </LineString>\n' +
      '    </Placemark>\n' +
      '  </Document>\n' +
      '</kml>';
  }

  function x(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
