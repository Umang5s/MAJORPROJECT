// show.js - interactive features for listing page

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM fully loaded");

  // Make sure listing is defined
  if (typeof listing === "undefined") {
    console.error("Listing data is not defined");
    return;
  }

  console.log("Listing data:", listing);

  // Get price from listing object
  const basePrice = listing.price || 0;

  // ========== DATE PICKER ==========
  const checkInDisplay = document.getElementById("checkInDisplay");
  const checkOutDisplay = document.getElementById("checkOutDisplay");
  const bookingCheckIn = document.getElementById("bookingCheckIn");
  const bookingCheckOut = document.getElementById("bookingCheckOut");
  const checkInContainer = document.getElementById("checkInContainer");
  const checkOutContainer = document.getElementById("checkOutContainer");

  // Initialize flatpickr
  if (checkInDisplay && checkOutDisplay) {
    try {
      if (typeof flatpickr === "undefined") {
        console.error("Flatpickr is not loaded");
      } else {
        const fp = flatpickr(checkInDisplay, {
          mode: "range",
          minDate: "today",
          dateFormat: "Y-m-d",
          showMonths: 2,
          onReady: function () {
            console.log("Flatpickr ready");
          },
          onChange: function (selectedDates, dateStr, instance) {
            console.log("Dates selected:", selectedDates);
            if (selectedDates.length === 2) {
              const checkIn = instance.formatDate(selectedDates[0], "Y-m-d");
              const checkOut = instance.formatDate(selectedDates[1], "Y-m-d");

              bookingCheckIn.value = checkIn;
              bookingCheckOut.value = checkOut;

              checkInDisplay.value = instance.formatDate(
                selectedDates[0],
                "M d, Y",
              );
              checkOutDisplay.value = instance.formatDate(
                selectedDates[1],
                "M d, Y",
              );

              // Update price breakdown when dates change
              updatePriceBreakdown();
            }
          },
        });

        // Make containers clickable
        if (checkInContainer) {
          checkInContainer.onclick = function () {
            fp.open();
            return false;
          };
        }

        if (checkOutContainer) {
          checkOutContainer.onclick = function () {
            fp.open();
            return false;
          };
        }

        // Also make inputs clickable directly
        checkInDisplay.onclick = function () {
          fp.open();
          return false;
        };

        checkOutDisplay.onclick = function () {
          fp.open();
          return false;
        };
      }
    } catch (error) {
      console.error("Flatpickr error:", error);
    }
  }

  // ========== ROOMS SELECTOR ==========
  const roomsSummary = document.getElementById("roomsSummary");
  const roomsDropdown = document.getElementById("roomsDropdown");
  const roomsSummaryText = document.getElementById("roomsSummaryText");
  const roomsTotalInput = document.getElementById("roomsTotal");
  const roomsCount = document.getElementById("roomsCount");
  const roomsMinusBtn = document.getElementById("roomsMinusBtn");
  const roomsPlusBtn = document.getElementById("roomsPlusBtn");
  const roomsAvailableText = document.getElementById("roomsAvailableText");

  // Get total rooms from hidden input
  const totalRoomsElement = document.getElementById("totalRoomsData");
  const totalRooms = totalRoomsElement
    ? parseInt(totalRoomsElement.value)
    : listing.totalRooms || listing.bedrooms || 1;

  let currentRooms = 1;

  function updateRoomsDisplay() {
    if (roomsCount) roomsCount.textContent = currentRooms;
    if (roomsSummaryText) {
      roomsSummaryText.textContent =
        currentRooms === 1 ? "1 room" : currentRooms + " rooms";
    }
    if (roomsTotalInput) roomsTotalInput.value = currentRooms;
    if (roomsAvailableText) {
      roomsAvailableText.textContent = "Available: " + totalRooms;
    }
    updatePriceBreakdown();
  }

  // Toggle rooms dropdown
  if (roomsSummary && roomsDropdown) {
    roomsSummary.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();

      // Close guest dropdown if open
      if (guestDropdown && guestDropdown.classList.contains("show")) {
        guestDropdown.classList.remove("show");
        const guestChevron = document.querySelector("#guestSummary i");
        if (guestChevron) guestChevron.style.transform = "";
      }

      roomsDropdown.classList.toggle("show");

      // Rotate chevron
      const chevron = this.querySelector("i");
      if (chevron) {
        chevron.style.transform = roomsDropdown.classList.contains("show")
          ? "rotate(180deg)"
          : "";
      }
    };
  }

  // Rooms plus button
  if (roomsPlusBtn) {
    roomsPlusBtn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (currentRooms < totalRooms) {
        currentRooms++;
        updateRoomsDisplay();
      }
    };
  }

  // Rooms minus button
  if (roomsMinusBtn) {
    roomsMinusBtn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (currentRooms > 1) {
        currentRooms--;
        updateRoomsDisplay();
      }
    };
  }

  // ========== GUEST DROPDOWN ==========
  const guestSummary = document.getElementById("guestSummary");
  const guestDropdown = document.getElementById("guestDropdown");
  const guestSummaryText = document.getElementById("guestSummaryText");
  const guestsTotalInput = document.getElementById("guestsTotal");

  // Get max guests from hidden input
  const maxGuestsElement = document.getElementById("maxGuestsData");
  const maxGuests = maxGuestsElement
    ? parseInt(maxGuestsElement.value)
    : listing.guests || 2;

  if (guestSummary && guestDropdown) {
    guestSummary.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();

      // Close rooms dropdown if open
      if (roomsDropdown && roomsDropdown.classList.contains("show")) {
        roomsDropdown.classList.remove("show");
        const roomsChevron = document.querySelector("#roomsSummary i");
        if (roomsChevron) roomsChevron.style.transform = "";
      }

      guestDropdown.classList.toggle("show");

      // Rotate chevron
      const chevron = this.querySelector("i");
      if (chevron) {
        chevron.style.transform = guestDropdown.classList.contains("show")
          ? "rotate(180deg)"
          : "";
      }
    };
  }

  // ========== GUEST COUNTERS ==========
  let adults = 1;
  let children = 0;
  let infants = 0;
  let pets = 0;

  const adultsSpan = document.getElementById("adultsCount");
  const childrenSpan = document.getElementById("childrenCount");
  const infantsSpan = document.getElementById("infantsCount");
  const petsSpan = document.getElementById("petsCount");

  function updateGuestDisplay() {
    const totalGuests = adults + children;

    if (guestsTotalInput) guestsTotalInput.value = totalGuests;
    if (guestSummaryText) {
      guestSummaryText.textContent =
        totalGuests === 1 ? "1 guest" : totalGuests + " guests";
    }
    if (adultsSpan) adultsSpan.textContent = adults;
    if (childrenSpan) childrenSpan.textContent = children;
    if (infantsSpan) infantsSpan.textContent = infants;
    if (petsSpan) petsSpan.textContent = pets;
  }

  // Plus buttons for guests
  document.querySelectorAll(".guest-counter .plus").forEach((btn) => {
    btn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();

      const category = this.dataset.category;

      if (category === "adults" && adults + children < maxGuests) adults++;
      else if (category === "children" && adults + children < maxGuests)
        children++;
      else if (category === "infants") infants++;
      else if (category === "pets") pets++;

      updateGuestDisplay();
    };
  });

  // Minus buttons for guests
  document.querySelectorAll(".guest-counter .minus").forEach((btn) => {
    btn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();

      const category = this.dataset.category;

      if (category === "adults" && adults > 1) adults--;
      else if (category === "children" && children > 0) children--;
      else if (category === "infants" && infants > 0) infants--;
      else if (category === "pets" && pets > 0) pets--;

      updateGuestDisplay();
    };
  });

  // ========== PRICE BREAKDOWN FUNCTION ==========
  function updatePriceBreakdown() {
    const nightsCountDisplay = document.getElementById("nightsCountDisplay");
    const roomsCountDisplay = document.getElementById("roomsCountDisplay");
    const totalNightsPrice = document.getElementById("totalNightsPrice");
    const serviceFee = document.getElementById("serviceFee");
    const totalPrice = document.getElementById("totalPrice");

    const checkIn = document.getElementById("bookingCheckIn")?.value;
    const checkOut = document.getElementById("bookingCheckOut")?.value;

    let nights = 2;
    if (checkIn && checkOut) {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      const diffTime = Math.abs(end - start);
      nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    if (nightsCountDisplay) nightsCountDisplay.textContent = nights;
    if (roomsCountDisplay) roomsCountDisplay.textContent = currentRooms;

    const totalNightsPriceValue = basePrice * nights * currentRooms;
    const serviceFeeValue = Math.round(totalNightsPriceValue * 0.14);
    const totalPriceValue = Math.round(totalNightsPriceValue * 1.14);

    if (totalNightsPrice)
      totalNightsPrice.textContent =
        "₹" + totalNightsPriceValue.toLocaleString("en-IN");
    if (serviceFee)
      serviceFee.textContent = "₹" + serviceFeeValue.toLocaleString("en-IN");
    if (totalPrice)
      totalPrice.textContent = "₹" + totalPriceValue.toLocaleString("en-IN");
  }

  // ========== CLICK OUTSIDE HANDLER ==========
  document.onclick = function (e) {
    // Close rooms dropdown
    if (roomsSummary && roomsDropdown) {
      if (
        !roomsSummary.contains(e.target) &&
        !roomsDropdown.contains(e.target)
      ) {
        roomsDropdown.classList.remove("show");
        const chevron = roomsSummary.querySelector("i");
        if (chevron) chevron.style.transform = "";
      }
    }

    // Close guest dropdown
    if (guestSummary && guestDropdown) {
      if (
        !guestSummary.contains(e.target) &&
        !guestDropdown.contains(e.target)
      ) {
        guestDropdown.classList.remove("show");
        const chevron = guestSummary.querySelector("i");
        if (chevron) chevron.style.transform = "";
      }
    }
  };

  // Prevent closing when clicking inside dropdowns
  if (roomsDropdown) {
    roomsDropdown.onclick = function (e) {
      e.stopPropagation();
    };
  }
  if (guestDropdown) {
    guestDropdown.onclick = function (e) {
      e.stopPropagation();
    };
  }

  // Initialize displays
  updateRoomsDisplay();
  updateGuestDisplay();
  updatePriceBreakdown();

  // ========== MAP WITH MARKER ==========
  if (typeof mapToken !== "undefined" && listing.geometry) {
    try {
      if (typeof mapboxgl !== "undefined") {
        mapboxgl.accessToken = mapToken;

        // Create the map
        const map = new mapboxgl.Map({
          container: "showMap",
          style: "mapbox://styles/mapbox/streets-v12",
          center: listing.geometry.coordinates,
          zoom: 14,
        });

        // Add navigation controls
        map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

        // Add fullscreen control
        map.addControl(new mapboxgl.FullscreenControl(), "top-right");

        // Create a marker with custom color (Airbnb red)
        const marker = new mapboxgl.Marker({
          color: "#ff385c",
          draggable: false,
          scale: 1.2,
        })
          .setLngLat(listing.geometry.coordinates)
          .setPopup(
            new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(
              `<div style="padding: 8px; font-family: 'Plus Jakarta Sans', sans-serif;">
                <h4 style="font-weight: 600; margin: 0 0 4px 0; font-size: 14px;">${listing.title}</h4>
                <p style="margin: 0; color: #717171; font-size: 12px;">${listing.location}</p>
              </div>`,
            ),
          )
          .addTo(map);

        // Add pulsing animation class
        marker.getElement().classList.add("pulse-marker");

        // Add CSS for pulsing effect if not already in your CSS
        if (!document.querySelector("#marker-styles")) {
          const style = document.createElement("style");
          style.id = "marker-styles";
          style.textContent = `
          .pulse-marker {
            animation: marker-pulse 2s infinite;
          }
          @keyframes marker-pulse {
            0% {
              box-shadow: 0 0 0 0 rgba(255, 56, 92, 0.7);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(255, 56, 92, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(255, 56, 92, 0);
            }
          }
        `;
          document.head.appendChild(style);
        }

        // Open popup on marker click
        marker.getElement().addEventListener("click", () => {
          marker.togglePopup();
        });

        // Automatically open popup after map loads (optional)
        map.on("load", () => {
          setTimeout(() => {
            marker.togglePopup();
          }, 1000);
        });
      }
    } catch (error) {
      console.error("Map error:", error);
    }
  }

  // ========== PHOTO GALLERY MODAL - UPDATED to show all photos ==========
  const modal = document.getElementById("photosModal");
  const btn = document.getElementById("showAllPhotosBtn");
  const span = document.querySelector(".close");

  if (btn && modal) {
    btn.onclick = function () {
      modal.style.display = "block";
      const modalGallery = document.querySelector(".modal-gallery");
      if (modalGallery && listing.images) {
        // Clear previous content
        modalGallery.innerHTML = "";
        
        // Create a grid of all images
        listing.images.forEach((img, index) => {
          const imgContainer = document.createElement("div");
          imgContainer.className = "modal-image-container";
          
          const imgElement = document.createElement("img");
          imgElement.src = img.url;
          imgElement.alt = `${listing.title} - photo ${index + 1}`;
          imgElement.loading = "lazy";
          
          imgContainer.appendChild(imgElement);
          modalGallery.appendChild(imgContainer);
        });
      }
    };
  }

  if (span) {
    span.onclick = function () {
      modal.style.display = "none";
    };
  }

  window.onclick = function (event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };

  // Click on any gallery item to open modal
  document.querySelectorAll(".gallery-item").forEach((item) => {
    item.onclick = function () {
      if (btn) btn.click();
    };
  });

  // ========== SHOW ALL AMENITIES ==========
  const showAllAmenitiesBtn = document.querySelector(".show-all-amenities");
  if (showAllAmenitiesBtn) {
    showAllAmenitiesBtn.onclick = function () {
      const amenitiesGrid = document.querySelector(".amenities-grid");
      amenitiesGrid.style.maxHeight = "none";
      amenitiesGrid.style.overflow = "visible";
      this.style.display = "none";
    };
  }

  // ========== BOOKING FORM VALIDATION ==========
  const bookingForm = document.getElementById("bookingForm");
  if (bookingForm) {
    bookingForm.onsubmit = function (e) {
      const checkIn = document.getElementById("bookingCheckIn").value;
      const checkOut = document.getElementById("bookingCheckOut").value;
      const roomsInput = document.getElementById("roomsTotal");
      const guestsInput = document.getElementById("guestsTotal");

      if (roomsInput && (!roomsInput.value || parseInt(roomsInput.value) < 1)) {
        roomsInput.value = currentRooms || 1;
      }
      if (
        guestsInput &&
        (!guestsInput.value || parseInt(guestsInput.value) < 1)
      ) {
        guestsInput.value = adults + children || 1;
      }

      if (!checkIn || !checkOut) {
        e.preventDefault();
        alert("Please select check-in and check-out dates");
        return false;
      }
      return true;
    };
  }

  // ========== ENHANCED REVIEWS FUNCTIONALITY ==========

  // ========== CATEGORY MODAL WITH FILTER OPTIONS ==========
  const categoryModal = document.getElementById("categoryModal");
  const modalCategoryTitle = document.getElementById("modalCategoryTitle");
  const modalReviewsList = document.getElementById("modalReviewsList");
  const modalCategoryOptions = document.querySelectorAll(
    ".modal-category-option",
  );
  const closeModalBtns = document.querySelectorAll(".close-modal");

  let currentModalCategory = "hospitality";
  let allReviewsData = [];

  // Store all review data when page loads
  document.querySelectorAll(".review-card").forEach((card) => {
    const reviewDataAttr = card.dataset.review;
    if (reviewDataAttr) {
      try {
        const reviewData = JSON.parse(reviewDataAttr.replace(/&apos;/g, "'"));
        allReviewsData.push(reviewData);
      } catch (e) {
        console.error("Error parsing review data:", e);
      }
    }
  });

  // Category tag click handler (for large category tags)
  document.querySelectorAll(".category-tag-large").forEach((tag) => {
    tag.addEventListener("click", function () {
      const category = this.dataset.category;
      currentModalCategory = category;

      // Update active state in modal options
      modalCategoryOptions.forEach((opt) => {
        if (opt.dataset.modalCategory === category) {
          opt.classList.add("active");
        } else {
          opt.classList.remove("active");
        }
      });

      updateModalForCategory(category);
      categoryModal.classList.add("show");
    });
  });

  // Modal category option click handler
  modalCategoryOptions.forEach((option) => {
    option.addEventListener("click", function () {
      const category = this.dataset.modalCategory;
      currentModalCategory = category;

      // Update active state
      modalCategoryOptions.forEach((opt) => opt.classList.remove("active"));
      this.classList.add("active");

      updateModalForCategory(category);
    });
  });

  // Function to update modal content based on selected category
  function updateModalForCategory(category) {
    // Get category display name
    const categoryNames = {
      hospitality: "Hospitality",
      cleanliness: "Cleanliness",
      accuracy: "Accuracy",
      communication: "Communication",
      location: "Location",
      checkIn: "Check-in",
      value: "Value",
      comfort: "Comfort",
    };

    const displayName = categoryNames[category] || category;

    // Show loading state
    modalReviewsList.innerHTML =
      '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading reviews...</div>';

    // Filter and display reviews
    setTimeout(() => {
      let html = "";
      let reviewCount = 0;

      // Filter reviews that have this category rating
      const filteredReviews = allReviewsData.filter((review) => {
        if (category === "hospitality" || category === "comfort") {
          // For custom categories, check if they exist
          return review[category]?.rating > 0;
        } else {
          // For standard categories, check rating
          return review[category]?.rating > 0;
        }
      });

      reviewCount = filteredReviews.length;

      if (filteredReviews.length === 0) {
        html =
          '<div class="no-reviews-modal">No reviews found for this category</div>';
      } else {
        filteredReviews.forEach((review) => {
          const yearsOnAirbnb = Math.floor(Math.random() * 5) + 1;
          const firstLetter = review.author?.username
            ? review.author.username[0].toUpperCase()
            : "G";
          const categoryRating = review[category]?.rating || 0;
          const categoryComment = review[category]?.comment || "";
          const overallComment = review.overallComment || review.comment || "";

          html += `
            <div class="modal-review-card">
              <div class="modal-review-header">
                <div class="modal-review-avatar">
                  ${
                    review.author?.avatar?.url
                      ? `<img src="${review.author.avatar.url}" alt="${review.author?.username}">`
                      : `<div class="avatar-placeholder">${firstLetter}</div>`
                  }
                </div>
                <div class="modal-review-info">
                  <div class="modal-review-name">${review.author?.username || "Anonymous"}</div>
                  <div class="modal-review-date">${new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })} · ${yearsOnAirbnb} years on Airbnb</div>
                </div>
              </div>
              
              <div class="modal-review-rating">
                <div class="modal-review-stars">
                  ${Array(5)
                    .fill(0)
                    .map(
                      (_, i) =>
                        `<i class="${i < Math.round(review.overallRating || 0) ? "fa-solid fa-star" : "fa-regular fa-star"}"></i>`,
                    )
                    .join("")}
                </div>
                <span class="modal-review-category-badge">${displayName}: ${categoryRating} ★</span>
              </div>
              
              ${
                categoryComment
                  ? `
                <div class="category-specific-comment">
                  <strong>${displayName} comment:</strong> "${categoryComment}"
                </div>
              `
                  : ""
              }
              
              <div class="modal-review-comment">
                ${overallComment.substring(0, 200)}${overallComment.length > 200 ? "..." : ""}
              </div>
              
              <div class="modal-review-category-list">
                <span><strong>Cleanliness:</strong> ${review.cleanliness?.rating || 0}</span>
                <span><strong>Accuracy:</strong> ${review.accuracy?.rating || 0}</span>
                <span><strong>Communication:</strong> ${review.communication?.rating || 0}</span>
                <span><strong>Location:</strong> ${review.location?.rating || 0}</span>
                <span><strong>Check-in:</strong> ${review.checkIn?.rating || 0}</span>
                <span><strong>Value:</strong> ${review.value?.rating || 0}</span>
              </div>
            </div>
          `;
        });
      }

      modalReviewsList.innerHTML = html;
      modalCategoryTitle.innerHTML = `${displayName} · <span>${reviewCount} reviews</span>`;
    }, 300);
  }

  // ========== INDIVIDUAL REVIEW DETAIL MODAL - WITH TOP RATING SECTION ==========
  const reviewDetailModal = document.getElementById("reviewDetailModal");
  const reviewDetailBody = document.getElementById("reviewDetailBody");
  const filterPills = document.querySelectorAll(".filter-pill");
  let currentFilter = "all";
  let currentClickedReviewId = null;

  // Function to render all reviews in the modal
  function renderAllReviewsInModal(filter = "all", highlightId = null) {
    const allReviews = listing.reviews || [];

    if (allReviews.length === 0) {
      reviewDetailBody.innerHTML =
        '<div class="no-reviews text-center py-5">No reviews yet</div>';
      return;
    }

    // Filter reviews based on selected filter
    let filteredReviews = allReviews;
    if (filter !== "all") {
      filteredReviews = allReviews.filter((review) => {
        // Map filter to review category
        const categoryMap = {
          hospitality: "hospitality",
          cleanliness: "cleanliness",
          accuracy: "accuracy",
          communication: "communication",
          location: "location",
          checkIn: "checkIn",
          value: "value",
          comfort: "comfort",
        };
        const category = categoryMap[filter];
        return review[category]?.rating > 0;
      });
    }

    // Sort reviews - put the highlighted one first
    if (highlightId) {
      filteredReviews.sort((a, b) => {
        if (a._id === highlightId) return -1;
        if (b._id === highlightId) return 1;
        return 0;
      });
    }

    let html = "";

    filteredReviews.forEach((review, index) => {
      const isHighlighted = review._id === highlightId;
      const yearsOnAirbnb = Math.floor(Math.random() * 5) + 1; // Replace with actual if available
      const firstLetter = review.author?.username
        ? review.author.username[0].toUpperCase()
        : "G";
      const fullComment =
        review.overallComment || review.comment || "No written review provided";
      const formattedComment = fullComment.replace(/\n/g, "<br>");
      const rating = review.overallRating || 0;

      const starsHtml = Array(5)
        .fill(0)
        .map(
          (_, i) =>
            `<i class="${i < Math.round(rating) ? "fa-solid fa-star" : "fa-regular fa-star"}"></i>`,
        )
        .join("");

      // Get category ratings for chips
      const categories = [
        { name: "Cleanliness", rating: review.cleanliness?.rating },
        { name: "Accuracy", rating: review.accuracy?.rating },
        { name: "Communication", rating: review.communication?.rating },
        { name: "Location", rating: review.location?.rating },
        { name: "Check-in", rating: review.checkIn?.rating },
        { name: "Value", rating: review.value?.rating },
        { name: "Hospitality", rating: review.hospitality?.rating },
        { name: "Comfort", rating: review.comfort?.rating },
      ].filter((c) => c.rating > 0);

      const categoryChips = categories
        .map(
          (c) =>
            `<span class="modal-category-chip">${c.name} <span class="chip-rating">${c.rating}</span></span>`,
        )
        .join("");

      html += `
        <div class="modal-review-card ${isHighlighted ? "featured-review" : ""}" data-review-id="${review._id}">
          ${isHighlighted ? '<div class="featured-badge">Review you clicked</div>' : ""}
          
          <!-- Review Header -->
          <div class="modal-review-header">
            <div class="modal-review-avatar">
              ${
                review.author?.avatar?.url
                  ? `<img src="${review.author.avatar.url}" alt="${review.author?.username}">`
                  : `<div class="avatar-placeholder">${firstLetter}</div>`
              }
            </div>
            <div class="modal-review-info">
              <div class="modal-review-name">${review.author?.username || "Anonymous"}</div>
              <div class="modal-review-date">
                <i class="fa-regular fa-clock"></i> ${yearsOnAirbnb} years on Airbnb · 
                ${new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
          </div>

          <!-- Rating Stars -->
          <div class="review-rating-stars" style="margin: 8px 0;">
            ${starsHtml}
          </div>

          <!-- Category Chips -->
          <div class="modal-review-category-chips">
            ${categoryChips}
          </div>

          <!-- Review Comment -->
          <div class="modal-review-comment">
            ${formattedComment}
          </div>

          <!-- Host Reply (if exists) -->
          ${
            review.hostReply?.text
              ? `
            <div class="host-reply-section">
              <div class="host-reply-header">
                <span class="host-reply-name">Response from ${listing.owner?.username || "Host"}</span>
                <span class="host-reply-date">${new Date(review.hostReply.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
              <div class="host-reply-text">${review.hostReply.text}</div>
            </div>
          `
              : ""
          }
        </div>
      `;

      // Add separator between reviews (except last one and if not featured)
      if (!isHighlighted && index < filteredReviews.length - 1) {
        html += '<hr style="margin: 20px 0; border-color: #ebebeb;">';
      }
    });

    reviewDetailBody.innerHTML = html;
  }

  // Filter pill click handlers
  filterPills.forEach((pill) => {
    pill.addEventListener("click", function () {
      // Update active state
      filterPills.forEach((p) => p.classList.remove("active"));
      this.classList.add("active");

      currentFilter = this.dataset.filter;
      renderAllReviewsInModal(currentFilter, currentClickedReviewId);
    });
  });

  // Show more link click handler
  document.querySelectorAll(".show-more-link").forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const reviewId = this.dataset.reviewId;
      currentClickedReviewId = reviewId;

      // Reset filter to "all"
      filterPills.forEach((p) => {
        if (p.dataset.filter === "all") {
          p.classList.add("active");
        } else {
          p.classList.remove("active");
        }
      });
      currentFilter = "all";

      // Render all reviews with the clicked one highlighted
      renderAllReviewsInModal("all", reviewId);
      reviewDetailModal.classList.add("show");
    });
  });

  // ========== ALL REVIEWS MODAL ==========
  const allReviewsModal = document.getElementById("allReviewsModal");
  const allReviewsList = document.getElementById("allReviewsList");
  const showAllReviewsBtn = document.getElementById("showAllReviewsBtn");

  if (showAllReviewsBtn && allReviewsModal) {
    showAllReviewsBtn.addEventListener("click", function () {
      // Build HTML for all reviews
      const reviewCards = document.querySelectorAll(".review-card");
      let allReviewsHtml = "";

      reviewCards.forEach((card) => {
        const clone = card.cloneNode(true);
        allReviewsHtml += clone.outerHTML;
      });

      allReviewsList.innerHTML = allReviewsHtml;
      allReviewsModal.classList.add("show");
    });
  }

  // Close modals when clicking X
  closeModalBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      if (categoryModal) categoryModal.classList.remove("show");
      if (allReviewsModal) allReviewsModal.classList.remove("show");
      if (reviewDetailModal) reviewDetailModal.classList.remove("show");
      if (document.getElementById("howReviewsModal"))
        document.getElementById("howReviewsModal").classList.remove("show");
      if (document.getElementById("replyModal"))
        document.getElementById("replyModal").classList.remove("show");
    });
  });

  // Close modals when clicking outside
  window.addEventListener("click", function (e) {
    if (e.target === categoryModal) {
      categoryModal.classList.remove("show");
    }
    if (e.target === allReviewsModal) {
      allReviewsModal.classList.remove("show");
    }
    if (e.target === reviewDetailModal) {
      reviewDetailModal.classList.remove("show");
    }
    if (e.target === document.getElementById("howReviewsModal")) {
      document.getElementById("howReviewsModal").classList.remove("show");
    }
    if (e.target === document.getElementById("replyModal")) {
      document.getElementById("replyModal").classList.remove("show");
    }
  });

  // ========== REVIEW SORTING ==========
  const sortSelect = document.getElementById("sortReviews");
  const reviewsContainer = document.getElementById("reviewsList");

  if (sortSelect && reviewsContainer) {
    sortSelect.addEventListener("change", function () {
      const reviewCards = Array.from(document.querySelectorAll(".review-card"));
      const sortBy = this.value;

      reviewCards.sort((a, b) => {
        const dateA = parseInt(a.dataset.date);
        const dateB = parseInt(b.dataset.date);
        const ratingA = parseFloat(a.dataset.rating);
        const ratingB = parseFloat(b.dataset.rating);

        switch (sortBy) {
          case "newest":
            return dateB - dateA;
          case "oldest":
            return dateA - dateB;
          case "highest":
            return ratingB - ratingA;
          case "lowest":
            return ratingA - ratingB;
          default:
            return 0;
        }
      });

      // Clear and re-append
      reviewsContainer.innerHTML = "";
      reviewCards.forEach((card) => reviewsContainer.appendChild(card));

      // Re-attach event listeners to new show more links
      document.querySelectorAll(".show-more-link").forEach((link) => {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          const reviewId = this.dataset.reviewId;
          currentClickedReviewId = reviewId;

          // Reset filter to "all"
          filterPills.forEach((p) => {
            if (p.dataset.filter === "all") {
              p.classList.add("active");
            } else {
              p.classList.remove("active");
            }
          });
          currentFilter = "all";

          // Render all reviews with the clicked one highlighted
          renderAllReviewsInModal("all", reviewId);
          reviewDetailModal.classList.add("show");
        });
      });
    });
  }

  // ========== FILTER BUTTONS ==========
  const filterButtons = document.querySelectorAll(".filter-btn");
  const reviewCards = document.querySelectorAll(".review-card");

  function filterReviews(category) {
    reviewCards.forEach((card) => {
      if (category === "all") {
        card.style.display = "block";
      } else {
        const rating = card.dataset[category];
        if (rating && parseInt(rating) >= 4) {
          card.style.display = "block";
        } else {
          card.style.display = "none";
        }
      }
    });
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
      filterButtons.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      filterReviews(this.dataset.filter);
    });
  });

  // ========== REPLY MODAL ==========
  const replyModal = document.getElementById("replyModal");
  const replyForm = document.getElementById("replyForm");
  const cancelReplyBtn = document.querySelector(".cancel-reply-btn");

  document
    .querySelectorAll(".reply-to-review-btn, .reply-trigger")
    .forEach((btn) => {
      btn.addEventListener("click", function () {
        const reviewId = this.dataset.reviewId;
        if (replyForm) {
          replyForm.action = `/reviews/${reviewId}/reply`;
        }
        if (replyModal) {
          replyModal.classList.add("show");
        }
      });
    });

  if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener("click", function () {
      if (replyModal) replyModal.classList.remove("show");
    });
  }

  // ========== HOW REVIEWS WORK MODAL ==========
  const howReviewsBtn = document.getElementById("howReviewsWorkBtn");
  const howReviewsModal = document.getElementById("howReviewsModal");

  if (howReviewsBtn && howReviewsModal) {
    howReviewsBtn.addEventListener("click", function () {
      calculateRatingDistribution();
      howReviewsModal.classList.add("show");
    });
  }

  // ========== RATING DISTRIBUTION CALCULATOR ==========
  function calculateRatingDistribution() {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    if (listing.reviews && listing.reviews.length > 0) {
      listing.reviews.forEach((review) => {
        if (review.isPublished && review.overallRating) {
          distribution[Math.floor(review.overallRating)]++;
        }
      });
    }

    const totalReviews = listing.reviewCount || 0;
    const modalContent = document.querySelector(
      ".how-reviews-modal .rating-distribution",
    );

    if (modalContent) {
      const rows = modalContent.querySelectorAll(".distribution-row");
      rows.forEach((row, index) => {
        const stars = 5 - index;
        const bar = row.querySelector(".progress-bar");
        const countSpan = row.querySelector(".star-count");

        if (bar && countSpan) {
          const count = distribution[stars] || 0;
          const percentage =
            totalReviews > 0 ? (count / totalReviews) * 100 : 0;
          bar.style.width = percentage + "%";
          countSpan.textContent = count;
        }
      });
    }
  }

  // ========== DELETE CONFIRMATION ==========
  document.querySelectorAll(".delete-review-form").forEach((form) => {
    form.addEventListener("submit", function (e) {
      if (
        !confirm(
          "Are you sure you want to delete this review? This action cannot be undone.",
        )
      ) {
        e.preventDefault();
      }
    });
  });
});