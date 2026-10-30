# Gehr 的旅遊規劃｜公開網站

> **本資料夾角色：**可部署的公開靜態網站；只放願意分享的旅行內容。
> **本地完整紀錄：**依年份保存在上一層的行程資料夾，不隨網站部署。

- 首頁：[index.html](index.html)
- 共用版面與行為：[assets/](assets/)
- 行程頁：`trips/<年份>/<slug>/`

新增行程時，在對應子目錄放置 `index.html` 與 `route-data.js`，並讓首頁載入該資料檔。網站不發布逐筆開銷、票據、私人住宿資料或同行者資訊。

## 互動路線地圖

開頁讀取本站保存的北宜道路軌跡，其餘每日主線、北橫歷史比較、西部及海線備案也有保存的軌跡。來源為 OpenStreetMap／Valhalla `motor_scooter` 真實回應，不以節點直線代替道路。管制線只從同一軌跡截取；匹配失敗保留未核實提示。

地圖是行程對照，不是已核實的台灣普通機車導航。碧興門市精確座標未核實，北宜由坪林開始。模型時間不含餐休與管制等待，且部分路線超出原時間預算；19:00目標不能視為保證。網站目前公開，尚未實作登入及旅行子頁授權。

- 更新軌跡：`node scripts/build-road-routes.cjs`；強制重取用 `--refresh`。須可連線正式 Valhalla 端點；失敗回傳非零狀態，不以假資料補線。
- 資料檢查：`node --test tests/*.test.cjs`。
- 瀏覽器檢查：安裝 `playwright-core`，以 `PLAYWRIGHT_MODULE=/path/to/playwright-core node scripts/verify-road-map.cjs` 執行。使用本機 Chromium、真實保存軌跡及真實圖磚，不攔截路由回應。
- [正式道路資料核對與限制](docs/road-map-validation.md)。
