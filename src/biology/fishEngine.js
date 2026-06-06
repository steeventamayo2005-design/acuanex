const EventBus = require('../core/eventBus');

class FishEngine {
    constructor(stateManager, timeManager) {
        this.state = stateManager;
        this.timeManager = timeManager;
    }
    update(dt) {
        const fish = this.state.state.fish;
        const water = this.state.state.water;
        const feeding = this.state.state.feeding;
        const config = require('../config/species.json')[fish.species];
        if (!config) return;
        const tempFactor = this.calculateTempFactor(water.temperature, config.water.temperature);
        const oxyFactor = Math.min(1, water.oxygen / config.water.oxygen.optimal);
        const nh3Factor = Math.max(0, 1 - water.ammonia / config.water.ammonia.max);
        const baseSGR = config.growth.growthRate;
        const effectiveSGR = baseSGR * tempFactor * oxyFactor * nh3Factor;
        const previousWeight = fish.averageWeight;
        fish.averageWeight = Math.min(config.growth.maxWeight, previousWeight * Math.exp(effectiveSGR * dt));
        fish.totalBiomass = (fish.population * fish.averageWeight) / 1000;
        const feedRate = config.growth.dailyFeedRate * tempFactor;
        fish.dailyFeed = Math.max(0.1, fish.totalBiomass * feedRate);
        const weightGain = (fish.averageWeight - previousWeight) * fish.population / 1000;
        fish.fcr = weightGain > 0 ? (fish.dailyFeed * dt) / weightGain : config.growth.fcr;
        fish.daysInCulture += dt;
        fish.stressLevel = Math.round((1 - tempFactor) * 4 + (1 - oxyFactor) * 3 + (1 - nh3Factor) * 3);
        if (fish.stressLevel > 7) {
            const mortalityRate = (fish.stressLevel - 6) * 0.001 * dt;
            const deaths = Math.max(1, Math.floor(fish.population * mortalityRate));
            if (deaths > 0) {
                fish.population -= deaths;
                fish.mortality += deaths;
                EventBus.emit('alarm', { type: 'critical', title: 'Mortalidad', message: deaths + ' peces muertos' });
            }
        }
        feeding.feedInStock = Math.max(0, (feeding.feedInStock || 200) - fish.dailyFeed * dt);
        feeding.totalFeedConsumed = (feeding.totalFeedConsumed || 0) + fish.dailyFeed * dt;
        if (feeding.feedInStock < fish.dailyFeed * 3) {
            EventBus.emit('alarm', { type: 'warning', title: 'Alimento bajo', message: 'Quedan ' + feeding.feedInStock.toFixed(0) + ' kg' });
        }
        this.state.state.fish = fish;
        this.state.state.feeding = feeding;
    }
    calculateTempFactor(temp, range) {
        if (temp < range.min - 3 || temp > range.max + 3) return 0.1;
        if (temp < range.min || temp > range.max) return 0.5;
        const optimal = range.optimal || (range.min + range.max) / 2;
        return 1 - Math.abs(temp - optimal) / (range.max - range.min);
    }
}
module.exports = FishEngine;
