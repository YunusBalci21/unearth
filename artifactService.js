// ============================================
// ARTIFACT SERVICE v2 - With SVG Icons Fallback
// ============================================
// Uses Met Museum API when available, falls back to stylized SVG icons

class ArtifactService {
    constructor() {
        this.apiBase = 'https://collectionapi.metmuseum.org/public/collection/v1';
        this.usedIds = new Set();
        this.apiAvailable = true; // Will be set to false if API fails repeatedly
        this.apiFailCount = 0;

        // Search queries for variety
        this.countryQueries = {
            'Egypt': ['Egyptian sculpture', 'Egyptian jewelry', 'Pharaoh', 'Mummy mask', 'Hieroglyphic', 'Scarab', 'Egyptian gold', 'Ankh', 'Egyptian cat'],
            'Greece': ['Greek vase', 'Greek sculpture', 'Amphora', 'Greek coin', 'Greek bronze', 'Hellenistic', 'Greek marble'],
            'China': ['Chinese porcelain', 'Chinese jade', 'Ming dynasty', 'Tang dynasty', 'Chinese Buddha', 'Chinese dragon', 'Chinese bronze'],
            'Japan': ['Japanese samurai', 'Katana', 'Ukiyo-e', 'Hokusai', 'Noh mask', 'Japanese armor', 'Edo period'],
            'Mexico': ['Aztec', 'Maya', 'Olmec', 'Aztec mask', 'Maya jade', 'Feathered serpent', 'Aztec warrior'],
            'Rome': ['Roman bust', 'Roman coin', 'Roman mosaic', 'Roman glass', 'Pompeii', 'Roman jewelry', 'Roman bronze'],
            'India': ['Hindu deity', 'Shiva', 'Ganesha', 'Mughal', 'Indian bronze', 'Vishnu', 'Krishna'],
            'Peru': ['Inca', 'Moche', 'Nazca', 'Peruvian gold', 'Inca silver', 'Moche portrait', 'Andean textile'],
            'Mesopotamia': ['Assyrian relief', 'Babylonian', 'Sumerian', 'Cuneiform', 'Cylinder seal', 'Akkadian']
        };

        // SVG Icons - Transparent, lightweight, always available!
        // These are stylized representations perfect for games
        this.artifactIcons = {
            'Egypt': [
                { id: 'eg1', title: 'Pharaoh Mask', period: 'Ancient Egypt', culture: 'Egyptian', icon: 'pharaoh-mask' },
                { id: 'eg2', title: 'Scarab Amulet', period: 'New Kingdom', culture: 'Egyptian', icon: 'scarab' },
                { id: 'eg3', title: 'Ankh Symbol', period: 'Ancient Egypt', culture: 'Egyptian', icon: 'ankh' },
                { id: 'eg4', title: 'Canopic Jar', period: 'Ancient Egypt', culture: 'Egyptian', icon: 'canopic-jar' },
                { id: 'eg5', title: 'Eye of Horus', period: 'Ancient Egypt', culture: 'Egyptian', icon: 'eye-of-horus' },
                { id: 'eg6', title: 'Sphinx Statue', period: 'Old Kingdom', culture: 'Egyptian', icon: 'sphinx' },
                { id: 'eg7', title: 'Pyramid Model', period: 'Ancient Egypt', culture: 'Egyptian', icon: 'pyramid' },
                { id: 'eg8', title: 'Cat Statue', period: 'Late Period', culture: 'Egyptian', icon: 'cat-statue' },
                { id: 'eg9', title: 'Hieroglyph Tablet', period: 'Ancient Egypt', culture: 'Egyptian', icon: 'hieroglyph' },
                { id: 'eg10', title: 'Nefertiti Bust', period: 'New Kingdom', culture: 'Egyptian', icon: 'nefertiti' },
            ],
            'Greece': [
                { id: 'gr1', title: 'Amphora Vase', period: '5th Century BC', culture: 'Greek', icon: 'amphora' },
                { id: 'gr2', title: 'Spartan Helmet', period: 'Classical', culture: 'Greek', icon: 'spartan-helmet' },
                { id: 'gr3', title: 'Laurel Wreath', period: 'Classical', culture: 'Greek', icon: 'laurel-wreath' },
                { id: 'gr4', title: 'Greek Column', period: 'Classical', culture: 'Greek', icon: 'column' },
                { id: 'gr5', title: 'Lyre', period: 'Ancient Greece', culture: 'Greek', icon: 'lyre' },
                { id: 'gr6', title: 'Olympic Discus', period: 'Classical', culture: 'Greek', icon: 'discus' },
                { id: 'gr7', title: 'Owl of Athena', period: 'Classical', culture: 'Greek', icon: 'owl' },
                { id: 'gr8', title: 'Trident', period: 'Ancient Greece', culture: 'Greek', icon: 'trident' },
                { id: 'gr9', title: 'Greek Theater Mask', period: 'Classical', culture: 'Greek', icon: 'theater-mask' },
                { id: 'gr10', title: 'Drachma Coin', period: '4th Century BC', culture: 'Greek', icon: 'coin' },
            ],
            'China': [
                { id: 'ch1', title: 'Dragon Vase', period: 'Ming Dynasty', culture: 'Chinese', icon: 'dragon-vase' },
                { id: 'ch2', title: 'Jade Disc', period: 'Han Dynasty', culture: 'Chinese', icon: 'jade-disc' },
                { id: 'ch3', title: 'Terracotta Warrior', period: 'Qin Dynasty', culture: 'Chinese', icon: 'terracotta' },
                { id: 'ch4', title: 'Bronze Bell', period: 'Zhou Dynasty', culture: 'Chinese', icon: 'bronze-bell' },
                { id: 'ch5', title: 'Silk Fan', period: 'Tang Dynasty', culture: 'Chinese', icon: 'fan' },
                { id: 'ch6', title: 'Pagoda Model', period: 'Song Dynasty', culture: 'Chinese', icon: 'pagoda' },
                { id: 'ch7', title: 'Buddha Statue', period: 'Tang Dynasty', culture: 'Chinese', icon: 'buddha' },
                { id: 'ch8', title: 'Chinese Lantern', period: 'Ming Dynasty', culture: 'Chinese', icon: 'lantern' },
                { id: 'ch9', title: 'Tea Set', period: 'Qing Dynasty', culture: 'Chinese', icon: 'tea-set' },
                { id: 'ch10', title: 'Calligraphy Scroll', period: 'Song Dynasty', culture: 'Chinese', icon: 'scroll' },
            ],
            'Japan': [
                { id: 'jp1', title: 'Samurai Helmet', period: 'Edo Period', culture: 'Japanese', icon: 'samurai-helmet' },
                { id: 'jp2', title: 'Katana Sword', period: 'Muromachi', culture: 'Japanese', icon: 'katana' },
                { id: 'jp3', title: 'Noh Mask', period: 'Edo Period', culture: 'Japanese', icon: 'noh-mask' },
                { id: 'jp4', title: 'Daruma Doll', period: 'Edo Period', culture: 'Japanese', icon: 'daruma' },
                { id: 'jp5', title: 'Torii Gate Model', period: 'Traditional', culture: 'Japanese', icon: 'torii' },
                { id: 'jp6', title: 'Origami Crane', period: 'Edo Period', culture: 'Japanese', icon: 'origami' },
                { id: 'jp7', title: 'Sake Bottle', period: 'Edo Period', culture: 'Japanese', icon: 'sake' },
                { id: 'jp8', title: 'Bonsai Tree', period: 'Traditional', culture: 'Japanese', icon: 'bonsai' },
                { id: 'jp9', title: 'Maneki-neko', period: 'Edo Period', culture: 'Japanese', icon: 'lucky-cat' },
                { id: 'jp10', title: 'Koi Fish Painting', period: 'Edo Period', culture: 'Japanese', icon: 'koi' },
            ],
            'Mexico': [
                { id: 'mx1', title: 'Aztec Sun Stone', period: 'Aztec Empire', culture: 'Aztec', icon: 'sun-stone' },
                { id: 'mx2', title: 'Jade Mask', period: 'Maya Classic', culture: 'Maya', icon: 'jade-mask' },
                { id: 'mx3', title: 'Quetzalcoatl Head', period: 'Aztec Empire', culture: 'Aztec', icon: 'quetzalcoatl' },
                { id: 'mx4', title: 'Olmec Head', period: '1500-400 BC', culture: 'Olmec', icon: 'olmec-head' },
                { id: 'mx5', title: 'Maya Calendar', period: 'Maya Classic', culture: 'Maya', icon: 'maya-calendar' },
                { id: 'mx6', title: 'Eagle Warrior', period: 'Aztec Empire', culture: 'Aztec', icon: 'eagle-warrior' },
                { id: 'mx7', title: 'Obsidian Knife', period: 'Aztec Empire', culture: 'Aztec', icon: 'obsidian-knife' },
                { id: 'mx8', title: 'Cacao Pod', period: 'Mesoamerican', culture: 'Maya', icon: 'cacao' },
                { id: 'mx9', title: 'Jaguar Statue', period: 'Maya Classic', culture: 'Maya', icon: 'jaguar' },
                { id: 'mx10', title: 'Pyramid Model', period: 'Maya Classic', culture: 'Maya', icon: 'maya-pyramid' },
            ],
            'Rome': [
                { id: 'rm1', title: 'Roman Helmet', period: 'Imperial Rome', culture: 'Roman', icon: 'roman-helmet' },
                { id: 'rm2', title: 'Gladius Sword', period: 'Imperial Rome', culture: 'Roman', icon: 'gladius' },
                { id: 'rm3', title: 'Laurel Crown', period: 'Roman Republic', culture: 'Roman', icon: 'laurel-crown' },
                { id: 'rm4', title: 'Roman Coin', period: 'Imperial Rome', culture: 'Roman', icon: 'roman-coin' },
                { id: 'rm5', title: 'Eagle Standard', period: 'Imperial Rome', culture: 'Roman', icon: 'aquila' },
                { id: 'rm6', title: 'Roman Shield', period: 'Imperial Rome', culture: 'Roman', icon: 'scutum' },
                { id: 'rm7', title: 'Oil Lamp', period: 'Imperial Rome', culture: 'Roman', icon: 'oil-lamp' },
                { id: 'rm8', title: 'Mosaic Tile', period: 'Imperial Rome', culture: 'Roman', icon: 'mosaic' },
                { id: 'rm9', title: 'Amphora', period: 'Roman Republic', culture: 'Roman', icon: 'roman-amphora' },
                { id: 'rm10', title: 'Bust of Caesar', period: 'Roman Republic', culture: 'Roman', icon: 'caesar-bust' },
            ],
            'India': [
                { id: 'in1', title: 'Shiva Nataraja', period: 'Chola Dynasty', culture: 'Indian', icon: 'shiva' },
                { id: 'in2', title: 'Ganesha Statue', period: 'Medieval India', culture: 'Indian', icon: 'ganesha' },
                { id: 'in3', title: 'Lotus Flower', period: 'Traditional', culture: 'Indian', icon: 'lotus' },
                { id: 'in4', title: 'Mughal Dagger', period: 'Mughal Empire', culture: 'Indian', icon: 'mughal-dagger' },
                { id: 'in5', title: 'Elephant Statue', period: 'Medieval India', culture: 'Indian', icon: 'elephant' },
                { id: 'in6', title: 'Buddha Head', period: 'Gupta Period', culture: 'Indian', icon: 'buddha-head' },
                { id: 'in7', title: 'Temple Bell', period: 'Medieval India', culture: 'Indian', icon: 'temple-bell' },
                { id: 'in8', title: 'Peacock Ornament', period: 'Mughal Empire', culture: 'Indian', icon: 'peacock' },
                { id: 'in9', title: 'Om Symbol', period: 'Traditional', culture: 'Indian', icon: 'om' },
                { id: 'in10', title: 'Sitar', period: 'Mughal Empire', culture: 'Indian', icon: 'sitar' },
            ],
            'Peru': [
                { id: 'pe1', title: 'Inca Gold Mask', period: 'Inca Empire', culture: 'Inca', icon: 'inca-mask' },
                { id: 'pe2', title: 'Moche Portrait', period: 'Moche Culture', culture: 'Moche', icon: 'moche-portrait' },
                { id: 'pe3', title: 'Nazca Lines Bird', period: 'Nazca Culture', culture: 'Nazca', icon: 'nazca-bird' },
                { id: 'pe4', title: 'Tumi Knife', period: 'Chimu Culture', culture: 'Chimu', icon: 'tumi' },
                { id: 'pe5', title: 'Llama Figure', period: 'Inca Empire', culture: 'Inca', icon: 'llama' },
                { id: 'pe6', title: 'Quipu', period: 'Inca Empire', culture: 'Inca', icon: 'quipu' },
                { id: 'pe7', title: 'Textile Pattern', period: 'Wari Culture', culture: 'Wari', icon: 'wari-textile' },
                { id: 'pe8', title: 'Sun Disc', period: 'Inca Empire', culture: 'Inca', icon: 'inti' },
                { id: 'pe9', title: 'Ceramic Vessel', period: 'Moche Culture', culture: 'Moche', icon: 'moche-vessel' },
                { id: 'pe10', title: 'Condor Figure', period: 'Nazca Culture', culture: 'Nazca', icon: 'condor' },
            ],
            'Mesopotamia': [
                { id: 'ms1', title: 'Winged Bull', period: 'Assyrian Empire', culture: 'Assyrian', icon: 'lamassu' },
                { id: 'ms2', title: 'Cuneiform Tablet', period: 'Sumerian', culture: 'Sumerian', icon: 'cuneiform' },
                { id: 'ms3', title: 'Cylinder Seal', period: 'Akkadian', culture: 'Akkadian', icon: 'cylinder-seal' },
                { id: 'ms4', title: 'Ishtar Gate Lion', period: 'Babylonian', culture: 'Babylonian', icon: 'ishtar-lion' },
                { id: 'ms5', title: 'Ziggurat Model', period: 'Sumerian', culture: 'Sumerian', icon: 'ziggurat' },
                { id: 'ms6', title: 'Code of Hammurabi', period: 'Babylonian', culture: 'Babylonian', icon: 'hammurabi' },
                { id: 'ms7', title: 'Gilgamesh Relief', period: 'Akkadian', culture: 'Akkadian', icon: 'gilgamesh' },
                { id: 'ms8', title: 'Royal Harp', period: 'Sumerian', culture: 'Sumerian', icon: 'harp' },
                { id: 'ms9', title: 'Lion Hunt Relief', period: 'Assyrian Empire', culture: 'Assyrian', icon: 'lion-hunt' },
                { id: 'ms10', title: 'Star of Shamash', period: 'Babylonian', culture: 'Babylonian', icon: 'shamash' },
            ]
        };
    }

    /**
     * Get artifacts - tries API first, falls back to icons
     */
    async getArtifacts(country, count = 5, preferIcons = true) {
        // If preferIcons or API has failed too many times, use icons
        if (preferIcons || !this.apiAvailable) {
            return this.getIconArtifacts(country, count);
        }

        try {
            const artifacts = await this.fetchFromAPI(country, count);
            if (artifacts && artifacts.length >= count) {
                this.apiFailCount = 0; // Reset fail count on success
                return artifacts;
            }
        } catch (error) {
            console.warn('[ArtifactService] API error:', error.message);
            this.apiFailCount++;

            // After 3 failures, switch to icons for this session
            if (this.apiFailCount >= 3) {
                console.log('[ArtifactService] Switching to icon mode');
                this.apiAvailable = false;
            }
        }

        // Fallback to icons
        return this.getIconArtifacts(country, count);
    }

    /**
     * Get SVG icon artifacts (always works, transparent background!)
     */
    getIconArtifacts(country, count) {
        const icons = this.artifactIcons[country];
        if (!icons) return [];

        // Filter out used ones
        let available = icons.filter(a => !this.usedIds.has(a.id));

        // Reset if running low
        if (available.length < count) {
            icons.forEach(a => this.usedIds.delete(a.id));
            available = [...icons];
        }

        // Shuffle
        for (let i = available.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [available[i], available[j]] = [available[j], available[i]];
        }

        const selected = available.slice(0, count);
        selected.forEach(a => this.usedIds.add(a.id));

        // Add SVG image URLs
        return selected.map(artifact => ({
            ...artifact,
            image: this.generateSVGDataUrl(artifact.icon, country),
            isIcon: true
        }));
    }

    /**
     * Generate SVG data URL for an artifact icon
     */
    generateSVGDataUrl(iconType, country) {
        const colors = {
            'Egypt': { primary: '#D4AF37', secondary: '#8B6914', bg: '#2C1810' },
            'Greece': { primary: '#FFFFFF', secondary: '#1E90FF', bg: '#1A237E' },
            'China': { primary: '#FF0000', secondary: '#FFD700', bg: '#8B0000' },
            'Japan': { primary: '#FFFFFF', secondary: '#BC002D', bg: '#2D2D2D' },
            'Mexico': { primary: '#00A86B', secondary: '#FFD700', bg: '#4A0E0E' },
            'Rome': { primary: '#FFD700', secondary: '#8B0000', bg: '#1A1A2E' },
            'India': { primary: '#FF9933', secondary: '#138808', bg: '#2E1A47' },
            'Peru': { primary: '#FFD700', secondary: '#C41E3A', bg: '#3D2914' },
            'Mesopotamia': { primary: '#C9A227', secondary: '#4A3728', bg: '#1A1410' }
        };

        const c = colors[country] || colors['Egypt'];

        // Simple iconic SVGs for each artifact type
        const svgs = {
            // Egypt
            'pharaoh-mask': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="45" rx="30" ry="35" fill="${c.primary}"/><path d="M20 45 Q50 90 80 45" fill="${c.secondary}"/><circle cx="40" cy="40" r="5" fill="${c.bg}"/><circle cx="60" cy="40" r="5" fill="${c.bg}"/><path d="M20 30 L50 10 L80 30" fill="${c.primary}" stroke="${c.secondary}" stroke-width="2"/></svg>`,
            'scarab': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="55" rx="25" ry="30" fill="${c.primary}"/><circle cx="50" cy="25" r="15" fill="${c.primary}"/><path d="M25 50 Q10 30 25 20" stroke="${c.secondary}" stroke-width="4" fill="none"/><path d="M75 50 Q90 30 75 20" stroke="${c.secondary}" stroke-width="4" fill="none"/></svg>`,
            'ankh': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="25" rx="15" ry="20" fill="none" stroke="${c.primary}" stroke-width="8"/><line x1="50" y1="45" x2="50" y2="90" stroke="${c.primary}" stroke-width="8"/><line x1="30" y1="60" x2="70" y2="60" stroke="${c.primary}" stroke-width="8"/></svg>`,
            'canopic-jar': `<svg viewBox="0 0 100 100"><path d="M35 30 Q35 80 50 85 Q65 80 65 30" fill="${c.primary}"/><ellipse cx="50" cy="30" rx="15" ry="8" fill="${c.secondary}"/><circle cx="50" cy="15" r="12" fill="${c.primary}"/><circle cx="45" cy="13" r="2" fill="${c.bg}"/><circle cx="55" cy="13" r="2" fill="${c.bg}"/></svg>`,
            'eye-of-horus': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="40" rx="35" ry="20" fill="${c.primary}"/><circle cx="50" cy="40" r="12" fill="${c.bg}"/><circle cx="50" cy="40" r="6" fill="${c.secondary}"/><path d="M15 40 Q30 70 50 80" stroke="${c.primary}" stroke-width="6" fill="none"/><path d="M50 55 L50 80" stroke="${c.primary}" stroke-width="4"/></svg>`,
            'sphinx': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="70" rx="35" ry="15" fill="${c.primary}"/><path d="M30 70 L30 40 Q50 20 70 40 L70 70" fill="${c.primary}"/><circle cx="42" cy="45" r="3" fill="${c.bg}"/><circle cx="58" cy="45" r="3" fill="${c.bg}"/></svg>`,
            'pyramid': `<svg viewBox="0 0 100 100"><polygon points="50,15 85,85 15,85" fill="${c.primary}" stroke="${c.secondary}" stroke-width="2"/><line x1="50" y1="15" x2="50" y2="85" stroke="${c.secondary}" stroke-width="1"/></svg>`,
            'cat-statue': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="75" rx="20" ry="10" fill="${c.primary}"/><path d="M35 75 L35 40 Q50 30 65 40 L65 75" fill="${c.primary}"/><polygon points="35,40 25,20 40,35" fill="${c.primary}"/><polygon points="65,40 75,20 60,35" fill="${c.primary}"/><circle cx="42" cy="45" r="3" fill="${c.secondary}"/><circle cx="58" cy="45" r="3" fill="${c.secondary}"/></svg>`,
            'hieroglyph': `<svg viewBox="0 0 100 100"><rect x="20" y="15" width="60" height="70" fill="${c.secondary}" rx="5"/><circle cx="35" cy="35" r="8" fill="${c.primary}"/><rect x="50" y="30" width="20" height="10" fill="${c.primary}"/><path d="M30 55 L45 55 L45 70 L30 70 Z" fill="${c.primary}"/><path d="M55 50 L70 65" stroke="${c.primary}" stroke-width="4"/></svg>`,
            'nefertiti': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="55" rx="20" ry="25" fill="${c.primary}"/><path d="M30 30 L50 10 L70 30 L70 45 L30 45 Z" fill="${c.secondary}"/><circle cx="43" cy="50" r="3" fill="${c.bg}"/><circle cx="57" cy="50" r="3" fill="${c.bg}"/><path d="M45 62 Q50 65 55 62" stroke="${c.bg}" stroke-width="2" fill="none"/></svg>`,

            // Greece
            'amphora': `<svg viewBox="0 0 100 100"><path d="M35 25 Q30 50 35 80 Q50 90 65 80 Q70 50 65 25" fill="${c.secondary}"/><ellipse cx="50" cy="25" rx="15" ry="8" fill="${c.secondary}"/><path d="M35 35 Q20 30 25 45" stroke="${c.secondary}" stroke-width="5" fill="none"/><path d="M65 35 Q80 30 75 45" stroke="${c.secondary}" stroke-width="5" fill="none"/><rect x="38" y="40" width="24" height="30" fill="${c.primary}" opacity="0.3"/></svg>`,
            'spartan-helmet': `<svg viewBox="0 0 100 100"><path d="M25 70 Q25 30 50 20 Q75 30 75 70" fill="${c.primary}"/><rect x="45" y="15" width="10" height="40" fill="${c.secondary}"/><path d="M30 70 L30 85 L70 85 L70 70" fill="${c.primary}"/><rect x="35" y="55" width="30" height="8" fill="${c.bg}"/></svg>`,
            'laurel-wreath': `<svg viewBox="0 0 100 100"><path d="M50 80 Q20 60 25 30 Q30 20 40 25" stroke="${c.secondary}" stroke-width="3" fill="none"/><path d="M50 80 Q80 60 75 30 Q70 20 60 25" stroke="${c.secondary}" stroke-width="3" fill="none"/><ellipse cx="30" cy="40" rx="8" ry="15" fill="${c.secondary}" transform="rotate(-30 30 40)"/><ellipse cx="70" cy="40" rx="8" ry="15" fill="${c.secondary}" transform="rotate(30 70 40)"/><ellipse cx="35" cy="55" rx="8" ry="15" fill="${c.secondary}" transform="rotate(-15 35 55)"/><ellipse cx="65" cy="55" rx="8" ry="15" fill="${c.secondary}" transform="rotate(15 65 55)"/></svg>`,
            'column': `<svg viewBox="0 0 100 100"><rect x="30" y="20" width="40" height="60" fill="${c.primary}"/><rect x="25" y="15" width="50" height="8" fill="${c.primary}"/><rect x="25" y="77" width="50" height="8" fill="${c.primary}"/><line x1="38" y1="23" x2="38" y2="77" stroke="${c.bg}" stroke-width="2"/><line x1="50" y1="23" x2="50" y2="77" stroke="${c.bg}" stroke-width="2"/><line x1="62" y1="23" x2="62" y2="77" stroke="${c.bg}" stroke-width="2"/></svg>`,
            'lyre': `<svg viewBox="0 0 100 100"><path d="M30 80 Q20 40 35 20" stroke="${c.primary}" stroke-width="5" fill="none"/><path d="M70 80 Q80 40 65 20" stroke="${c.primary}" stroke-width="5" fill="none"/><path d="M35 20 Q50 10 65 20" stroke="${c.primary}" stroke-width="5" fill="none"/><rect x="25" y="75" width="50" height="10" fill="${c.primary}" rx="3"/><line x1="35" y1="25" x2="35" y2="75" stroke="${c.secondary}" stroke-width="1"/><line x1="50" y1="20" x2="50" y2="75" stroke="${c.secondary}" stroke-width="1"/><line x1="65" y1="25" x2="65" y2="75" stroke="${c.secondary}" stroke-width="1"/></svg>`,
            'discus': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="35" ry="35" fill="${c.primary}"/><ellipse cx="50" cy="50" rx="25" ry="25" fill="${c.secondary}"/><ellipse cx="50" cy="50" rx="10" ry="10" fill="${c.primary}"/></svg>`,
            'owl': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="55" rx="25" ry="30" fill="${c.primary}"/><circle cx="40" cy="45" r="12" fill="${c.secondary}"/><circle cx="60" cy="45" r="12" fill="${c.secondary}"/><circle cx="40" cy="45" r="6" fill="${c.bg}"/><circle cx="60" cy="45" r="6" fill="${c.bg}"/><polygon points="50,55 45,65 55,65" fill="${c.secondary}"/><polygon points="30,35 40,40 35,30" fill="${c.primary}"/><polygon points="70,35 60,40 65,30" fill="${c.primary}"/></svg>`,
            'trident': `<svg viewBox="0 0 100 100"><line x1="50" y1="20" x2="50" y2="90" stroke="${c.primary}" stroke-width="6"/><line x1="30" y1="35" x2="30" y2="15" stroke="${c.primary}" stroke-width="4"/><line x1="50" y1="35" x2="50" y2="10" stroke="${c.primary}" stroke-width="4"/><line x1="70" y1="35" x2="70" y2="15" stroke="${c.primary}" stroke-width="4"/><path d="M30 35 L50 35 L70 35" stroke="${c.primary}" stroke-width="4"/><circle cx="30" cy="15" r="4" fill="${c.secondary}"/><circle cx="50" cy="10" r="4" fill="${c.secondary}"/><circle cx="70" cy="15" r="4" fill="${c.secondary}"/></svg>`,
            'theater-mask': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="30" ry="35" fill="${c.primary}"/><ellipse cx="38" cy="40" rx="8" ry="10" fill="${c.bg}"/><ellipse cx="62" cy="40" rx="8" ry="10" fill="${c.bg}"/><path d="M35 65 Q50 80 65 65" stroke="${c.bg}" stroke-width="4" fill="none"/></svg>`,
            'coin': `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="${c.primary}"/><circle cx="50" cy="50" r="28" fill="${c.secondary}"/><circle cx="50" cy="45" r="15" fill="${c.primary}"/><path d="M45 70 L55 70" stroke="${c.primary}" stroke-width="3"/></svg>`,

            // China
            'dragon-vase': `<svg viewBox="0 0 100 100"><path d="M35 25 Q30 50 35 80 Q50 90 65 80 Q70 50 65 25" fill="${c.primary}"/><ellipse cx="50" cy="25" rx="15" ry="8" fill="${c.secondary}"/><path d="M40 45 Q50 35 60 45 Q55 55 50 50 Q45 55 40 45" fill="${c.secondary}"/></svg>`,
            'jade-disc': `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="${c.primary}"/><circle cx="50" cy="50" r="12" fill="${c.bg}"/><circle cx="50" cy="50" r="25" fill="none" stroke="${c.secondary}" stroke-width="3"/></svg>`,
            'terracotta': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="75" rx="20" ry="8" fill="${c.primary}"/><path d="M35 75 L35 35 Q50 25 65 35 L65 75" fill="${c.primary}"/><circle cx="50" cy="30" r="12" fill="${c.secondary}"/><circle cx="45" cy="28" r="2" fill="${c.bg}"/><circle cx="55" cy="28" r="2" fill="${c.bg}"/></svg>`,
            'bronze-bell': `<svg viewBox="0 0 100 100"><path d="M30 75 Q30 40 50 30 Q70 40 70 75" fill="${c.primary}"/><ellipse cx="50" cy="75" rx="20" ry="8" fill="${c.secondary}"/><circle cx="50" cy="20" r="8" fill="${c.primary}"/><circle cx="50" cy="65" r="5" fill="${c.secondary}"/></svg>`,
            'fan': `<svg viewBox="0 0 100 100"><path d="M50 85 L20 30 Q50 10 80 30 Z" fill="${c.primary}"/><line x1="50" y1="85" x2="35" y2="35" stroke="${c.secondary}" stroke-width="1"/><line x1="50" y1="85" x2="50" y2="25" stroke="${c.secondary}" stroke-width="1"/><line x1="50" y1="85" x2="65" y2="35" stroke="${c.secondary}" stroke-width="1"/></svg>`,
            'pagoda': `<svg viewBox="0 0 100 100"><polygon points="50,10 70,30 30,30" fill="${c.primary}"/><rect x="35" y="30" width="30" height="15" fill="${c.secondary}"/><polygon points="50,35 65,50 35,50" fill="${c.primary}"/><rect x="38" y="50" width="24" height="12" fill="${c.secondary}"/><polygon points="50,55 62,65 38,65" fill="${c.primary}"/><rect x="40" y="65" width="20" height="20" fill="${c.secondary}"/></svg>`,
            'buddha': `<svg viewBox="0 0 100 100"><circle cx="50" cy="35" r="20" fill="${c.primary}"/><ellipse cx="50" cy="70" rx="25" ry="20" fill="${c.primary}"/><circle cx="43" cy="32" r="2" fill="${c.bg}"/><circle cx="57" cy="32" r="2" fill="${c.bg}"/><path d="M45 40 Q50 43 55 40" stroke="${c.bg}" stroke-width="2" fill="none"/></svg>`,
            'lantern': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="25" ry="30" fill="${c.primary}"/><rect x="40" y="15" width="20" height="10" fill="${c.secondary}"/><rect x="40" y="75" width="20" height="10" fill="${c.secondary}"/><line x1="50" y1="5" x2="50" y2="15" stroke="${c.secondary}" stroke-width="3"/></svg>`,
            'tea-set': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="70" rx="30" ry="10" fill="${c.secondary}"/><path d="M30 65 Q30 45 50 40 Q70 45 70 65" fill="${c.primary}"/><ellipse cx="50" cy="40" rx="10" ry="5" fill="${c.bg}"/><path d="M70 50 Q85 50 80 65" stroke="${c.primary}" stroke-width="4" fill="none"/></svg>`,
            'scroll': `<svg viewBox="0 0 100 100"><rect x="25" y="25" width="50" height="50" fill="${c.secondary}"/><circle cx="25" cy="25" r="8" fill="${c.primary}"/><circle cx="75" cy="25" r="8" fill="${c.primary}"/><circle cx="25" cy="75" r="8" fill="${c.primary}"/><circle cx="75" cy="75" r="8" fill="${c.primary}"/><line x1="35" y1="40" x2="65" y2="40" stroke="${c.bg}" stroke-width="2"/><line x1="35" y1="50" x2="65" y2="50" stroke="${c.bg}" stroke-width="2"/><line x1="35" y1="60" x2="55" y2="60" stroke="${c.bg}" stroke-width="2"/></svg>`,

            // Japan
            'samurai-helmet': `<svg viewBox="0 0 100 100"><path d="M20 60 Q20 30 50 20 Q80 30 80 60" fill="${c.primary}"/><path d="M25 60 L75 60 L70 75 L30 75 Z" fill="${c.secondary}"/><path d="M35 20 L50 5 L65 20" fill="${c.primary}"/><ellipse cx="50" cy="45" rx="25" ry="10" fill="${c.bg}" opacity="0.3"/></svg>`,
            'katana': `<svg viewBox="0 0 100 100"><path d="M20 80 Q25 75 75 25" stroke="${c.primary}" stroke-width="4" fill="none"/><path d="M75 25 L80 20" stroke="${c.secondary}" stroke-width="2"/><rect x="18" y="76" width="8" height="12" fill="${c.secondary}" transform="rotate(-45 22 82)"/></svg>`,
            'noh-mask': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="30" ry="35" fill="${c.primary}"/><path d="M35 40 L42 45 L35 50" fill="${c.bg}"/><path d="M65 40 L58 45 L65 50" fill="${c.bg}"/><ellipse cx="50" cy="65" rx="10" ry="5" fill="${c.secondary}"/></svg>`,
            'daruma': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="55" rx="30" ry="35" fill="${c.primary}"/><circle cx="50" cy="45" r="20" fill="${c.secondary}"/><circle cx="42" cy="42" r="6" fill="${c.primary}"/><circle cx="58" cy="42" r="6" fill="${c.primary}"/><circle cx="42" cy="42" r="3" fill="${c.bg}"/><circle cx="58" cy="42" r="3" fill="${c.bg}"/></svg>`,
            'torii': `<svg viewBox="0 0 100 100"><rect x="20" y="25" width="8" height="60" fill="${c.primary}"/><rect x="72" y="25" width="8" height="60" fill="${c.primary}"/><rect x="15" y="20" width="70" height="8" fill="${c.primary}"/><rect x="18" y="35" width="64" height="5" fill="${c.primary}"/><path d="M15 20 L50 10 L85 20" fill="${c.secondary}"/></svg>`,
            'origami': `<svg viewBox="0 0 100 100"><polygon points="50,20 80,50 65,50 65,80 35,80 35,50 20,50" fill="${c.primary}"/><polygon points="50,20 35,50 65,50" fill="${c.secondary}"/></svg>`,
            'sake': `<svg viewBox="0 0 100 100"><path d="M35 30 L35 75 Q50 85 65 75 L65 30" fill="${c.primary}"/><ellipse cx="50" cy="30" rx="15" ry="8" fill="${c.secondary}"/><rect x="45" y="20" width="10" height="15" fill="${c.primary}"/></svg>`,
            'bonsai': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="80" rx="25" ry="8" fill="${c.secondary}"/><rect x="45" y="60" width="10" height="20" fill="${c.primary}"/><circle cx="50" cy="45" r="20" fill="${c.secondary}"/><circle cx="35" cy="50" r="12" fill="${c.secondary}"/><circle cx="65" cy="50" r="12" fill="${c.secondary}"/></svg>`,
            'lucky-cat': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="65" rx="25" ry="25" fill="${c.primary}"/><circle cx="50" cy="40" r="20" fill="${c.primary}"/><polygon points="32,30 38,45 28,40" fill="${c.primary}"/><polygon points="68,30 62,45 72,40" fill="${c.primary}"/><circle cx="42" cy="38" r="4" fill="${c.bg}"/><circle cx="58" cy="38" r="4" fill="${c.bg}"/><path d="M75 50 L85 30" stroke="${c.primary}" stroke-width="6"/></svg>`,
            'koi': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="35" ry="20" fill="${c.primary}"/><polygon points="85,50 95,35 95,65" fill="${c.secondary}"/><circle cx="30" cy="45" r="4" fill="${c.bg}"/><path d="M15 50 Q25 40 35 50" stroke="${c.secondary}" stroke-width="2" fill="none"/></svg>`,

            // Mexico
            'sun-stone': `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${c.primary}"/><circle cx="50" cy="50" r="30" fill="${c.secondary}"/><circle cx="50" cy="50" r="15" fill="${c.primary}"/><circle cx="50" cy="50" r="8" fill="${c.bg}"/></svg>`,
            'jade-mask': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="30" ry="35" fill="${c.primary}"/><ellipse cx="38" cy="42" rx="8" ry="6" fill="${c.bg}"/><ellipse cx="62" cy="42" rx="8" ry="6" fill="${c.bg}"/><ellipse cx="50" cy="65" rx="12" ry="6" fill="${c.bg}"/><rect x="35" y="20" width="30" height="8" fill="${c.secondary}"/></svg>`,
            'quetzalcoatl': `<svg viewBox="0 0 100 100"><circle cx="50" cy="40" r="20" fill="${c.primary}"/><path d="M30 40 Q20 50 25 60 Q35 55 30 40" fill="${c.secondary}"/><path d="M70 40 Q80 50 75 60 Q65 55 70 40" fill="${c.secondary}"/><path d="M50 60 Q50 80 40 90" stroke="${c.primary}" stroke-width="8" fill="none"/><circle cx="43" cy="38" r="3" fill="${c.bg}"/><circle cx="57" cy="38" r="3" fill="${c.bg}"/></svg>`,
            'olmec-head': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="55" rx="30" ry="35" fill="${c.primary}"/><ellipse cx="50" cy="25" rx="25" ry="15" fill="${c.secondary}"/><ellipse cx="40" cy="50" rx="5" ry="4" fill="${c.bg}"/><ellipse cx="60" cy="50" rx="5" ry="4" fill="${c.bg}"/><ellipse cx="50" cy="70" rx="10" ry="6" fill="${c.bg}"/></svg>`,
            'maya-calendar': `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${c.primary}"/><circle cx="50" cy="50" r="32" fill="${c.secondary}"/><circle cx="50" cy="50" r="20" fill="${c.primary}"/><circle cx="50" cy="50" r="10" fill="${c.secondary}"/><line x1="50" y1="10" x2="50" y2="25" stroke="${c.bg}" stroke-width="2"/><line x1="50" y1="75" x2="50" y2="90" stroke="${c.bg}" stroke-width="2"/><line x1="10" y1="50" x2="25" y2="50" stroke="${c.bg}" stroke-width="2"/><line x1="75" y1="50" x2="90" y2="50" stroke="${c.bg}" stroke-width="2"/></svg>`,
            'eagle-warrior': `<svg viewBox="0 0 100 100"><circle cx="50" cy="45" r="20" fill="${c.primary}"/><path d="M30 35 L20 25 L35 35" fill="${c.secondary}"/><path d="M70 35 L80 25 L65 35" fill="${c.secondary}"/><ellipse cx="50" cy="75" rx="15" ry="20" fill="${c.primary}"/><circle cx="43" cy="42" r="3" fill="${c.bg}"/><circle cx="57" cy="42" r="3" fill="${c.bg}"/><path d="M45 52 L50 58 L55 52" fill="${c.secondary}"/></svg>`,
            'obsidian-knife': `<svg viewBox="0 0 100 100"><polygon points="50,15 60,70 50,85 40,70" fill="${c.primary}"/><rect x="40" y="70" width="20" height="20" fill="${c.secondary}"/></svg>`,
            'cacao': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="20" ry="35" fill="${c.primary}"/><line x1="50" y1="20" x2="50" y2="80" stroke="${c.secondary}" stroke-width="2"/><ellipse cx="40" cy="40" rx="5" ry="8" fill="${c.secondary}"/><ellipse cx="60" cy="55" rx="5" ry="8" fill="${c.secondary}"/></svg>`,
            'jaguar': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="60" rx="30" ry="20" fill="${c.primary}"/><circle cx="50" cy="35" r="18" fill="${c.primary}"/><polygon points="35,25 30,15 40,22" fill="${c.primary}"/><polygon points="65,25 70,15 60,22" fill="${c.primary}"/><circle cx="42" cy="32" r="4" fill="${c.secondary}"/><circle cx="58" cy="32" r="4" fill="${c.secondary}"/><circle cx="42" cy="32" r="2" fill="${c.bg}"/><circle cx="58" cy="32" r="2" fill="${c.bg}"/></svg>`,
            'maya-pyramid': `<svg viewBox="0 0 100 100"><polygon points="50,15 85,85 15,85" fill="${c.primary}"/><rect x="35" y="25" width="30" height="10" fill="${c.secondary}"/><rect x="30" y="40" width="40" height="10" fill="${c.secondary}"/><rect x="25" y="55" width="50" height="10" fill="${c.secondary}"/><rect x="20" y="70" width="60" height="10" fill="${c.secondary}"/></svg>`,

            // Rome
            'roman-helmet': `<svg viewBox="0 0 100 100"><path d="M20 65 Q20 30 50 25 Q80 30 80 65" fill="${c.primary}"/><rect x="45" y="10" width="10" height="20" fill="${c.secondary}"/><ellipse cx="50" cy="10" rx="15" ry="5" fill="${c.secondary}"/><path d="M25 65 L75 65 L70 80 L30 80 Z" fill="${c.primary}"/></svg>`,
            'gladius': `<svg viewBox="0 0 100 100"><rect x="47" y="15" width="6" height="50" fill="${c.primary}"/><polygon points="47,15 53,15 50,5" fill="${c.primary}"/><rect x="40" y="65" width="20" height="8" fill="${c.secondary}"/><rect x="45" y="73" width="10" height="15" fill="${c.secondary}"/></svg>`,
            'laurel-crown': `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="none" stroke="${c.primary}" stroke-width="5"/><ellipse cx="30" cy="35" rx="8" ry="15" fill="${c.secondary}" transform="rotate(-30 30 35)"/><ellipse cx="70" cy="35" rx="8" ry="15" fill="${c.secondary}" transform="rotate(30 70 35)"/><ellipse cx="30" cy="65" rx="8" ry="15" fill="${c.secondary}" transform="rotate(30 30 65)"/><ellipse cx="70" cy="65" rx="8" ry="15" fill="${c.secondary}" transform="rotate(-30 70 65)"/></svg>`,
            'roman-coin': `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="${c.primary}"/><circle cx="50" cy="50" r="32" fill="${c.secondary}"/><circle cx="50" cy="45" r="15" fill="${c.primary}"/><text x="50" y="75" text-anchor="middle" fill="${c.primary}" font-size="12">SPQR</text></svg>`,
            'aquila': `<svg viewBox="0 0 100 100"><polygon points="50,15 60,40 90,35 65,55 75,85 50,65 25,85 35,55 10,35 40,40" fill="${c.primary}"/><circle cx="50" cy="45" r="8" fill="${c.secondary}"/></svg>`,
            'scutum': `<svg viewBox="0 0 100 100"><path d="M25 20 Q25 80 50 90 Q75 80 75 20 Q50 15 25 20" fill="${c.primary}"/><path d="M35 30 Q35 70 50 78 Q65 70 65 30 Q50 25 35 30" fill="${c.secondary}"/><circle cx="50" cy="50" r="10" fill="${c.primary}"/></svg>`,
            'oil-lamp': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="60" rx="25" ry="15" fill="${c.primary}"/><path d="M75 55 Q90 50 85 60 Q90 70 75 65" fill="${c.primary}"/><ellipse cx="50" cy="55" rx="8" ry="5" fill="${c.bg}"/><path d="M50 45 Q55 35 50 25" stroke="${c.secondary}" stroke-width="3" fill="none"/></svg>`,
            'mosaic': `<svg viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" fill="${c.bg}"/><rect x="25" y="25" width="12" height="12" fill="${c.primary}"/><rect x="42" y="25" width="12" height="12" fill="${c.secondary}"/><rect x="59" y="25" width="12" height="12" fill="${c.primary}"/><rect x="25" y="42" width="12" height="12" fill="${c.secondary}"/><rect x="42" y="42" width="12" height="12" fill="${c.primary}"/><rect x="59" y="42" width="12" height="12" fill="${c.secondary}"/><rect x="25" y="59" width="12" height="12" fill="${c.primary}"/><rect x="42" y="59" width="12" height="12" fill="${c.secondary}"/><rect x="59" y="59" width="12" height="12" fill="${c.primary}"/></svg>`,
            'roman-amphora': `<svg viewBox="0 0 100 100"><path d="M38 25 Q32 50 35 80 Q50 90 65 80 Q68 50 62 25" fill="${c.primary}"/><ellipse cx="50" cy="25" rx="12" ry="6" fill="${c.secondary}"/><path d="M38 30 Q25 25 28 40" stroke="${c.primary}" stroke-width="5" fill="none"/><path d="M62 30 Q75 25 72 40" stroke="${c.primary}" stroke-width="5" fill="none"/></svg>`,
            'caesar-bust': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="40" rx="20" ry="25" fill="${c.primary}"/><path d="M30 65 Q30 85 50 90 Q70 85 70 65" fill="${c.primary}"/><circle cx="42" cy="35" r="3" fill="${c.bg}"/><circle cx="58" cy="35" r="3" fill="${c.bg}"/><path d="M30 25 Q50 15 70 25" fill="${c.secondary}"/></svg>`,

            // India
            'shiva': `<svg viewBox="0 0 100 100"><circle cx="50" cy="35" r="15" fill="${c.primary}"/><ellipse cx="50" cy="65" rx="20" ry="25" fill="${c.primary}"/><circle cx="50" cy="50" r="30" fill="none" stroke="${c.secondary}" stroke-width="3"/><path d="M25 70 L15 55" stroke="${c.primary}" stroke-width="4"/><path d="M75 70 L85 55" stroke="${c.primary}" stroke-width="4"/><path d="M30 80 L20 90" stroke="${c.primary}" stroke-width="4"/><path d="M70 80 L80 90" stroke="${c.primary}" stroke-width="4"/></svg>`,
            'ganesha': `<svg viewBox="0 0 100 100"><circle cx="50" cy="45" r="25" fill="${c.primary}"/><ellipse cx="50" cy="80" rx="20" ry="15" fill="${c.primary}"/><path d="M50 55 Q40 70 35 80" stroke="${c.primary}" stroke-width="8" fill="none"/><circle cx="40" cy="40" r="4" fill="${c.bg}"/><circle cx="55" cy="40" r="4" fill="${c.bg}"/><polygon points="35,30 25,15 40,25" fill="${c.primary}"/><polygon points="65,30 75,15 60,25" fill="${c.primary}"/></svg>`,
            'lotus': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="70" rx="8" ry="20" fill="${c.primary}"/><ellipse cx="35" cy="65" rx="8" ry="18" fill="${c.secondary}" transform="rotate(-20 35 65)"/><ellipse cx="65" cy="65" rx="8" ry="18" fill="${c.secondary}" transform="rotate(20 65 65)"/><ellipse cx="25" cy="60" rx="6" ry="15" fill="${c.primary}" transform="rotate(-40 25 60)"/><ellipse cx="75" cy="60" rx="6" ry="15" fill="${c.primary}" transform="rotate(40 75 60)"/><circle cx="50" cy="75" r="8" fill="${c.secondary}"/></svg>`,
            'mughal-dagger': `<svg viewBox="0 0 100 100"><path d="M50 15 Q55 40 50 70" stroke="${c.primary}" stroke-width="6" fill="none"/><path d="M50 70 L45 75 Q50 90 55 75 Z" fill="${c.secondary}"/><ellipse cx="50" cy="78" rx="12" ry="6" fill="${c.secondary}"/></svg>`,
            'elephant': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="55" rx="30" ry="25" fill="${c.primary}"/><circle cx="35" cy="40" r="15" fill="${c.primary}"/><path d="M25 50 Q15 65 20 80" stroke="${c.primary}" stroke-width="8" fill="none"/><circle cx="30" cy="38" r="3" fill="${c.bg}"/><polygon points="22,30 15,20 28,28" fill="${c.primary}"/></svg>`,
            'buddha-head': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="55" rx="25" ry="30" fill="${c.primary}"/><path d="M25 40 Q50 20 75 40" fill="${c.secondary}"/><circle cx="40" cy="50" r="3" fill="${c.bg}"/><circle cx="60" cy="50" r="3" fill="${c.bg}"/><path d="M45 65 Q50 68 55 65" stroke="${c.bg}" stroke-width="2" fill="none"/><circle cx="50" cy="35" r="5" fill="${c.secondary}"/></svg>`,
            'temple-bell': `<svg viewBox="0 0 100 100"><path d="M30 70 Q30 35 50 25 Q70 35 70 70" fill="${c.primary}"/><ellipse cx="50" cy="70" rx="20" ry="8" fill="${c.secondary}"/><rect x="45" y="15" width="10" height="15" fill="${c.secondary}"/><circle cx="50" cy="60" r="5" fill="${c.secondary}"/></svg>`,
            'peacock': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="70" rx="15" ry="20" fill="${c.primary}"/><circle cx="50" cy="45" r="12" fill="${c.primary}"/><path d="M20 30 Q50 10 80 30 Q50 50 20 30" fill="${c.secondary}"/><circle cx="35" cy="25" r="5" fill="${c.primary}"/><circle cx="50" cy="20" r="5" fill="${c.primary}"/><circle cx="65" cy="25" r="5" fill="${c.primary}"/><circle cx="45" cy="43" r="2" fill="${c.bg}"/><circle cx="55" cy="43" r="2" fill="${c.bg}"/></svg>`,
            'om': `<svg viewBox="0 0 100 100"><path d="M30 60 Q25 40 40 35 Q55 30 50 50 Q45 65 55 70 Q70 75 75 55 Q80 35 65 30" stroke="${c.primary}" stroke-width="5" fill="none"/><circle cx="70" cy="25" r="5" fill="${c.primary}"/><path d="M60 20 Q65 15 70 20" stroke="${c.primary}" stroke-width="3" fill="none"/></svg>`,
            'sitar': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="75" rx="20" ry="15" fill="${c.primary}"/><rect x="47" y="20" width="6" height="55" fill="${c.secondary}"/><ellipse cx="50" cy="20" rx="10" ry="8" fill="${c.primary}"/><line x1="45" y1="30" x2="45" y2="70" stroke="${c.primary}" stroke-width="1"/><line x1="50" y1="28" x2="50" y2="70" stroke="${c.primary}" stroke-width="1"/><line x1="55" y1="30" x2="55" y2="70" stroke="${c.primary}" stroke-width="1"/></svg>`,

            // Peru
            'inca-mask': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="30" ry="35" fill="${c.primary}"/><rect x="35" y="35" width="10" height="8" fill="${c.bg}"/><rect x="55" y="35" width="10" height="8" fill="${c.bg}"/><rect x="40" y="60" width="20" height="10" fill="${c.bg}"/><rect x="20" y="40" width="10" height="20" fill="${c.secondary}"/><rect x="70" y="40" width="10" height="20" fill="${c.secondary}"/></svg>`,
            'moche-portrait': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="55" rx="28" ry="35" fill="${c.primary}"/><ellipse cx="42" cy="45" rx="6" ry="5" fill="${c.bg}"/><ellipse cx="58" cy="45" rx="6" ry="5" fill="${c.bg}"/><path d="M40 65 Q50 75 60 65" fill="${c.bg}"/><rect x="30" y="18" width="40" height="15" fill="${c.secondary}"/></svg>`,
            'nazca-bird': `<svg viewBox="0 0 100 100"><path d="M20 50 L50 30 L80 50 L50 45 Z" fill="${c.primary}" stroke="${c.secondary}" stroke-width="2"/><path d="M50 45 L50 80" stroke="${c.primary}" stroke-width="3"/><path d="M50 80 L40 90" stroke="${c.primary}" stroke-width="3"/><path d="M50 80 L60 90" stroke="${c.primary}" stroke-width="3"/><circle cx="45" cy="35" r="3" fill="${c.secondary}"/></svg>`,
            'tumi': `<svg viewBox="0 0 100 100"><path d="M30 40 Q50 20 70 40 L65 80 L35 80 Z" fill="${c.primary}"/><circle cx="50" cy="35" r="12" fill="${c.secondary}"/><circle cx="50" cy="35" r="6" fill="${c.primary}"/><rect x="40" y="80" width="20" height="10" fill="${c.secondary}"/></svg>`,
            'llama': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="60" rx="25" ry="18" fill="${c.primary}"/><path d="M35 60 L35 85" stroke="${c.primary}" stroke-width="6"/><path d="M65 60 L65 85" stroke="${c.primary}" stroke-width="6"/><circle cx="60" cy="40" r="12" fill="${c.primary}"/><polygon points="55,30 50,15 58,28" fill="${c.primary}"/><polygon points="68,32 75,18 70,30" fill="${c.primary}"/><circle cx="58" cy="38" r="2" fill="${c.bg}"/></svg>`,
            'quipu': `<svg viewBox="0 0 100 100"><rect x="20" y="25" width="60" height="8" fill="${c.primary}"/><path d="M30 33 L30 80" stroke="${c.secondary}" stroke-width="3"/><path d="M45 33 L45 70" stroke="${c.primary}" stroke-width="3"/><path d="M60 33 L60 85" stroke="${c.secondary}" stroke-width="3"/><path d="M75 33 L75 65" stroke="${c.primary}" stroke-width="3"/><circle cx="30" cy="50" r="4" fill="${c.primary}"/><circle cx="60" cy="60" r="4" fill="${c.primary}"/></svg>`,
            'wari-textile': `<svg viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" fill="${c.secondary}"/><rect x="25" y="25" width="15" height="15" fill="${c.primary}"/><rect x="42" y="25" width="15" height="15" fill="${c.bg}"/><rect x="59" y="25" width="15" height="15" fill="${c.primary}"/><rect x="25" y="42" width="15" height="15" fill="${c.bg}"/><rect x="42" y="42" width="15" height="15" fill="${c.primary}"/><rect x="59" y="42" width="15" height="15" fill="${c.bg}"/><rect x="25" y="59" width="15" height="15" fill="${c.primary}"/><rect x="42" y="59" width="15" height="15" fill="${c.bg}"/><rect x="59" y="59" width="15" height="15" fill="${c.primary}"/></svg>`,
            'inti': `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="20" fill="${c.primary}"/><line x1="50" y1="10" x2="50" y2="25" stroke="${c.primary}" stroke-width="4"/><line x1="50" y1="75" x2="50" y2="90" stroke="${c.primary}" stroke-width="4"/><line x1="10" y1="50" x2="25" y2="50" stroke="${c.primary}" stroke-width="4"/><line x1="75" y1="50" x2="90" y2="50" stroke="${c.primary}" stroke-width="4"/><line x1="22" y1="22" x2="32" y2="32" stroke="${c.secondary}" stroke-width="3"/><line x1="68" y1="68" x2="78" y2="78" stroke="${c.secondary}" stroke-width="3"/><line x1="78" y1="22" x2="68" y2="32" stroke="${c.secondary}" stroke-width="3"/><line x1="22" y1="78" x2="32" y2="68" stroke="${c.secondary}" stroke-width="3"/></svg>`,
            'moche-vessel': `<svg viewBox="0 0 100 100"><path d="M35 35 Q30 60 35 80 Q50 90 65 80 Q70 60 65 35" fill="${c.primary}"/><ellipse cx="50" cy="35" rx="15" ry="10" fill="${c.secondary}"/><circle cx="50" cy="55" r="10" fill="${c.secondary}"/><circle cx="45" cy="52" r="2" fill="${c.bg}"/><circle cx="55" cy="52" r="2" fill="${c.bg}"/></svg>`,
            'condor': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="10" ry="15" fill="${c.primary}"/><path d="M40 45 L10 55 L15 50 L10 45 L40 50" fill="${c.secondary}"/><path d="M60 45 L90 55 L85 50 L90 45 L60 50" fill="${c.secondary}"/><circle cx="50" cy="38" r="8" fill="${c.primary}"/><circle cx="48" cy="36" r="2" fill="${c.bg}"/><path d="M50 42 L48 48 L52 48 Z" fill="${c.secondary}"/></svg>`,

            // Mesopotamia
            'lamassu': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="65" rx="28" ry="22" fill="${c.primary}"/><circle cx="50" cy="35" r="18" fill="${c.primary}"/><path d="M35 25 L25 10 L40 22" fill="${c.secondary}"/><path d="M65 25 L75 10 L60 22" fill="${c.secondary}"/><rect x="25" y="65" width="8" height="25" fill="${c.primary}"/><rect x="67" y="65" width="8" height="25" fill="${c.primary}"/><circle cx="43" cy="32" r="3" fill="${c.bg}"/><circle cx="57" cy="32" r="3" fill="${c.bg}"/><path d="M75 50 Q90 45 85 60" fill="${c.secondary}"/></svg>`,
            'cuneiform': `<svg viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" fill="${c.secondary}" rx="3"/><path d="M30 35 L45 35 L40 40" fill="${c.primary}"/><path d="M50 35 L65 35 L60 40" fill="${c.primary}"/><path d="M35 50 L50 50 L45 55" fill="${c.primary}"/><path d="M55 50 L70 50 L65 55" fill="${c.primary}"/><path d="M30 65 L45 65 L40 70" fill="${c.primary}"/><path d="M50 65 L65 65 L60 70" fill="${c.primary}"/></svg>`,
            'cylinder-seal': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="25" rx="15" ry="8" fill="${c.primary}"/><rect x="35" y="25" width="30" height="50" fill="${c.secondary}"/><ellipse cx="50" cy="75" rx="15" ry="8" fill="${c.primary}"/><line x1="40" y1="35" x2="40" y2="65" stroke="${c.primary}" stroke-width="2"/><line x1="50" y1="33" x2="50" y2="67" stroke="${c.primary}" stroke-width="2"/><line x1="60" y1="35" x2="60" y2="65" stroke="${c.primary}" stroke-width="2"/></svg>`,
            'ishtar-lion': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="55" rx="30" ry="20" fill="${c.primary}"/><circle cx="35" cy="40" r="15" fill="${c.primary}"/><path d="M25 30 Q35 15 45 30" fill="${c.secondary}"/><circle cx="30" cy="38" r="3" fill="${c.bg}"/><path d="M25 45 Q20 50 25 55" fill="${c.primary}"/><path d="M80 55 Q90 50 85 65" stroke="${c.primary}" stroke-width="5" fill="none"/><rect x="25" y="70" width="8" height="15" fill="${c.primary}"/><rect x="67" y="70" width="8" height="15" fill="${c.primary}"/></svg>`,
            'ziggurat': `<svg viewBox="0 0 100 100"><rect x="15" y="70" width="70" height="15" fill="${c.primary}"/><rect x="22" y="55" width="56" height="15" fill="${c.secondary}"/><rect x="29" y="40" width="42" height="15" fill="${c.primary}"/><rect x="36" y="25" width="28" height="15" fill="${c.secondary}"/><rect x="43" y="15" width="14" height="10" fill="${c.primary}"/></svg>`,
            'hammurabi': `<svg viewBox="0 0 100 100"><rect x="30" y="15" width="40" height="70" fill="${c.secondary}" rx="5"/><path d="M40 25 Q50 20 60 25 L60 35 Q50 40 40 35 Z" fill="${c.primary}"/><line x1="35" y1="45" x2="65" y2="45" stroke="${c.primary}" stroke-width="2"/><line x1="35" y1="52" x2="65" y2="52" stroke="${c.primary}" stroke-width="2"/><line x1="35" y1="59" x2="65" y2="59" stroke="${c.primary}" stroke-width="2"/><line x1="35" y1="66" x2="65" y2="66" stroke="${c.primary}" stroke-width="2"/><line x1="35" y1="73" x2="55" y2="73" stroke="${c.primary}" stroke-width="2"/></svg>`,
            'gilgamesh': `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="70" rx="25" ry="20" fill="${c.primary}"/><circle cx="50" cy="40" r="20" fill="${c.primary}"/><path d="M30 30 Q50 10 70 30" fill="${c.secondary}"/><circle cx="42" cy="38" r="4" fill="${c.bg}"/><circle cx="58" cy="38" r="4" fill="${c.bg}"/><rect x="60" y="55" width="25" height="8" fill="${c.secondary}"/><path d="M45 50 Q50 55 55 50" stroke="${c.secondary}" stroke-width="3" fill="none"/></svg>`,
            'harp': `<svg viewBox="0 0 100 100"><path d="M30 80 L30 30 Q50 15 70 30" stroke="${c.primary}" stroke-width="6" fill="none"/><path d="M70 30 L70 80" stroke="${c.primary}" stroke-width="4"/><line x1="30" y1="40" x2="70" y2="35" stroke="${c.secondary}" stroke-width="1"/><line x1="30" y1="50" x2="70" y2="43" stroke="${c.secondary}" stroke-width="1"/><line x1="30" y1="60" x2="70" y2="52" stroke="${c.secondary}" stroke-width="1"/><line x1="30" y1="70" x2="70" y2="62" stroke="${c.secondary}" stroke-width="1"/><circle cx="70" cy="25" r="8" fill="${c.secondary}"/></svg>`,
            'lion-hunt': `<svg viewBox="0 0 100 100"><rect x="15" y="25" width="70" height="50" fill="${c.secondary}"/><circle cx="35" cy="45" r="12" fill="${c.primary}"/><ellipse cx="35" cy="55" rx="15" ry="10" fill="${c.primary}"/><path d="M60 40 L60 60 M55 45 L65 55 M55 55 L65 45" stroke="${c.primary}" stroke-width="3"/><path d="M70 50 Q80 45 85 55" stroke="${c.primary}" stroke-width="4" fill="none"/></svg>`,
            'shamash': `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="20" fill="${c.primary}"/><path d="M50 15 L55 30 L50 25 L45 30 Z" fill="${c.secondary}"/><path d="M50 85 L55 70 L50 75 L45 70 Z" fill="${c.secondary}"/><path d="M15 50 L30 55 L25 50 L30 45 Z" fill="${c.secondary}"/><path d="M85 50 L70 55 L75 50 L70 45 Z" fill="${c.secondary}"/><path d="M25 25 L38 35 L33 33 L35 38 Z" fill="${c.secondary}"/><path d="M75 75 L62 65 L67 67 L65 62 Z" fill="${c.secondary}"/><path d="M75 25 L62 35 L67 33 L65 38 Z" fill="${c.secondary}"/><path d="M25 75 L38 65 L33 67 L35 62 Z" fill="${c.secondary}"/></svg>`,

            // Generic fallback
            'default': `<svg viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" fill="${c.primary}" rx="10"/><circle cx="50" cy="50" r="20" fill="${c.secondary}"/><text x="50" y="55" text-anchor="middle" fill="${c.bg}" font-size="16">?</text></svg>`
        };

        const svg = svgs[iconType] || svgs['default'];
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }

    /**
     * Fetch from Met Museum API
     */
    async fetchFromAPI(country, count) {
        const queries = this.countryQueries[country];
        if (!queries) throw new Error('Unknown country');

        const randomQuery = queries[Math.floor(Math.random() * queries.length)];
        console.log(`[ArtifactService] Searching: "${randomQuery}"`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
            const searchUrl = `${this.apiBase}/search?hasImages=true&q=${encodeURIComponent(randomQuery)}`;
            const response = await fetch(searchUrl, { signal: controller.signal });
            clearTimeout(timeout);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            if (!data.objectIDs || data.objectIDs.length === 0) {
                throw new Error('No results');
            }

            // Shuffle and pick random
            const shuffled = [...data.objectIDs].sort(() => Math.random() - 0.5);
            const candidates = shuffled.filter(id => !this.usedIds.has(id)).slice(0, count * 2);

            const artifacts = [];
            for (const id of candidates) {
                if (artifacts.length >= count) break;

                try {
                    const detail = await this.fetchArtifactDetail(id);
                    if (detail) {
                        this.usedIds.add(id);
                        artifacts.push(detail);
                    }
                } catch (e) {
                    // Skip
                }
            }

            return artifacts;
        } finally {
            clearTimeout(timeout);
        }
    }

    async fetchArtifactDetail(id) {
        const response = await fetch(`${this.apiBase}/objects/${id}`);
        if (!response.ok) return null;

        const data = await response.json();
        if (!data.primaryImageSmall && !data.primaryImage) return null;

        const originalImage = data.primaryImageSmall || data.primaryImage;

        // Convert: https://images.metmuseum.org/... -> /met-img/...
        let proxiedImage = originalImage;
        try {
            const u = new URL(originalImage);
            proxiedImage = `/met-img${u.pathname}`;
        } catch {}

        return {
            id: data.objectID,
            title: data.title || 'Unknown Artifact',
            period: data.objectDate || 'Ancient',
            culture: data.culture || 'Unknown',
            image: proxiedImage,
            originalImage: originalImage,
            isIcon: false
        };
    }


    reset() {
        this.usedIds.clear();
        this.apiFailCount = 0;
        this.apiAvailable = true;
    }

    getCountries() {
        return Object.keys(this.artifactIcons);
    }

    // Force icon mode (for testing or preference)
    setIconMode(enabled) {
        this.apiAvailable = !enabled;
    }
}

const artifactService = new ArtifactService();
export { ArtifactService, artifactService };