// Search form submission handler
document.addEventListener("DOMContentLoaded", () => {
    const searchForm = document.getElementById("nnSearchForm");
    
    if (searchForm) {
        searchForm.addEventListener("submit", function(e) {
            const whereInput = document.getElementById("nnWhere");
            const checkIn = document.getElementById("checkIn");
            const checkOut = document.getElementById("checkOut");
            const guestsInput = document.getElementById("nnGuestsInput");
            
            // Build search query
            const searchParams = new URLSearchParams();
            
            if (whereInput && whereInput.value.trim()) {
                searchParams.append("location", whereInput.value.trim());
            }
            
            if (checkIn && checkIn.value) {
                searchParams.append("checkIn", checkIn.value);
            }
            
            if (checkOut && checkOut.value) {
                searchParams.append("checkOut", checkOut.value);
            }
            
            if (guestsInput && guestsInput.value) {
                searchParams.append("guests", guestsInput.value);
            }
            
            // Redirect to search results page
            window.location.href = "/search/results?" + searchParams.toString();
            e.preventDefault();
        });
    }
});