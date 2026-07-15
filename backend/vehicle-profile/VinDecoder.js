/**
 * VIN Decoder — ISO 3779
 * Decodare structurală fără API extern.
 * Pozițiile 1-3 (WMI) = manufacturer, 4-8 (VDS) = model/engine, 10 = year
 */

const WMI_MAP = {
    'WAU': { make: 'Audi', country: 'Germany' },
    'WUA': { make: 'Audi', country: 'Germany' },
    'WVW': { make: 'Volkswagen', country: 'Germany' },
    'WV1': { make: 'Volkswagen Commercial', country: 'Germany' },
    'WV2': { make: 'Volkswagen Commercial', country: 'Germany' },
    'WBA': { make: 'BMW', country: 'Germany' },
    'WBS': { make: 'BMW M', country: 'Germany' },
    'WDB': { make: 'Mercedes-Benz', country: 'Germany' },
    'WDD': { make: 'Mercedes-Benz', country: 'Germany' },
    'WDC': { make: 'Mercedes-Benz', country: 'Germany' },
    'WF0': { make: 'Ford', country: 'Germany' },
    'WME': { make: 'Smart', country: 'Germany' },
    'WP0': { make: 'Porsche', country: 'Germany' },
    'W0L': { make: 'Opel', country: 'Germany' },
    'ZAR': { make: 'Alfa Romeo', country: 'Italy' },
    'ZFA': { make: 'Fiat', country: 'Italy' },
    'ZFF': { make: 'Ferrari', country: 'Italy' },
    'ZLA': { make: 'Lancia', country: 'Italy' },
    'VF1': { make: 'Renault', country: 'France' },
    'VF3': { make: 'Peugeot', country: 'France' },
    'VF7': { make: 'Citroen', country: 'France' },
    'VF8': { make: 'Matra/Talbot', country: 'France' },
    'VSS': { make: 'SEAT', country: 'Spain' },
    'VSK': { make: 'SEAT', country: 'Spain' },
    'TMB': { make: 'Skoda', country: 'Czech Republic' },
    'TMA': { make: 'Hyundai', country: 'Czech Republic' },
    'UU1': { make: 'Dacia/Renault', country: 'Romania' },
    'UU6': { make: 'Dacia', country: 'Romania' },
    'SAL': { make: 'Land Rover', country: 'UK' },
    'SAJ': { make: 'Jaguar', country: 'UK' },
    'SCC': { make: 'Lotus', country: 'UK' },
    'SJN': { make: 'Nissan', country: 'UK' },
    'JTD': { make: 'Toyota', country: 'Japan' },
    'JHM': { make: 'Honda', country: 'Japan' },
    'JMZ': { make: 'Mazda', country: 'Japan' },
    'JS1': { make: 'Suzuki', country: 'Japan' },
    'KMH': { make: 'Hyundai', country: 'South Korea' },
    'KNA': { make: 'Kia', country: 'South Korea' },
    'LVS': { make: 'Ford', country: 'China' },
    'YV1': { make: 'Volvo', country: 'Sweden' },
    'YS3': { make: 'Saab', country: 'Sweden' },
    '1G1': { make: 'Chevrolet', country: 'USA' },
    '1GC': { make: 'Chevrolet Truck', country: 'USA' },
    '1FA': { make: 'Ford', country: 'USA' },
    '1FM': { make: 'Ford', country: 'USA' },
    '2HM': { make: 'Honda', country: 'Canada' },
    '3VW': { make: 'Volkswagen', country: 'Mexico' },
    '5YJ': { make: 'Tesla', country: 'USA' },
};

// Audi model codes (pozitii 4-5 din VDS)
const AUDI_MODELS = {
    '4A': 'A6 C4',
    '4B': 'A6 C5',
    '4F': 'A6 C6',
    '4G': 'A6 C7',
    '8D': 'A4 B5',
    '8E': 'A4 B6/B7',
    '8K': 'A4 B8',
    '8L': 'A3 8L',
    '8P': 'A3 8P',
    '8V': 'A3 8V',
    '8T': 'A5 8T',
    '8N': 'TT 8N',
    '8J': 'TT 8J',
    '4L': 'Q7 4L',
    '4M': 'Q7 4M',
    '8U': 'Q3 8U',
    '8R': 'Q5 8R',
};

// VW model codes
const VW_MODELS = {
    '1J': 'Golf IV / Bora',
    '1K': 'Golf V / Jetta III',
    '5K': 'Golf VI',
    '5G': 'Golf VII',
    '3C': 'Passat B6/B7',
    '3G': 'Passat B8',
    '1T': 'Touran',
    '7L': 'Touareg',
    '7P': 'Touareg II',
    '2K': 'Caddy',
    '7H': 'Transporter T5',
    '6R': 'Polo V',
    'AW': 'Polo VI',
};

// Year codes (pozitia 10)
const YEAR_CODES = {
    'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014,
    'F': 2015, 'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019,
    'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024,
    'S': 2025, 'T': 2026, 'V': 2027, 'W': 2028, 'X': 2029,
    'Y': 2030,
    '1': 2001, '2': 2002, '3': 2003, '4': 2004, '5': 2005,
    '6': 2006, '7': 2007, '8': 2008, '9': 2009,
    // Pre-2000 (aceleasi coduri, context-dependent)
    // R=1994, S=1995, T=1996, V=1997, W=1998, X=1999, Y=2000
};

const YEAR_CODES_PRE2010 = {
    'R': 1994, 'S': 1995, 'T': 1996, 'V': 1997, 'W': 1998,
    'X': 1999, 'Y': 2000,
};

function validateVin(vin) {
    if (!vin || typeof vin !== 'string') return { valid: false, error: 'VIN lipseste' };
    const cleaned = vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    if (cleaned.length !== 17) return { valid: false, error: 'VIN trebuie sa aiba 17 caractere' };
    if (/[IOQ]/.test(cleaned)) return { valid: false, error: 'VIN nu poate contine I, O sau Q' };
    return { valid: true, vin: cleaned };
}

function decodeVin(vin) {
    const validation = validateVin(vin);
    if (!validation.valid) return { valid: false, error: validation.error };

    const cleanVin = validation.vin;
    const wmi = cleanVin.substring(0, 3);
    const vds = cleanVin.substring(3, 9);
    const yearCode = cleanVin[9];
    const modelCode = cleanVin.substring(3, 5);

    const result = {
        valid: true,
        vin: cleanVin,
        make: null,
        model: null,
        variant: null,
        year: null,
        country: null,
        plant: null,
    };

    // WMI lookup
    const manufacturer = WMI_MAP[wmi];
    if (manufacturer) {
        result.make = manufacturer.make;
        result.country = manufacturer.country;
    } else {
        // Fallback: primele 2 caractere
        const wmi2 = wmi.substring(0, 2);
        for (const [key, val] of Object.entries(WMI_MAP)) {
            if (key.startsWith(wmi2)) {
                result.make = val.make;
                result.country = val.country;
                break;
            }
        }
    }

    // Model lookup (marca-specific)
    // VAG (Audi/VW/Skoda/SEAT): codul modelului e la pozitiile 7-8 (index 6-7)
    const vagModelCode = cleanVin.substring(6, 8);

    if (result.make === 'Audi') {
        const code = AUDI_MODELS[vagModelCode] || AUDI_MODELS[modelCode];
        if (code) {
            result.model = code.split(' ')[0];
            result.variant = code;
        }
    } else if (result.make === 'Volkswagen' || result.make === 'Volkswagen Commercial') {
        const code = VW_MODELS[vagModelCode] || VW_MODELS[modelCode];
        if (code) {
            result.model = code.split(' / ')[0];
            result.variant = code;
        }
    }

    // Year decode
    if (YEAR_CODES[yearCode]) {
        result.year = YEAR_CODES[yearCode];
    }
    // Disambiguation: modelele vechi (pre-2010) au aceleasi year codes reutilizate
    // Daca modelul este cunoscut ca pre-2010, folosim tabelul pre-2010
    const oldModels = ['C4', 'B5', '8L', '8N', 'Golf IV', 'Bora'];
    if (result.variant && oldModels.some(m => result.variant.includes(m)) && YEAR_CODES_PRE2010[yearCode]) {
        result.year = YEAR_CODES_PRE2010[yearCode];
    }

    return result;
}

module.exports = { decodeVin, validateVin };
