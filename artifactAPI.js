// ============================================
// ARTIFACT SERVICE - With Fallback Data
// ============================================
// Tries Met Museum API first, falls back to bundled data

class ArtifactService {
    constructor() {
        this.apiBase = 'https://collectionapi.metmuseum.org/public/collection/v1';
        this.useAPI = true;
        this.cache = new Map();
        this.usedIds = new Set();
    }

    /**
     * Get artifacts for a country - tries API first, falls back to bundled data
     */
    async getArtifacts(country, count = 5) {
        // First try the live API for variety
        if (this.useAPI) {
            try {
                const artifacts = await this.fetchFromAPI(country, count);
                if (artifacts && artifacts.length > 0) {
                    console.log(`[ArtifactService] Loaded ${artifacts.length} artifacts from API`);
                    return artifacts;
                }
            } catch (error) {
                console.warn('[ArtifactService] API failed, using fallback data:', error.message);
                this.useAPI = false; // Don't try API again this session
            }
        }

        // Fallback to bundled data
        return this.getFromFallback(country, count);
    }

    /**
     * Fetch from Met Museum API
     */
    async fetchFromAPI(country, count) {
        const searchTerms = {
            'Egypt': 'Egyptian',
            'Greece': 'Greek',
            'China': 'Chinese',
            'Japan': 'Japanese',
            'Mexico': 'Aztec OR Maya',
            'Rome': 'Roman',
            'India': 'Indian',
            'Peru': 'Peruvian OR Inca',
            'Mesopotamia': 'Mesopotamian OR Assyrian'
        };

        const query = searchTerms[country] || country;
        const searchUrl = `${this.apiBase}/search?hasImages=true&q=${encodeURIComponent(query)}`;
        
        const response = await fetch(searchUrl);
        if (!response.ok) throw new Error('Search failed');
        
        const data = await response.json();
        if (!data.objectIDs || data.objectIDs.length === 0) {
            throw new Error('No results');
        }

        // Pick random IDs
        const shuffled = data.objectIDs.sort(() => Math.random() - 0.5);
        const selectedIds = shuffled.filter(id => !this.usedIds.has(id)).slice(0, count * 2);

        // Fetch details
        const artifacts = [];
        for (const id of selectedIds) {
            if (artifacts.length >= count) break;
            
            try {
                const detailRes = await fetch(`${this.apiBase}/objects/${id}`);
                const detail = await detailRes.json();
                
                if (detail.primaryImageSmall || detail.primaryImage) {
                    this.usedIds.add(id);
                    artifacts.push({
                        id: detail.objectID,
                        title: detail.title || 'Unknown Artifact',
                        period: detail.objectDate || 'Ancient',
                        culture: detail.culture || country,
                        image: detail.primaryImageSmall || detail.primaryImage
                    });
                }
            } catch (e) {
                // Skip failed items
            }
        }

        return artifacts;
    }

    /**
     * Get from fallback bundled data
     */
    getFromFallback(country, count) {
        const countryData = this.fallbackData[country];
        if (!countryData) {
            console.warn(`[ArtifactService] No fallback data for ${country}`);
            return [];
        }

        // Get unused artifacts
        const available = countryData.filter(a => !this.usedIds.has(a.id));
        
        // Reset if running low
        if (available.length < count) {
            countryData.forEach(a => this.usedIds.delete(a.id));
            available.push(...countryData);
        }

        // Shuffle and pick
        const shuffled = available.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, count);
        
        // Mark as used
        selected.forEach(a => this.usedIds.add(a.id));

        console.log(`[ArtifactService] Loaded ${selected.length} artifacts from fallback`);
        return selected;
    }

    /**
     * Reset used artifacts (for new game)
     */
    reset() {
        this.usedIds.clear();
    }

    /**
     * Get all available countries
     */
    getCountries() {
        return Object.keys(this.fallbackData);
    }
}

// Create singleton instance
const artifactService = new ArtifactService();

export { ArtifactService, artifactService };