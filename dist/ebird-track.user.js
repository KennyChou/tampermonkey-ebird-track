// ==UserScript==
// @name         ebird-track
// @namespace    https://kennychou.github.io/
// @version      2.0.5
// @description  eBird GPS Track Download
// @author       Kenny Chou
// @grant        none
// @run-at       document-start
// @match        https://ebird.org/checklist/*
// @match        https://ebird.org/*/checklist/*
// ==/UserScript==

(function () {
  'use strict';

  // ── Inject GPS capture into main world via <script> tag ──────────────
  // Primary: intercept google.maps.Polyline before eBird creates the track.
  // Fallback: intercept removeChild/replaceChild/etc for data-maptrack-data.
  const captureScript = document.createElement('script');
  captureScript.textContent = `(function(){
    if(window.__ebirdGPSReady) return;
    window.__ebirdGPSReady = true;
    window.__ebirdGPS = null;

    // ── Primary: intercept google.maps.Polyline ───────────────────────
    // eBird uses loading=async, so Polyline is NOT on google.maps directly —
    // it comes from await google.maps.importLibrary('maps') as {Polyline,...}.
    // We intercept importLibrary and patch the returned Polyline class.
    function extractCoords(opts) {
      if(!opts || !opts.path || window.__ebirdGPS) return;
      var arr = (typeof opts.path.getArray==='function') ? opts.path.getArray() : opts.path;
      if(!arr || arr.length < 2) return;
      var coords = [];
      for(var i=0; i<arr.length; i++) {
        var p=arr[i];
        var lat=(typeof p.lat==='function')?p.lat():p.lat;
        var lng=(typeof p.lng==='function')?p.lng():p.lng;
        coords.push(lng+','+lat);
      }
      window.__ebirdGPS = coords.join(',');
    }

    function patchPolylineOn(obj) {
      if(!obj || !obj.Polyline || obj.Polyline.__ebirdPatched) return;
      var Orig = obj.Polyline;
      obj.Polyline = function(opts) { extractCoords(opts); return new Orig(opts); };
      obj.Polyline.prototype = Orig.prototype;
      obj.Polyline.__ebirdPatched = true;
    }

    function patchMaps(maps) {
      if(!maps || maps.__ebirdMapsPatched) return;
      maps.__ebirdMapsPatched = true;

      // Patch classic API
      patchPolylineOn(maps);

      // Patch async API: importLibrary('maps') returns {Polyline, Map, ...}
      if(typeof maps.importLibrary === 'function') {
        var _origImport = maps.importLibrary;
        maps.importLibrary = function(libName) {
          return Promise.resolve(_origImport.apply(maps, arguments)).then(function(lib) {
            if(lib && lib.Polyline) patchPolylineOn(lib);
            return lib;
          });
        };
      }
    }

    // Intercept window.google setter — Maps bootstrap script sets it after document-start.
    // IMPORTANT: _google must start as undefined so typeof google === 'undefined'
    // before Maps loads; eBird uses this to decide whether to load Maps.
    var _google = (typeof window.google !== 'undefined') ? window.google : undefined;
    if(!_google) {
      Object.defineProperty(window, 'google', {
        get: function(){ return _google; },
        set: function(val){
          _google = val;
          if(val && val.maps) {
            // maps may grow incrementally; wait for importLibrary or Polyline
            if(val.maps.importLibrary || val.maps.Polyline) { patchMaps(val.maps); }
            else {
              var t=setInterval(function(){
                if(val.maps && (val.maps.importLibrary || val.maps.Polyline)){
                  patchMaps(val.maps); clearInterval(t);
                }
              }, 20);
              setTimeout(function(){clearInterval(t);}, 30000);
            }
          }
        },
        configurable: true
      });
    }
    if(_google && _google.maps) patchMaps(_google.maps);

    // ── Fallback: DOM removal interception ────────────────────────────
    function checkNode(n){
      if(!n||n.nodeType!==1) return null;
      var d=n.dataset&&n.dataset.maptrackData; if(d) return d;
      try{var f=n.querySelector('[data-maptrack-data]');if(f)return f.dataset.maptrackData||null;}catch(e){}
      return null;
    }
    function capDOM(d){if(d&&!window.__ebirdGPS)window.__ebirdGPS=d;}

    var _rc=Node.prototype.removeChild;
    Node.prototype.removeChild=function(c){capDOM(checkNode(c));return _rc.call(this,c);};

    var _rpc=Node.prototype.replaceChild;
    Node.prototype.replaceChild=function(n,o){capDOM(checkNode(o));return _rpc.call(this,n,o);};

    var _rw=Element.prototype.replaceWith;
    Element.prototype.replaceWith=function(){capDOM(checkNode(this));return _rw.apply(this,arguments);};

    var _rm=Element.prototype.remove;
    Element.prototype.remove=function(){capDOM(checkNode(this));return _rm.call(this);};

    var _ih=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
    if(_ih&&_ih.set) Object.defineProperty(Element.prototype,'innerHTML',{
      set:function(v){capDOM(checkNode(this));_ih.set.call(this,v);},
      get:function(){return _ih.get.call(this);},configurable:true
    });
  })();`;

  (document.head || document.documentElement).appendChild(captureScript);

  // ── Inject download button at DOMContentLoaded ────────────────────────
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

  // ── Download logic ───────────────────────────────────────────────────
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
