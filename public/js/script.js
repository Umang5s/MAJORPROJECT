(() => {
  "use strict";

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  const forms = document.querySelectorAll(".needs-validation");

  // Loop over them and prevent submission
  Array.from(forms).forEach((form) => {
    form.addEventListener(
      "submit",
      (event) => {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        }

        form.classList.add("was-validated");
      },
      false
    );
  });
})();


document.addEventListener("DOMContentLoaded", function() {
    // Get elements
    const body = document.body;
    // const navbar = document.querySelector('nav');
    const searchInput = document.querySelector('nav input[name="q"]');
    const searchBtn = document.querySelector('nav .search-btn');
    const searchForm = document.querySelector('nav form[role="search"]');
    
    // Create dropdown container
    const dropdown = document.createElement('div');
    dropdown.className = 'search-dropdown';
    searchForm.appendChild(dropdown);
    
    // Load search history
    let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];
    
    // Update dropdown display
    function updateDropdown() {
        if (searchHistory.length > 0) {
            dropdown.innerHTML = `
                <div class="dropdown-header">RECENT SEARCHES</div>
                ${searchHistory.map(term => `
                    <div class="dropdown-item">${term}</div>
                `).join('')}
            `;
            
            // Add click handlers
            document.querySelectorAll('.dropdown-item').forEach(item => {
                item.addEventListener('click', function() {
                    searchInput.value = this.textContent;
                    searchInput.focus();
                });
            });
        } else {
            dropdown.innerHTML = '';
        }
    }
    
    // Save search term
    function saveSearchTerm(term) {
        if (!term.trim()) return;
        
        // Remove if already exists
        searchHistory = searchHistory.filter(t => t.toLowerCase() !== term.toLowerCase());
        // Add to beginning
        searchHistory.unshift(term);
        // Keep only last 3
        searchHistory = searchHistory.slice(0, 3);
        
        localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
        updateDropdown();
    }
    
    // Toggle dropdown visibility
    function toggleDropdown(show) {
        dropdown.style.display = show && searchHistory.length > 0 ? 'block' : 'none';
    }
    
    // Hide other content
    function toggleSearchMode(show) {
        if (show) {
            body.classList.add('search-focused');
            toggleDropdown(true);
        } else {
            body.classList.remove('search-focused');
            toggleDropdown(false);
        }
    }
    
    // Event listeners
    searchInput.addEventListener('focus', () => {
        toggleSearchMode(true);
    });
    
    searchInput.addEventListener('blur', () => {
        setTimeout(() => toggleDropdown(false), 200);
    });
    
    searchBtn.addEventListener('click', () => {
        saveSearchTerm(searchInput.value.trim());
        toggleSearchMode(false);
    });
    
    searchForm.addEventListener('submit', function(e) {
        saveSearchTerm(searchInput.value.trim());
        toggleSearchMode(false);
    });
    
    // Click outside to unhide - NEW CODE
    document.addEventListener('click', function(e) {
        // Check if click is outside the search form
        if (!searchForm.contains(e.target)) {
            toggleSearchMode(false);
        }
    });
    
    // Internal CSS
    const style = document.createElement('style');
    style.textContent = `
        .search-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border-radius: 0 0 10px 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: none;
            z-index: 1000;
            max-height: 300px;
            overflow-y: auto;
        }
        
        body.search-focused > *:not(nav):not(.search-dropdown) {
            opacity: 0.3;
            pointer-events: none;
        }
        
        .dropdown-header {
            padding: 8px 15px;
            font-size: 12px;
            color: #666;
            font-weight: bold;
            border-bottom: 1px solid #eee;
        }
        
        .dropdown-item {
            padding: 10px 15px;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        .dropdown-item:hover {
            background: #f5f5f5;
            color: #fe424d;
        }
        
        nav form[role="search"] {
            position: relative;
        }
    `;
    document.head.appendChild(style);
    
    // Initialize
    updateDropdown();
});
