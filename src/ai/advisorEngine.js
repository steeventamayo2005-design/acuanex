class AdvisorEngine {
    constructor(stateManager) {
        this.state = stateManager;
        this.recommendations = [];
    }
    analyze() {
        const water = this.state.state.water;
        const fish = this.state.state.fish;
        const config = require('../config/species.json')[fish.species];
        if (!config) return [];
        this.recommendations = [];
        if (water.oxygen < config.water.oxygen.min) {
            this.recommendations.push({ priority: 'high', action: 'Activar aireador', reason: 'Oxigeno bajo: ' + water.oxygen.toFixed(1) + ' mg/L' });
        }
        if (water.ammonia > config.water.ammonia.max) {
            this.recommendations.push({ priority: 'high', action: 'Reducir alimentacion 30%', reason: 'Amoniaco alto: ' + water.ammonia.toFixed(3) + ' ppm' });
        }
        if (water.temperature > config.water.temperature.max) {
            this.recommendations.push({ priority: 'medium', action: 'Aumentar recirculacion', reason: 'Temperatura alta: ' + water.temperature.toFixed(1) + 'C' });
        } else if (water.temperature < config.water.temperature.min) {
            this.recommendations.push({ priority: 'medium', action: 'Activar calentador', reason: 'Temperatura baja: ' + water.temperature.toFixed(1) + 'C' });
        }
        if (fish.stressLevel > 6) {
            this.recommendations.push({ priority: 'high', action: 'Suspender alimentacion', reason: 'Estres alto: ' + fish.stressLevel + '/10' });
        }
        if (fish.averageWeight >= fish.harvestWeight * 0.9) {
            this.recommendations.push({ priority: 'info', action: 'Planificar cosecha', reason: 'Peso: ' + fish.averageWeight.toFixed(0) + 'g' });
        }
        const feeding = this.state.state.feeding;
        if ((feeding.feedInStock || 200) < fish.dailyFeed * 7) {
            this.recommendations.push({ priority: 'medium', action: 'Comprar alimento', reason: 'Quedan ' + (feeding.feedInStock || 0).toFixed(0) + ' kg' });
        }
        return this.recommendations;
    }
    getRecommendations() { return this.recommendations; }
}
module.exports = AdvisorEngine;
