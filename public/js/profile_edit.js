document.getElementById("avatarInput").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    document.querySelector(".avatar-xl").innerHTML =
      `<img src="${event.target.result}" class="avatar-img">`;
  };
  reader.readAsDataURL(file);
});

document.addEventListener("DOMContentLoaded", function () {
  // ----- Step wizard (unchanged) -----
  const steps = document.querySelectorAll(".step-content");
  const indicators = document.querySelectorAll(".step-indicator");
  const progressFill = document.getElementById("progressFill");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const doneBtn = document.getElementById("doneBtn");
  let currentStep = 1;
  const totalSteps = steps.length;

  function updateStep(step) {
    steps.forEach((s) => s.classList.toggle("active", s.dataset.step == step));
    indicators.forEach((ind) => {
      const indStep = parseInt(ind.dataset.step);
      ind.classList.toggle("active", indStep === step);
      ind.classList.toggle("completed", indStep < step);
    });
    progressFill.style.width = (step / totalSteps) * 100 + "%";
    prevBtn.disabled = step === 1;
    if (step === totalSteps) {
      nextBtn.style.display = "none";
      doneBtn.style.display = "inline-block";
    } else {
      nextBtn.style.display = "inline-block";
      doneBtn.style.display = "none";
    }
  }

  nextBtn.addEventListener("click", () => {
    if (currentStep < totalSteps) updateStep(++currentStep);
  });
  prevBtn.addEventListener("click", () => {
    if (currentStep > 1) updateStep(--currentStep);
  });
  indicators.forEach((ind) =>
    ind.addEventListener("click", () => {
      const targetStep = parseInt(ind.dataset.step);
      if (targetStep >= 1 && targetStep <= totalSteps) {
        currentStep = targetStep;
        updateStep(currentStep);
      }
    }),
  );
  updateStep(1);
});

document.addEventListener("DOMContentLoaded", function () {
  // ----- Interest Picker Modal (apply on Save) -----
  const allInterests = window.allInterests || []; // fallback

  const selectedContainer = document.getElementById(
    "selectedInterestsContainer",
  );
  const hiddenContainer = document.getElementById("hiddenInterestsContainer");
  const openModalBtn = document.getElementById("openInterestModalBtn");
  const pickerModal = document.getElementById("interestPickerModal");
  const closePicker = document.getElementById("closePickerModal");
  const cancelPicker = document.getElementById("cancelPicker");
  const savePicker = document.getElementById("savePicker");
  const interestsGrid = document.getElementById("interestsGrid");
  const selectionCounter = document.getElementById("selectionCounter");

  // Exit if any critical element is missing
  if (
    !selectedContainer ||
    !hiddenContainer ||
    !openModalBtn ||
    !pickerModal ||
    !interestsGrid
  ) {
    console.warn("Interest picker elements not found");
    return;
  }

  // Get current selected interests from hidden inputs
  function getSelectedInterests() {
    return Array.from(
      hiddenContainer.querySelectorAll('input[name="interests[]"]'),
    ).map((input) => input.value);
  }

  // Replace all selected interests in the main form
  function setSelectedInterests(interests) {
    hiddenContainer.innerHTML = "";
    interests.forEach((value) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "interests[]";
      input.value = value;
      hiddenContainer.appendChild(input);
    });
    updateFeaturedTags(interests);
  }

  // Update featured tags (max 5)
  function updateFeaturedTags(interests) {
    selectedContainer.innerHTML = "";
    const maxDisplay = 5;
    const display = interests.slice(0, maxDisplay);
    display.forEach((interest) => {
      const tag = document.createElement("span");
      tag.className = "selected-interest-tag";
      tag.innerHTML = `${interest} <button type="button" class="remove-interest" data-interest="${interest}">&times;</button>`;
      selectedContainer.appendChild(tag);
    });
    if (interests.length > maxDisplay) {
      const more = document.createElement("span");
      more.className = "more-interests";
      more.textContent = `+${interests.length - maxDisplay} more`;
      more.addEventListener("click", openModal);
      selectedContainer.appendChild(more);
    }
    // Attach remove events
    document.querySelectorAll(".remove-interest").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const interest = btn.dataset.interest;
        let current = getSelectedInterests();
        current = current.filter((i) => i !== interest);
        setSelectedInterests(current);
      });
    });
  }

  // Open modal: backup current selection and build grid
  function openModal() {
    const currentSelection = getSelectedInterests();
    window._modalSelection = currentSelection.slice(); // working copy

    interestsGrid.innerHTML = "";
    allInterests.forEach((interest) => {
      const tile = document.createElement("div");
      tile.className = "interest-tile";
      tile.textContent = interest;
      tile.dataset.interest = interest;
      if (window._modalSelection.includes(interest)) {
        tile.classList.add("selected");
      }

      tile.addEventListener("click", () => {
        tile.classList.toggle("selected");
        const isSelected = tile.classList.contains("selected");
        if (isSelected) {
          if (!window._modalSelection.includes(interest)) {
            window._modalSelection.push(interest);
          }
        } else {
          window._modalSelection = window._modalSelection.filter(
            (i) => i !== interest,
          );
        }
        updateModalCounter();
      });

      interestsGrid.appendChild(tile);
    });

    updateModalCounter();
    pickerModal.style.display = "flex";
  }

  function updateModalCounter() {
    const count = window._modalSelection ? window._modalSelection.length : 0;
    if (selectionCounter) {
      selectionCounter.textContent = `${count}/${allInterests.length} selected`;
    }
  }

  // Cancel: just close
  if (cancelPicker) {
    cancelPicker.addEventListener("click", () => {
      pickerModal.style.display = "none";
    });
  }

  if (closePicker) {
    closePicker.addEventListener("click", () => {
      pickerModal.style.display = "none";
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === pickerModal) {
      pickerModal.style.display = "none";
    }
  });

  // Save: apply modal selection to main form
  if (savePicker) {
    savePicker.addEventListener("click", () => {
      if (window._modalSelection) {
        setSelectedInterests(window._modalSelection);
      }
      pickerModal.style.display = "none";
      const successMsg = document.getElementById("successMessage");
      if (successMsg) {
        successMsg.style.display = "block";
        setTimeout(() => (successMsg.style.display = "none"), 2000);
      }
    });
  }

  // Open modal button
  openModalBtn.addEventListener("click", openModal);

  // Initialize featured tags from existing hidden inputs
  const initial = getSelectedInterests();
  updateFeaturedTags(initial);

  // ----- Custom Interests Modal (Airbnb style) -----
  const customModal = document.getElementById("customInterestModal");
  const openCustomBtn = document.getElementById("openCustomModalBtn");
  const closeCustom = document.getElementById("closeCustomModal");
  const cancelCustom = document.getElementById("cancelCustom");
  const addCustomBtn = document.getElementById("addCustomBtn");
  const customInput = document.getElementById("customInterestInput");
  const customContainer = document.getElementById("customInterestsContainer");

  function openCustomModal() {
    if (!customModal) return;
    customModal.style.display = "flex";
    if (customInput) {
      customInput.value = "";
      customInput.focus();
    }
  }

  function closeCustomModal() {
    if (customModal) customModal.style.display = "none";
  }

  if (openCustomBtn) {
    openCustomBtn.addEventListener("click", openCustomModal);
  }
  if (closeCustom) {
    closeCustom.addEventListener("click", closeCustomModal);
  }
  if (cancelCustom) {
    cancelCustom.addEventListener("click", closeCustomModal);
  }
  window.addEventListener("click", (e) => {
    if (e.target === customModal) closeCustomModal();
  });

  // Helper to add a custom tag (already exists, but ensure it's defined)
  function addCustomTag(interest) {
    // Optional: prevent duplicates (case‑insensitive)
    const existing = Array.from(
      customContainer.querySelectorAll('input[name="custom_interests[]"]'),
    ).map((inp) => inp.value.toLowerCase());
    if (existing.includes(interest.toLowerCase())) {
      alert("This interest already exists.");
      return;
    }

    const tagDiv = document.createElement("div");
    tagDiv.className = "custom-tag";

    const span = document.createElement("span");
    span.textContent = interest;
    tagDiv.appendChild(span);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-tag";
    removeBtn.setAttribute("aria-label", "Remove");
    removeBtn.innerHTML = "×";
    tagDiv.appendChild(removeBtn);

    const hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.name = "custom_interests[]";
    hiddenInput.value = interest;
    tagDiv.appendChild(hiddenInput);

    removeBtn.addEventListener("click", () => {
      tagDiv.remove();
    });

    customContainer.appendChild(tagDiv);
  }

  if (addCustomBtn) {
    addCustomBtn.addEventListener("click", () => {
      const interest = customInput ? customInput.value.trim() : "";
      if (interest === "") {
        alert("Please enter an interest.");
        return;
      }
      addCustomTag(interest);
      closeCustomModal();
    });
  }

  // Attach remove to existing custom tags (if any)
  document.querySelectorAll(".custom-tag .remove-tag").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.target.closest(".custom-tag").remove();
    });
  });
});

// ----- Delete photo (global function, called from onclick) -----
window.deletePhoto = function () {
  fetch('/profile/delete-photo', {
    method: 'POST',
    credentials: 'same-origin'
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const avatar = document.querySelector('.avatar-xl');
        // Use a safe expression for the initial – this will be replaced by EJS
        avatar.innerHTML = '<%= (currUser && currUser.name ? currUser.name[0].toUpperCase() : "U") %>';
        const deleteBtn = document.querySelector('.delete-photo-btn');
        if (deleteBtn) deleteBtn.remove();
      }
    })
    .catch(err => console.log('Delete failed', err));
};