(() => {
  const TIME_ZONE = "Asia/Tehran";
  const faDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-arabext", {
    timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const tehranClock = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", timeZoneName: "longOffset",
  });
  const parts = (formatter, date) => Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  function renderDate() {
    const header = document.querySelector(".site-header .header-inner");
    if (!header) return;
    const now = new Date();
    const value = parts(faDate, now);
    const gregorian = parts(tehranClock, now);
    let output = header.querySelector(".site-date");
    if (!output) {
      output = document.createElement("time");
      output.className = "site-date";
      header.append(output);
    }
    output.dateTime = `${gregorian.year}-${gregorian.month}-${gregorian.day}`;
    output.textContent = `${value.weekday} ${value.day} ${value.month} ${value.year}`;
  }

  function millisecondsToTehranMidnight() {
    const now = new Date();
    const value = parts(tehranClock, now);
    const offset = value.timeZoneName.match(/GMT([+-])(\d{2}):(\d{2})/);
    const offsetMinutes = offset
      ? (offset[1] === "+" ? 1 : -1) * (Number(offset[2]) * 60 + Number(offset[3]))
      : 210;
    const nextMidnightUtc = Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day) + 1)
      - offsetMinutes * 60_000;
    return Math.max(1_000, nextMidnightUtc - now.getTime());
  }

  function scheduleNextDay() {
    window.setTimeout(() => {
      renderDate();
      scheduleNextDay();
    }, millisecondsToTehranMidnight() + 50);
  }

  renderDate();
  scheduleNextDay();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) renderDate();
  });
})();
