'use strict';

function buildTripInsights(rezultat) {
    if (!rezultat) return [];
    const insights = [];
    const { summary, health, ai } = rezultat;

    if (health.overallHealth >= 90) {
        insights.push({ type: 'POSITIVE', icon: '✓', text: 'Cursă excelentă — toate sistemele în parametri optimi' });
    } else if (health.overallHealth < 60) {
        insights.push({ type: 'NEGATIVE', icon: '!', text: 'Sănătatea vehiculului a scăzut sub 60% în această cursă' });
    }

    const aggressivePct = summary.drivingStyle?.aggressivePct || 0;
    const economicPct   = summary.drivingStyle?.economicPct   || 0;
    if (aggressivePct > 25) {
        insights.push({ type: 'WARNING', icon: '⚡', text: `Condus agresiv ${Math.round(aggressivePct)}% din cursă — impact pe consum și uzură` });
    } else if (economicPct > 60) {
        insights.push({ type: 'POSITIVE', icon: '✓', text: `Condus economic ${Math.round(economicPct)}% din cursă — excelent!` });
    }

    const hardBrakes = summary.events?.hardBrakes        || 0;
    const hardAccels = summary.events?.hardAccelerations || 0;
    if (hardBrakes + hardAccels > 3) {
        insights.push({ type: 'WARNING', icon: '⚠', text: `${hardBrakes + hardAccels} evenimente bruște — frânări și accelerări agresive` });
    } else if (hardBrakes === 0 && hardAccels === 0) {
        insights.push({ type: 'POSITIVE', icon: '✓', text: 'Zero evenimente bruște — condus fluent și anticipativ' });
    }

    const coolantMax = summary.pid?.coolant?.max || 0;
    if (coolantMax > 100) {
        insights.push({ type: 'NEGATIVE', icon: '!', text: `Temperatura antigel a atins ${coolantMax}°C — supraîncălzire!` });
    }

    const voltMin = summary.pid?.voltage?.min || 14;
    if (voltMin < 13.2) {
        insights.push({ type: 'WARNING', icon: '⚡', text: `Tensiune minimă ${voltMin}V — posibilă problemă alternator` });
    }

    const predictions = ai?.intelligence?.predictions || [];
    const highPred = predictions.find(p => p.severity === 'HIGH');
    if (highPred) {
        insights.push({ type: 'NEGATIVE', icon: '!', text: `${highPred.component}: probabilitate ${highPred.probability}% defecțiune — verificare recomandată` });
    }

    return insights.slice(0, 4);
}

module.exports = { buildTripInsights };
