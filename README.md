# 2026 切地瓜

四天三夜縱貫山海騎旅網站。

## 行程

- 10/31（六）：蘆洲 → 富貴角 → 北橫 → 武嶺 → 埔里
- 11/1（日）：埔里 → 塔塔加 → 阿里山 → 茶山 → 那瑪夏 → 甲仙
- 11/2（一）：甲仙 → 沿山公路 → 鵝鑾鼻 → 旭海 → 台東
- 11/3（二）：台東 → 台11 → 玉長公路 → 玉里麵 → 蘇花 → 北宜 → 蘆洲

## 功能

- 四天行程總覽
- Leaflet／OpenStreetMap 路線總覽
- 每日 1A、1B…分段 Google Maps 機車導航
- 出發前整備清單與完成進度
- 手機／桌面響應式版面
- 純 HTML、CSS、JavaScript，不需要建置或 API Key

## 本機預覽

在資料夾執行：

```bash
python -m http.server 8000
```

瀏覽器開啟：

```text
http://localhost:8000
```

## GitHub Pages

1. 建立 public repository，例如 `qiedigua-2026`。
2. 將本資料夾內所有檔案放在 repository 根目錄。
3. 進入 `Settings → Pages`。
4. Source 選擇 `Deploy from a branch`。
5. Branch 選擇 `main`，Folder 選擇 `/(root)`。

網站網址通常會是：

```text
https://你的帳號.github.io/qiedigua-2026/
```

## 修改資料

路線、日期、Google Maps 連結與檢查項目集中在：

```text
route-data.js
```

出發前請依最新道路公告更新。
