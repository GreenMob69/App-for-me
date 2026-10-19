// Baza de date extinsa cu coduri DTC (OBD-II & VAG Heritage) pentru Telemetrie Licenta V3

export const DTC_DATABASE = [
    {
        code: 'P0234',
        vagCode: '00575',
        title: 'Suprapresiune Turbo Depășită (Engine Overboost)',
        category: 'TURBO',
        severity: 'CRIT',
        cause: 'Actuator geometrie variabilă VNT ancrasat cu funingine sau electrovalvă vacuum N75 blocată mecanic.',
        symptoms: 'Intrare în Limp Mode (lipsă putere peste 3000 RPM), șuierat intens.',
        costEst: '250 - 650 RON',
        action: 'Curățare geometrie turbină sau înlocuire convertor presiune N75 Pierburg.',
    },
    {
        code: 'P0299',
        vagCode: '00665',
        title: 'Subpresiune Turbo (Underboost Condition)',
        category: 'TURBO',
        severity: 'WARN',
        cause: 'Furtun intercooler fisurat, pierdere vacuum la actuatoare sau miez turbină uzat.',
        symptoms: 'Răspuns lent la accelerație (turbo lag pronunțat), fum negru la sarcină.',
        costEst: '180 - 450 RON',
        action: 'Testare etanșeitate circuit admisie cu fum și verificare actuator vacuum.',
    },
    {
        code: 'P0101',
        vagCode: '00553',
        title: 'Debitmetru Aer MAF (Semnal Implauzibil)',
        category: 'ADMISIE',
        severity: 'WARN',
        cause: 'Filament MAF contaminat cu vapori de ulei sau traseu admisie neetanș după filtru.',
        symptoms: 'Plafonare turație, consum crescut cu 15-20%, ezitări la accelerare.',
        costEst: '320 - 580 RON',
        action: 'Curățare senzor cu spray dedicat sau înlocuire debitmetru Bosch.',
    },
    {
        code: 'P0401',
        vagCode: '16785',
        title: 'Debit Recirculare Gaze EGR Insuficient',
        category: 'EMISII',
        severity: 'WARN',
        cause: 'Supapă EGR colmatată masiv cu depuneri de calamină sau tubulatură obturată.',
        symptoms: 'Martor Check Engine aprins, mers neregulat la sarcină parțială.',
        costEst: '200 - 500 RON',
        action: 'Demontare și decalaminare baie ultrasunete supapă EGR.',
    },
    {
        code: 'P2002',
        vagCode: '08194',
        title: 'Eficiență Filtru Particule DPF sub Prag (Banc 1)',
        category: 'DPF',
        severity: 'CRIT',
        cause: 'Contrapresiune excesivă, acumulare masivă de funingine / cenușă peste 45g.',
        symptoms: 'Regenerări foarte dese (sub 150 km), consum ridicat, degradare rapidă ulei.',
        costEst: '450 - 1200 RON',
        action: 'Regenerare forțată în mers sau spălare chimică DPF pe banc profesional.',
    },
    {
        code: 'P0300',
        vagCode: '16684',
        title: 'Rateuri de Aprindere Aleatorii / Multipli Cilindri',
        category: 'MOTOR',
        severity: 'CRIT',
        cause: 'Compresie scăzută, injectoare cu debit neuniform sau cablaj bobine degradat.',
        symptoms: 'Vibrații puternice la ralanti, zgomot metalic, fum alb/gri la pornire.',
        costEst: '300 - 900 RON',
        action: 'Test compresie mecanică și calibrare pe banc a injectoarelor.',
    },
    {
        code: '00550',
        vagCode: '00550',
        title: 'Reglare Început Injecție (Start of Injection Deviation)',
        category: 'MOTOR',
        severity: 'CRIT',
        cause: 'Avans dinamic incorect pompă distribuitor VP37 sau curea dințată alungită.',
        symptoms: 'Pornire grea la rece, zgomot de tachet, fum albicios la ralanti.',
        costEst: '150 - 350 RON',
        action: 'Reglare mecanică avans pompă cu VAG 1551 / VCDS TDI-Timing.',
    },
    {
        code: 'P0113',
        vagCode: '16497',
        title: 'Senzor Temperatură Aer Admisie IAT (Semnal Prea Mare)',
        category: 'ADMISIE',
        severity: 'INFO',
        cause: 'Circuit întrerupt senzor IAT sau conector oxidat.',
        symptoms: 'Calcul eronat al densității aerului de către ECU, amestec prea bogat.',
        costEst: '80 - 160 RON',
        action: 'Verificare mufă și înlocuire senzor NTC temperatură admisie.',
    },
    {
        code: 'P0562',
        vagCode: '16946',
        title: 'Tensiune Sistem Electric Scăzută (< 11.5V)',
        category: 'ELECTRIC',
        severity: 'WARN',
        cause: 'Punte diode alternator arsă, fulie frei blocată sau baterie sulfatată.',
        symptoms: 'Avertizare martor baterie, resetare calculatoare de bord la pornire.',
        costEst: '250 - 550 RON',
        action: 'Recondiționare alternator și test de cădere de tensiune pe demaror.',
    },
];

export const searchDtcDatabase = (query = '') => {
    if (!query || typeof query !== 'string') return [];
    const q = query.trim().toUpperCase();
    return DTC_DATABASE.filter(item =>
        item.code.includes(q) ||
        item.vagCode.includes(q) ||
        item.title.toUpperCase().includes(q) ||
        item.category.includes(q) ||
        item.cause.toUpperCase().includes(q)
    );
};
