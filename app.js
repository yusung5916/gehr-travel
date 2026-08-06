(() => {
  const trip = window.TRIP_DATA;
  const overview = document.querySelector("#dayOverview");
  const tabs = document.querySelector("#dayTabs");
  const panel = document.querySelector("#routePanel");

  const iconSvg = {
    road: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3 6 21M16 3l2 18M12 5v3m0 3v3m0 3v2"/></svg>`,
    bike: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="m6 17 4-8h4l4 8M9 13h6M13 9l-1-3h3"/></svg>`,
    bag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 8V6a5 5 0 0 1 10 0v2M5 8h14l1 13H4L5 8Z"/></svg>`,
    stay: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 20V7l9-4 9 4v13M7 20v-7h10v7M9 9h.01M15 9h.01"/></svg>`,
    check: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m4 10 4 4 8-9"/></svg>`
  };

  overview.innerHTML = trip.days.map(day => `
    <article class="day-card" style="--day-color:${day.color}">
      <div class="day-card-top">
        <div>
          <div class="day-date">${day.date}</div>
          <div class="day-tag">${day.tag}</div>
        </div>
        <div class="day-number">${day.number}</div>
      </div>
      <h3>${day.title}</h3>
      <div class="day-route">${day.route}</div>
      <div class="day-card-footer">
        <span>${day.distance}</span>
        <span>宿｜${day.stay}</span>
      </div>
    </article>
  `).join("");

  function renderRoute(dayId) {
    const day = trip.days.find(d => d.id === dayId);
    panel.innerHTML = `
      <article class="route-panel" role="tabpanel">
        <div class="route-panel-head">
          <div>
            <h3>${day.date}｜${day.title}</h3>
            <p>${day.summary}</p>
          </div>
          <div class="route-panel-meta">
            <strong>${day.distance}</strong>
            <span>住宿：${day.stay}</span>
          </div>
        </div>
        <div class="segment-list">
          ${day.segments.map(segment => `
            <div class="segment-card">
              <div class="segment-code">${segment.code}</div>
              <div>
                <h4>${segment.name}</h4>
                <p>${segment.note}</p>
              </div>
              <a class="map-link" href="${segment.url}" target="_blank" rel="noopener">Google Maps ↗</a>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  trip.days.forEach((day, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-tab";
    button.style.setProperty("--day-color", day.color);
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", index === 0 ? "true" : "false");
    button.innerHTML = `
      <span class="day-tab-number">${day.number}</span>
      <span><small>${day.date}</small><strong>${day.stay}</strong></span>
    `;
    button.addEventListener("click", () => {
      tabs.querySelectorAll(".day-tab").forEach(tab => tab.setAttribute("aria-selected", "false"));
      button.setAttribute("aria-selected", "true");
      renderRoute(day.id);
    });
    tabs.appendChild(button);
  });
  renderRoute(trip.days[0].id);

  const map = L.map("map", {
    scrollWheelZoom: false,
    zoomControl: true,
  }).setView([23.75, 121.0], 7);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const toolbar = document.querySelector("#mapToolbar");
  const layers = {};
  const allPoints = [];

  trip.days.forEach(day => {
    const layer = L.layerGroup().addTo(map);
    const points = day.points.map(([lat, lng]) => [lat, lng]);
    allPoints.push(...points);

    L.polyline(points, {
      color: day.color,
      weight: 5,
      opacity: .88,
      dashArray: "7 8",
      lineCap: "round"
    }).addTo(layer);

    day.points.forEach(([lat, lng, name]) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="route-marker" style="background:${day.color}"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      L.marker([lat, lng], { icon })
        .bindPopup(`<strong>${day.date}｜${name}</strong><br>${day.route}`)
        .addTo(layer);
    });

    layers[day.id] = layer;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-toggle active";
    button.style.setProperty("--day-color", day.color);
    button.innerHTML = `<i></i><span>${day.date}</span>`;
    button.addEventListener("click", () => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
        button.classList.remove("active");
      } else {
        layer.addTo(map);
        button.classList.add("active");
      }
    });
    toolbar.appendChild(button);
  });

  map.fitBounds(allPoints, { padding: [28, 28] });

  const checkRoot = document.querySelector("#checkGroups");
  checkRoot.innerHTML = trip.checkGroups.map(group => `
    <section class="check-group">
      <div class="check-group-head">
        <div class="check-icon">${iconSvg[group.icon]}</div>
        <h3>${group.title}</h3>
      </div>
      <div class="check-items">
        ${group.items.map(([id, label]) => `
          <label class="check-item">
            <input type="checkbox" data-check="${id}">
            <span class="check-box">${iconSvg.check}</span>
            <span>${label}</span>
          </label>
        `).join("")}
      </div>
    </section>
  `).join("");

  const boxes = [...document.querySelectorAll("[data-check]")];
  const progressText = document.querySelector("#checkProgressText");
  const progressPercent = document.querySelector("#progressPercent");
  const ring = document.querySelector("#progressRing");
  const saved = JSON.parse(localStorage.getItem("qiedigua-checks") || "{}");

  function refreshProgress() {
    const done = boxes.filter(box => box.checked).length;
    const percent = Math.round(done / boxes.length * 100);
    progressText.textContent = `${done} / ${boxes.length}`;
    progressPercent.textContent = `${percent}%`;
    ring.style.setProperty("--progress", percent);
  }

  boxes.forEach(box => {
    box.checked = Boolean(saved[box.dataset.check]);
    box.addEventListener("change", () => {
      saved[box.dataset.check] = box.checked;
      localStorage.setItem("qiedigua-checks", JSON.stringify(saved));
      refreshProgress();
    });
  });
  refreshProgress();

  document.querySelector("#resetChecks").addEventListener("click", () => {
    localStorage.removeItem("qiedigua-checks");
    boxes.forEach(box => { box.checked = false; });
    Object.keys(saved).forEach(key => delete saved[key]);
    refreshProgress();
  });
})();
