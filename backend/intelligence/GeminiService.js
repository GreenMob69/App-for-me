'use strict';

const Groq = require('groq-sdk');

let _client = null;

function getClient() {
    if (!_client) {
        const key = process.env.GROQ_API_KEY;
        if (!key) throw new Error('GROQ_API_KEY lipsă din .env');
        _client = new Groq({ apiKey: key });
    }
    return _client;
}

function buildSystemPrompt(ctx) {
    const v  = ctx.vehicle        || {};
    const h  = ctx.health         || {};
    const ds = ctx.drivingStyle   || {};
    const fe = ctx.fuelEfficiency || {};

    const healthLabel = (score) => {
        if (score == null) return 'necunoscut';
        if (score >= 90)   return 'excelentă';
        if (score >= 75)   return 'bună';
        if (score >= 60)   return 'acceptabilă';
        if (score >= 40)   return 'precară';
        return 'critică';
    };

    const subsystemLines = Object.entries(h.subsystems || {})
        .map(([k, s]) => `  • ${k}: ${s.score ?? '?'}/100 (${s.status ?? '?'})`)
        .join('\n') || '  • (date indisponibile)';

    const predictionLines = (ctx.predictions || []).slice(0, 5)
        .map(p => `  • ${p.component}: ${p.probability}% risc, severitate ${p.severity}`)
        .join('\n') || '  • (nicio predicție activă)';

    const dtcLines = (ctx.dtc || []).slice(0, 3)
        .map(d => `  • ${d.code}: ${d.shortDesc || d.description || ''}`)
        .join('\n') || '  • (niciun cod activ)';

    const overallScore = h.overallScore ?? null;

    return `Ești ARIA — Automotive Reasoning & Intelligence Assistant — un expert tehnic auto cu personalitate caldă și directă. Ești atașat de această mașină și vrei sincer să o menții în formă bună.

MAȘINA TA: ${[v.make, v.model, v.year, v.engine, v.fuelType].filter(Boolean).join(' · ')}
STARE GENERALĂ: ${overallScore ?? '?'}/100 — ${healthLabel(overallScore)} (alertă: ${h.alertLevel || 'NORMAL'})

SUBSISTEME:
${subsystemLines}

RISCURI DETECTATE:
${predictionLines}

CODURI EROARE:
${dtcLines}

CONDUS:
  • Consum mediu: ${fe.avgConsumptionL100 ?? '?'} L/100km
  • Eco Score: ${ds.avgEcoScore ?? '?'}/100
  • Curse înregistrate: ${ctx.tripCount ?? '?'}

CUM RĂSPUNZI:
- Vorbești ca un mecanic experimentat care cunoaște mașina — nu ca un robot care citește date
- Folosești cifrele de mai sus ca argumente concrete, nu le inventezi
- Dacă ceva e îngrijorător, spui clar și pe înțeles — fără dramă, dar fără minimalizat
- Dacă ceva e ok, confirmi scurt și treci mai departe
- Răspunzi în română naturală, nu formală — poți folosi expresii de genul "mă îngrijorează puțin", "e ok deocamdată", "aș ține ochii pe asta"
- La follow-up-uri, construiești pe ce s-a spus anterior — nu o iei de la capăt
- Lungime: cât e nevoie — nici prea scurt dacă e complex, nici prea lung dacă e simplu
- Dacă nu ai date suficiente pentru un răspuns precis, recunoști asta sincer`;
}

async function enhanceWithGemini(question, ctx, baseAnswer, intent, history = []) {
    try {
        const client = getClient();

        const conversationHistory = (history || []).flatMap(m => {
            if (m.role === 'user') return [{ role: 'user',      content: m.text || '' }];
            if (m.role === 'ai')   return [{ role: 'assistant', content: m.text || '' }];
            return [];
        });

        // baseAnswer e hint intern — ajuta AI sa stie contextul tehnic
        // dar nu il constrange sa il parafrazeze
        const hintLine = baseAnswer
            ? `[Hint tehnic intern, nu cita direct: ${baseAnswer}]`
            : '';

        const userMessage = hintLine ? `${hintLine}\n\n${question}` : question;

        const completion = await client.chat.completions.create({
            model:       'llama-3.3-70b-versatile',
            temperature: 0.7,
            max_tokens:  350,
            messages: [
                { role: 'system', content: buildSystemPrompt(ctx) },
                ...conversationHistory,
                { role: 'user',   content: userMessage },
            ],
        });

        const text = completion.choices?.[0]?.message?.content?.trim();
        return text || null;
    } catch (err) {
        console.error('[AIService] Eroare:', err.message);
        return null;
    }
}

module.exports = { enhanceWithGemini };
