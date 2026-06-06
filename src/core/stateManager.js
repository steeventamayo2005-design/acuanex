const EventBus = require('./eventBus');
const fs = require('fs');
const path = require('path');

class StateManager {
    constructor() {
        this.state = {
            system: { status: 'running', startedAt: new Date().toISOString(), mode: 'simulation' },
            water: { temperature: 26.5, ph: 7.2, oxygen: 6.5, ammonia: 0.02, nitrite: 0.005, nitrate: 10.0, alkalinity: 80, turbidity: 15 },
            fish: { species: 'tilapia', population: 500, averageWeight: 250, totalBiomass: 125, fcr: 1.4, dailyFeed: 3.75, mortality: 0, stressLevel: 2, daysInCulture: 45, harvestWeight: 500 },
            feeding: { totalFeedConsumed: 0, feedingsToday: 0, lastFeedingTime: null, feedInStock: 200 },
            economics: { feedCostPerKg: 0.85, electricityCostPerDay: 3.50, fishPricePerKg: 4.50, totalCost: 0, totalRevenue: 0, profit: 0 },
            actuators: { pump: false, aerator: false, heater: false, feeder: false },
            alerts: []
        };
        this.history = [];
    }
    loadFromFile(filePath) {
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            this.state = data.state || data;
            return true;
        }
        return false;
    }
    saveToFile(filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify({ state: this.state, timestamp: new Date().toISOString() }, null, 2));
    }
}
module.exports = new StateManager();
