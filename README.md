# Gehr 的旅遊規劃｜公開網站

> **本資料夾角色：**可部署的公開靜態網站；只放願意分享的旅行內容。
> **本地完整紀錄：**依年份保存在上一層的行程資料夾，不隨網站部署。

- 首頁：[index.html](index.html)
- 共用版面與行為：[assets/](assets/)
- 行程頁：`trips/<年份>/<slug>/`

新增行程時，在對應子目錄放置 `index.html` 與 `route-data.js`，並讓首頁載入該資料檔。網站不發布逐筆開銷、票據、私人住宿資料或同行者資訊。

## 免費互動地圖

行程頁使用自帶的 Leaflet 1.9.4（BSD-2-Clause）、OpenStreetMap 圖磚及 Valhalla 公共機車路線服務，不需要 Google Maps Platform 金鑰。Google Maps 外開導航連結不會呼叫本網站的 Google API。

- 開頁自動顯示北宜主線；其他路線由使用者切換後載入。有固定軌跡時不請求外部路線服務。公開服務遵守公平使用，單頁串行且至少間隔 1.2 秒，不自動重試；不應當作大量流量的正式路線後端。
- 當前執行環境無法連到 Valhalla，尚無實際產生的固定道路軌跡。`road-routes.geojson` 目前為空；互動與失敗處理已用模擬服務驗證，正式路線服務仍須實際確認。
- 成功載入後可以匯出 GeoJSON。將各匯出檔的 Feature 合併進 `trips/2026/qiedigua/road-routes.geojson`，保留 `groupId` 和 `signature`；符合目前途經點的固定軌跡會優先使用，免除該路線的外部路線請求。不能放入 Google API 回傳的道路軌跡。
- 路線是 OSM／Valhalla 規劃，不保證與每日 Google Maps 導航相同。北宜地圖因新店碧興精確座標未核實，由坪林開始；不得把地圖長度或耗時當作完整 Day 1 實測值。
- Google 金鑰已從現行程式移除，但舊提交仍可能包含它；擁有者仍須在 Google Cloud 撤銷舊金鑰。

驗證：`node --test tests/route-geometry.test.cjs tests/open-route-client.test.cjs`。
