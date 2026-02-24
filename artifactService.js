// ============================================
// ARTIFACT SERVICE v3.0 — Release 1.0.0
// ============================================
// Met Museum API primary → SVG icon fallback
// Supports 28 civilizations with culturally-accurate artifacts

// ============================================
// SVG SHAPE TEMPLATES
// ============================================

const SVG_SHAPES = {
    vase: (p, s, bg) => `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="75" rx="18" ry="8" fill="${s}"/><path d="M35 75 Q32 50 38 35 Q44 25 50 22 Q56 25 62 35 Q68 50 65 75 Z" fill="${p}"/><ellipse cx="50" cy="22" rx="10" ry="5" fill="${s}"/><path d="M40 35 Q50 30 60 35" stroke="${s}" stroke-width="2" fill="none"/><path d="M38 55 Q50 50 62 55" stroke="${s}" stroke-width="1.5" fill="none"/></svg>`,
    coin: (p, s, bg) => `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="${p}" stroke="${s}" stroke-width="4"/><circle cx="50" cy="50" r="28" fill="none" stroke="${s}" stroke-width="2"/><circle cx="50" cy="42" r="10" fill="${s}"/><path d="M42 58 L50 52 L58 58" stroke="${s}" stroke-width="3" fill="none"/><circle cx="30" cy="50" r="3" fill="${s}"/><circle cx="70" cy="50" r="3" fill="${s}"/></svg>`,
    mask: (p, s, bg) => `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="48" rx="30" ry="35" fill="${p}"/><path d="M20 48 Q50 90 80 48" fill="${s}" opacity="0.5"/><ellipse cx="38" cy="40" rx="8" ry="5" fill="${bg}"/><ellipse cx="62" cy="40" rx="8" ry="5" fill="${bg}"/><ellipse cx="38" cy="40" rx="4" ry="3" fill="${s}"/><ellipse cx="62" cy="40" rx="4" ry="3" fill="${s}"/><path d="M45 60 Q50 65 55 60" stroke="${bg}" stroke-width="2.5" fill="none"/><path d="M20 30 Q50 15 80 30" fill="${p}" stroke="${s}" stroke-width="2"/></svg>`,
    sword: (p, s, bg) => `<svg viewBox="0 0 100 100"><rect x="47" y="10" width="6" height="50" fill="#ccc" rx="1"/><polygon points="47,10 50,4 53,10" fill="#ddd"/><rect x="38" y="58" width="24" height="5" fill="${p}" rx="2"/><rect x="46" y="63" width="8" height="18" fill="${s}" rx="2"/><circle cx="50" cy="85" r="5" fill="${p}"/><line x1="50" y1="15" x2="50" y2="55" stroke="#eee" stroke-width="1" opacity="0.5"/></svg>`,
    statue: (p, s, bg) => `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="88" rx="20" ry="5" fill="${s}"/><rect x="40" y="82" width="20" height="6" fill="${s}" rx="1"/><path d="M42 82 L44 55 L56 55 L58 82 Z" fill="${p}"/><circle cx="50" cy="45" r="12" fill="${p}"/><circle cx="46" cy="43" r="2" fill="${bg}"/><circle cx="54" cy="43" r="2" fill="${bg}"/><path d="M30 65 L44 58" stroke="${p}" stroke-width="4" stroke-linecap="round"/><path d="M70 60 L56 58" stroke="${p}" stroke-width="4" stroke-linecap="round"/></svg>`,
    helmet: (p, s, bg) => `<svg viewBox="0 0 100 100"><path d="M25 60 Q25 20 50 15 Q75 20 75 60" fill="${p}"/><rect x="22" y="55" width="56" height="8" fill="${s}" rx="2"/><path d="M48 15 L48 8 Q50 5 52 8 L52 15" fill="${s}"/><path d="M30 45 L40 42 L40 52 L30 55 Z" fill="${bg}" opacity="0.8"/><rect x="33" y="43" width="12" height="2" fill="${s}"/></svg>`,
    shield: (p, s, bg) => `<svg viewBox="0 0 100 100"><path d="M50 10 L80 25 L80 55 Q80 80 50 92 Q20 80 20 55 L20 25 Z" fill="${p}" stroke="${s}" stroke-width="3"/><path d="M50 20 L70 30 L70 52 Q70 72 50 82 Q30 72 30 52 L30 30 Z" fill="${s}" opacity="0.3"/><circle cx="50" cy="50" r="12" fill="${s}"/><circle cx="50" cy="50" r="6" fill="${p}"/></svg>`,
    scroll: (p, s, bg) => `<svg viewBox="0 0 100 100"><rect x="25" y="20" width="50" height="60" fill="#f5e6c8" rx="2"/><ellipse cx="25" cy="20" rx="6" ry="4" fill="${p}"/><ellipse cx="75" cy="20" rx="6" ry="4" fill="${p}"/><ellipse cx="25" cy="80" rx="6" ry="4" fill="${p}"/><ellipse cx="75" cy="80" rx="6" ry="4" fill="${p}"/><line x1="33" y1="32" x2="67" y2="32" stroke="${s}" stroke-width="2"/><line x1="33" y1="42" x2="67" y2="42" stroke="${s}" stroke-width="2"/><line x1="33" y1="52" x2="60" y2="52" stroke="${s}" stroke-width="2"/><line x1="33" y1="62" x2="55" y2="62" stroke="${s}" stroke-width="2"/><circle cx="50" cy="72" r="4" fill="${p}"/></svg>`,
    crown: (p, s, bg) => `<svg viewBox="0 0 100 100"><path d="M20 65 L20 35 L35 50 L50 25 L65 50 L80 35 L80 65 Z" fill="${p}"/><rect x="18" y="62" width="64" height="10" fill="${s}" rx="2"/><circle cx="50" cy="30" r="5" fill="${s}"/><circle cx="35" cy="44" r="4" fill="${s}"/><circle cx="65" cy="44" r="4" fill="${s}"/><rect x="18" y="72" width="64" height="5" fill="${p}" rx="1"/></svg>`,
    jewel: (p, s, bg) => `<svg viewBox="0 0 100 100"><polygon points="50,15 70,35 65,65 35,65 30,35" fill="${p}" stroke="${s}" stroke-width="2"/><polygon points="50,15 60,35 50,30 40,35" fill="${s}" opacity="0.5"/><polygon points="60,35 65,65 50,55" fill="${s}" opacity="0.3"/><line x1="40" y1="35" x2="60" y2="35" stroke="${s}" stroke-width="1"/><line x1="37" y1="50" x2="63" y2="50" stroke="${s}" stroke-width="1"/><path d="M30 80 Q50 90 70 80" stroke="${p}" stroke-width="3" fill="none"/><circle cx="50" cy="82" r="3" fill="${p}"/></svg>`,
    pillar: (p, s, bg) => `<svg viewBox="0 0 100 100"><rect x="35" y="25" width="30" height="55" fill="${p}"/><rect x="30" y="18" width="40" height="8" fill="${s}" rx="2"/><rect x="30" y="79" width="40" height="8" fill="${s}" rx="2"/><rect x="27" y="86" width="46" height="6" fill="${p}" rx="1"/><rect x="27" y="12" width="46" height="6" fill="${p}" rx="1"/><line x1="42" y1="26" x2="42" y2="79" stroke="${s}" stroke-width="1.5" opacity="0.4"/><line x1="50" y1="26" x2="50" y2="79" stroke="${s}" stroke-width="1.5" opacity="0.4"/><line x1="58" y1="26" x2="58" y2="79" stroke="${s}" stroke-width="1.5" opacity="0.4"/></svg>`,
    animal: (p, s, bg) => `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="55" rx="25" ry="18" fill="${p}"/><circle cx="30" cy="40" r="12" fill="${p}"/><circle cx="27" cy="37" r="3" fill="${bg}"/><circle cx="27" cy="37" r="1.5" fill="${s}"/><path d="M22 33 L18 25 L26 30" fill="${s}"/><path d="M34 33 L35 24 L28 30" fill="${s}"/><path d="M75 55 Q85 50 88 55 Q85 60 75 55" fill="${s}"/><line x1="35" y1="72" x2="35" y2="85" stroke="${p}" stroke-width="5"/><line x1="50" y1="72" x2="50" y2="85" stroke="${p}" stroke-width="5"/><line x1="60" y1="70" x2="60" y2="83" stroke="${p}" stroke-width="5"/></svg>`,
    instrument: (p, s, bg) => `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="65" rx="22" ry="18" fill="${p}" stroke="${s}" stroke-width="2"/><ellipse cx="50" cy="65" rx="8" ry="6" fill="${bg}"/><rect x="47" y="15" width="6" height="50" fill="${s}" rx="2"/><rect x="40" y="12" width="20" height="6" fill="${p}" rx="2"/><line x1="42" y1="18" x2="42" y2="48" stroke="${p}" stroke-width="1"/><line x1="50" y1="18" x2="50" y2="48" stroke="${p}" stroke-width="1"/><line x1="58" y1="18" x2="58" y2="48" stroke="${p}" stroke-width="1"/></svg>`,
    chalice: (p, s, bg) => `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="30" rx="22" ry="14" fill="${p}" stroke="${s}" stroke-width="2"/><path d="M35 35 Q40 55 48 60 L48 72 L52 72 L52 60 Q60 55 65 35" fill="${p}"/><ellipse cx="50" cy="30" rx="16" ry="9" fill="${s}" opacity="0.4"/><rect x="38" y="72" width="24" height="4" fill="${s}" rx="1"/><ellipse cx="50" cy="78" rx="16" ry="5" fill="${p}" stroke="${s}" stroke-width="1.5"/></svg>`,
    totem: (p, s, bg) => `<svg viewBox="0 0 100 100"><rect x="35" y="10" width="30" height="80" fill="${p}" rx="4"/><circle cx="50" cy="25" r="10" fill="${s}"/><circle cx="46" cy="23" r="3" fill="${bg}"/><circle cx="54" cy="23" r="3" fill="${bg}"/><path d="M44 30 Q50 36 56 30" stroke="${bg}" stroke-width="2" fill="none"/><rect x="38" y="40" width="24" height="15" fill="${s}" rx="2"/><path d="M38 48 L30 45 L30 52 Z" fill="${s}"/><path d="M62 48 L70 45 L70 52 Z" fill="${s}"/><circle cx="50" cy="68" r="8" fill="${s}"/><path d="M44 68 L50 60 L56 68" fill="${p}"/></svg>`,
    pottery: (p, s, bg) => `<svg viewBox="0 0 100 100"><path d="M30 80 Q28 55 35 40 Q42 30 50 28 Q58 30 65 40 Q72 55 70 80 Z" fill="${p}"/><ellipse cx="50" cy="80" rx="20" ry="6" fill="${s}"/><ellipse cx="50" cy="28" rx="12" ry="6" fill="${p}" stroke="${s}" stroke-width="1.5"/><path d="M35 45 Q50 40 65 45" stroke="${s}" stroke-width="2" fill="none"/><path d="M33 58 Q50 52 67 58" stroke="${s}" stroke-width="2" fill="none"/><path d="M32 70 Q50 64 68 70" stroke="${s}" stroke-width="2" fill="none"/></svg>`,
    temple: (p, s, bg) => `<svg viewBox="0 0 100 100"><polygon points="50,12 82,32 18,32" fill="${s}"/><rect x="20" y="32" width="60" height="5" fill="${p}"/><rect x="25" y="37" width="8" height="38" fill="${p}"/><rect x="40" y="37" width="8" height="38" fill="${p}"/><rect x="55" y="37" width="8" height="38" fill="${p}"/><rect x="67" y="37" width="8" height="38" fill="${p}"/><rect x="18" y="75" width="64" height="8" fill="${s}"/><rect x="15" y="83" width="70" height="5" fill="${p}"/></svg>`,
    textile: (p, s, bg) => `<svg viewBox="0 0 100 100"><rect x="15" y="15" width="70" height="70" fill="${p}" rx="2"/><rect x="18" y="18" width="64" height="64" fill="${bg}" opacity="0.2" rx="1"/><path d="M20 30 L80 30 M20 50 L80 50 M20 70 L80 70" stroke="${s}" stroke-width="2"/><path d="M30 20 L30 80 M50 20 L50 80 M70 20 L70 80" stroke="${s}" stroke-width="2"/><circle cx="30" cy="30" r="4" fill="${s}"/><circle cx="50" cy="50" r="4" fill="${s}"/><circle cx="70" cy="70" r="4" fill="${s}"/><circle cx="70" cy="30" r="4" fill="${p}"/><circle cx="30" cy="70" r="4" fill="${p}"/></svg>`,
    drum: (p, s, bg) => `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="30" rx="28" ry="12" fill="${p}" stroke="${s}" stroke-width="2"/><rect x="22" y="30" width="56" height="35" fill="${p}"/><ellipse cx="50" cy="65" rx="28" ry="12" fill="${s}" stroke="${s}" stroke-width="2"/><ellipse cx="50" cy="30" rx="20" ry="7" fill="${s}" opacity="0.3"/><line x1="22" y1="30" x2="22" y2="65" stroke="${s}" stroke-width="2"/><line x1="78" y1="30" x2="78" y2="65" stroke="${s}" stroke-width="2"/><path d="M28 35 L28 62" stroke="${s}" stroke-width="1.5" stroke-dasharray="4,4"/><path d="M72 35 L72 62" stroke="${s}" stroke-width="1.5" stroke-dasharray="4,4"/></svg>`,
    boat: (p, s, bg) => `<svg viewBox="0 0 100 100"><path d="M15 60 Q20 75 50 78 Q80 75 85 60 Z" fill="${p}" stroke="${s}" stroke-width="2"/><rect x="48" y="25" width="4" height="35" fill="${s}"/><path d="M52 28 L52 55 L72 50 Z" fill="${s}" opacity="0.7"/><path d="M10 65 Q30 58 50 65 Q70 58 90 65" stroke="${s}" stroke-width="2" fill="none" opacity="0.5"/><circle cx="50" cy="67" r="4" fill="${s}"/></svg>`,
};

function generateSVG(shape, primary, secondary, bg) {
    const generator = SVG_SHAPES[shape] || SVG_SHAPES.vase;
    const svg = generator(primary, secondary, bg);
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}


// ============================================
// COUNTRY CONFIGURATIONS
// ============================================

const COUNTRY_DATA = {
    'Egypt': {
        queries: ['Egyptian sculpture', 'Egyptian jewelry', 'Pharaoh', 'Mummy mask', 'Hieroglyphic', 'Scarab', 'Egyptian gold', 'Ankh', 'Egyptian cat statue'],
        colors: { primary: '#D4AF37', secondary: '#8B6914', bg: '#2C1810' },
        artifacts: [
            { id: 'eg1', title: 'Pharaoh Death Mask', period: 'New Kingdom', culture: 'Egyptian', shape: 'mask' },
            { id: 'eg2', title: 'Scarab Amulet', period: 'Middle Kingdom', culture: 'Egyptian', shape: 'jewel' },
            { id: 'eg3', title: 'Canopic Jar', period: 'New Kingdom', culture: 'Egyptian', shape: 'vase' },
            { id: 'eg4', title: 'Eye of Horus Pendant', period: 'Late Period', culture: 'Egyptian', shape: 'jewel' },
            { id: 'eg5', title: 'Sphinx Statuette', period: 'Old Kingdom', culture: 'Egyptian', shape: 'animal' },
            { id: 'eg6', title: 'Hieroglyph Tablet', period: '2500 BC', culture: 'Egyptian', shape: 'scroll' },
            { id: 'eg7', title: 'Bastet Cat Figure', period: 'Late Period', culture: 'Egyptian', shape: 'animal' },
            { id: 'eg8', title: 'Ankh Symbol', period: 'Ancient Egypt', culture: 'Egyptian', shape: 'totem' },
        ]
    },
    'Greece': {
        queries: ['Greek vase', 'Greek sculpture', 'Amphora', 'Greek coin', 'Greek bronze', 'Hellenistic', 'Attic pottery'],
        colors: { primary: '#FFFFFF', secondary: '#1E90FF', bg: '#1A237E' },
        artifacts: [
            { id: 'gr1', title: 'Attic Amphora', period: '5th Century BC', culture: 'Greek', shape: 'vase' },
            { id: 'gr2', title: 'Corinthian Helmet', period: 'Classical', culture: 'Greek', shape: 'helmet' },
            { id: 'gr3', title: 'Laurel Wreath', period: 'Classical', culture: 'Greek', shape: 'crown' },
            { id: 'gr4', title: 'Ionic Column Fragment', period: 'Classical', culture: 'Greek', shape: 'pillar' },
            { id: 'gr5', title: 'Lyre', period: 'Archaic', culture: 'Greek', shape: 'instrument' },
            { id: 'gr6', title: 'Drachma Coin', period: '4th Century BC', culture: 'Greek', shape: 'coin' },
            { id: 'gr7', title: 'Owl of Athena', period: 'Classical', culture: 'Greek', shape: 'animal' },
            { id: 'gr8', title: 'Theater Mask', period: 'Classical', culture: 'Greek', shape: 'mask' },
        ]
    },
    'China': {
        queries: ['Chinese porcelain', 'Chinese jade', 'Ming dynasty', 'Tang dynasty', 'Chinese Buddha', 'Chinese bronze vessel', 'Song dynasty ceramics'],
        colors: { primary: '#FF0000', secondary: '#FFD700', bg: '#8B0000' },
        artifacts: [
            { id: 'ch1', title: 'Ming Dynasty Vase', period: 'Ming Dynasty', culture: 'Chinese', shape: 'vase' },
            { id: 'ch2', title: 'Jade Bi Disc', period: 'Han Dynasty', culture: 'Chinese', shape: 'coin' },
            { id: 'ch3', title: 'Terracotta Warrior', period: 'Qin Dynasty', culture: 'Chinese', shape: 'statue' },
            { id: 'ch4', title: 'Bronze Ritual Bell', period: 'Zhou Dynasty', culture: 'Chinese', shape: 'chalice' },
            { id: 'ch5', title: 'Dragon Figurine', period: 'Tang Dynasty', culture: 'Chinese', shape: 'animal' },
            { id: 'ch6', title: 'Calligraphy Scroll', period: 'Song Dynasty', culture: 'Chinese', shape: 'scroll' },
            { id: 'ch7', title: 'Silk Textile Fragment', period: 'Tang Dynasty', culture: 'Chinese', shape: 'textile' },
            { id: 'ch8', title: 'Buddha Statue', period: 'Tang Dynasty', culture: 'Chinese', shape: 'statue' },
        ]
    },
    'Japan': {
        queries: ['Japanese sword', 'Ukiyo-e print', 'Japanese ceramics', 'Edo period art', 'Noh theater mask', 'Japanese lacquer', 'samurai armor', 'Japanese woodblock'],
        colors: { primary: '#FFFFFF', secondary: '#BC002D', bg: '#2D2D2D' },
        artifacts: [
            { id: 'jp1', title: 'Samurai Kabuto', period: 'Edo Period', culture: 'Japanese', shape: 'helmet' },
            { id: 'jp2', title: 'Katana Blade', period: 'Muromachi', culture: 'Japanese', shape: 'sword' },
            { id: 'jp3', title: 'Noh Theater Mask', period: 'Edo Period', culture: 'Japanese', shape: 'mask' },
            { id: 'jp4', title: 'Raku Tea Bowl', period: 'Momoyama', culture: 'Japanese', shape: 'pottery' },
            { id: 'jp5', title: 'Torii Gate Model', period: 'Traditional', culture: 'Japanese', shape: 'temple' },
            { id: 'jp6', title: 'Daruma Doll', period: 'Edo Period', culture: 'Japanese', shape: 'totem' },
            { id: 'jp7', title: 'Shamisen', period: 'Edo Period', culture: 'Japanese', shape: 'instrument' },
            { id: 'jp8', title: 'Maneki-neko', period: 'Edo Period', culture: 'Japanese', shape: 'animal' },
        ]
    },
    'Mexico': {
        queries: ['Aztec sculpture', 'Maya jade', 'Olmec head', 'Aztec mask', 'Maya ceramic', 'Feathered serpent', 'Mesoamerican art'],
        colors: { primary: '#00A86B', secondary: '#FFD700', bg: '#4A0E0E' },
        artifacts: [
            { id: 'mx1', title: 'Aztec Sun Stone', period: 'Aztec Empire', culture: 'Aztec', shape: 'coin' },
            { id: 'mx2', title: 'Jade Death Mask', period: 'Maya Classic', culture: 'Maya', shape: 'mask' },
            { id: 'mx3', title: 'Quetzalcoatl Head', period: 'Aztec Empire', culture: 'Aztec', shape: 'totem' },
            { id: 'mx4', title: 'Olmec Colossal Head', period: '1500-400 BC', culture: 'Olmec', shape: 'statue' },
            { id: 'mx5', title: 'Eagle Warrior', period: 'Aztec Empire', culture: 'Aztec', shape: 'statue' },
            { id: 'mx6', title: 'Obsidian Blade', period: 'Aztec Empire', culture: 'Aztec', shape: 'sword' },
            { id: 'mx7', title: 'Jaguar Vessel', period: 'Maya Classic', culture: 'Maya', shape: 'pottery' },
            { id: 'mx8', title: 'Maya Calendar Stone', period: 'Maya Classic', culture: 'Maya', shape: 'totem' },
        ]
    },
    'Italy': {
        queries: ['Roman bust', 'Roman coin', 'Roman mosaic', 'Roman glass', 'Pompeii', 'Roman bronze', 'Roman marble'],
        colors: { primary: '#FFD700', secondary: '#8B0000', bg: '#1A1A2E' },
        artifacts: [
            { id: 'rm1', title: 'Centurion Helmet', period: 'Imperial Rome', culture: 'Roman', shape: 'helmet' },
            { id: 'rm2', title: 'Gladius Sword', period: 'Imperial Rome', culture: 'Roman', shape: 'sword' },
            { id: 'rm3', title: 'Laurel Crown', period: 'Roman Republic', culture: 'Roman', shape: 'crown' },
            { id: 'rm4', title: 'Denarius Coin', period: 'Imperial Rome', culture: 'Roman', shape: 'coin' },
            { id: 'rm5', title: 'Eagle Aquila Standard', period: 'Imperial Rome', culture: 'Roman', shape: 'totem' },
            { id: 'rm6', title: 'Legionary Shield', period: 'Imperial Rome', culture: 'Roman', shape: 'shield' },
            { id: 'rm7', title: 'Mosaic Fragment', period: '2nd Century AD', culture: 'Roman', shape: 'textile' },
            { id: 'rm8', title: 'Bust of Caesar', period: 'Roman Republic', culture: 'Roman', shape: 'statue' },
        ]
    },
    'India': {
        queries: ['Hindu deity sculpture', 'Shiva bronze', 'Ganesha statue', 'Mughal art', 'Indian miniature', 'Gupta period', 'Chola bronze'],
        colors: { primary: '#FF9933', secondary: '#138808', bg: '#2E1A47' },
        artifacts: [
            { id: 'in1', title: 'Nataraja Bronze', period: 'Chola Dynasty', culture: 'Indian', shape: 'statue' },
            { id: 'in2', title: 'Ganesha Statue', period: 'Medieval India', culture: 'Indian', shape: 'statue' },
            { id: 'in3', title: 'Mughal Dagger', period: 'Mughal Empire', culture: 'Indian', shape: 'sword' },
            { id: 'in4', title: 'Lotus Ornament', period: 'Traditional', culture: 'Indian', shape: 'jewel' },
            { id: 'in5', title: 'Temple Bell', period: 'Medieval India', culture: 'Indian', shape: 'chalice' },
            { id: 'in6', title: 'Buddha Head', period: 'Gupta Period', culture: 'Indian', shape: 'mask' },
            { id: 'in7', title: 'Peacock Brooch', period: 'Mughal Empire', culture: 'Indian', shape: 'jewel' },
            { id: 'in8', title: 'Sitar', period: 'Mughal Empire', culture: 'Indian', shape: 'instrument' },
        ]
    },
    'Peru': {
        queries: ['Inca gold', 'Moche portrait vessel', 'Nazca pottery', 'Peruvian textile', 'Chimu silver', 'Andean art', 'Wari textile'],
        colors: { primary: '#FFD700', secondary: '#C41E3A', bg: '#3D2914' },
        artifacts: [
            { id: 'pe1', title: 'Inca Gold Mask', period: 'Inca Empire', culture: 'Inca', shape: 'mask' },
            { id: 'pe2', title: 'Moche Portrait Vessel', period: 'Moche Culture', culture: 'Moche', shape: 'vase' },
            { id: 'pe3', title: 'Tumi Ceremonial Knife', period: 'Chimu Culture', culture: 'Chimu', shape: 'sword' },
            { id: 'pe4', title: 'Quipu Knot Record', period: 'Inca Empire', culture: 'Inca', shape: 'textile' },
            { id: 'pe5', title: 'Nazca Lines Bird', period: 'Nazca Culture', culture: 'Nazca', shape: 'animal' },
            { id: 'pe6', title: 'Llama Figurine', period: 'Inca Empire', culture: 'Inca', shape: 'animal' },
            { id: 'pe7', title: 'Sun Disc of Inti', period: 'Inca Empire', culture: 'Inca', shape: 'coin' },
            { id: 'pe8', title: 'Andean Textile', period: 'Wari Culture', culture: 'Wari', shape: 'textile' },
        ]
    },
    'Iraq': {
        queries: ['Assyrian relief', 'Babylonian art', 'Sumerian sculpture', 'Cuneiform tablet', 'Cylinder seal', 'Akkadian', 'Mesopotamian art'],
        colors: { primary: '#C9A227', secondary: '#4A3728', bg: '#1A1410' },
        artifacts: [
            { id: 'ms1', title: 'Lamassu Statue', period: 'Assyrian Empire', culture: 'Assyrian', shape: 'animal' },
            { id: 'ms2', title: 'Cuneiform Tablet', period: 'Sumerian', culture: 'Sumerian', shape: 'scroll' },
            { id: 'ms3', title: 'Cylinder Seal', period: 'Akkadian', culture: 'Akkadian', shape: 'totem' },
            { id: 'ms4', title: 'Ishtar Gate Lion', period: 'Neo-Babylonian', culture: 'Babylonian', shape: 'animal' },
            { id: 'ms5', title: 'Ziggurat Model', period: 'Sumerian', culture: 'Sumerian', shape: 'temple' },
            { id: 'ms6', title: 'Code of Hammurabi', period: 'Old Babylonian', culture: 'Babylonian', shape: 'pillar' },
            { id: 'ms7', title: 'Royal Harp', period: 'Sumerian', culture: 'Sumerian', shape: 'instrument' },
            { id: 'ms8', title: 'Lion Hunt Relief', period: 'Assyrian Empire', culture: 'Assyrian', shape: 'shield' },
        ]
    },
    'France': {
        queries: ['French medieval art', 'French porcelain', 'Limoges enamel', 'French tapestry', 'Gothic sculpture French', 'Versailles art'],
        colors: { primary: '#002395', secondary: '#ED2939', bg: '#F5F0E1' },
        artifacts: [
            { id: 'fr1', title: 'Fleur-de-Lis Crown', period: 'Medieval', culture: 'French', shape: 'crown' },
            { id: 'fr2', title: 'Gothic Cathedral Window', period: '13th Century', culture: 'French', shape: 'shield' },
            { id: 'fr3', title: 'Sevres Porcelain Vase', period: '18th Century', culture: 'French', shape: 'vase' },
            { id: 'fr4', title: 'Crusader Sword', period: 'Medieval', culture: 'French', shape: 'sword' },
            { id: 'fr5', title: 'Bayeux Tapestry Fragment', period: '11th Century', culture: 'Norman', shape: 'textile' },
            { id: 'fr6', title: 'Limoges Enamel Chalice', period: '12th Century', culture: 'French', shape: 'chalice' },
            { id: 'fr7', title: 'Napoleon Medal', period: '19th Century', culture: 'French', shape: 'coin' },
            { id: 'fr8', title: 'Gargoyle Head', period: 'Gothic Period', culture: 'French', shape: 'mask' },
        ]
    },
    'United Kingdom': {
        queries: ['British medieval art', 'Anglo-Saxon jewelry', 'Tudor portrait', 'British silver', 'Celtic art British', 'English pottery'],
        colors: { primary: '#C8102E', secondary: '#012169', bg: '#F0E6D3' },
        artifacts: [
            { id: 'uk1', title: 'Tudor Crown', period: '16th Century', culture: 'English', shape: 'crown' },
            { id: 'uk2', title: 'Anglo-Saxon Brooch', period: '7th Century', culture: 'Anglo-Saxon', shape: 'jewel' },
            { id: 'uk3', title: 'Longbow', period: 'Medieval', culture: 'English', shape: 'sword' },
            { id: 'uk4', title: 'Celtic Torque', period: 'Iron Age', culture: 'Celtic', shape: 'jewel' },
            { id: 'uk5', title: 'Wedgwood Vase', period: '18th Century', culture: 'English', shape: 'vase' },
            { id: 'uk6', title: 'Knight Shield', period: 'Medieval', culture: 'English', shape: 'shield' },
            { id: 'uk7', title: 'Magna Carta Seal', period: '1215 AD', culture: 'English', shape: 'coin' },
            { id: 'uk8', title: 'Stone Circle Fragment', period: 'Neolithic', culture: 'British', shape: 'pillar' },
        ]
    },
    'Spain': {
        queries: ['Spanish colonial art', 'Moorish art Spain', 'Spanish armor', 'Hispano-Moresque', 'Spanish silver', 'Reconquista'],
        colors: { primary: '#AA151B', secondary: '#F1BF00', bg: '#2C1A0E' },
        artifacts: [
            { id: 'es1', title: 'Conquistador Helmet', period: '16th Century', culture: 'Spanish', shape: 'helmet' },
            { id: 'es2', title: 'Moorish Tile Pattern', period: 'Al-Andalus', culture: 'Moorish', shape: 'textile' },
            { id: 'es3', title: 'Toledo Steel Sword', period: 'Medieval', culture: 'Spanish', shape: 'sword' },
            { id: 'es4', title: 'Hispano-Moresque Plate', period: '15th Century', culture: 'Spanish', shape: 'pottery' },
            { id: 'es5', title: 'Bull Figurine', period: 'Traditional', culture: 'Spanish', shape: 'animal' },
            { id: 'es6', title: 'Royal Doubloon', period: 'Colonial Era', culture: 'Spanish', shape: 'coin' },
            { id: 'es7', title: 'Flamenco Castanets', period: 'Traditional', culture: 'Spanish', shape: 'instrument' },
            { id: 'es8', title: 'Reconquista Shield', period: 'Medieval', culture: 'Spanish', shape: 'shield' },
        ]
    },
    'Germany': {
        queries: ['German medieval art', 'Meissen porcelain', 'German armor', 'Holy Roman Empire', 'German silver'],
        colors: { primary: '#FFCC00', secondary: '#000000', bg: '#DD0000' },
        artifacts: [
            { id: 'de1', title: 'Teutonic Knight Helmet', period: 'Medieval', culture: 'German', shape: 'helmet' },
            { id: 'de2', title: 'Meissen Porcelain Stein', period: '18th Century', culture: 'German', shape: 'chalice' },
            { id: 'de3', title: 'Gutenberg Printing Block', period: '15th Century', culture: 'German', shape: 'scroll' },
            { id: 'de4', title: 'Imperial Eagle Emblem', period: 'Holy Roman Empire', culture: 'German', shape: 'shield' },
            { id: 'de5', title: 'Hanseatic Trade Coin', period: 'Medieval', culture: 'German', shape: 'coin' },
            { id: 'de6', title: 'Zweihander Sword', period: '16th Century', culture: 'German', shape: 'sword' },
            { id: 'de7', title: 'Imperial Crown', period: 'Holy Roman Empire', culture: 'German', shape: 'crown' },
            { id: 'de8', title: 'Cuckoo Clock Figurine', period: '18th Century', culture: 'German', shape: 'totem' },
        ]
    },
    'Turkey': {
        queries: ['Ottoman art', 'Turkish ceramics', 'Iznik pottery', 'Ottoman jewelry', 'Turkish calligraphy', 'Seljuk art'],
        colors: { primary: '#E30A17', secondary: '#FFFFFF', bg: '#1A0A0A' },
        artifacts: [
            { id: 'tr1', title: 'Ottoman Sultan Turban', period: 'Ottoman Empire', culture: 'Ottoman', shape: 'crown' },
            { id: 'tr2', title: 'Iznik Ceramic Tile', period: '16th Century', culture: 'Ottoman', shape: 'textile' },
            { id: 'tr3', title: 'Janissary Kilij Sword', period: 'Ottoman Empire', culture: 'Ottoman', shape: 'sword' },
            { id: 'tr4', title: 'Turkish Coffee Pot', period: '17th Century', culture: 'Ottoman', shape: 'vase' },
            { id: 'tr5', title: 'Calligraphy Scroll', period: 'Ottoman Empire', culture: 'Ottoman', shape: 'scroll' },
            { id: 'tr6', title: 'Seljuk Lion Statue', period: 'Seljuk Period', culture: 'Seljuk', shape: 'animal' },
            { id: 'tr7', title: 'Whirling Dervish Figure', period: 'Ottoman Empire', culture: 'Ottoman', shape: 'statue' },
            { id: 'tr8', title: 'Ottoman Coin', period: '18th Century', culture: 'Ottoman', shape: 'coin' },
        ]
    },
    'Iran': {
        queries: ['Persian art', 'Achaemenid gold', 'Safavid art', 'Persian carpet', 'Iranian ceramic', 'Persepolis', 'Persian miniature'],
        colors: { primary: '#239F40', secondary: '#DA0000', bg: '#1A1A2E' },
        artifacts: [
            { id: 'ir1', title: 'Persepolis Griffin', period: 'Achaemenid', culture: 'Persian', shape: 'animal' },
            { id: 'ir2', title: 'Persian Carpet Fragment', period: 'Safavid', culture: 'Persian', shape: 'textile' },
            { id: 'ir3', title: 'Immortal Guard Shield', period: 'Achaemenid', culture: 'Persian', shape: 'shield' },
            { id: 'ir4', title: 'Rhyton Drinking Horn', period: 'Achaemenid', culture: 'Persian', shape: 'chalice' },
            { id: 'ir5', title: 'Persian Miniature Painting', period: 'Safavid', culture: 'Persian', shape: 'scroll' },
            { id: 'ir6', title: 'Daric Gold Coin', period: 'Achaemenid', culture: 'Persian', shape: 'coin' },
            { id: 'ir7', title: 'Shamshir Sword', period: 'Safavid', culture: 'Persian', shape: 'sword' },
            { id: 'ir8', title: 'Ceramic Starplate', period: '12th Century', culture: 'Persian', shape: 'pottery' },
        ]
    },
    'Morocco': {
        queries: ['Moroccan art', 'Berber jewelry', 'Moroccan ceramic', 'Islamic art Morocco', 'Fez pottery', 'Moorish art'],
        colors: { primary: '#C1272D', secondary: '#006233', bg: '#1A120E' },
        artifacts: [
            { id: 'ma1', title: 'Berber Silver Fibula', period: 'Traditional', culture: 'Berber', shape: 'jewel' },
            { id: 'ma2', title: 'Zellige Tile Mosaic', period: 'Medieval', culture: 'Moroccan', shape: 'textile' },
            { id: 'ma3', title: 'Moroccan Tea Pot', period: 'Traditional', culture: 'Moroccan', shape: 'vase' },
            { id: 'ma4', title: 'Berber Tribal Mask', period: 'Traditional', culture: 'Berber', shape: 'mask' },
            { id: 'ma5', title: 'Khamsa Hand Amulet', period: 'Traditional', culture: 'Moroccan', shape: 'totem' },
            { id: 'ma6', title: 'Fez Ceramic Bowl', period: 'Medieval', culture: 'Moroccan', shape: 'pottery' },
            { id: 'ma7', title: 'Minaret Model', period: 'Medieval', culture: 'Moroccan', shape: 'temple' },
            { id: 'ma8', title: 'Amazigh Drum', period: 'Traditional', culture: 'Berber', shape: 'drum' },
        ]
    },
    'South Korea': {
        queries: ['Korean ceramics', 'Goryeo celadon', 'Korean art', 'Joseon dynasty', 'Korean bronze', 'Korean Buddhist art'],
        colors: { primary: '#FFFFFF', secondary: '#003478', bg: '#CD2E3A' },
        artifacts: [
            { id: 'kr1', title: 'Goryeo Celadon Vase', period: 'Goryeo Dynasty', culture: 'Korean', shape: 'vase' },
            { id: 'kr2', title: 'Joseon Royal Crown', period: 'Joseon Dynasty', culture: 'Korean', shape: 'crown' },
            { id: 'kr3', title: 'Silla Gold Earrings', period: 'Silla Kingdom', culture: 'Korean', shape: 'jewel' },
            { id: 'kr4', title: 'Hwarang Sword', period: 'Silla Kingdom', culture: 'Korean', shape: 'sword' },
            { id: 'kr5', title: 'Buddhist Temple Bell', period: 'Goryeo Dynasty', culture: 'Korean', shape: 'chalice' },
            { id: 'kr6', title: 'Gayageum Instrument', period: 'Joseon Dynasty', culture: 'Korean', shape: 'instrument' },
            { id: 'kr7', title: 'Turtle Ship Model', period: 'Joseon Dynasty', culture: 'Korean', shape: 'boat' },
            { id: 'kr8', title: 'White Porcelain Moon Jar', period: 'Joseon Dynasty', culture: 'Korean', shape: 'pottery' },
        ]
    },
    'Thailand': {
        queries: ['Thai Buddha', 'Thai art', 'Sukhothai sculpture', 'Thai ceramics', 'Ayutthaya art'],
        colors: { primary: '#FFD700', secondary: '#A51931', bg: '#0D1E47' },
        artifacts: [
            { id: 'th1', title: 'Sukhothai Buddha Head', period: 'Sukhothai Period', culture: 'Thai', shape: 'mask' },
            { id: 'th2', title: 'Ayutthaya Gold Crown', period: 'Ayutthaya Kingdom', culture: 'Thai', shape: 'crown' },
            { id: 'th3', title: 'Naga Serpent Figure', period: 'Traditional', culture: 'Thai', shape: 'animal' },
            { id: 'th4', title: 'Celadon Elephant', period: 'Sukhothai Period', culture: 'Thai', shape: 'animal' },
            { id: 'th5', title: 'Thai Temple Finial', period: 'Rattanakosin', culture: 'Thai', shape: 'temple' },
            { id: 'th6', title: 'Khon Dance Mask', period: 'Traditional', culture: 'Thai', shape: 'mask' },
            { id: 'th7', title: 'Sawankhalok Pottery', period: 'Sukhothai', culture: 'Thai', shape: 'pottery' },
            { id: 'th8', title: 'Spirit House Model', period: 'Traditional', culture: 'Thai', shape: 'temple' },
        ]
    },
    'Cambodia': {
        queries: ['Khmer sculpture', 'Angkor Wat', 'Cambodian art', 'Khmer bronze', 'Angkor relief'],
        colors: { primary: '#032EA1', secondary: '#E00025', bg: '#1A1410' },
        artifacts: [
            { id: 'kh1', title: 'Angkor Wat Apsara', period: 'Angkor Period', culture: 'Khmer', shape: 'statue' },
            { id: 'kh2', title: 'Khmer Naga Head', period: 'Angkor Period', culture: 'Khmer', shape: 'animal' },
            { id: 'kh3', title: 'Bayon Face Tower', period: 'Angkor Period', culture: 'Khmer', shape: 'mask' },
            { id: 'kh4', title: 'Vishnu Bronze', period: 'Pre-Angkor', culture: 'Khmer', shape: 'statue' },
            { id: 'kh5', title: 'Khmer Lion Guardian', period: 'Angkor Period', culture: 'Khmer', shape: 'animal' },
            { id: 'kh6', title: 'Temple Pediment', period: 'Angkor Period', culture: 'Khmer', shape: 'temple' },
            { id: 'kh7', title: 'Khmer Linga Shrine', period: 'Angkor Period', culture: 'Khmer', shape: 'pillar' },
            { id: 'kh8', title: 'Stoneware Vessel', period: 'Angkor Period', culture: 'Khmer', shape: 'vase' },
        ]
    },
    'Indonesia': {
        queries: ['Indonesian art', 'Javanese sculpture', 'Balinese art', 'Borobudur', 'Indonesian textile', 'wayang puppet'],
        colors: { primary: '#CE1126', secondary: '#FFFFFF', bg: '#1A2E0A' },
        artifacts: [
            { id: 'id1', title: 'Borobudur Buddha', period: '9th Century', culture: 'Javanese', shape: 'statue' },
            { id: 'id2', title: 'Wayang Puppet', period: 'Traditional', culture: 'Javanese', shape: 'totem' },
            { id: 'id3', title: 'Batik Textile', period: 'Traditional', culture: 'Indonesian', shape: 'textile' },
            { id: 'id4', title: 'Keris Dagger', period: 'Majapahit', culture: 'Javanese', shape: 'sword' },
            { id: 'id5', title: 'Barong Mask', period: 'Traditional', culture: 'Balinese', shape: 'mask' },
            { id: 'id6', title: 'Gamelan Gong', period: 'Traditional', culture: 'Javanese', shape: 'drum' },
            { id: 'id7', title: 'Garuda Statue', period: 'Majapahit', culture: 'Javanese', shape: 'animal' },
            { id: 'id8', title: 'Prambanan Relief', period: '9th Century', culture: 'Javanese', shape: 'scroll' },
        ]
    },
    'Nigeria': {
        queries: ['Nigerian art', 'Benin bronze', 'Nok sculpture', 'Yoruba art', 'Igbo art', 'Nigerian mask'],
        colors: { primary: '#008751', secondary: '#FFFFFF', bg: '#1A0E00' },
        artifacts: [
            { id: 'ng1', title: 'Benin Bronze Head', period: 'Benin Kingdom', culture: 'Edo', shape: 'mask' },
            { id: 'ng2', title: 'Nok Terracotta', period: '500 BC', culture: 'Nok', shape: 'statue' },
            { id: 'ng3', title: 'Yoruba Gelede Mask', period: 'Traditional', culture: 'Yoruba', shape: 'mask' },
            { id: 'ng4', title: 'Igbo Ukwu Bronze', period: '9th Century', culture: 'Igbo', shape: 'chalice' },
            { id: 'ng5', title: 'Benin Leopard', period: 'Benin Kingdom', culture: 'Edo', shape: 'animal' },
            { id: 'ng6', title: 'Talking Drum', period: 'Traditional', culture: 'Yoruba', shape: 'drum' },
            { id: 'ng7', title: 'Ife Bronze Head', period: '12th Century', culture: 'Yoruba', shape: 'statue' },
            { id: 'ng8', title: 'Adire Textile', period: 'Traditional', culture: 'Yoruba', shape: 'textile' },
        ]
    },
    'Ethiopia': {
        queries: ['Ethiopian art', 'Aksumite art', 'Ethiopian cross', 'Lalibela', 'Ethiopian manuscript', 'Coptic art Ethiopia'],
        colors: { primary: '#009739', secondary: '#FCDD09', bg: '#DA121A' },
        artifacts: [
            { id: 'et1', title: 'Aksumite Obelisk', period: 'Aksumite Empire', culture: 'Aksumite', shape: 'pillar' },
            { id: 'et2', title: 'Processional Cross', period: 'Medieval', culture: 'Ethiopian', shape: 'totem' },
            { id: 'et3', title: 'Lalibela Church Model', period: '12th Century', culture: 'Ethiopian', shape: 'temple' },
            { id: 'et4', title: 'Geez Prayer Scroll', period: 'Medieval', culture: 'Ethiopian', shape: 'scroll' },
            { id: 'et5', title: 'Queen of Sheba Coin', period: 'Aksumite Empire', culture: 'Aksumite', shape: 'coin' },
            { id: 'et6', title: 'Coffee Jebena Pot', period: 'Traditional', culture: 'Ethiopian', shape: 'vase' },
            { id: 'et7', title: 'Lion of Judah Statue', period: 'Solomonic Dynasty', culture: 'Ethiopian', shape: 'animal' },
            { id: 'et8', title: 'Meskel Drum', period: 'Traditional', culture: 'Ethiopian', shape: 'drum' },
        ]
    },
    'Russia': {
        queries: ['Russian art', 'Faberge', 'Russian icon painting', 'Scythian gold', 'Russian silver', 'Imperial Russia art'],
        colors: { primary: '#FFFFFF', secondary: '#0039A6', bg: '#D52B1E' },
        artifacts: [
            { id: 'ru1', title: 'Faberge Egg', period: 'Imperial Russia', culture: 'Russian', shape: 'jewel' },
            { id: 'ru2', title: 'Scythian Gold Comb', period: '4th Century BC', culture: 'Scythian', shape: 'crown' },
            { id: 'ru3', title: 'Orthodox Icon Panel', period: 'Medieval', culture: 'Russian', shape: 'scroll' },
            { id: 'ru4', title: 'Matryoshka Doll', period: '19th Century', culture: 'Russian', shape: 'totem' },
            { id: 'ru5', title: 'Imperial Samovar', period: '19th Century', culture: 'Russian', shape: 'chalice' },
            { id: 'ru6', title: 'Cossack Shashka Saber', period: '18th Century', culture: 'Russian', shape: 'sword' },
            { id: 'ru7', title: 'Onion Dome Model', period: 'Medieval', culture: 'Russian', shape: 'temple' },
            { id: 'ru8', title: 'Imperial Ruble', period: 'Imperial Russia', culture: 'Russian', shape: 'coin' },
        ]
    },
    'Ireland': {
        queries: ['Irish art', 'Celtic jewelry', 'Irish gold', 'Book of Kells', 'Irish bronze age', 'Celtic Irish art'],
        colors: { primary: '#169B62', secondary: '#FF883E', bg: '#1A2E1A' },
        artifacts: [
            { id: 'ie1', title: 'Celtic Gold Torque', period: 'Iron Age', culture: 'Celtic', shape: 'jewel' },
            { id: 'ie2', title: 'Book of Kells Page', period: '9th Century', culture: 'Irish', shape: 'scroll' },
            { id: 'ie3', title: 'Celtic Cross', period: 'Early Medieval', culture: 'Irish', shape: 'totem' },
            { id: 'ie4', title: 'Tara Brooch', period: '8th Century', culture: 'Irish', shape: 'jewel' },
            { id: 'ie5', title: 'Ardagh Chalice', period: '8th Century', culture: 'Irish', shape: 'chalice' },
            { id: 'ie6', title: 'Newgrange Spiral Stone', period: 'Neolithic', culture: 'Irish', shape: 'pillar' },
            { id: 'ie7', title: 'Irish War Horn', period: 'Bronze Age', culture: 'Irish', shape: 'instrument' },
            { id: 'ie8', title: 'Claddagh Ring', period: '17th Century', culture: 'Irish', shape: 'jewel' },
        ]
    },
    'Netherlands': {
        queries: ['Dutch golden age', 'Delft pottery', 'Dutch art', 'Netherlands art', 'Dutch silver'],
        colors: { primary: '#AE1C28', secondary: '#21468B', bg: '#F5E6C8' },
        artifacts: [
            { id: 'nl1', title: 'Delft Blue Tile', period: '17th Century', culture: 'Dutch', shape: 'textile' },
            { id: 'nl2', title: 'VOC Trade Coin', period: 'Golden Age', culture: 'Dutch', shape: 'coin' },
            { id: 'nl3', title: 'Golden Age Chalice', period: '17th Century', culture: 'Dutch', shape: 'chalice' },
            { id: 'nl4', title: 'Dutch Ship Model', period: 'Golden Age', culture: 'Dutch', shape: 'boat' },
            { id: 'nl5', title: 'Delft Vase', period: '17th Century', culture: 'Dutch', shape: 'vase' },
            { id: 'nl6', title: 'Windmill Figurine', period: '18th Century', culture: 'Dutch', shape: 'temple' },
            { id: 'nl7', title: 'Tulip Mania Medal', period: '1637', culture: 'Dutch', shape: 'coin' },
            { id: 'nl8', title: 'Dutch Master Frame', period: 'Golden Age', culture: 'Dutch', shape: 'scroll' },
        ]
    },
    'Colombia': {
        queries: ['Colombian gold', 'Muisca art', 'Quimbaya gold', 'pre-Columbian Colombia', 'Tairona art'],
        colors: { primary: '#FCD116', secondary: '#003893', bg: '#CE1126' },
        artifacts: [
            { id: 'co1', title: 'Muisca Gold Raft', period: 'Muisca Period', culture: 'Muisca', shape: 'boat' },
            { id: 'co2', title: 'Quimbaya Gold Figure', period: 'Quimbaya Culture', culture: 'Quimbaya', shape: 'statue' },
            { id: 'co3', title: 'Tairona Gold Pendant', period: 'Tairona Culture', culture: 'Tairona', shape: 'jewel' },
            { id: 'co4', title: 'San Agustin Statue', period: '1st Century AD', culture: 'San Agustin', shape: 'statue' },
            { id: 'co5', title: 'Poporo Lime Container', period: 'Quimbaya Culture', culture: 'Quimbaya', shape: 'vase' },
            { id: 'co6', title: 'Calima Gold Mask', period: 'Calima Culture', culture: 'Calima', shape: 'mask' },
            { id: 'co7', title: 'Tierradentro Urn', period: '6th Century', culture: 'Tierradentro', shape: 'pottery' },
            { id: 'co8', title: 'Tumaco Figurine', period: 'Tumaco Culture', culture: 'Tumaco', shape: 'totem' },
        ]
    },
    'Brazil': {
        queries: ['Brazilian indigenous art', 'Marajoara pottery', 'Tupi art', 'Brazilian colonial art', 'Amazonian art'],
        colors: { primary: '#009C3B', secondary: '#FFDF00', bg: '#002776' },
        artifacts: [
            { id: 'br1', title: 'Marajoara Urn', period: 'Marajoara Culture', culture: 'Marajoara', shape: 'vase' },
            { id: 'br2', title: 'Tupi Feather Headdress', period: 'Pre-Colonial', culture: 'Tupi', shape: 'crown' },
            { id: 'br3', title: 'Amazonian War Club', period: 'Pre-Colonial', culture: 'Indigenous', shape: 'sword' },
            { id: 'br4', title: 'Muiraquita Amulet', period: 'Pre-Colonial', culture: 'Amazonian', shape: 'jewel' },
            { id: 'br5', title: 'Santarem Pottery', period: 'Tapajos Culture', culture: 'Tapajos', shape: 'pottery' },
            { id: 'br6', title: 'Tupi Body Paint Pattern', period: 'Pre-Colonial', culture: 'Tupi', shape: 'textile' },
            { id: 'br7', title: 'Kayapo Mask', period: 'Traditional', culture: 'Kayapo', shape: 'mask' },
            { id: 'br8', title: 'Maraca Funerary Urn', period: 'Pre-Colonial', culture: 'Maraca', shape: 'totem' },
        ]
    },
    'United States': {
        queries: ['Native American art', 'Navajo weaving', 'Pueblo pottery', 'Plains Indian art', 'American folk art'],
        colors: { primary: '#3C3B6E', secondary: '#B22234', bg: '#F5E6C8' },
        artifacts: [
            { id: 'us1', title: 'Navajo Turquoise Necklace', period: 'Traditional', culture: 'Navajo', shape: 'jewel' },
            { id: 'us2', title: 'Pueblo Pottery', period: 'Traditional', culture: 'Pueblo', shape: 'pottery' },
            { id: 'us3', title: 'Plains War Bonnet', period: '19th Century', culture: 'Lakota', shape: 'crown' },
            { id: 'us4', title: 'Totem Pole Fragment', period: 'Traditional', culture: 'Pacific NW', shape: 'totem' },
            { id: 'us5', title: 'Clovis Point Arrowhead', period: '11000 BC', culture: 'Paleo-Indian', shape: 'sword' },
            { id: 'us6', title: 'Kachina Doll', period: 'Traditional', culture: 'Hopi', shape: 'statue' },
            { id: 'us7', title: 'Shell Gorget', period: 'Mississippian', culture: 'Mississippian', shape: 'coin' },
            { id: 'us8', title: 'Navajo Rug', period: 'Traditional', culture: 'Navajo', shape: 'textile' },
        ]
    },
    'Australia': {
        queries: ['Aboriginal art', 'Australian indigenous art', 'bark painting', 'Oceanic art Australia'],
        colors: { primary: '#D2691E', secondary: '#FFD700', bg: '#2C1810' },
        artifacts: [
            { id: 'au1', title: 'Aboriginal Dot Painting', period: 'Traditional', culture: 'Aboriginal', shape: 'textile' },
            { id: 'au2', title: 'Boomerang', period: 'Traditional', culture: 'Aboriginal', shape: 'sword' },
            { id: 'au3', title: 'Didgeridoo', period: 'Traditional', culture: 'Aboriginal', shape: 'instrument' },
            { id: 'au4', title: 'Bark Shield', period: 'Traditional', culture: 'Aboriginal', shape: 'shield' },
            { id: 'au5', title: 'Churinga Stone', period: 'Traditional', culture: 'Aboriginal', shape: 'coin' },
            { id: 'au6', title: 'Wandjina Spirit Mask', period: 'Traditional', culture: 'Aboriginal', shape: 'mask' },
            { id: 'au7', title: 'Message Stick', period: 'Traditional', culture: 'Aboriginal', shape: 'totem' },
            { id: 'au8', title: 'Rock Art Panel', period: '20000+ BC', culture: 'Aboriginal', shape: 'scroll' },
        ]
    },
    // ── Scandinavia ──
    'Norway': {
        queries: ['Viking ship', 'Norwegian stave church', 'Viking sword Norway', 'Oseberg ship', 'Norse brooch', 'Viking age Norway'],
        colors: { primary: '#C0C0C0', secondary: '#002868', bg: '#1A1A2E' },
        artifacts: [
            { id: 'no1', title: 'Oseberg Ship Prow', period: '9th Century AD', culture: 'Norse', shape: 'boat' },
            { id: 'no2', title: 'Viking Sword', period: '9th Century AD', culture: 'Norse', shape: 'sword' },
            { id: 'no3', title: 'Rune Stone', period: '10th Century AD', culture: 'Norse', shape: 'scroll' },
            { id: 'no4', title: 'Stave Church Carving', period: '12th Century AD', culture: 'Norse', shape: 'temple' },
            { id: 'no5', title: 'Tortoise Brooch', period: '9th Century AD', culture: 'Norse', shape: 'jewel' },
            { id: 'no6', title: 'Iron Helmet', period: '10th Century AD', culture: 'Norse', shape: 'helmet' },
            { id: 'no7', title: 'Drinking Horn', period: '9th Century AD', culture: 'Norse', shape: 'chalice' },
            { id: 'no8', title: 'Whalebone Plaque', period: '8th Century AD', culture: 'Norse', shape: 'textile' },
        ]
    },
    'Sweden': {
        queries: ['Vendel helmet', 'Swedish rune stone', 'Gotland picture stone', 'Swedish Viking art', 'Birka artifact', 'Swedish gold bracteate'],
        colors: { primary: '#FECC02', secondary: '#006AA7', bg: '#1A2040' },
        artifacts: [
            { id: 'se1', title: 'Vendel Helmet', period: '7th Century AD', culture: 'Swedish', shape: 'helmet' },
            { id: 'se2', title: 'Gotland Picture Stone', period: '5th Century AD', culture: 'Swedish', shape: 'scroll' },
            { id: 'se3', title: 'Gold Bracteate', period: '6th Century AD', culture: 'Swedish', shape: 'coin' },
            { id: 'se4', title: 'Birka Trade Weight', period: '9th Century AD', culture: 'Swedish', shape: 'jewel' },
            { id: 'se5', title: 'Valsgärde Shield', period: '7th Century AD', culture: 'Swedish', shape: 'shield' },
            { id: 'se6', title: 'Rock Carving Panel', period: '1500 BC', culture: 'Swedish', shape: 'textile' },
            { id: 'se7', title: 'Bronze Lur', period: '800 BC', culture: 'Swedish', shape: 'instrument' },
            { id: 'se8', title: 'Uppland Rune Stone', period: '11th Century AD', culture: 'Swedish', shape: 'totem' },
        ]
    },
    'Denmark': {
        queries: ['Jelling stone', 'Danish Viking art', 'Gundestrup cauldron', 'Danish bronze age', 'Sun chariot Denmark', 'Danish bog find'],
        colors: { primary: '#C8102E', secondary: '#FFFFFF', bg: '#2A1520' },
        artifacts: [
            { id: 'dk1', title: 'Jelling Rune Stone', period: '10th Century AD', culture: 'Danish', shape: 'scroll' },
            { id: 'dk2', title: 'Gundestrup Cauldron', period: '1st Century BC', culture: 'Danish', shape: 'chalice' },
            { id: 'dk3', title: 'Sun Chariot', period: '1400 BC', culture: 'Danish', shape: 'boat' },
            { id: 'dk4', title: 'Golden Horns of Gallehus', period: '5th Century AD', culture: 'Danish', shape: 'instrument' },
            { id: 'dk5', title: 'Tollund Man Rope', period: '4th Century BC', culture: 'Danish', shape: 'textile' },
            { id: 'dk6', title: 'Mammen Axe', period: '10th Century AD', culture: 'Danish', shape: 'sword' },
            { id: 'dk7', title: 'Bronze Age Razor', period: '1300 BC', culture: 'Danish', shape: 'coin' },
            { id: 'dk8', title: 'Trundholm Disc', period: '1400 BC', culture: 'Danish', shape: 'shield' },
        ]
    },
};


// ============================================
// ARTIFACT SERVICE CLASS
// ============================================

class ArtifactService {
    constructor() {
        this.apiBase = 'https://collectionapi.metmuseum.org/public/collection/v1';
        this.usedIds = new Set();
        this.apiAvailable = true;
        this.apiFailCount = 0;
    }

    async getArtifacts(country, count = 5, preferIcons = true) {
        if (preferIcons || !this.apiAvailable) {
            return this.getIconArtifacts(country, count);
        }

        try {
            const artifacts = await this.fetchFromAPI(country, count);
            if (artifacts && artifacts.length >= count) {
                this.apiFailCount = 0;
                return artifacts;
            }
        } catch (error) {
            console.warn('[ArtifactService] API error:', error.message);
            this.apiFailCount++;
            if (this.apiFailCount >= 3) {
                console.log('[ArtifactService] Switching to icon mode after repeated failures');
                this.apiAvailable = false;
            }
        }

        return this.getIconArtifacts(country, count);
    }

    getIconArtifacts(country, count) {
        const config = COUNTRY_DATA[country];
        if (!config) {
            console.warn(`[ArtifactService] Unknown country: ${country}, using generic fallback`);
            return this.getGenericArtifacts(country, count);
        }

        const icons = config.artifacts;
        let available = icons.filter(a => !this.usedIds.has(a.id));

        if (available.length < count) {
            icons.forEach(a => this.usedIds.delete(a.id));
            available = [...icons];
        }

        for (let i = available.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [available[i], available[j]] = [available[j], available[i]];
        }

        const selected = available.slice(0, count);
        selected.forEach(a => this.usedIds.add(a.id));

        const { primary, secondary, bg } = config.colors;
        return selected.map(artifact => ({
            ...artifact,
            image: generateSVG(artifact.shape, primary, secondary, bg),
            isIcon: true
        }));
    }

    getGenericArtifacts(country, count) {
        const shapes = ['vase', 'coin', 'mask', 'sword', 'statue', 'scroll', 'jewel', 'pottery'];
        const artifacts = [];
        for (let i = 0; i < count; i++) {
            artifacts.push({
                id: `gen_${country}_${i}`,
                title: `Ancient ${country} Artifact ${i + 1}`,
                period: 'Ancient',
                culture: country,
                image: generateSVG(shapes[i % shapes.length], '#C9A227', '#4A3728', '#1A1410'),
                isIcon: true
            });
        }
        return artifacts;
    }

    async fetchFromAPI(country, count) {
        const config = COUNTRY_DATA[country];
        if (!config || !config.queries) throw new Error('No queries for country');

        const queries = config.queries;
        const randomQuery = queries[Math.floor(Math.random() * queries.length)];
        // Log removed (leaks query)

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
            const searchUrl = `${this.apiBase}/search?hasImages=true&q=${encodeURIComponent(randomQuery)}`;
            const response = await fetch(searchUrl, { signal: controller.signal });
            clearTimeout(timeout);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            if (!data.objectIDs || data.objectIDs.length === 0) throw new Error('No results');

            const shuffled = [...data.objectIDs].sort(() => Math.random() - 0.5);
            const candidates = shuffled.filter(id => !this.usedIds.has(id)).slice(0, count * 3);

            const artifacts = [];
            for (const id of candidates) {
                if (artifacts.length >= count) break;
                try {
                    const detail = await this.fetchArtifactDetail(id);
                    if (detail) {
                        this.usedIds.add(id);
                        artifacts.push(detail);
                    }
                } catch (e) { /* skip */ }
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
            originalImage,
            isIcon: false
        };
    }

    reset() {
        this.usedIds.clear();
        this.apiFailCount = 0;
        this.apiAvailable = true;
    }

    getCountries() {
        return Object.keys(COUNTRY_DATA);
    }

    setIconMode(enabled) {
        this.apiAvailable = !enabled;
    }
}

const artifactService = new ArtifactService();
export { ArtifactService, artifactService, COUNTRY_DATA, generateSVG };
