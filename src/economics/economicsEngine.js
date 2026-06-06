const EventBus = require('../core/eventBus');

class EconomicsEngine {
    constructor(stateManager) {
        this.state = stateManager;
    }
    update(dt) {
        const fish = this.state.state.fish;
        const economics = this.state.state.economics;
        const feeding = this.state.state.feeding;
        const actuators = this.state.state.actuators;
        const dailyFeedCost = fish.dailyFeed * economics.feedCostPerKg;
        let electricityCost = 1.0;
        if (actuators.aerator) electricityCost += 1.5;
        if (actuators.pump) electricityCost += 1.0;
        if (actuators.heater) electricityCost += 2.0;
        economics.electricityCostPerDay = electricityCost;
        const dailyCost = dailyFeedCost + electricityCost;
        economics.totalCost += dailyCost * dt;
        economics.totalRevenue = fish.totalBiomass * economics.fishPricePerKg;
        economics.profit = economics.totalRevenue - economics.totalCost;
        if ((feeding.feedInStock || 200) < fish.dailyFeed * 5) {
            EventBus.emit('alarm', { type: 'warning', title: 'REORDENAR ALIMENTO', message: 'Stock bajo: ' + (feeding.feedInStock || 0).toFixed(0) + ' kg' });
        }
        this.state.state.economics = economics;
    }
}
module.exports = EconomicsEngine;
