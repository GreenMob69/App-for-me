export default {
    // --- Status header messages ---
    status: {
        excellent: {
            message: 'Mașina ta este în formă excelentă.',
            subtitle: 'Nicio problemă detectată. Poți pleca liniștit.',
        },
        good: {
            message: 'Mașina ta este în stare foarte bună.',
            subtitle: 'Toate sistemele funcționează normal.',
        },
        goodWithObservation: {
            message: 'Mașina ta este în stare bună, dar am observat ceva.',
            subtitle: 'Nu este urgent. Citește mai jos ce am detectat.',
        },
        attention: {
            message: 'Mașina ta necesită atenție.',
            subtitleWithHigh: 'Am detectat o problemă care ar trebui verificată.',
            subtitleGeneral: 'Sunt câteva lucruri pe care ar fi bine să le verifici.',
        },
        problem: {
            message: 'Am detectat o problemă importantă.',
            subtitle: 'Recomand verificarea înainte de un drum lung.',
        },
        critical: {
            message: 'Nu recomand să conduci fără o verificare prealabilă.',
            subtitle: 'Detaliile sunt mai jos.',
        },
        empty: {
            message: 'Încă nu am suficiente date.',
            subtitle: 'Efectuează câteva curse pentru ca sistemul să învețe comportamentul mașinii tale.',
        },
    },

    // --- Evaluation labels ---
    evaluation: {
        EXCELLENT: 'Excelent',
        GOOD: 'Foarte bun',
        ATTENTION: 'Necesită atenție',
        PROBLEM: 'Problemă importantă',
        CRITICAL: 'Critic',
    },

    // --- Confidence badges ---
    confidence: {
        HIGH: 'Certitudine ridicată',
        MEDIUM: 'Certitudine moderată',
        LOW: 'Date insuficiente',
    },

    // --- Prediction titles ---
    prediction: {
        highProbability: 'Datele sugerează o problemă cu: {{component}}.',
        mediumProbability: 'Am observat o degradare ușoară a componentei: {{component}}.',
        lowProbability: 'Monitorizez componenta: {{component}}.',
    },

    // --- Urgency messages ---
    urgency: {
        high: 'Recomand verificare cât mai curând.',
        medium: 'Nu este urgent. Poți continua să conduci.',
        low: 'Monitorizez situația.',
        withTimeframe: 'Recomand verificarea în următoarele {{days}} zile.',
    },

    // --- Trend observations ---
    trends: {
        title: 'Am detectat o tendință negativă la {{system}}.',
        followUp: 'Nu este urgent. Urmăresc în continuare.',
        systems: {
            ELECTRIC: 'sistemul de încărcare',
            ADMISIE_AER: 'admisia de aer',
            RACIRE: 'sistemul de răcire',
            ECONOMIE: 'consumul de combustibil',
        },
    },

    // --- Actions per system ---
    actions: {
        ELECTRIC: 'La următoarea revizie, cere verificarea alternatorului și a bateriei.',
        ADMISIE_AER: 'Verifică starea filtrului de aer. Dacă are peste 30.000 km, înlocuiește-l.',
        RACIRE: 'Verifică nivelul lichidului de răcire cu motorul rece. Dacă e scăzut, programează o inspecție.',
        ECONOMIE: 'Consumul crește gradual. Posibile cauze: filtru aer, filtru combustibil, sau stil de condus schimbat.',
        DEFAULT: 'Monitorizează situația pe următoarele curse.',
    },

    // --- Comparison section ---
    comparison: {
        sectionTitle: 'FAȚĂ DE CURSELE ANTERIOARE',
        noChange: 'Nu am observat schimbări semnificative față de perioada anterioară.',

        healthImproved: 'Mașina se comportă mai bine decât în cursele anterioare. Starea generală s-a îmbunătățit.',
        healthDeclined: 'Starea generală a scăzut ușor față de cursele anterioare.',
        consumptionUp: 'Consumul a crescut cu aproximativ {{percent}}% față de cursele anterioare.',
        consumptionDown: 'Consumul a scăzut cu aproximativ {{percent}}%. Stilul de condus sau traseele par mai eficiente.',
        coolantUp: 'Temperatura medie a motorului a crescut față de cursele anterioare.',
        voltageDown: 'Tensiunea de încărcare a scăzut ușor față de cursele anterioare.',

        consumptionAndCoolant: 'Consumul a crescut cu {{percent}}%, iar temperatura motorului e mai ridicată. Cele două pot fi legate — termostatul sau radiatorul merită verificat.',
        consumptionAndMaf: 'Consumul a crescut cu {{percent}}%, iar debitul de aer a scăzut. Cauza probabilă: filtru de aer obosit sau senzor MAF murdar.',
        voltageAndHealth: 'Tensiunea de încărcare a scăzut, iar starea generală a coborât. Sistemul electric poate afecta mai multe componente — verifică alternatorul.',
        healthAndCoolant: 'Starea generală a scăzut, iar temperatura motorului e în creștere. Cauza probabilă: sistem de răcire sub presiune.',

        causeUnknown: 'Monitorizez situația pe următoarele curse.',
        causeStyle: 'Poate fi legat de stilul de condus sau de trasee noi.',
        causeWear: 'Poate indica uzura treptată a unei componente.',
    },

    // --- Upcoming maintenance timeline ---
    upcoming: {
        sectionTitle: 'CE SE APROPIE',
        nothingPlanned: 'Nu anticipez nicio intervenție în perioada următoare.',
        timeframeKm: '~{{km}} km',
        timeframeDays: '~{{days}} zile',
        timeframeBoth: '~{{km}} km sau ~{{days}} zile',
        timeframeUnknown: 'Nu pot estima încă',
        whyPrefix: 'De ce:',
    },

    // --- Long trip readiness ---
    longTrip: {
        sectionTitle: 'POT PLECA ÎNTR-UN DRUM LUNG?',
        ready: 'Da. Mașina ta este pregătită pentru un drum lung.',
        readyDetail: 'Toate sistemele funcționează în parametri normali.',
        readyDpfNote: ' Un drum lung pe autostradă chiar ajută la regenerarea filtrului de particule.',
        notRecommended: 'Nu recomand un drum lung acum.',
        notRecommendedDetail: 'Motivul: {{reason}}. Verifică problema mai întâi.',
        caution: 'Poți pleca, dar cu precauție.',
        cautionDetail: 'Ține cont că {{component}} necesită atenție. Recomand verificare înainte de un drum foarte lung (>500 km).',
        monitor: 'Poți pleca, dar monitorizează situația.',
        monitorDetail: 'Sunt câteva observații active. Citește recomandările de mai sus.',
        reasons: {
            cooling: 'sistemul de răcire necesită atenție',
            electric: 'sistemul electric necesită atenție',
        },
    },

    // --- Last trip section ---
    lastTrip: {
        sectionTitle: 'ULTIMA CURSĂ',
        normal: 'Totul a fost normal.',
        problems: 'Au fost detectate probleme în această cursă.',
        aggressive: 'Conducerea a fost mai agresivă decât de obicei.',
    },

    // --- Last event section (replaces lastTrip in StatusScreen) ---
    lastEvent: {
        sectionTitle: 'ULTIMUL EVENIMENT IMPORTANT',
        tripTitle: 'Cursă',
        alertTitle: 'Alertă în cursă',
    },

    // --- Footer data info card ---
    footer: {
        lastAnalysis: 'Ultima analiză',
        dataCompleteness: 'Date disponibile',
        lastSync: 'Ultima sincronizare',
        qualityHigh: 'Complete',
        qualityMedium: 'Parțiale',
        qualityLow: 'Limitate',
        neverSynced: 'Niciodată',
    },

    // --- Section labels ---
    sections: {
        observations: 'CE AM OBSERVAT',
    },

    // --- Relative dates ---
    dates: {
        today: 'Astăzi',
        yesterday: 'Ieri',
        daysAgo: 'Acum {{days}} zile',
    },

    // --- Observation card ---
    observation: {
        actionLabel: 'CE SĂ FACI:',
        expandHint: 'De ce spun asta...',
    },

    // --- Urgent banner ---
    urgent: {
        labelCritical: 'NECESITĂ ATENȚIE IMEDIATĂ',
        labelProblem: 'PRIORITATEA PRINCIPALĂ',
        actionLabel: 'CE SĂ FACI:',
    },

    // --- Detail screen (explanation center) ---
    detail: {
        back: 'Înapoi',
        conclusionLabel: 'CONCLUZIE',
        whyLabel: 'DE CE SPUN ASTA',
        evolutionLabel: 'EVOLUȚIE ÎN TIMP',
        baselineLabel: 'COMPARAȚIE CU NORMALUL MAȘINII',
        correlationsLabel: 'CORELAȚII RELEVANTE',
        recommendationLabel: 'CE RECOMAND',
        technicalLabel: 'DATE TEHNICE',
        expandTechnical: 'Vezi datele tehnice complete',
        collapseTechnical: 'Ascunde datele tehnice',
        noData: 'Nu am suficiente date pentru acest subsistem.',
        factorDeviation: '{{direction}} {{percent}}% față de normal',
        factorUp: '↑',
        factorDown: '↓',
        trendConfirmed: 'Trend confirmat pe ultimele curse',
        trendStable: 'Stabil — fără tendință clară',
        baselineNormal: 'În limitele normalului învățat',
        baselineDeviation: 'Deviație detectată față de normal',
        correlationExplanation: '{{pair}}: coeficient {{value}}',
        sensorQualityGood: 'Calitate date: bună',
        sensorQualityMedium: 'Calitate date: moderată — concluziile pot fi mai puțin sigure',
        sensorQualityLow: 'Calitate date: scăzută — concluziile sunt orientative',
        systems: {
            motor: 'Motor și răcire',
            electric: 'Sistem electric',
            turbo: 'Turbosuflantă',
            combustibil: 'Combustibil și emisii',
            stil_condus: 'Stil de condus',
        },
        conclusions: {
            motor_ok: 'Sistemul de răcire și motorul funcționează în parametri normali.',
            motor_attention: 'Temperatura motorului arată o tendință ascendentă. Merită monitorizat.',
            motor_problem: 'Sistemul de răcire arată semne de degradare. Recomand verificare.',
            electric_ok: 'Sistemul electric funcționează normal.',
            electric_attention: 'Tensiunea de încărcare arată o tendință descendentă.',
            electric_problem: 'Sistemul electric necesită atenție. Alternatorul sau bateria pot fi afectate.',
            turbo_ok: 'Turbosuflanta funcționează în parametri normali.',
            turbo_attention: 'Am detectat fluctuații la presiunea de supraalimentare.',
            turbo_problem: 'Presiunea turbo e în afara parametrilor normali.',
            combustibil_ok: 'Consumul și emisiile sunt în parametri normali.',
            combustibil_attention: 'Consumul a crescut față de perioada anterioară.',
            combustibil_problem: 'Consumul este semnificativ mai mare decât normalul învățat.',
            stil_condus_ok: 'Stilul de condus este economic și predictibil.',
            stil_condus_attention: 'Stilul de condus a fost mai agresiv recent.',
            stil_condus_problem: 'Stilul de condus agresiv afectează uzura și consumul.',
            generic_ok: 'Totul este în parametri normali.',
            generic_attention: 'Am detectat o degradare ușoară.',
            generic_problem: 'Există o problemă care necesită atenție.',
        },
    },

    // --- Screen states ---
    states: {
        loading: 'Analizez starea vehiculului...',
        errorTitle: 'Nu mă pot conecta la server.',
        errorSubtitle: 'Verifică conexiunea și încearcă din nou.',
        retry: 'Încearcă din nou',
    },

    // --- Estimates ---
    estimates: {
        km: '~{{km}} km',
        days: '~{{days}} zile',
        separator: ' / ',
    },

    // --- Calm state (everything OK) ---
    calm: {
        message: 'Nicio acțiune necesară. Toate sistemele funcționează în parametri normali.',
        lastCheck: 'Ultima verificare: {{date}}',
    },

    // --- Maintenance screen ---
    maint: {
        hero: {
            title: 'CE TREBUIE SĂ FAC?',
            noUrgent:        'Nu ai intervenții urgente.',
            noUrgentSub:     'Toate sistemele sunt în parametri normali.',
            oneDueSoon:      'Ai un lucru care necesită atenție.',
            oneDueSoonSub:   'Nu este urgent, dar recomand o programare.',
            manyDueSoon:     'Ai {{count}} lucruri care necesită atenție.',
            manyDueSoonSub:  'Nu este urgent. Programează o vizită la service.',
            oneOverdue:      'O intervenție este întârziată.',
            oneOverdueSub:   'Verifică itemul marcat ca depășit mai jos.',
            manyOverdue:     '{{count}} intervenții sunt întârziate.',
            manyOverdueSub:  'Aceste intervenții au depășit termenul recomandat.',
        },
        sections: {
            attentionNow:   'CE NECESITĂ ATENȚIE',
            upcoming:       'URMEAZĂ ÎN CURÂND',
            documents:      'DOCUMENTE',
            healthSummary:  'SĂNĂTATEA VEHICULULUI',
            costs:          'COSTURI',
            serviceHistory: 'ISTORIC SERVICE',
            workshop:       'SERVICE-UL MEU',
            footer:         'INFO',
        },
        item: {
            lastAtKm:  'Ultima dată: {{km}} km',
            remaining: '~{{km}} km sau ~{{days}} zile',
            remainingKm: '~{{km}} km',
            remainingDays: '~{{days}} zile',
            overdue:   'Termen depășit',
            unknown:   'Date insuficiente',
        },
        docs: {
            itp:              'ITP',
            itpCategory:      'Inspecție Tehnică',
            rca:              'Asigurare RCA',
            rcaCategory:      'Asigurare',
            rovinieta:        'Rovinieta',
            rovinietaCategory:'Taxă drum',
            noData:           'Fără date înregistrate',
            comingSoon:       'Editare disponibilă în sprint următor',
        },
        costs: {
            thisYear:   'Cheltuieli {{year}}',
            fuel:       'Combustibil',
            service:    'Service',
            total:      'Total',
        },
        history: {
            serviceDefault: 'Revizie service',
            noHistory:      'Niciun service înregistrat.',
            seeAll:         'Vezi tot istoricul',
            seeLess:        'Arată mai puțin',
        },
        footer: {
            lastUpdate:         'Ultima actualizare',
            totalInterventions: 'Intervenții totale',
            estimatedKm:        'Kilometraj estimat',
        },
        empty: {
            message: 'Nu am suficiente date de mentenanță.',
            subtitle: 'Adaugă vehiculul și înregistrează servicii pentru a vedea centrul de mentenanță.',
        },
    },

    // --- Health score labels (Romanian) ---
    health: {
        overall: 'Stare generală',
        engine:  'Motor',
        fuel:    'Combustibil',
        driving: 'Stil condus',
        safety:  'Siguranță',
    },

    // --- Error boundary ---
    error: {
        title: 'Ceva nu a funcționat.',
        subtitle: 'Încearcă din nou sau revino mai târziu.',
        retry: 'Încearcă din nou',
    },

    // --- Subsystem card labels (short, uppercase) ---
    subsystems: {
        motor:       'MOTOR',
        electric:    'ELECTRIC',
        turbo:       'TURBO',
        combustibil: 'COMBUSTIBIL',
        stil_condus: 'STIL CONDUS',
    },

    // --- Prediction card ---
    predictionCard: {
        wearSigns:          'semne de uzură',
        remainingDist:      'Distanță estimată rămasă',
        analysisConfidence: 'Încredere analiză',
        viewFull:           'Vezi analiza completă →',
    },

    // --- Health timeline ---
    healthTimeline: {
        title:     'Evoluție Health Score',
        lastN:     'Ultimele {{n}} curse',
        emptyHint: 'Efectuează cel puțin 3 curse pentru a vedea evoluția',
    },
};
