// ==UserScript==
// @name         ebird-track
// @namespace    https://kennychou.github.io/
// @version      2.0.2
// @description  eBird GPS Track Download
// @author       Kenny Chou
// @grant        none
// @run-at       document-start
// @match        https://ebird.org/checklist/*
// @match        https://ebird.org/*/checklist/*
// ==/UserScript==

(function () {
  'use strict';

  // ── Step 1: inject GPS capture code into main world via <script> tag ──
  // Tampermonkey may run in an isolated JS world even with @grant none.
  // Injecting a <script> element guarantees execution in the page's main world,
  // where our removeChild patch affects eBird's own Vue code.
  const captureScript = document.createElement('script');
  captureScript.id = '__ebird_gps_capture__';
  captureScript.textContent = `(function(){
    if(window.__ebirdGPSReady) return;
    window.__ebirdGPSReady = true;
    window.__ebirdGPS = null;

    var _rc = Node.prototype.removeChild;
    Node.prototype.removeChild = function(child){
      if(!window.__ebirdGPS && child && child.nodeType===1){
        var d = child.dataset && child.dataset.maptrackData;
        if(d){ window.__ebirdGPS = d; Node.prototype.removeChild = _rc; }
        else{
          try{
            var f = child.querySelector('[data-maptrack-data]');
            if(f && f.dataset.maptrackData){
              window.__ebirdGPS = f.dataset.maptrackData;
              Node.prototype.removeChild = _rc;
            }
          }catch(e){}
        }
      }
      return _rc.call(this, child);
    };

    var _ih = Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
    if(_ih && _ih.set){
      Object.defineProperty(Element.prototype,'innerHTML',{
        set:function(v){
          if(!window.__ebirdGPS){
            try{
              var f=this.querySelector('[data-maptrack-data]');
              if(f&&f.dataset.maptrackData){
                window.__ebirdGPS=f.dataset.maptrackData;
                Object.defineProperty(Element.prototype,'innerHTML',_ih);
              }
            }catch(e){}
          }
          _ih.set.call(this,v);
        },
        get:function(){return _ih.get.call(this);},
        configurable:true
      });
    }
  })();`;

  (document.head || document.documentElement).appendChild(captureScript);

  // ── Step 2: inject download button at DOMContentLoaded ───────────────
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

  // ── Step 3: download logic ────────────────────────────────────────────
  function downloadTrack() {
    const gpsData = window.__ebirdGPS;
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
