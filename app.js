(() => {
  "use strict";

  const data = window.TRIP_DATA;
  if (!data) {
    document.body.innerHTML = "<p style='padding:2rem'>無法載入行程資料。</p>";
    return;
  }

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const checklistKey = `trip-checklist:${data.meta.startDate}:${data.meta.title}`;
  const themeKey = "trip-site-theme";
  let toastTimer;

  function mapUrl(segment) {
    const params = new URLSearchParams({
      api: "1",
      origin: segment.origin,
      destination: segment.destination,
      travelmode: "two-wheeler"
    });
    if (segment.via.length) params.set("waypoints", segment.via.join("|"));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 1800);
  }

  function renderMeta() {
    $("#trip-eyebrow").textContent = data.meta.eyebrow;
    $("#trip-status").textContent = data.meta.status;
    $("#trip-updated").textContent = `更新 ${data.meta.updated}`;
    $("#hero-title").textContent = data.meta.title;
    $("#trip-date").textContent = data.meta.dateLabel;
    $("#trip-note").textContent = data.meta.note;
    $("#poster-start").textContent = data.meta.startName;
    $("#poster-end").textContent = data.meta.endName;
    $("#poster-caption").textContent = `${data.meta.startName}起算 · 鵝鑾鼻完成主線 · ${data.meta.endDetail}結束導航`;
    $("#footer-title").textContent = data.meta.title;
    $("#footer-source").textContent = `整理自對話「${data.meta.sourceConversation}」`;

    $("#reference-title").textContent = `${data.reference.title} · ${data.reference.variant}`;
    $("#reference-note").textContent = data.reference.note;
    $("#reference-checked").textContent = `路線資料核對：${data.reference.checked}`;
    $("#reference-map").href = data.reference.mapUrl;
    $("#reference-map").textContent = "開啟機車總覽";
    $("#reference-linktree").href = data.reference.secondaryUrl;
    $("#reference-linktree").textContent = "開啟 TCT 參考圖";

    const segmentCount = data.days.reduce((sum, day) => sum + day.segments.length, 0);
    const overnightStops = data.days.filter((day) => day.stay && !day.stay.includes("導航")).length;
    const stats = [
      [`${data.days.length} 天 ${overnightStops} 夜`, "行程長度"],
      [`${segmentCount} 段`, "Google Maps 分段"],
      [`${overnightStops} 個住宿城市`, data.days.filter((day) => day.stay && !day.stay.includes("導航")).map((day) => day.stay).join(" · ")],
      ["CB200X", "預定車輛"]
    ];
    $("#stats").innerHTML = stats
      .map(([value, label]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`)
      .join("");
  }

  function renderPrinciples() {
    $("#principles-list").innerHTML = data.principles
      .map(
        (item, index) => `
          <article class="principle">
            <span class="principle-index">0${index + 1}</span>
            <p>${item}</p>
          </article>`
      )
      .join("");
  }

  function renderDays() {
    const tabs = $("#day-tabs");
    const panels = $("#day-panels");

    tabs.innerHTML = data.days
      .map(
        (day, index) => `
          <button
            class="day-tab"
            id="tab-${day.id}"
            type="button"
            role="tab"
            aria-selected="${index === 0}"
            aria-controls="panel-${day.id}"
            tabindex="${index === 0 ? 0 : -1}"
            style="--day-color:${day.color}"
          >Day ${day.day} · ${day.date}</button>`
      )
      .join("");

    panels.innerHTML = data.days
      .map(
        (day, index) => `
          <article
            class="day-panel"
            id="panel-${day.id}"
            role="tabpanel"
            aria-labelledby="tab-${day.id}"
            style="--day-color:${day.color}"
            ${index === 0 ? "" : "hidden"}
          >
            <div class="day-overview">
              <div>
                <span class="day-label">Day ${day.day} · ${day.date}</span>
                <h3>${day.route}</h3>
                <p class="day-focus">${day.focus}</p>
              </div>
              <div class="day-facts">
                <div class="fact"><span>建議出發</span><strong>${day.departure}</strong></div>
                <div class="fact"><span>預估抵達</span><strong>${day.arrival}</strong></div>
                <div class="fact"><span>含休息</span><strong>${day.duration}</strong></div>
                <div class="fact"><span>住宿</span><strong>${day.stay}</strong></div>
              </div>
            </div>
            <div class="segments">
              ${day.segments
                .map(
                  (segment) => `
                    <div class="segment">
                      <span class="segment-code">${segment.code}</span>
                      <div>
                        <div class="segment-meta">
                          <h4>${segment.title}</h4>
                          <span class="segment-source">${segment.basis}</span>
                        </div>
                        <p>${segment.note}</p>
                      </div>
                      <a class="map-button" href="${mapUrl(segment)}" target="_blank" rel="noopener noreferrer">
                        開啟導航 <span aria-hidden="true">↗</span>
                      </a>
                    </div>`
                )
                .join("")}
            </div>
          </article>`
      )
      .join("");

    const tabButtons = $$(".day-tab", tabs);
    const activateTab = (nextTab) => {
      tabButtons.forEach((tab) => {
        const selected = tab === nextTab;
        tab.setAttribute("aria-selected", selected);
        tab.tabIndex = selected ? 0 : -1;
        $(`#${tab.getAttribute("aria-controls")}`).hidden = !selected;
      });
    };

    tabButtons.forEach((tab, index) => {
      tab.addEventListener("click", () => activateTab(tab));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let target = index;
        if (event.key === "ArrowLeft") target = (index - 1 + tabButtons.length) % tabButtons.length;
        if (event.key === "ArrowRight") target = (index + 1) % tabButtons.length;
        if (event.key === "Home") target = 0;
        if (event.key === "End") target = tabButtons.length - 1;
        activateTab(tabButtons[target]);
        tabButtons[target].focus();
      });
    });
  }

  function readChecklist() {
    try {
      return JSON.parse(localStorage.getItem(checklistKey)) || {};
    } catch {
      return {};
    }
  }

  function updateProgress() {
    const boxes = $$("#checklist-groups input[type='checkbox']");
    const checked = boxes.filter((box) => box.checked).length;
    $("#check-progress").textContent = `${checked} / ${boxes.length} 完成`;
  }

  function renderChecklist() {
    const saved = readChecklist();
    let sequence = 0;
    $("#checklist-groups").innerHTML = data.checkpoints
      .map(
        (group) => `
          <section class="check-group">
            <h3>${group.group}</h3>
            ${group.items
              .map((item) => {
                const id = `check-${sequence++}`;
                return `
                  <label class="check-item" for="${id}">
                    <input id="${id}" type="checkbox" ${saved[id] ? "checked" : ""} />
                    <span>${item}</span>
                  </label>`;
              })
              .join("")}
          </section>`
      )
      .join("");

    $$("#checklist-groups input[type='checkbox']").forEach((box) => {
      box.addEventListener("change", () => {
        const next = readChecklist();
        next[box.id] = box.checked;
        localStorage.setItem(checklistKey, JSON.stringify(next));
        updateProgress();
      });
    });
    updateProgress();
  }

  function renderOpenQuestions() {
    $("#open-questions").innerHTML = data.openQuestions.map((item) => `<li>${item}</li>`).join("");
  }

  function setupTheme() {
    const saved = localStorage.getItem(themeKey);
    if (saved) document.documentElement.dataset.theme = saved;
    $(".theme-toggle").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      localStorage.setItem(themeKey, next);
    });
  }

  function setupActions() {
    $("#copy-summary").addEventListener("click", async () => {
      const summary = [
        `${data.meta.title}｜${data.meta.dateLabel}`,
        ...data.days.map((day) => `Day ${day.day} ${day.date}｜${day.route}｜宿 ${day.stay}`)
      ].join("\n");
      try {
        await navigator.clipboard.writeText(summary);
        showToast("行程摘要已複製");
      } catch {
        showToast("瀏覽器未允許複製");
      }
    });

    $("#reset-checklist").addEventListener("click", () => {
      localStorage.removeItem(checklistKey);
      $$("#checklist-groups input[type='checkbox']").forEach((box) => {
        box.checked = false;
      });
      updateProgress();
      showToast("檢查清單已重設");
    });
  }

  renderMeta();
  renderPrinciples();
  renderDays();
  renderChecklist();
  renderOpenQuestions();
  setupTheme();
  setupActions();
})();
