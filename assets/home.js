(() => {
  "use strict";

  const trips = Object.values(window.TRAVEL_TRIPS || {});
  const themeKey = "gehr-travel-theme";
  const $ = (selector) => document.querySelector(selector);

  function statusClass(status) {
    if (/完成|已結束/.test(status)) return "complete";
    if (/取消|暫停/.test(status)) return "paused";
    return "planning";
  }

  function renderTrips() {
    $("#trip-count").textContent = String(trips.length);
    const byYear = trips.reduce((groups, trip) => {
      const year = trip.meta.startDate.slice(0, 4);
      (groups[year] ||= []).push(trip);
      return groups;
    }, {});

    $("#year-groups").innerHTML = Object.keys(byYear)
      .sort((a, b) => b.localeCompare(a))
      .map(
        (year) => `
          <section class="year-group" aria-labelledby="year-${year}">
            <div class="year-label">
              <span id="year-${year}">${year}</span>
              <i aria-hidden="true"></i>
              <small>${byYear[year].length} JOURNEY</small>
            </div>
            <div class="trip-grid">
              ${byYear[year]
                .map((trip) => {
                  const first = trip.days[0];
                  const last = trip.days[trip.days.length - 1];
                  const status = trip.meta.statusLabel || trip.meta.status;
                  return `
                    <article class="trip-card">
                      <a class="trip-card-link" href="trips/${year}/${trip.meta.slug}/" aria-label="查看 ${trip.meta.title}"></a>
                      <div class="trip-card-topline">
                        <span class="status ${statusClass(status)}">${status}</span>
                        <span>${trip.meta.dateLabel}</span>
                      </div>
                      <div class="trip-card-body">
                        <p>${trip.meta.eyebrow}</p>
                        <h3>${trip.meta.title}</h3>
                        <p class="trip-summary">${trip.meta.note}</p>
                      </div>
                      <div class="trip-card-route">
                        <span>${first.route.split(" → ")[0]}</span>
                        <i aria-hidden="true"></i>
                        <span>${last.route.split(" → ").at(-1)}</span>
                      </div>
                      <div class="trip-card-footer">
                        <span>${trip.days.length} DAYS</span>
                        <span>查看行程 <b aria-hidden="true">↗</b></span>
                      </div>
                    </article>`;
                })
                .join("")}
            </div>
          </section>`
      )
      .join("");
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

  renderTrips();
  setupTheme();
})();
