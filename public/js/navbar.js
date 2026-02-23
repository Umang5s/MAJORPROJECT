document.addEventListener("DOMContentLoaded", () => {
  /* ===============================
        SCROLL BEHAVIOR - Toggle between Full and Compact Navbar
  =============================== */

  const fullNavbar = document.getElementById("fullNavbar");
  const compactNavbar = document.getElementById("compactNavbar");
  let lastScrollTop = 0;
  let scrollThreshold = 50;

  if (fullNavbar && compactNavbar) {
    window.addEventListener("scroll", () => {
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;

      if (Math.abs(scrollTop - lastScrollTop) > scrollThreshold) {
        if (scrollTop > lastScrollTop && scrollTop > 100) {
          // Scrolling DOWN - show compact navbar, hide full
          fullNavbar.classList.add("hide");
          compactNavbar.classList.add("show");
        } else {
          // Scrolling UP - show full navbar, hide compact
          fullNavbar.classList.remove("hide");
          compactNavbar.classList.remove("show");
        }
        lastScrollTop = scrollTop;
      }
    });
  }

  /* ===============================
        MODE SWITCH (for both navbars)
  =============================== */

  // Handle both switch forms
  const switchForms = document.querySelectorAll(
    "#nnSwitchForm, #nnSwitchFormCompact",
  );

  switchForms.forEach((form) => {
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const switchBtn = e.target.querySelector('button[type="submit"]');
        const switchText = switchBtn.querySelector(".switch-text");
        const switchSpinner = switchBtn.querySelector(".switch-spinner");
        const formData = new FormData(form);

        if (switchText) switchText.style.display = "none";
        if (switchSpinner) switchSpinner.style.display = "inline-block";
        switchBtn.disabled = true;

        try {
          const response = await fetch("/mode/switch", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(formData),
          });

          if (response.redirected) {
            window.location.href = response.url;
          } else {
            window.location.reload();
          }
        } catch (error) {
          console.error("Switch error:", error);
          if (switchText) switchText.style.display = "inline-block";
          if (switchSpinner) switchSpinner.style.display = "none";
          switchBtn.disabled = false;
        }
      });
    }
  });

  /* ===============================
        DESTINATION SUGGESTIONS
  =============================== */

  const whereInput = document.getElementById("nnWhere");
  const suggestionsBox = document.getElementById("nnWhereSuggestions");
  let timeout = null;

  if (whereInput && suggestionsBox) {
    whereInput.addEventListener("input", (e) => {
      const q = e.target.value.trim();
      clearTimeout(timeout);

      if (!q) {
        suggestionsBox.style.display = "none";
        return;
      }
      timeout = setTimeout(() => loadSuggestions(q), 250);
    });

    async function loadSuggestions(q) {
      try {
        const res = await fetch("/api/destinations?q=" + encodeURIComponent(q));
        const data = await res.json();
        renderSuggestions(data);
      } catch {
        renderSuggestions(["Goa", "Mumbai", "Delhi", "Jaipur", "Manali"]);
      }
    }

    function renderSuggestions(list) {
      if (!list || !list.length) {
        suggestionsBox.style.display = "none";
        return;
      }

      suggestionsBox.innerHTML = list
        .map((i) => `<div class="item">${escapeHtml(i)}</div>`)
        .join("");
      suggestionsBox.style.display = "block";

      suggestionsBox.querySelectorAll(".item").forEach((el) => {
        el.addEventListener("click", () => {
          whereInput.value = el.textContent;
          suggestionsBox.style.display = "none";
        });
      });
    }

    function escapeHtml(s) {
      return ("" + s).replace(
        /[&<>"']/g,
        (m) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[m],
      );
    }
  }

  document.addEventListener("click", (e) => {
    if (
      suggestionsBox &&
      !e.target.closest('.nn-search-part[data-part="where"]')
    ) {
      suggestionsBox.style.display = "none";
    }
  });

  /* ===============================
            FLATPICKR DATE RANGE - UPDATED TO AVOID CONFLICTS
  =============================== */

  // Only initialize for the main search bar, NOT for booking form
  const dateInput = document.getElementById("dateRange");
  const checkIn = document.getElementById("checkIn");
  const checkOut = document.getElementById("checkOut");

  if (dateInput && window.flatpickr) {
    flatpickr(dateInput, {
      mode: "range",
      minDate: "today",
      dateFormat: "Y-m-d",
      onChange: function (dates) {
        if (dates.length === 2) {
          if (checkIn) checkIn.value = this.formatDate(dates[0], "Y-m-d");
          if (checkOut) checkOut.value = this.formatDate(dates[1], "Y-m-d");
          dateInput.value =
            this.formatDate(dates[0], "Y-m-d") +
            " → " +
            this.formatDate(dates[1], "Y-m-d");
        } else if (dates.length === 1) {
          dateInput.value = this.formatDate(dates[0], "Y-m-d");
        }
      },
    });
  }

  /* ===============================
              GUEST PICKER
  =============================== */

  const guestBtn = document.getElementById("nnGuestBtn");
  const guestPopover = document.getElementById("nnGuestPopover");
  const guestDone = document.getElementById("nnGuestDone");
  const guestsInput = document.getElementById("nnGuestsInput");

  const counts = { adults: 1, children: 0, infants: 0 };

  function updateGuestText() {
    const total = counts.adults + counts.children;
    let text = total + (total === 1 ? " guest" : " guests");
    if (counts.infants)
      text += `, ${counts.infants} infant${counts.infants > 1 ? "s" : ""}`;
    if (guestBtn) guestBtn.textContent = text;
    if (guestsInput) guestsInput.value = total;

    document.querySelectorAll(".nn-count").forEach((el) => {
      const t = el.dataset.type;
      if (t && counts[t] !== undefined) el.textContent = counts[t];
    });
  }

  if (guestBtn) {
    guestBtn.addEventListener("click", (e) => {
      e.stopPropagation();

      // close profile dropdowns safely
      if (dropdownFull) dropdownFull.classList.remove("show");
      if (dropdownCompact) dropdownCompact.classList.remove("show");

      if (guestPopover) {
        guestPopover.style.display =
          guestPopover.style.display === "block" ? "none" : "block";
      }
    });
  }

  document.querySelectorAll(".nn-plus, .nn-minus").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      if (!type) return;

      if (btn.classList.contains("nn-plus")) {
        counts[type]++;
      } else {
        counts[type] = Math.max(type === "adults" ? 1 : 0, counts[type] - 1);
      }
      updateGuestText();
    });
  });

  if (guestDone) {
    guestDone.addEventListener("click", () => {
      if (guestPopover) guestPopover.style.display = "none";
    });
  }

  document.addEventListener("click", (e) => {
    if (
      guestPopover &&
      !e.target.closest("#nnGuestPopover") &&
      !e.target.closest("#nnGuestBtn")
    ) {
      guestPopover.style.display = "none";
    }
  });

  updateGuestText();

  /* ===============================
   PROFILE MENU LOGIC (CLEAN)
================================ */

  const menuTrigger = document.getElementById("nnMenuTrigger");
  const menuTriggerCompact = document.getElementById("nnMenuTriggerCompact");

  const dropdownFull = document.getElementById("nnProfileDropdown");
  const dropdownCompact = document.getElementById("nnProfileDropdownCompact");

  function closeDropdowns() {
    if (dropdownFull) dropdownFull.classList.remove("show");
    if (dropdownCompact) dropdownCompact.classList.remove("show");
  }

  // FULL NAVBAR
  if (menuTrigger) {
    menuTrigger.addEventListener("click", function (e) {
      e.stopPropagation();
      if (dropdownFull) dropdownFull.classList.toggle("show");
    });
  }

  // COMPACT NAVBAR
  if (menuTriggerCompact) {
    menuTriggerCompact.addEventListener("click", function (e) {
      e.stopPropagation();
      if (dropdownCompact) dropdownCompact.classList.toggle("show");
    });
  }

  // CLICK OUTSIDE CLOSE
  document.addEventListener("click", function () {
    closeDropdowns();
  });

  /* ===============================
        COMPACT SEARCH CLICK HANDLER
  =============================== */

  const compactSearch = document.getElementById("compactSearch");
  const compactSearchBtn = document.getElementById("compactSearchBtn");

  function openFullSearch() {
    // Scroll to top to show full navbar
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    // After scrolling, focus on the search input
    setTimeout(() => {
      const searchInput = document.getElementById("nnWhere");
      if (searchInput) {
        searchInput.focus();
      }
    }, 300);
  }

  if (compactSearch) {
    compactSearch.addEventListener("click", openFullSearch);
  }

  if (compactSearchBtn) {
    compactSearchBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openFullSearch();
    });
  }
});
