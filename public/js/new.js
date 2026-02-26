new Vue({
  el: "#createListingApp",
  data: {
    currentStep: 0,
    currentMainStep: 1,
    currentSubStep: 0,
    selectedType: "home",
    showCopyModal: false,
    showFullBreakdown: true,
    formData: {
      propertyType: "",
      guestAccess: "",
      detailedPropertyType: "",
      placeType: "",
      address: "",
      country: "",
      lat: null,
      lng: null,
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      instructions: "",
      fullAddress: "",
      guests: 4,
      bedrooms: 1,
      beds: 1,
      bathrooms: 1,
      amenities: [],
      photos: [],
      title: "",
      description: "",
      highlights: [],
      // Step 3 fields
      bookingType: "approve",
      basePrice: 2273,
      weekendPrice: 2318,
      weekendPremium: 2,
      discounts: [],
      safetyItems: [],
      residentialCountry: "India",
      flatNumber: "",
      residentialStreet: "",
      landmark: "",
      residentialCity: "",
      residentialState: "",
      residentialPincode: "",
      isBusiness: "no",
    },
    mapboxToken: null,
    suggestions: [],
    recentSearches: [],
    searchTimeout: null,
    map: null,
    marker: null,
    mapInitialized: false,
    propertyTypes: [
      { value: "house", label: "House", icon: "fa-solid fa-house" },
      { value: "apartment", label: "Apartment", icon: "fa-solid fa-building" },
      { value: "condo", label: "Condo", icon: "fa-solid fa-city" },
      { value: "townhouse", label: "Townhouse", icon: "fa-solid fa-home" },
    ],
    guestAccessTypes: [
      {
        value: "entire",
        label: "An entire place",
        hint: "Guests have the whole place to themselves.",
      },
      {
        value: "room",
        label: "A room",
        hint: "Guests have their own room in a home, plus access to shared spaces.",
      },
      {
        value: "shared",
        label: "A shared room in a hostel",
        hint: "Guests sleep in a shared room in a professionally managed hostel.",
      },
    ],
    detailedPropertyTypes: [
      { value: "house", label: "House", icon: "fa-solid fa-house" },
      { value: "flat", label: "Flat/apartment", icon: "fa-solid fa-building" },
      { value: "barn", label: "Barn", icon: "fa-solid fa-warehouse" },
      {
        value: "bnb",
        label: "Bed & breakfast",
        icon: "fa-solid fa-mug-saucer",
      },
      { value: "boat", label: "Boat", icon: "fa-solid fa-ship" },
      { value: "cabin", label: "Cabin", icon: "fa-solid fa-tree" },
      {
        value: "camper",
        label: "Campervan/motorhome",
        icon: "fa-solid fa-truck",
      },
      {
        value: "casa",
        label: "Casa particular",
        icon: "fa-solid fa-umbrella-beach",
      },
      { value: "castle", label: "Castle", icon: "fa-solid fa-crown" },
    ],
    placeTypes: [
      {
        value: "entire",
        label: "An entire place",
        description: "Guests have the whole place to themselves.",
      },
      {
        value: "room",
        label: "A room",
        description:
          "Guests have their own room in a home, plus access to shared spaces.",
      },
      {
        value: "shared",
        label: "A shared room in a hostel",
        description:
          "Guests sleep in a shared room in a professionally managed hostel with staff on-site 24/7.",
      },
    ],
    guestFavourites: [
      "WiFi",
      "TV",
      "Kitchen",
      "Washing machine",
      "Free parking on premises",
      "Paid parking on premises",
      "Air conditioning",
      "Dedicated workspace",
    ],
    standoutAmenities: [
      "Pool",
      "Hot tub",
      "Patio",
      "BBQ grill",
      "Outdoor dining area",
      "Firepit",
      "Pool table",
      "Indoor fireplace",
      "Piano",
      "Exercise equipment",
      "Lake access",
      "Beach access",
      "Ski-in/out",
      "Outdoor shower",
    ],
    safetyItems: [
      "Smoke alarm",
      "First aid kit",
      "Fire extinguisher",
      "Carbon monoxide alarm",
    ],
    highlights: [
      { value: "peaceful", emoji: "🏠", label: "Peaceful" },
      { value: "unique", emoji: "🔥", label: "Unique" },
      { value: "family", emoji: "🎨", label: "Family-friendly" },
      { value: "stylish", emoji: "📸", label: "Stylish" },
      { value: "central", emoji: "🟢", label: "Central" },
      { value: "spacious", emoji: "🌍", label: "Spacious" },
    ],
  },
  computed: {
    typeIcon() {
      const icons = {
        home: "fa-house",
        experience: "fa-compass",
        service: "fa-bell-concierge",
      };
      return icons[this.selectedType] || "fa-house";
    },
    typeDescription() {
      const descriptions = {
        home: "List your space and start earning money by hosting guests from around the world.",
        experience:
          "Share your passion by hosting unique activities and experiences for travelers.",
        service:
          "Offer professional services and connect with travelers who need your expertise.",
      };
      return descriptions[this.selectedType] || descriptions.home;
    },

    // Check if current step is the first step (no back button)
    isFirstStep() {
      // Welcome screen (substep 0) doesn't need back button
      if (this.currentMainStep === 1 && this.currentSubStep === 0) {
        return true;
      }
      return false;
    },
    showUtilityLinks() {
      // Hide on Get Started page (substep 1) since it has its own Exit link in content
      if (this.currentMainStep === 1 && this.currentSubStep === 1) {
        return false;
      }
      return true;
    },
    // Get the appropriate button text based on current step
    nextButtonText() {
      if (this.currentMainStep === 1) {
        if (this.currentSubStep === 0) return "Get started";
        if (this.currentSubStep === 1) return "Get started";
      }
      if (this.currentMainStep === 3 && this.currentSubStep === 8) {
        return "Create listing";
      }
      return "Next";
    },

    // Enable/disable next button based on validation
    isNextEnabled() {
      // Step 1 validation
      if (this.currentMainStep === 1) {
        if (this.currentSubStep === 0 || this.currentSubStep === 1) {
          return true; // Welcome and Get Started pages
        }
        if (this.currentSubStep === 2) {
          return this.formData.propertyType && this.formData.guestAccess;
        }
        if (this.currentSubStep === 3) {
          return this.formData.detailedPropertyType;
        }
        if (this.currentSubStep === 4) {
          return this.formData.placeType;
        }
        if (this.currentSubStep === 5) {
          return this.formData.lat && this.formData.lng;
        }
        if (this.currentSubStep === 6) {
          return (
            this.formData.addressLine1 &&
            this.formData.city &&
            this.formData.state &&
            this.formData.postalCode
          );
        }
        if (this.currentSubStep === 7) {
          return true; // Counter fields always valid
        }
      }

      // Step 2 validation
      if (this.currentMainStep === 2) {
        if (this.currentSubStep === 0) {
          return true; // Intro page
        }
        if (this.currentSubStep === 1) {
          return true; // Amenities optional
        }
        if (this.currentSubStep === 2) {
          return this.formData.photos.length >= 5; // Minimum 5 photos required
        }
        if (this.currentSubStep === 3) {
          return this.formData.title && this.formData.description;
        }
        if (this.currentSubStep === 4) {
          return true; // Highlights optional but limited
        }
      }

      // Step 3 validation
      if (this.currentMainStep === 3) {
        if (this.currentSubStep === 0) {
          return true; // Intro page
        }
        if (this.currentSubStep === 1) {
          return this.formData.bookingType;
        }
        if (this.currentSubStep === 2) {
          return this.formData.basePrice > 0;
        }
        if (this.currentSubStep === 3) {
          return true; // Just viewing breakdown
        }
        if (this.currentSubStep === 4) {
          return true; // Weekend price optional
        }
        if (this.currentSubStep === 5) {
          return true; // Discounts optional
        }
        if (this.currentSubStep === 6) {
          return true; // Safety items optional
        }
        if (this.currentSubStep === 7) {
          return (
            this.formData.residentialStreet &&
            this.formData.residentialCity &&
            this.formData.residentialState &&
            this.formData.residentialPincode
          );
        }
        if (this.currentSubStep === 8) {
          return this.formData.isBusiness;
        }
      }

      return true;
    },
  },
  methods: {
    // Save current state to sessionStorage
    saveState() {
      const state = {
        currentStep: this.currentStep,
        currentMainStep: this.currentMainStep,
        currentSubStep: this.currentSubStep,
        selectedType: this.selectedType,
        formData: this.formData,
      };
      sessionStorage.setItem("listingDraft", JSON.stringify(state));
    },

    // Load state from sessionStorage
    loadState() {
      const saved = sessionStorage.getItem("listingDraft");
      if (saved) {
        try {
          const state = JSON.parse(saved);
          this.currentStep = state.currentStep;
          this.currentMainStep = state.currentMainStep;
          this.currentSubStep = state.currentSubStep;
          this.selectedType = state.selectedType;
          this.formData = { ...this.formData, ...state.formData };
          console.log("Loaded saved state:", state);
        } catch (e) {
          console.error("Error loading saved state:", e);
        }
      }
    },

    // Clear saved state (call after successful submission)
    clearState() {
      sessionStorage.removeItem("listingDraft");
    },

    selectType(type) {
      this.selectedType = type;
      this.currentStep = 1;
      this.currentSubStep = 0;
      this.saveState();
    },

    closeModal() {
      window.location.href = "/host/listings";
    },

    startNewListing() {
      this.currentSubStep = 1;
      this.saveState();
    },

    goToSubStep(step) {
      this.currentSubStep = step;
      this.saveState();
    },

    goToMainStep2() {
      this.currentMainStep = 2;
      this.currentSubStep = 0;
      this.saveState();
    },

    goBackToBasics() {
      this.currentMainStep = 1;
      this.currentSubStep = 7;
      this.saveState();
    },

    goToAmenities() {
      this.currentSubStep = 1;
      this.saveState();
    },

    goToStep2Intro() {
      this.currentSubStep = 0;
      this.saveState();
    },

    goToPhotoUpload() {
      this.currentSubStep = 2;
      this.saveState();
    },

    goToTitleDescription() {
      if (this.formData.photos.length < 5) {
        alert(
          `Please upload at least 5 photos. You have ${this.formData.photos.length} photo(s).`,
        );
        return;
      }
      this.currentSubStep = 3;
      this.saveState();
    },

    goToHighlights() {
      if (!this.formData.title || !this.formData.description) {
        alert("Please fill in both title and description");
        return;
      }
      this.currentSubStep = 4;
      this.saveState();
    },

    goToMainStep3() {
      this.currentMainStep = 3;
      this.currentSubStep = 0;
      this.saveState();
    },

    goBackToHighlights() {
      this.currentMainStep = 2;
      this.currentSubStep = 4;
      this.saveState();
    },

    goToMainStep3Intro() {
      this.currentSubStep = 0;
      this.saveState();
    },

    goToBookingSettings() {
      this.currentSubStep = 1;
      this.saveState();
    },

    goToBasePrice() {
      this.currentSubStep = 2;
      this.saveState();
    },

    goToPriceBreakdown() {
      this.currentSubStep = 3;
      this.saveState();
    },

    goToWeekendPrice() {
      this.currentSubStep = 4;
      this.saveState();
    },

    goToDiscounts() {
      this.currentSubStep = 5;
      this.saveState();
    },

    goToSafetyDetails() {
      this.currentSubStep = 6;
      this.saveState();
    },

    goToResidentialAddress() {
      this.currentSubStep = 7;
      this.saveState();
    },

    goToBusinessType() {
      this.currentSubStep = 8;
      this.saveState();
    },

    validateHighlights() {
      if (this.formData.highlights.length > 2) {
        this.formData.highlights.pop();
      }
      this.saveState();
    },

    increment(field) {
      this.formData[field]++;
      this.saveState();
    },

    decrement(field) {
      if (this.formData[field] > 1) {
        this.formData[field]--;
      }
      this.saveState();
    },

    // New unified navigation method
    handleNext() {
      if (!this.isNextEnabled) return;

      // Step 1 navigation
      if (this.currentMainStep === 1) {
        if (this.currentSubStep === 0) this.goToSubStep(1);
        else if (this.currentSubStep === 1) this.goToSubStep(2);
        else if (this.currentSubStep === 2) this.goToSubStep(3);
        else if (this.currentSubStep === 3) this.goToSubStep(4);
        else if (this.currentSubStep === 4) this.goToSubStep(5);
        else if (this.currentSubStep === 5) this.goToSubStep(6);
        else if (this.currentSubStep === 6) this.goToSubStep(7);
        else if (this.currentSubStep === 7) this.goToMainStep2();
      }

      // Step 2 navigation
      else if (this.currentMainStep === 2) {
        if (this.currentSubStep === 0) this.goToAmenities();
        else if (this.currentSubStep === 1) this.goToPhotoUpload();
        else if (this.currentSubStep === 2) {
          if (this.formData.photos.length >= 5) {
            this.goToTitleDescription();
          } else {
            alert(
              `Please add at least 5 photos. You currently have ${this.formData.photos.length} photo(s).`,
            );
          }
        } else if (this.currentSubStep === 3) {
          if (this.formData.title && this.formData.description) {
            this.goToHighlights();
          } else {
            alert("Please fill in title and description");
          }
        } else if (this.currentSubStep === 4) this.goToMainStep3();
      }

      // Step 3 navigation
      else if (this.currentMainStep === 3) {
        if (this.currentSubStep === 0) this.goToBookingSettings();
        else if (this.currentSubStep === 1) this.goToBasePrice();
        else if (this.currentSubStep === 2) {
          if (this.formData.basePrice > 0) this.goToPriceBreakdown();
          else alert("Please enter a base price");
        } else if (this.currentSubStep === 3) this.goToWeekendPrice();
        else if (this.currentSubStep === 4) this.goToDiscounts();
        else if (this.currentSubStep === 5) this.goToSafetyDetails();
        else if (this.currentSubStep === 6) this.goToResidentialAddress();
        else if (this.currentSubStep === 7) this.goToBusinessType();
        else if (this.currentSubStep === 8) this.submitListing();
      }
    },

    // New unified back navigation
    goBack() {
      if (this.isFirstStep) return; // No back on first step

      // Step 1 back navigation
      if (this.currentMainStep === 1) {
        if (this.currentSubStep === 1) this.goToSubStep(0);
        else if (this.currentSubStep === 2) this.goToSubStep(1);
        else if (this.currentSubStep === 3) this.goToSubStep(2);
        else if (this.currentSubStep === 4) this.goToSubStep(3);
        else if (this.currentSubStep === 5) this.goToSubStep(4);
        else if (this.currentSubStep === 6) this.goToSubStep(5);
        else if (this.currentSubStep === 7) this.goToSubStep(6);
      }

      // Step 2 back navigation
      else if (this.currentMainStep === 2) {
        if (this.currentSubStep === 1) this.goToStep2Intro();
        else if (this.currentSubStep === 2) this.goToAmenities();
        else if (this.currentSubStep === 3) this.goToPhotoUpload();
        else if (this.currentSubStep === 4) this.goToTitleDescription();
        else if (this.currentSubStep === 0) this.goBackToBasics();
      }

      // Step 3 back navigation
      else if (this.currentMainStep === 3) {
        if (this.currentSubStep === 1) this.goToMainStep3Intro();
        else if (this.currentSubStep === 2) this.goToBookingSettings();
        else if (this.currentSubStep === 3) this.goToBasePrice();
        else if (this.currentSubStep === 4) this.goToPriceBreakdown();
        else if (this.currentSubStep === 5) this.goToWeekendPrice();
        else if (this.currentSubStep === 6) this.goToDiscounts();
        else if (this.currentSubStep === 7) this.goToSafetyDetails();
        else if (this.currentSubStep === 8) this.goToResidentialAddress();
        else if (this.currentSubStep === 0) this.goBackToHighlights();
      }
    },

    // Mapbox search methods
    async searchLocations() {
      if (!this.mapboxToken) {
        console.error("Mapbox token not available");
        return;
      }

      if (this.formData.address.length < 3) {
        this.suggestions = [];
        return;
      }

      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }

      this.searchTimeout = setTimeout(async () => {
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
              this.formData.address,
            )}.json?access_token=${this.mapboxToken}&autocomplete=true&limit=5`,
          );

          const data = await response.json();

          if (data.features) {
            this.suggestions = data.features.map((feature) => ({
              id: feature.id,
              place_name: feature.place_name,
              center: feature.center,
              context: feature.context
                ? feature.context.map((c) => c.text).join(", ")
                : "",
              lat: feature.center[1],
              lng: feature.center[0],
            }));
          }
        } catch (error) {
          console.error("Error searching locations:", error);
        }
      }, 300);
    },

    selectLocation(location) {
      this.formData.address = location.place_name;
      this.formData.lat = location.lat;
      this.formData.lng = location.lng;
      this.formData.country = this.extractCountry(location);
      this.suggestions = [];
      this.formData.city = this.extractCity(location);
      this.saveToRecentSearches(location);

      if (this.map && this.marker) {
        this.map.flyTo({
          center: [location.lng, location.lat],
          zoom: 14,
          essential: true,
        });
        this.marker.setLngLat([location.lng, location.lat]);
      }

      this.saveState();
    },

    extractCountry(location) {
      if (location.context) {
        for (const item of location.context) {
          if (
            typeof item === "object" &&
            item.id &&
            item.id.includes("country")
          ) {
            return item.text || "India";
          }
        }
      }
      return "India";
    },

    extractCity(location) {
      if (location.context) {
        for (const item of location.context) {
          if (typeof item === "object" && item.id) {
            if (
              item.id.includes("place") ||
              item.id.includes("locality") ||
              item.id.includes("neighborhood")
            ) {
              return item.text || location.place_name.split(",")[0];
            }
          }
        }
      }
      return location.place_name.split(",")[0].trim();
    },

    saveToRecentSearches(location) {
      const exists = this.recentSearches.some((s) => s.id === location.id);
      if (!exists) {
        this.recentSearches = [location, ...this.recentSearches].slice(0, 5);
        localStorage.setItem(
          "recentSearches",
          JSON.stringify(this.recentSearches),
        );
      }
    },

    loadRecentSearches() {
      const saved = localStorage.getItem("recentSearches");
      if (saved) {
        try {
          this.recentSearches = JSON.parse(saved);
        } catch (e) {
          console.error("Error loading recent searches:", e);
        }
      }
    },

    initMap() {
      if (this.mapInitialized) return;

      this.mapboxToken = window.MAP_TOKEN || window.MAPBOX_TOKEN;

      if (
        !this.mapboxToken ||
        this.mapboxToken === "YOUR_MAPBOX_TOKEN" ||
        this.mapboxToken === "undefined"
      ) {
        console.error("Mapbox token not configured properly");
        return;
      }

      const mapContainer = document.getElementById("locationMap");
      if (!mapContainer) {
        return;
      }

      try {
        mapboxgl.accessToken = this.mapboxToken;

        this.map = new mapboxgl.Map({
          container: "locationMap",
          style: "mapbox://styles/mapbox/streets-v12",
          center: [78.5, 20.5],
          zoom: 4,
        });

        this.map.addControl(new mapboxgl.NavigationControl(), "top-right");

        this.map.on("load", () => {
          this.marker = new mapboxgl.Marker({
            color: "#ff385c",
            draggable: true,
          })
            .setLngLat([78.5, 20.5])
            .addTo(this.map);

          this.marker.on("dragend", async () => {
            const lngLat = this.marker.getLngLat();
            this.formData.lat = lngLat.lat;
            this.formData.lng = lngLat.lng;

            try {
              const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${lngLat.lng},${lngLat.lat}.json?access_token=${this.mapboxToken}`,
              );
              const data = await response.json();

              if (data.features && data.features[0]) {
                const location = {
                  id: data.features[0].id,
                  place_name: data.features[0].place_name,
                  lat: lngLat.lat,
                  lng: lngLat.lng,
                  context: data.features[0].context,
                };
                this.selectLocation(location);
              }
            } catch (error) {
              console.error("Error reverse geocoding:", error);
            }
          });

          this.map.on("click", async (e) => {
            const { lng, lat } = e.lngLat;
            this.marker.setLngLat([lng, lat]);
            this.formData.lat = lat;
            this.formData.lng = lng;

            try {
              const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${this.mapboxToken}`,
              );
              const data = await response.json();

              if (data.features && data.features[0]) {
                const location = {
                  id: data.features[0].id,
                  place_name: data.features[0].place_name,
                  lat: lat,
                  lng: lng,
                  context: data.features[0].context,
                };
                this.selectLocation(location);
              }
            } catch (error) {
              console.error("Error reverse geocoding:", error);
            }
          });

          console.log("Map initialized successfully");
        });

        this.mapInitialized = true;
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    },

    copyListing(id) {
      window.location.href = `/listings/copy/${id}?type=${this.selectedType}`;
    },

    handlePhotoUpload(event) {
      const files = Array.from(event.target.files);

      files.forEach((file) => {
        if (this.formData.photos.length >= 10) {
          alert("Maximum 10 photos allowed");
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          this.formData.photos.push({
            file: file,
            url: e.target.result,
            name: file.name,
          });
          this.saveState();
        };
        reader.readAsDataURL(file);
      });

      event.target.value = "";
    },

    removePhoto(index) {
      this.formData.photos.splice(index, 1);
      this.saveState();
    },

    calculateGuestPrice(price) {
      const base = parseInt(price) || 0;
      return Math.round(base * 1.14);
    },

    calculateServiceFee(price) {
      const base = parseInt(price) || 0;
      return Math.round(base * 0.14);
    },

    calculateEarnings(price) {
      const base = parseInt(price) || 0;
      return Math.round(base * 0.97);
    },

    calculateWeekendPrice(basePrice) {
      const base = parseInt(basePrice) || 0;
      const premium = this.formData.weekendPremium || 2;
      return Math.round(base * (1 + premium / 100));
    },

    updateWeekendPrice() {
      this.formData.weekendPrice = this.calculateWeekendPrice(
        this.formData.basePrice,
      );
      this.saveState();
    },

    togglePriceBreakdown() {
      this.showFullBreakdown = !this.showFullBreakdown;
    },

    submitListing() {
      // Check minimum photos requirement before submission
      if (this.formData.photos.length < 5) {
        alert(
          `Please add at least 5 photos. You currently have ${this.formData.photos.length} photo(s).`,
        );
        this.currentMainStep = 2;
        this.currentSubStep = 2;
        return;
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/listings";
      form.enctype = "multipart/form-data";

      const addField = (name, value) => {
        if (value !== undefined && value !== null && value !== "") {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = String(value);
          form.appendChild(input);
        }
      };

      let category = "";

      const propertyTypeToCategory = {
        house: "Rooms",
        apartment: "Rooms",
        condo: "Rooms",
        townhouse: "Rooms",
        flat: "Rooms",
        bnb: "Rooms",
        cabin: "Camping",
        camper: "Camping",
        barn: "Farms",
        castle: "Castles",
        boat: "Amazing Pools",
        casa: "General",
      };

      const propertyType =
        this.formData.propertyType || this.formData.detailedPropertyType;
      if (propertyType && propertyTypeToCategory[propertyType]) {
        category = propertyTypeToCategory[propertyType];
      } else {
        category = "General";
      }

      addField("listing[title]", this.formData.title || "Untitled");
      addField("listing[description]", this.formData.description || "");
      addField("listing[price]", this.formData.basePrice || 0);
      addField(
        "listing[weekendPrice]",
        this.formData.weekendPrice || this.formData.basePrice,
      );
      addField(
        "listing[location]",
        this.formData.fullAddress ||
          `${this.formData.address}, ${this.formData.country}`,
      );
      addField("listing[country]", this.formData.country);
      addField("listing[category]", category);
      addField("listing[totalRooms]", this.formData.bedrooms || 1);
      addField("listing[propertyType]", this.formData.propertyType);
      addField("listing[guestAccess]", this.formData.guestAccess);
      addField(
        "listing[detailedPropertyType]",
        this.formData.detailedPropertyType,
      );
      addField("listing[placeType]", this.formData.placeType);
      addField("listing[addressLine1]", this.formData.addressLine1);
      addField("listing[addressLine2]", this.formData.addressLine2);
      addField("listing[city]", this.formData.city);
      addField("listing[state]", this.formData.state);
      addField("listing[postalCode]", this.formData.postalCode);
      addField("listing[instructions]", this.formData.instructions);
      addField("listing[guests]", this.formData.guests);
      addField("listing[bedrooms]", this.formData.bedrooms);
      addField("listing[beds]", this.formData.beds);
      addField("listing[bathrooms]", this.formData.bathrooms);
      addField("listing[bookingType]", this.formData.bookingType);
      addField("listing[isBusiness]", this.formData.isBusiness === "yes");

      if (this.formData.amenities && this.formData.amenities.length) {
        addField("listing[amenities]", this.formData.amenities.join(","));
      }

      if (this.formData.highlights && this.formData.highlights.length) {
        addField("listing[highlights]", this.formData.highlights.join(","));
      }

      if (this.formData.discounts && this.formData.discounts.length) {
        addField("listing[discounts]", this.formData.discounts.join(","));
      }

      if (this.formData.safetyItems && this.formData.safetyItems.length) {
        addField("listing[safetyItems]", this.formData.safetyItems.join(","));
      }

      if (this.formData.residentialStreet || this.formData.residentialCity) {
        const residentialAddress = {
          country: this.formData.residentialCountry || "India",
          flatNumber: this.formData.flatNumber || "",
          street: this.formData.residentialStreet || "",
          landmark: this.formData.landmark || "",
          city: this.formData.residentialCity || "",
          state: this.formData.residentialState || "",
          pincode: this.formData.residentialPincode || "",
        };
        addField(
          "listing[residentialAddress]",
          JSON.stringify(residentialAddress),
        );
      }

      if (this.formData.lng && this.formData.lat) {
        addField("listing[geometry][coordinates][0]", this.formData.lng);
        addField("listing[geometry][coordinates][1]", this.formData.lat);
      }

      document.body.appendChild(form);

      this.clearState();
      form.submit();
    },
  },
  mounted() {
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get("type");

    this.loadState();

    if (
      typeParam &&
      ["home", "experience", "service"].includes(typeParam) &&
      this.currentStep === 0
    ) {
      this.selectedType = typeParam;
      this.currentStep = 1;
      this.currentSubStep = 0;
      this.saveState();
    }

    this.loadRecentSearches();

    this.mapboxToken = window.MAP_TOKEN || window.MAPBOX_TOKEN;

    this.$watch("currentSubStep", (newVal) => {
      if (newVal === 5) {
        this.$nextTick(() => {
          setTimeout(() => {
            this.initMap();
          }, 100);
        });
      }
    });
  },
});
