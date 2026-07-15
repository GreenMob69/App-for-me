export default {
    // --- Status header messages ---
    status: {
        excellent: {
            message: 'Masina ta este in forma excelenta.',
            subtitle: 'Nicio problema detectata. Poti pleca linistit.',
        },
        good: {
            message: 'Masina ta este in stare foarte buna.',
            subtitle: 'Toate sistemele functioneaza normal.',
        },
        goodWithObservation: {
            message: 'Masina ta este in stare buna, dar am observat ceva.',
            subtitle: 'Nu este urgent. Citeste mai jos ce am detectat.',
        },
        attention: {
            message: 'Masina ta necesita atentie.',
            subtitleWithHigh: 'Am detectat o problema care ar trebui verificata.',
            subtitleGeneral: 'Sunt cateva lucruri pe care ar fi bine sa le verifici.',
        },
        problem: {
            message: 'Am detectat o problema importanta.',
            subtitle: 'Recomand verificarea inainte de un drum lung.',
        },
        critical: {
            message: 'Nu recomand sa conduci fara o verificare prealabila.',
            subtitle: 'Detaliile sunt mai jos.',
        },
        empty: {
            message: 'Inca nu am suficiente date.',
            subtitle: 'Efectueaza cateva curse pentru ca sistemul sa invete comportamentul masinii tale.',
        },
    },

    // --- Evaluation labels ---
    evaluation: {
        EXCELLENT: 'Excelent',
        GOOD: 'Foarte bun',
        ATTENTION: 'Necesita atentie',
        PROBLEM: 'Problema importanta',
        CRITICAL: 'Critic',
    },

    // --- Confidence badges ---
    confidence: {
        HIGH: 'Certitudine ridicata',
        MEDIUM: 'Certitudine moderata',
        LOW: 'Date insuficiente',
    },

    // --- Prediction titles ---
    prediction: {
        highProbability: 'Datele sugereaza o problema cu: {{component}}.',
        mediumProbability: 'Am observat o degradare usoara a componentei: {{component}}.',
        lowProbability: 'Monitorizez componenta: {{component}}.',
    },

    // --- Urgency messages ---
    urgency: {
        high: 'Recomand verificare cat mai curand.',
        medium: 'Nu este urgent. Poti continua sa conduci.',
        low: 'Monitorizez situatia.',
        withTimeframe: 'Recomand verificarea in urmatoarele {{days}} zile.',
    },

    // --- Trend observations ---
    trends: {
        title: 'Am detectat o tendinta negativa la {{system}}.',
        followUp: 'Nu este urgent. Urmaresc in continuare.',
        systems: {
            ELECTRIC: 'sistemul de incarcare',
            ADMISIE_AER: 'admisia de aer',
            RACIRE: 'sistemul de racire',
            ECONOMIE: 'consumul de combustibil',
        },
    },

    // --- Actions per system ---
    actions: {
        ELECTRIC: 'La urmatoarea revizie, cere verificarea alternatorului si a bateriei.',
        ADMISIE_AER: 'Verifica starea filtrului de aer. Daca are peste 30.000 km, inlocuieste-l.',
        RACIRE: 'Verifica nivelul lichidului de racire cu motorul rece. Daca e scazut, programeaza o inspectie.',
        ECONOMIE: 'Consumul creste gradual. Posibile cauze: filtru aer, filtru combustibil, sau stil de condus schimbat.',
        DEFAULT: 'Monitorizeaza situatia pe urmatoarele curse.',
    },

    // --- Comparison section ---
    comparison: {
        sectionTitle: 'FATA DE CURSELE ANTERIOARE',
        noChange: 'Nu am observat schimbari semnificative fata de perioada anterioara.',

        // Intelligent narratives — single dominant change
        healthImproved: 'Masina se comporta mai bine decat in cursele anterioare. Starea generala s-a imbunatatit.',
        healthDeclined: 'Starea generala a scazut usor fata de cursele anterioare.',
        consumptionUp: 'Consumul a crescut cu aproximativ {{percent}}% fata de cursele anterioare.',
        consumptionDown: 'Consumul a scazut cu aproximativ {{percent}}%. Stilul de condus sau traseele par mai eficiente.',
        coolantUp: 'Temperatura medie a motorului a crescut fata de cursele anterioare.',
        voltageDown: 'Tensiunea de incarcare a scazut usor fata de cursele anterioare.',

        // Correlations — when two changes happen together
        consumptionAndCoolant: 'Consumul a crescut cu {{percent}}%, iar temperatura motorului e mai ridicata. Cele doua pot fi legate — termostatul sau radiatorul merita verificat.',
        consumptionAndMaf: 'Consumul a crescut cu {{percent}}%, iar debitul de aer a scazut. Cauza probabila: filtru de aer obosit sau senzor MAF murdar.',
        voltageAndHealth: 'Tensiunea de incarcare a scazut, iar starea generala a coborat. Sistemul electric poate afecta mai multe componente — verifica alternatorul.',
        healthAndCoolant: 'Starea generala a scazut, iar temperatura motorului e in crestere. Cauza probabila: sistem de racire sub presiune.',

        // Cause phrases
        causeUnknown: 'Monitorizez situatia pe urmatoarele curse.',
        causeStyle: 'Poate fi legat de stilul de condus sau de trasee noi.',
        causeWear: 'Poate indica uzura treptata a unei componente.',
    },

    // --- Upcoming maintenance timeline ---
    upcoming: {
        sectionTitle: 'CE SE APROPIE',
        nothingPlanned: 'Nu anticipez nicio interventie in perioada urmatoare.',
        timeframeKm: '~{{km}} km',
        timeframeDays: '~{{days}} zile',
        timeframeBoth: '~{{km}} km sau ~{{days}} zile',
        timeframeUnknown: 'Nu pot estima inca',
        whyPrefix: 'De ce:',
    },

    // --- Long trip readiness ---
    longTrip: {
        sectionTitle: 'POT PLECA INTR-UN DRUM LUNG?',
        ready: 'Da. Masina ta este pregatita pentru un drum lung.',
        readyDetail: 'Toate sistemele functioneaza in parametri normali.',
        readyDpfNote: ' Un drum lung pe autostrada chiar ajuta la regenerarea filtrului de particule.',
        notRecommended: 'Nu recomand un drum lung acum.',
        notRecommendedDetail: 'Motivul: {{reason}}. Verifica problema mai intai.',
        caution: 'Poti pleca, dar cu precautie.',
        cautionDetail: 'Tine cont ca {{component}} necesita atentie. Recomand verificare inainte de un drum foarte lung (>500 km).',
        monitor: 'Poti pleca, dar monitorizeaza situatia.',
        monitorDetail: 'Sunt cateva observatii active. Citeste recomandarile de mai sus.',
        reasons: {
            cooling: 'sistemul de racire necesita atentie',
            electric: 'sistemul electric necesita atentie',
        },
    },

    // --- Last trip section ---
    lastTrip: {
        sectionTitle: 'ULTIMA CURSA',
        normal: 'Totul a fost normal.',
        problems: 'Au fost detectate probleme in aceasta cursa.',
        aggressive: 'Conducerea a fost mai agresiva decat de obicei.',
    },

    // --- Section labels ---
    sections: {
        observations: 'CE AM OBSERVAT',
    },

    // --- Relative dates ---
    dates: {
        today: 'Astazi',
        yesterday: 'Ieri',
        daysAgo: 'Acum {{days}} zile',
    },

    // --- Detail screen (explanation center) ---
    detail: {
        back: 'Inapoi',
        conclusionLabel: 'CONCLUZIE',
        whyLabel: 'DE CE SPUN ASTA',
        evolutionLabel: 'EVOLUTIE IN TIMP',
        baselineLabel: 'COMPARATIE CU NORMALUL MASINII',
        correlationsLabel: 'CORELATII RELEVANTE',
        recommendationLabel: 'CE RECOMAND',
        technicalLabel: 'DATE TEHNICE',
        expandTechnical: 'Vezi datele tehnice complete',
        collapseTechnical: 'Ascunde datele tehnice',
        noData: 'Nu am suficiente date pentru acest subsistem.',
        factorDeviation: '{{direction}} {{percent}}% fata de normal',
        factorUp: '↑',
        factorDown: '↓',
        trendConfirmed: 'Trend confirmat pe ultimele curse',
        trendStable: 'Stabil — fara tendinta clara',
        baselineNormal: 'In limitele normalului invatat',
        baselineDeviation: 'Deviatie detectata fata de normal',
        correlationExplanation: '{{pair}}: coeficient {{value}}',
        sensorQualityGood: 'Calitate date: buna',
        sensorQualityMedium: 'Calitate date: moderata — concluziile pot fi mai putin sigure',
        sensorQualityLow: 'Calitate date: scazuta — concluziile sunt orientative',
        systems: {
            motor: 'Motor si racire',
            electric: 'Sistem electric',
            turbo: 'Turbosuflanta',
            combustibil: 'Combustibil si emisii',
            stil_condus: 'Stil de condus',
        },
        conclusions: {
            motor_ok: 'Sistemul de racire si motorul functioneaza in parametri normali.',
            motor_attention: 'Temperatura motorului arata o tendinta ascendenta. Merita monitorizat.',
            motor_problem: 'Sistemul de racire arata semne de degradare. Recomand verificare.',
            electric_ok: 'Sistemul electric functioneaza normal.',
            electric_attention: 'Tensiunea de incarcare arata o tendinta descendenta.',
            electric_problem: 'Sistemul electric necesita atentie. Alternatorul sau bateria pot fi afectate.',
            turbo_ok: 'Turbosuflanta functioneaza in parametri normali.',
            turbo_attention: 'Am detectat fluctuatii la presiunea de supraalimentare.',
            turbo_problem: 'Presiunea turbo e in afara parametrilor normali.',
            combustibil_ok: 'Consumul si emisiile sunt in parametri normali.',
            combustibil_attention: 'Consumul a crescut fata de perioada anterioara.',
            combustibil_problem: 'Consumul este semnificativ mai mare decat normalul invatat.',
            stil_condus_ok: 'Stilul de condus este economic si predictibil.',
            stil_condus_attention: 'Stilul de condus a fost mai agresiv recent.',
            stil_condus_problem: 'Stilul de condus agresiv afecteaza uzura si consumul.',
            generic_ok: 'Totul este in parametri normali.',
            generic_attention: 'Am detectat o degradare usoara.',
            generic_problem: 'Exista o problema care necesita atentie.',
        },
    },

    // --- Screen states ---
    states: {
        loading: 'Analizez starea vehiculului...',
        errorTitle: 'Nu ma pot conecta la server.',
        errorSubtitle: 'Verifica conexiunea si incearca din nou.',
        retry: 'Reincearca',
    },

    // --- Estimates ---
    estimates: {
        km: '~{{km}} km',
        days: '~{{days}} zile',
        separator: ' / ',
    },

    // --- Calm state (everything OK) ---
    calm: {
        message: 'Nicio actiune necesara. Toate sistemele functioneaza in parametri normali.',
        lastCheck: 'Ultima verificare: {{date}}',
    },

    // --- Urgent banner ---
    urgent: {
        labelCritical: 'NECESITA ATENTIE IMEDIATA',
        labelProblem: 'PRIORITATEA PRINCIPALA',
        actionLabel: 'CE SA FACI:',
    },
};
