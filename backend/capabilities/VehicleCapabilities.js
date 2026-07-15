/**
 * VehicleCapabilities.js — derivare capability flags din datele vehiculului
 * -----------------------------------------------------------------------
 * Transformă un rând din tabela `vehicles` (sau orice obiect cu aceleași
 * câmpuri) într-un set de flag-uri booleene pe care pipeline-ul le folosește
 * pentru a decide ce etape și modele sunt relevante pentru vehiculul curent.
 *
 * Regula de bază: capabilities descriu ce POATE FACE vehiculul și ce
 * semnale OBD sunt de așteptat — NU ce date a trimis efectiv în ultima cursă.
 *
 * defaultCapabilities() — fallback când nu există date despre vehicul.
 * Returnează toate flag-urile adevărate, ceea ce reproduce exact
 * comportamentul din versiunea anterioară (toate modelele rulează).
 * -----------------------------------------------------------------------
 */

/**
 * Derivă capabilities din datele vehiculului stocate în DB.
 *
 * @param {Object|null} vehicleRow - rând din tabela `vehicles`
 * @returns {VehicleCapabilities}
 */
function deriveCapabilities(vehicleRow) {
    if (!vehicleRow) return defaultCapabilities();

    const fuel    = (vehicleRow.fuel_type    || '').toLowerCase().trim();
    const code    = (vehicleRow.engine_code  || '').toUpperCase().trim();
    const trans   = (vehicleRow.transmission || '').toLowerCase().trim();
    const year    = vehicleRow.year ? Number(vehicleRow.year) : null;

    // ── Tip combustibil ───────────────────────────────────────────────
    const isDiesel  = fuel === 'diesel';
    const isPetrol  = ['petrol', 'gasoline', 'benzina', 'benzin', 'petrol'].includes(fuel);
    const isElectric = ['electric', 'bev', 'ev'].includes(fuel);
    const isHybrid  = ['hybrid', 'phev', 'hev', 'mhev'].includes(fuel);
    const hasICE    = !isElectric;

    // ── Turbo ─────────────────────────────────────────────────────────
    // Diesel post-1990 este aproape mereu turbo. La benzinǎ: verificăm
    // codul motorului pentru markeri comuni (T, TSI, TFSI, TDCI etc.).
    const hasTurbo = isDiesel ||
        /TDI|TDCI|CDI|CDTI|CRDI|D4D/.test(code) ||    // diesel turbo
        /TSI|TFSI|TGDI|TURBO|EcoBoost|SkyActiv-T/.test(code) || // benzinǎ turbo
        /[0-9]T$/.test(code);                          // ex: "M54T", "1.8T"

    // ── DPF (Filtru Particule Diesel) ─────────────────────────────────
    // Introdus treptat după 2005 (optional) și obligatoriu Euro 5 din 2009.
    // Dacă year lipsește, presupunem absenţa DPF (conservator).
    const hasDPF = isDiesel && year !== null && year >= 2005;

    // ── EGR (Recirculare Gaze Ardere) ─────────────────────────────────
    // Present pe dieseluri de la ~1990 și pe benzinǎ de la ~2000.
    // Dacă year lipsește, presupunem prezența EGR (diesel are aproape sigur).
    const hasEGR = isDiesel
        ? (year === null || year >= 1990)
        : (isPetrol && year !== null && year >= 2000);

    // ── Sondă Lambda / Oxygen ─────────────────────────────────────────
    // Benzinǎ: întotdeauna (reglaj stoichiometric).
    // Diesel: Euro 3+ (2001+) are cel puțin o sondă de monitorizare.
    const hasLambdaOxygen = isPetrol || (isDiesel && year !== null && year >= 2001);

    // ── Transmisie ────────────────────────────────────────────────────
    const isManual    = trans === 'manual' || trans === 'm' || trans === 'mt';
    const isAutomatic = trans === 'automatic' || trans === 'auto' || trans === 'at';
    const isDCT       = /dsg|dct|pdk|s-tronic|dct/.test(trans);

    // ── Propulsie electrică (pentru sprint-uri viitoare) ──────────────
    const hasBEV          = isElectric;
    const hasHVBattery    = isElectric || isHybrid;
    const hasElectricMotor = isElectric || isHybrid;

    return {
        // Propulsie termică
        hasICE,
        isDiesel,
        isPetrol,
        hasTurbo,
        hasDPF,
        hasEGR,
        hasLambdaOxygen,

        // Transmisie
        isManual,
        isAutomatic,
        isDCT,

        // Propulsie electrică
        hasBEV,
        hasHVBattery,
        hasElectricMotor,

        // Sursă: de unde au venit datele
        _source: 'vehicle_row',
        _vehicleYear: year,
        _fuelType: fuel,
    };
}

/**
 * Capabilities implicite când nu există date despre vehicul.
 * Toate flag-urile relevante pentru ICE diesel turbo sunt true —
 * reproduce comportamentul anterior în care toate modelele rulau.
 *
 * @returns {VehicleCapabilities}
 */
function defaultCapabilities() {
    return {
        hasICE:            true,
        isDiesel:          true,
        isPetrol:          false,
        hasTurbo:          true,
        hasDPF:            true,
        hasEGR:            true,
        hasLambdaOxygen:   true,
        isManual:          true,
        isAutomatic:       false,
        isDCT:             false,
        hasBEV:            false,
        hasHVBattery:      false,
        hasElectricMotor:  false,
        _source:           'default',
        _vehicleYear:      null,
        _fuelType:         'diesel',
    };
}

module.exports = { deriveCapabilities, defaultCapabilities };
