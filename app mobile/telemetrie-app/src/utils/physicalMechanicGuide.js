/**
 * physicalMechanicGuide.js
 * Ghid practic „Mâini pe Mașină” pentru intervenții fizice rapide.
 * Atașat fiecărei anomalii detectate de cei 32 de observatori fizici.
 */

export const PHYSICAL_MECHANIC_GUIDES = {
    INTERCOOLER_BOOST_LEAK: {
        id: 'INTERCOOLER_BOOST_LEAK',
        code: 'P0299',
        system: 'TURBO & ADMISIE',
        titleRo: 'Pierdere Presiune Turbo / Furtun Intercooler Fisurat',
        titleEn: 'Turbo Boost Leak / Cracked Intercooler Hose',
        titleRu: 'Утечка наддува / Трещина патрубка интеркулера',
        subsystem: 'turbo',
        locationRo: 'Traseul inferior de admisie dintre ieșirea compresorului turbinei (partea dreaptă a motorului) și intercooler (baza radiatorului, partea dreaptă-față), plus cotul superior de intrare în galeria de admisie / supapa EGR.',
        locationEn: 'Lower boost piping between turbo compressor outlet and intercooler core (bottom-right front), plus upper elbow entering intake manifold / EGR.',
        locationRu: 'Нижняя воздушная магистраль от выхода турбины к интеркулеру (справа внизу) и верхний патрубок к коллектору/EGR.',
        diyLevel: 'UȘOR',
        durationMin: 15,
        estimatedCostRon: '120 - 250 RON',
        estimatedCostEur: '25 - 50 EUR',
        tools: ['Șurubelniță dreaptă / tubulară 7mm', 'Lanternă LED', 'Cârpă curată', 'Mănuși de protecție'],
        stepsRo: [
            'Oprește motorul și lasă-l să se răcească 5 minute. Localizează furtunul gros de cauciuc de la baza intercoolerului (partea dreapta-jos, sub farul pasagerului).',
            'Strânge ferm furtunul cu ambele mâini pe toată lungimea curburii. Caută fisuri longitudinale ascunse sau zone îmbibate cu ulei proaspăt (uleiul suflat prin presiune indică locul exact al găurii).',
            'Verifică colierele metalice de la capete: dacă colierul a tăiat buza furtunului sau e slăbit, repoziționează colierul și strânge-l ferm cu o tubulară de 7mm.'
        ],
        stepsEn: [
            'Turn off engine and allow 5 min cooldown. Locate thick rubber boost hose at lower right of intercooler (under passenger headlight).',
            'Squeeze hose firmly along its curvature. Look for longitudinal fatigue splits or fresh oil sweating (oil spray pinpointing leak location).',
            'Inspect hose clamps at both ends: if loose or cutting into rubber bead, reposition clamp and tighten firmly with a 7mm socket.'
        ],
        stepsRu: [
          'Заглушите мотор и дайте остыть 5 минут. Осмотрите толстый резиновый патрубок интеркулера справа снизу.',
          'Сожмите патрубок руками по всей длине. Ищите скрытые продольные трещины или свежие следы масла (масляный налет точно указывает на свищ).',
          'Проверьте хомуты на концах: подтяните головкой на 7мм или замените треснувший хомут.'
],
        symptomsRo: 'Fâșâit puternic la accelerare, fum negru la sarcină, lipsă de putere peste 2000 RPM (Underboost P0299).',
        symptomsEn: 'Hissing noise under throttle, black smoke under load, sluggish acceleration above 2000 RPM.',
        symptomsRu: 'Громкое шипение при разгоне, черный дым под нагрузкой, вялый разгон выше 2000 об/мин (ошибка P0299).',
        partNumberRef: 'OEM VAG 1H0145834 / Universal Siliconic 51mm'
    },

    VNT_N75_SPIKE: {
        id: 'VNT_N75_SPIKE',
        code: 'P0234',
        system: 'TURBO & ADMISIE',
        titleRo: 'Suprapresiune Turbo / Geometrie VNT sau Supapă N75 Blocată',
        titleEn: 'Turbo Overboost / Sticking VNT Vanes or Faulty N75',
        titleRu: 'Передув турбины / Заедание геометрии VNT или клапана N75',
        subsystem: 'turbo',
        locationRo: 'Electrovana N75 (montată pe peretele despărțitor de foc, în spatele filtrului de aer, cu mufă cu 2 pini și 3 furtunașe subțiri de vacuum de 4mm) și tija actuatorului de pe turbină.',
        locationEn: 'N75 boost solenoid (on firewall behind air box, 2-pin connector, 3 vacuum lines) and turbocharger VNT actuator rod.',
        locationRu: 'Электромагнитный клапан N75 на моторном щите и шток актуатора геометрии на самой турбине.',
        diyLevel: 'MEDIU',
        durationMin: 20,
        estimatedCostRon: '180 - 320 RON',
        estimatedCostEur: '35 - 65 EUR',
        tools: ['Seringă mare (50ml) sau pompă vacuum', 'Spray contacte electrice', 'Lanternă', 'Șurubelniță lungă'],
        stepsRo: [
            'Verifică furtunașul negru de vacuum care pleacă din N75 către actuatorul turbinei: dacă este copt, crăpat la capete sau sărit din ștuț, înlocuiește-l cu furtun de silicon de 4mm.',
            'Cu motorul oprit, mișcă tija actuatorului VNT cu o șurubelniță lungă. Cursa trebuie să fie de 10-12mm, continuă și lină, fără hopuri sau blocaje la capăt de cursă cauzate de funingine.',
            'Deconectează mufa electrică a electrovanei N75, inspectează pinii pentru oxidare verde și curăță cu spray de contacte.'
        ],
        stepsEn: [
            'Inspect 4mm vacuum line from N75 to turbo actuator: replace if cracked, brittle or slipped off barb.',
            'With engine off, manually exercise VNT rod using a long screwdriver. It must travel 10-12mm smoothly without binding.',
            'Disconnect N75 2-pin connector, inspect for green copper oxidation and treat with electrical contact cleaner.'
        ],
        stepsRu: [
          'Проверьте вакуумную трубку 4мм от N75 к турбине на предмет растрескивания и соскакивания со штуцера.',
          'На заглушенном двигателе вручную подвигайте шток VNT длинной отверткой. Ход должен быть 10-12мм, плавным и без заеданий от сажи.',
          'Снимите 2-контактный разъем N75, проверьте контакты на окисление и обработайте спреем для контактов.'
],
        symptomsRo: 'Intrare în Limp Mode la depășiri pe autostradă (la 120-130 km/h), motorul își revine după repornire.',
        symptomsEn: 'Limp mode triggered on highway pulls (at 120-130 km/h), clears after ignition power-cycle.',
        symptomsRu: 'Аварийный режим (Limp Mode) при обгоне на трассе (на 120-130 км/ч), пропадает после перезапуска зажигания.',
        partNumberRef: 'Pierburg 7.21895.55.0 / VAG 1J0906627A'
    },

    THERMOSTAT_STUCK_OPEN: {
        id: 'THERMOSTAT_STUCK_OPEN',
        code: 'P0128',
        system: 'TERMIC & RĂCIRE',
        titleRo: 'Termostat Blocat Deschis / Răcire Excesivă Motor',
        titleEn: 'Thermostat Stuck Open / Insufficient Warm-Up',
        titleRu: 'Термостат заклинил в открытом положении / Недогрев мотора',
        subsystem: 'cooling',
        locationRo: 'Carcasa termostatului din plastic/aluminiu, montată pe blocul motor lângă pompa de apă, unde se conectează furtunul gros inferior al radiatorului.',
        locationEn: 'Thermostat housing on engine block near water pump, connected to lower main radiator hose.',
        locationRu: 'Корпус термостата на блоке цилиндров возле помпы, куда подходит нижний толстый шланг радиатора.',
        diyLevel: 'UȘOR',
        durationMin: 15,
        estimatedCostRon: '65 - 140 RON',
        estimatedCostEur: '13 - 28 EUR',
        tools: ['Mănuși de protecție termică', 'Termometru infraroșu (sau mâna liberă)', 'Lanternă'],
        stepsRo: [
            'Pornește motorul rece și lasă-l să meargă 4-5 minute la ralanti. Păstrează mâna pe furtunul gros de sus al radiatorului.',
            'Dacă furtunul începe să se încălzească treptat de la 40-50°C odată cu motorul, termostatul este blocat deschis (apa circulă prematur prin radiatorul mare).',
            'La un termostat sănătos, furtunul trebuie să rămână complet rece până când motorul atinge 87°C, moment în care se încălzește brusc în 30 de secunde.'
        ],
        stepsEn: [
            'Start cold engine, idle for 4-5 mins. Keep hand on upper radiator hose.',
            'If hose warms up gradually from 40°C alongside engine, thermostat is stuck open (coolant bypassing early).',
            'On a sound thermostat, hose must stay stone-cold until 87°C is reached, then warm up abruptly within 30s.'
        ],
        stepsRu: [
          'Запустите холодный мотор и дайте поработать 4-5 минут. Держите руку на верхнем шланге радиатора.',
          'Если шланг начинает теплеть уже при 40°C вместе с мотором — термостат заклинил в открытом положении.',
          'У исправного термостата шланг остается ледяным до достижения 87°C, после чего резко теплеет за 30 секунд.'
],
        symptomsRo: 'Acul de temperatură din bord scade la coborârea pantelor sau pe autostradă, căldură slabă în habitaclu, consum mărit cu 15%.',
        symptomsEn: 'Coolant gauge drops on descents/highway, weak cabin heat, 15% elevated fuel consumption.',
        symptomsRu: 'Стрелка температуры падает на спусках и на трассе, печка дует еле теплым, расход топлива выше на 15%.',
        partNumberRef: 'Wahler 4264.87D / Mahle TX 14 87D'
    },

    RESTRICTED_HEAT_EXCHANGE: {
        id: 'RESTRICTED_HEAT_EXCHANGE',
        code: 'P0217',
        system: 'TERMIC & RĂCIRE',
        titleRo: 'Schimb Termic Restricționat / Fagure Radiator Colmatat',
        titleEn: 'Restricted Heat Exchanger / Radiator Fins Clogged',
        titleRu: 'Забит радиатор / Ухудшение теплообмена сотами',
        subsystem: 'cooling',
        locationRo: 'Pachetul de radiatoare din spatele grilei frontale (condensator climă AC în față, intercooler la mijloc, radiator răcire motor în spate).',
        locationEn: 'Front radiator cooling stack behind front grille (AC condenser in front, intercooler, main radiator rear).',
        locationRu: 'Пакет радиаторов за решеткой радиатора (конденсор кондиционера спереди, интеркулер и основной радиатор сзади).',
        diyLevel: 'UȘOR',
        durationMin: 20,
        estimatedCostRon: '0 - 50 RON (curățare)',
        estimatedCostEur: '0 - 10 EUR',
        tools: ['Lanternă LED', 'Pensulă moale cu peri lungi', 'Furtun apă joasă presiune (NU spălătorie cu presiune!)'],
        stepsRo: [
            'Privește prin fantele barei față cu o lanternă. Verifică spațiul îngust de 1-2 cm dintre radiatorul de climă și cel de apă.',
            'Dacă observi o „pătură” compactă de puf de plop, insecte uscate și frunze, desprinde cele 2 șuruburi de fixare de sus pentru a distanța ușor radiatoarele.',
            'Curăță mizeria cu o pensulă moale sau jet de aer/apă la presiune mică dinspre motor spre exterior (fără a îndoi aripioarele fine de aluminiu!).'
        ],
        stepsEn: [
            'Shine flashlight through front grille. Inspect narrow 1-2 cm gap between AC condenser and main radiator.',
            'If you see a carpet of poplar fluff, dead bugs and leaves, unfasten top 2 retaining clips to tilt condenser.',
            'Clear debris with soft brush or low-pressure water sprayed from engine bay outwards (never bend aluminum fins).'
        ],
        stepsRu: [
          'Посветите фонариком в решетку бампера. Осмотрите зазор 1-2 см между радиатором кондиционера и основным.',
          'Если между ними образовался плотный «валенок» из тополиного пуха, листьев и грязи — открутите верхние крепления.',
          'Аккуратно промойте соты водой низкого давления из моторного отсека наружу (не загибайте алюминиевые ламели!).'
],
        symptomsRo: 'Temperatura apei trece de 98-105°C pe urcări sau la viteze mari, ventilatoarele merg permanent pe treapta maximă.',
        symptomsEn: 'Coolant exceeds 98-105°C on inclines/high speed, radiator fan howling continuously on max speed.',
        symptomsRu: 'Температура ОЖ превышает 98-105°C на подъемах и в пробках, вентилятор постоянно воет на максимальной скорости.',
        partNumberRef: 'Curățare fizică externă / Nissens 60497A'
    },

    ALTERNATOR_DIODE_FAULT: {
        id: 'ALTERNATOR_DIODE_FAULT',
        code: 'P0562',
        system: 'ELECTRICĂ & BATERIE',
        titleRo: 'Punte Diode Străpunsă / Ondulație Tensiune Alternator',
        titleEn: 'Blown Alternator Diode / AC Voltage Ripple',
        titleRu: 'Пробит диод генератора / Пульсация переменного тока',
        subsystem: 'battery',
        locationRo: 'Alternatorul, pe partea din față a motorului, antrenat de cureaua de accesorii, cu borna groasă de curent B+ și mufa D+ de semnalizare bord.',
        locationEn: 'Alternator at front of engine driven by serpentine belt, main B+ stud and D+ signal connector.',
        locationRu: 'Генератор в передней части мотора, силовой болт B+ и разъем сигнального провода D+.',
        diyLevel: 'UȘOR',
        durationMin: 10,
        estimatedCostRon: '140 - 240 RON (regulator)',
        estimatedCostEur: '28 - 48 EUR',
        tools: ['Multimetru digital (cu mod VDC și VAC)', 'Mănuși', 'Lanternă'],
        stepsRo: [
            'Pornește motorul, aprinde faza lungă și aeroterma la maxim. Pune multimetrul pe volți DC pe bornele bateriei: tensiunea trebuie să fie între 13.8V și 14.4V.',
            'Comută multimetrul pe tensiune alternativă (VAC): dacă valoarea citită depășește 0.35V AC (350mV), una dintre diodele de redresare este arsă și trimite curent pulsatoriu distructiv în ECU!',
            'Verifică borna B+ cu piuliță de 13mm de pe alternator: asigură-te că nu este slăbită, afumată sau încinsă.'
        ],
        stepsEn: [
            'Start engine, turn on high beams and HVAC blower. Probe battery terminals with multimeter on DC: must read 13.8V-14.4V.',
            'Switch multimeter to AC Volts: if reading exceeds 0.35V AC, a rectifier diode has failed, leaking damaging AC ripple to ECUs.',
            'Inspect main B+ 13mm nut at rear of alternator: ensure it is tight, free of scorch marks or heat discoloration.'
        ],
        stepsRu: [
          'Запустите мотор, включите дальний свет и печку. Мультиметром в режиме DC проверьте клеммы АКБ: норма 13.8-14.4В.',
          'Переключите мультиметр в режим переменного напряжения (AC): если показания выше 0.35В AC, пробит диодный мост!',
          'Проверьте силовую гайку 13мм на генераторе B+: она не должна быть ослабленной или иметь следы перегрева.'
],
        symptomsRo: 'Pâlpâire fină a luminilor de bord la ralanti, martor baterie aprins slab, erori electrice ciudate pe diverse module.',
        symptomsEn: 'Faint dashboard light pulsing at idle, dim battery warning light, sporadic ghost errors across CAN bus.',
        symptomsRu: 'Мерцание ламп приборной панели на холостом ходу, тускло тлеет лампа АКБ, случайные ошибки блоков по CAN.',
        partNumberRef: 'Regulator Bosch F00M145225 / Punte Mobiletron'
    },

    GROUND_WIRING_DROP: {
        id: 'GROUND_WIRING_DROP',
        code: 'B1000',
        system: 'ELECTRICĂ & BATERIE',
        titleRo: 'Cădere de Tensiune Masă Motor / Caroserie Corodată',
        titleEn: 'Engine Ground Strap Voltage Drop / Corroded Ground',
        titleRu: 'Падение напряжения на массе двигателя / Окисление проводки',
        subsystem: 'battery',
        locationRo: 'Tresa metalică împletită de cupru dintre lonjeronul stâng și blocul motor/cutia de viteze, plus punctul de masă de sub borna minus (-) a bateriei.',
        locationEn: 'Braided copper ground strap connecting left chassis frame rail to engine/gearbox, and main battery negative post ground lug.',
        locationRu: 'Плетеный медный провод массы между левым лонжероном и КПП/мотором, а также провод массы от минуса АКБ к кузову.',
        diyLevel: 'FOARTE UȘOR',
        durationMin: 10,
        estimatedCostRon: '25 - 45 RON (tresă nouă)',
        estimatedCostEur: '5 - 9 EUR',
        tools: ['Multimetru digital', 'Șmirghel fin / perie de sârmă', 'Cheie 10mm / 13mm', 'Spray vaselină de cupru'],
        stepsRo: [
            'Cu motorul pornit și luminile aprinse, pune o sondă a multimetrului pe borna de plumb MINUS a bateriei și cealaltă pe metalul curat al chiulasei motorului.',
            'Tensiunea citită TREBUIE să fie sub 0.08V (80mV). Dacă multimetrul arată peste 0.20V, tresa principală de masă are rezistență mare din cauza oxidării!',
            'Demontați șuruburile tresei, curățați cu șmirghel contactul pe caroserie până lucește metalul, aplicați vaselină de contacte și strângeți ferm.'
        ],
        stepsEn: [
            'With engine idling and lights on, probe negative lead battery post with one lead and bare engine metal with the other.',
            'Multimeter MUST read below 0.08V (80mV). If it shows >0.20V, primary ground strap is severely oxidized.',
            'Unbolt ground cable lugs, sand contact surface down to bare gleaming metal, apply dielectric grease and torque tight.'
        ],
        stepsRu: [
          'На заведенном моторе один щуп мультиметра поставьте на свинцовый минус АКБ, а второй — на чистый металл ГБЦ.',
          'Напряжение ДОЛЖНО быть ниже 0.08В (80мВ). Если прибор показывает >0.20В, провод массы окислен и имеет высокое сопротивление!',
          'Открутите болты массы, зачистите посадочные места до блеска металла, нанесите медную смазку и надежно затяните.'
],
        symptomsRo: 'Demarorul învârte greoi deși bateria e nouă, senzorii de temperatură indică eronat la pornirea farurilor.',
        symptomsEn: 'Sluggish cranking despite healthy battery, temperature gauge fluctuating when headlights are turned on.',
        symptomsRu: 'Стартер крутит вяло даже с новым АКБ, стрелка температуры дергается при включении фар.',
        partNumberRef: 'Tresă masă flexibilă cupru 250mm x 25mm²'
    },

    BRAKE_CALIPER_OR_BEARING_DRAG: {
        id: 'BRAKE_CALIPER_OR_BEARING_DRAG',
        code: 'C1095',
        system: 'ȘASIU & FRÂNE',
        titleRo: 'Etrier Frână Gripant / Culise Blocate sau Rulment Încins',
        titleEn: 'Sticking Brake Caliper / Seized Guide Pins or Bearing Drag',
        titleRu: 'Подклинивание суппорта / Заклинившие направляющие или подшипник',
        subsystem: 'brakes',
        locationRo: 'Etrierul de frână de pe roata semnalată (culisele de ghidare cauciucate și pistonul etrierului).',
        locationEn: 'Brake caliper on flagged corner (rubber slider guide pins and hydraulic caliper piston).',
        locationRu: 'Тормозной суппорт проблемного колеса (резиновые пыльники направляющих пальцев и поршень).',
        diyLevel: 'MEDIU',
        durationMin: 15,
        estimatedCostRon: '45 - 90 RON (kit culise)',
        estimatedCostEur: '9 - 18 EUR',
        tools: ['Cric și cheie de roți', 'Lanternă', 'Spray curățitor frâne', 'Vaselină siliconică pentru culise frână'],
        stepsRo: [
            'După un drum de 10 km, apropie dosul palmei (fără să atingi!) de centrul jantei suspectate: dacă radiază căldură sufocantă comparativ cu celelalte 3 roți, frâna rămâne aplicată.',
            'Ridică roata pe cric (asigură mașina). Învârte roata cu mâna — trebuie să se rotească liber cel puțin 1.5 - 2 ture complete fără efort.',
            'Dacă roata se oprește instant, desfa șuruburile culiselor, verifică dacă culisele sunt ruginite/blocate și dacă burduful pistonului e rupt.'
        ],
        stepsEn: [
            'After a 10 km drive, hover back of hand near suspect wheel rim: if radiating intense heat vs other 3 wheels, brake is dragging.',
            'Safely jack up wheel. Spin wheel by hand — must rotate freely for at least 1.5 - 2 full revolutions with zero drag.',
            'If wheel binds immediately, inspect slider guide pins for rust/gummed grease and piston dust boot for tears.'
        ],
        stepsRu: [
          'После поездки поднесите тыльную сторону ладони к диску проблемного колеса: если идет жар по сравнению с остальными, суппорт клинит.',
          'Поддомкратьте колесо. Проверните рукой: исправное колесо должно легко сделать не менее 1.5 - 2 оборотов.',
          'Если колесо встает колом, снимите направляющие, удалите ржавчину, замените смазку на высокотемпературную силиконовую.'
],
        symptomsRo: 'Mașina trage într-o parte la rulaj liber, miros înțepător de ferodou ars, consum crescut cu 1L/100km, jantă neagră de praf.',
        symptomsEn: 'Vehicle drifts to one side when coasting, burning pad odor, 1L/100km higher fuel burn, wheel rim coated in black dust.',
        symptomsRu: 'Машину уводит в сторону при накате, запах гари колодок, повышенный расход топлива, колесный диск покрыт черной пылью.',
        partNumberRef: 'Kit reparație etrier Frenkit 257014 / Ghidaje ATE'
    },

    NOZZLE_COKING_OR_PUMP_WEAR: {
        id: 'NOZZLE_COKING_OR_PUMP_WEAR',
        code: 'P0263',
        system: 'MOTOR & INJECȚIE',
        titleRo: 'Depuneri Calamină Duză Injector / Pierdere Compresie Șaibă',
        titleEn: 'Injector Nozzle Coking / Copper Crush Washer Leak',
        titleRu: 'Закоксовка распылителя форсунки / Прогар медной шайбы',
        subsystem: 'engine',
        locationRo: 'Injectoarele diesel de pe chiulasă, conectate la rampa comună prin conducte metalice individuale.',
        locationEn: 'Diesel fuel injectors seated in cylinder head, linked to rail via steel high-pressure hardlines.',
        locationRu: 'Дизельные форсунки на ГБЦ, подсоединенные к рампе индивидуальными стальными трубками высокого давления.',
        diyLevel: 'MEDIU',
        durationMin: 15,
        estimatedCostRon: '15 - 30 RON (șaibă foc)',
        estimatedCostEur: '3 - 6 EUR',
        tools: ['Lanternă LED', 'Cheie conducte 17mm', 'Cârpă curată'],
        stepsRo: [
            'Cu motorul cald și lăsat la ralanti, atinge cu degetul fiecare conductă metalică de injecție: fiecare cilindru trebuie să aibă un puls metalic ritmic și ferm.',
            'Privește cu lanterna la baza injectorului din chiulasă: caută depuneri negre lucioase de gudron întărit (efectul „Black Death”) și fâsâit ritmic de compresie scăpată pe lângă șaiba de cupru.',
            'Dacă există depuneri, șaiba termică de cupru de la baza injectorului este arsă și trebuie înlocuită imediat înainte ca injectorul să se sudeze în chiulasă.'
        ],
        stepsEn: [
            'With warm engine idling, place fingertip on each steel injection pipe: each injector must transmit a crisp, rhythmic hydraulic pulse.',
            'Shine flashlight at base of injector bore: look for glossy black carbon pitch ("Black Death") and puffing sound of escaping compression.',
            'If carbon tar is present, bottom copper crush seal is blown and must be renewed promptly before injector seizes in head.'
        ],
        stepsRu: [
          'На прогретом работающем моторе прикоснитесь пальцем к каждой металлической трубке: должна быть четкая ритмичная пульсация.',
          'Осмотрите колодцы форсунок фонариком: ищите черный смолистый нагар (эффект «Black Death») и шипение прорывающихся газов.',
          'При наличии нагара медная огнеупорная шайба под форсункой прогорела и требует срочной замены.'
],
        symptomsRo: 'Ralanti tremurat la cald, miros de gaze nearse la pornire, bătăi ușoare de injector la sarcină parțială.',
        symptomsEn: 'Rough warm idle, unburnt diesel smell around valve cover, light injector rattle under light load.',
        symptomsRu: 'Неровный холостой ход на горячую, запах несгоревшей солярки под капотом, стрекот форсунки под нагрузкой.',
        partNumberRef: 'Șaibe foc cupru Bosch F00VP01004 (15x7.3x1.5mm)'
    },

    WORN_SHOCK_ABSORBERS: {
        id: 'WORN_SHOCK_ABSORBERS',
        code: 'C1100',
        system: 'ȘASIU & FRÂNE',
        titleRo: 'Amortizoare Uzate / Pierdere Amortizare și Contact Asfalt',
        titleEn: 'Worn Shock Absorbers / Loss of Damping Ratio',
        titleRu: 'Износ амортизаторов / Потеря демпфирования подвески',
        subsystem: 'suspension',
        locationRo: 'Amortizoarele din interiorul pasajelor roților (în spatele arcurilor elicoidale).',
        locationEn: 'Suspension shock absorber / strut assemblies behind wheels inside wheel well arches.',
        locationRu: 'Стойки и амортизаторы внутри колесных арок (внутри винтовых пружин).',
        diyLevel: 'UȘOR',
        durationMin: 10,
        estimatedCostRon: '280 - 480 RON / pereche',
        estimatedCostEur: '55 - 95 EUR',
        tools: ['Lanternă LED', 'Mănuși de lucru'],
        stepsRo: [
            'Testul balansului pe colț: Apasă cu toată greutatea corpului pe aripa de deasupra roții și eliberează brusc. Caroseria trebuie să revină și să se oprească instantaneu.',
            'Dacă mașina continuă să oscileze sus-jos de 2 sau mai multe ori, amortizorul a pierdut complet uleiul sau presiunea de gaz.',
            'Privește tija cromată a amortizorului cu lanterna: dacă tubul inferior este umed sau acoperit de un strat gros de noroi lipit de ulei curs, amortizorul este compromis.'
        ],
        stepsEn: [
            'Corner bounce test: Push down firmly on fender directly above wheel and release abruptly. Chassis must rebound and settle instantly.',
            'If car continues to oscillate up and down 2 or more times, hydraulic damping oil or nitrogen charge has been lost.',
            'Inspect chrome damper rod and body with flashlight: if damp or coated in oily grime, oil seal has failed.'
        ],
        stepsRu: [
          'Тест на раскачку: резко нажмите всем весом на крыло над колесом и отпустите. Кузов должен мгновенно стабилизироваться.',
          'Если кузов продолжает качаться вверх-вниз 2 и более раз, амортизатор полностью потерял масло или давление газа.',
          'Осмотрите шток и корпус амортизатора фонариком: если корпус влажный от вытекшего масла, амортизатор вышел из строя.'
],
        symptomsRo: 'Distanță de frânare mărită, intrare violentă a ABS-ului pe asfalt denivelat, tangaj accentuat în viraje.',
        symptomsEn: 'Increased braking distance, premature ABS activation over ripples, excessive body float in corners.',
        symptomsRu: 'Увеличенный тормозной путь, раннее срабатывание ABS на неровностях, сильные крены и раскачка в поворотах.',
        partNumberRef: 'Sachs 313 045 / Bilstein B4 22-045751'
    },

    LOW_TIRE_PRESSURE_DETECTED: {
        id: 'LOW_TIRE_PRESSURE_DETECTED',
        code: 'C1088',
        system: 'ȘASIU & FRÂNE',
        titleRo: 'Presiune Anvelopă Scăzută / Pierdere Lentă de Aer',
        titleEn: 'Low Tire Pressure / Slow Air Leak',
        titleRu: 'Низкое давление в шине / Медленная утечка воздуха',
        subsystem: 'suspension',
        locationRo: 'Anvelopa și valva de cauciuc de la roata semnalată de algoritmul indirect TPMS.',
        locationEn: 'Tire tread and rubber valve stem at flagged wheel corner identified by indirect TPMS.',
        locationRu: 'Протектор шины и вентиль колеса, определенного алгоритмом косвенного контроля TPMS.',
        diyLevel: 'FOARTE UȘOR',
        durationMin: 5,
        estimatedCostRon: '5 - 35 RON',
        estimatedCostEur: '1 - 7 EUR',
        tools: ['Manometru digital', 'Pompă/compresor 12V', 'Apă cu săpun'],
        stepsRo: [
            'Măsoară presiunea la rece cu un manometru pe toate cele 4 roți. Compară cu eticheta de pe stâlpul B al șoferului (uzual 2.2 - 2.4 bar).',
            'Aplică apă cu săpun pe valva de cauciuc (inclusiv acul interior): dacă se formează bule mici, acul interior este slăbit sau corodat și pierde aer.',
            'Inspectează vizual circumferința anvelopei pentru șuruburi, cuie sau flancuri tăiate pe interior.'
        ],
        stepsEn: [
            'Measure cold tire pressure on all 4 corners with digital gauge. Compare with B-pillar door jamb label (typically 2.2-2.4 bar).',
            'Apply soapy water to valve stem and core: if bubbling, Schrader valve core is loose or leaking.',
            'Inspect tread face and inner sidewall for embedded screws, nails, or bead separation cuts.'
        ],
        stepsRu: [
          'Замерьте манометром давление на всех 4 холодных шинах. Сверьте с табличкой в проеме двери (обычно 2.2 - 2.4 бар).',
          'Нанесите мыльную воду на вентиль и золотник: появление пузырей указывает на утечку через неплотный ниппель.',
          'Внимательно осмотрите беговую дорожку протектора и внутреннюю боковину на предмет саморезов и порезов.'
],
        symptomsRo: 'Tragere ușoară a direcției spre roata dezumflată, zgomot de rulare mai pronunțat, uzură pe marginile anvelopei.',
        symptomsEn: 'Gentle steering pull toward flat corner, increased road rumble, premature shoulder tread wear.',
        symptomsRu: 'Легкий увод руля в сторону спущенного колеса, гул шин при качении, повышенный износ плечевых зон.',
        partNumberRef: 'Ventil Schrader TR414 / Șnur vulcanizare anvelope'
    },

    DIESEL_RUNAWAY_RISK: {
        id: 'DIESEL_RUNAWAY_RISK',
        code: 'EMERGENCY_RUNAWAY',
        system: 'URGENȚĂ MOTOR',
        titleRo: '🚨 PROTOCOL URGENȚĂ: Autoturare Diesel pe Ulei Motor',
        titleEn: '🚨 EMERGENCY PROTOCOL: Diesel Engine Runaway',
        titleRu: '🚨 ЭКСТРЕННЫЙ ПРОТОКОЛ: Разнос дизеля на моторном масле',
        subsystem: 'engine',
        locationRo: 'Ax turbină / Simeringuri compresor scăpate în admisie sau epurator de gaze carter (PCV) blocat.',
        locationEn: 'Turbo shaft oil seals dumping oil into intake charge piping or stuck PCV breather valve.',
        locationRu: 'Вал и масляные уплотнения турбины, гонящие масло во впуск, либо забитый клапан вентиляции картера (ВКГ).',
        diyLevel: 'CRITIC',
        durationMin: 2,
        estimatedCostRon: '900 - 1500 RON (prevenție)',
        estimatedCostEur: '180 - 300 EUR',
        tools: ['Procedură mecanică de urgență (fără scule)'],
        stepsRo: [
            'URGENȚĂ ÎN TIMPUL MERSULUI: Dacă motorul se turează la maxim și nu se oprește la cheie, calcă frâna de picior cu ambele picioare, cuplează treapta a 5-a sau a 6-a și eliberează violent ambreiajul pentru a cala forțat motorul!',
            'DACĂ EȘTI PE LOC / CUTIE AUTOMATĂ: Oprește pe dreapta, ridică capota și sufocă admisia de aer acoperind priza de aer cu o cârpă groasă sau placă de lemn (NICIODATĂ cu mâna goală!).',
            'PREVENȚIE: Desfa furtunul inferior al intercoolerului o dată pe an — dacă curge mai mult de 50ml de ulei lichid, simeringul turbinei este uzat și trebuie recondiționat.'
        ],
        stepsEn: [
            'IN-MOTION EMERGENCY: If engine revs uncontrollably beyond redline and ignores key-off, stomp footbrake with both feet, engage 5th/6th gear, drop clutch violently to stall engine mechanically!',
            'IF STATIONARY / AUTOMATIC: Pull over, pop hood, choke air intake box using a heavy rag or wooden board (NEVER bare hand!).',
            'PREVENTION: Drain intercooler lower hose annually — if >50ml liquid oil pools out, turbo seals are critically worn.'
        ],
        stepsRu: [
          'ЭКСТРЕННО В ДВИЖЕНИИ: Если мотор сам пошел в максимальные обороты и не глушится ключом, нажмите тормоз двумя ногами, включите 5-ю передачу и бросьте сцепление, чтобы механически заглушить мотор!',
          'НА МЕСТЕ / АКПП: Остановитесь, откройте капот и перекройте забор воздуха плотной тряпкой или доской (НИКОГДА голой рукой!).',
          'ПРОФИЛАКТИКА: Раз в год снимайте нижний патрубок интеркулера — если выливается более 50 мл масла, турбина требует срочного ремонта.'
],
        symptomsRo: 'Nori de fum alb-albăstrui dens în spate, motorul se accelerează singur dincolo de linia roșie (5000+ RPM).',
        symptomsEn: 'Massive white-blue smoke cloud behind vehicle, engine revving uncontrollably past redline on its own oil.',
        symptomsRu: 'Густые клубы сизо-белого дыма сзади, двигатель сам раскручивается далеко за красную зону (выше 5000 об/мин).',
        partNumberRef: 'Calare mecanică imediată / Recondiționare turbină CHRA'
    }
};

/**
 * Găsește fișa mecanică potrivită pe baza ID-ului, codului DTC sau cuvintelor cheie
 */
export function getMechanicGuide(key) {
    if (!key) return null;
    const normalized = String(key).toUpperCase().replace(/[\s-]/g, '_');

    // 1. Căutare directă după cheie
    if (PHYSICAL_MECHANIC_GUIDES[normalized]) {
        return PHYSICAL_MECHANIC_GUIDES[normalized];
    }

    // 2. Căutare după cod DTC sau aliasuri
    for (const guide of Object.values(PHYSICAL_MECHANIC_GUIDES)) {
        if (guide.code && guide.code.toUpperCase() === normalized) {
            return guide;
        }
        if (normalized.includes('TURBO') || normalized.includes('BOOST') || normalized.includes('P0299')) {
            return PHYSICAL_MECHANIC_GUIDES.INTERCOOLER_BOOST_LEAK;
        }
        if (normalized.includes('N75') || normalized.includes('OVERBOOST') || normalized.includes('P0234')) {
            return PHYSICAL_MECHANIC_GUIDES.VNT_N75_SPIKE;
        }
        if (normalized.includes('THERMOSTAT') || normalized.includes('TERMOSTAT') || normalized.includes('P0128')) {
            return PHYSICAL_MECHANIC_GUIDES.THERMOSTAT_STUCK_OPEN;
        }
        if (normalized.includes('RADIATOR') || normalized.includes('OVERHEAT') || normalized.includes('HEAT_EXCHANGE')) {
            return PHYSICAL_MECHANIC_GUIDES.RESTRICTED_HEAT_EXCHANGE;
        }
        if (normalized.includes('DIODE') || normalized.includes('ALTERNATOR') || normalized.includes('P0562')) {
            return PHYSICAL_MECHANIC_GUIDES.ALTERNATOR_DIODE_FAULT;
        }
        if (normalized.includes('GROUND') || normalized.includes('MASA') || normalized.includes('WIRING')) {
            return PHYSICAL_MECHANIC_GUIDES.GROUND_WIRING_DROP;
        }
        if (normalized.includes('CALIPER') || normalized.includes('BEARING') || normalized.includes('FRANA') || normalized.includes('FADE')) {
            return PHYSICAL_MECHANIC_GUIDES.BRAKE_CALIPER_OR_BEARING_DRAG;
        }
        if (normalized.includes('INJECTOR') || normalized.includes('COKING') || normalized.includes('P0263')) {
            return PHYSICAL_MECHANIC_GUIDES.NOZZLE_COKING_OR_PUMP_WEAR;
        }
        if (normalized.includes('SHOCK') || normalized.includes('SUSPENS') || normalized.includes('AMORTIZOR')) {
            return PHYSICAL_MECHANIC_GUIDES.WORN_SHOCK_ABSORBERS;
        }
        if (normalized.includes('TIRE') || normalized.includes('TPMS') || normalized.includes('PRESIUNE_ROTI')) {
            return PHYSICAL_MECHANIC_GUIDES.LOW_TIRE_PRESSURE_DETECTED;
        }
        if (normalized.includes('RUNAWAY') || normalized.includes('AUTOTURARE')) {
            return PHYSICAL_MECHANIC_GUIDES.DIESEL_RUNAWAY_RISK;
        }
    }

    return null;
}
