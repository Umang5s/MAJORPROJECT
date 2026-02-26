// Mapbox helper functions
const MapboxHelper = {
  async searchLocations(query, token) {
    if (!query || query.length < 3) return [];
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?access_token=${token}&autocomplete=true&limit=5`
      );
      
      const data = await response.json();
      
      return data.features ? data.features.map(feature => ({
        id: feature.id,
        place_name: feature.place_name,
        center: feature.center,
        context: feature.context ? feature.context.map(c => c.text).join(', ') : '',
        lat: feature.center[1],
        lng: feature.center[0]
      })) : [];
    } catch (error) {
      console.error('Error searching locations:', error);
      return [];
    }
  },

  async reverseGeocode(lng, lat, token) {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}`
      );
      const data = await response.json();
      
      if (data.features && data.features[0]) {
        return {
          id: data.features[0].id,
          place_name: data.features[0].place_name,
          lat: lat,
          lng: lng,
          context: data.features[0].context
        };
      }
      return null;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return null;
    }
  },

  extractCountry(location) {
    if (location.context) {
      const country = location.context.find(c => c.id.includes('country'));
      return country ? country.text : 'India';
    }
    return 'India';
  },

  extractCity(location) {
    if (location.context) {
      const place = location.context.find(c => 
        c.id.includes('place') || c.id.includes('locality')
      );
      return place ? place.text : location.place_name.split(',')[0];
    }
    return location.place_name.split(',')[0];
  }
};

// Make it available globally
window.MapboxHelper = MapboxHelper;