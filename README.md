# tampermonkey-ebird-track

eBird 賞鳥紀錄清單的 **GPS 軌跡下載** Tampermonkey 腳本。

在清單頁面的地圖旁加一個「下載軌跡」按鈕,把該次紀錄的 GPS 軌跡匯出成 **KML**
(可匯入 Google Earth、Google My Maps、GIS 軟體等)。

## 安裝

1. 先安裝 [Tampermonkey](https://www.tampermonkey.net/) 瀏覽器外掛
2. 點 [ebird-track 腳本](https://github.com/KennyChou/tampermonkey-ebird-track/raw/main/dist/ebird-track.user.js)
   安裝(Tampermonkey 會跳出安裝/更新畫面)

整支腳本就是 [`dist/ebird-track.user.js`](dist/ebird-track.user.js) 這一個檔案,
純 vanilla JS、無任何相依套件,不需要 build。

## 使用

1. **登入 eBird**(軌跡是私密資料,只有清單擁有者或被共享的人看得到)
2. 打開一張**有 GPS 軌跡**的清單(用 eBird App 邊走邊記錄才會有軌跡)
3. 地圖旁會出現「下載軌跡」按鈕,點下去即下載 KML

檔名為地點名稱;KML 內的 Placemark 名稱為「紀錄編號 日期 時間」。

## 運作原理 / 開發筆記

這支腳本踩過幾個坑,記錄如下以免重蹈覆轍:

- **軌跡資料是伺服器端直接渲染進 HTML 的**,藏在清單頁原始碼裡:
  ```html
  <clo-map-google :path="[lng,lat,lng,lat,...]" ...></clo-map-google>
  <!-- 同一份資料也以 data-maptrack-data="lng,lat,lng,lat,..." 出現 -->
  ```
  格式是 `經度,緯度` 成對的扁平數列(台灣約 `121.x, 25.x`)。

- **eBird 的 JS 一載入就把 `data-maptrack-data` 從即時 DOM 上讀走並刪掉**,
  所以在已渲染的頁面上 `querySelector('[data-maptrack-data]')` 會找不到。
  但重新 `fetch(location.href)` 拿到的 HTML 原始碼裡仍然有。

- **eBird 不是用 `google.maps.Polyline` 畫軌跡的**,而是用 `<clo-map-google>`
  這個 WebGL/自訂 overlay。曾經嘗試攔截 `Polyline.prototype.setPath`,
  呼叫次數是 0 —— 攔截 Google Maps 是死路。

- **未登入 / 非共享對象看不到軌跡**,頁面只會顯示
  「此GPS軌跡只有你和共享清單的其他人可以看到」,且不會送出座標資料。

因此本腳本的做法是:**按下按鈕時,重新 `fetch` 一次清單頁面,
直接從 HTML 原始碼解析 `data-maptrack-data`(備援:`:path`),
組出 KML 下載。** 不需要 `@run-at document-start`、不攔截 Google Maps、
也不跟 DOM 搶時間,單純又穩定。

> 歷史:`2.0.x`–`2.1.0` 走了攔截 Google Maps Polyline 的錯路;
> `2.2.0` 起改為 fetch + 解析 `data-maptrack-data`。
