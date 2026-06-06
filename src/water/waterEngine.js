const EventBus = require('../core/eventBus');

class WaterEngine {
    constructor(stateManager, timeManager) {
        this.state = stateManager;
        this.timeManager = timeManager;
    }
    update(dt) {
        const water = this.state.state.water;
        const fish = this.state.state.fish;
        const actuators = this.state.state.actuators;
        const hourFactor = this.timeManager.getHourFactor();
        water.temperature += hourFactor * 0.15 * dt;
        water.oxygen -= fish.totalBiomass * 0.0004 * dt;
        if (actuators.aerator) water.oxygen += 0.8 * dt;
        if (hourFactor > 0) water.oxygen += hourFactor * 0.1 * dt;
        water.ammonia += fish.dailyFeed * 0.025 * dt;
        if (water.oxygen > 2 && water.temperature > 15) {
            const tempFactor = Math.max(0.1, (water.temperature - 10) / 20);
            const nitrificationRate = 0.15 * tempFactor * dt;
            const nh3Oxidized = water.ammonia * nitrificationRate;
            water.ammonia -= nh3Oxidized;
            water.nitrite += nh3Oxidized * 0.9;
            const no2Oxidized = water.nitrite * nitrificationRate * 0.8;
            water.nitrite -= no2Oxidized;
            water.nitrate += no2Oxidized;
            water.alkalinity -= nh3Oxidized * 7.14 * 0.01;
        }
        water.ph += (Math.random() - 0.5) * 0.03 * dt;
        if (water.ph < 6.0) water.ph += 0.02 * dt;
        if (water.ph > 8.5) water.ph -= 0.02 * dt;
        water.temperature = Math.max(5, Math.min(40, water.temperature));
        water.oxygen = Math.max(0, Math.min(15, water.oxygen));
        water.ammonia = Math.max(0, Math.min(1, water.ammonia));
        water.nitrite = Math.max(0, water.nitrite);
        water.nitrate = Math.max(0, water.nitrate);
        water.ph = Math.max(5, Math.min(9, water.ph));
        water.alkalinity = Math.max(10, water.alkalinity);
        this.checkAlarms();
        this.state.state.water = water;
    }
    checkAlarms() {
        const water = this.state.state.water;
        const config = require('../config/species.json')[this.state.state.fish.species];
        if (!config) return;
        if (water.oxygen < config.water.oxygen.min) EventBus.emit('alarm', { type: 'critical', title: 'OXIGENO CRITICO', message: water.oxygen.toFixed(1) + ' mg/L' });
        if (water.ammonia > config.water.ammonia.max * 1.5) EventBus.emit('alarm', { type: 'critical', title: 'AMONIACO TOXICO', message: water.ammonia.toFixed(3) + ' ppm' });
        if (water.nitrite > config.water.nitrite.max) EventBus.emit('alarm', { type: 'warning', title: 'NITRITO ELEVADO', message: water.nitrite.toFixed(3) + ' ppm' });
    }
}
module.exports = WaterEngine;
