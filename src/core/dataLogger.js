const fs = require('fs');
const path = require('path');

class DataLogger {
    constructor(basePath) {
        this.basePath = basePath || './src/data/history';
        this.buffers = { water: [], fish: [], economics: [], alerts: [] };
        this.maxBufferSize = 100;
        this.recordCount = 0;
        if (!fs.existsSync(this.basePath)) fs.mkdirSync(this.basePath, { recursive: true });
    }
    logWater(data, simTime) {
        this.buffers.water.push({ timestamp: new Date().toISOString(), simTime, temperature: data.temperature, ph: data.ph, oxygen: data.oxygen, ammonia: data.ammonia, nitrite: data.nitrite, nitrate: data.nitrate, alkalinity: data.alkalinity });
        this.recordCount++;
        this.checkFlush();
    }
    logFish(data, simTime) {
        this.buffers.fish.push({ timestamp: new Date().toISOString(), simTime, population: data.population, averageWeight: data.averageWeight, totalBiomass: data.totalBiomass, fcr: data.fcr, dailyFeed: data.dailyFeed, stressLevel: data.stressLevel, mortality: data.mortality });
        this.recordCount++;
        this.checkFlush();
    }
    logEconomics(data, simTime) {
        this.buffers.economics.push({ timestamp: new Date().toISOString(), simTime, dailyCost: data.electricityCostPerDay, totalCost: data.totalCost, totalRevenue: data.totalRevenue, profit: data.profit });
        this.recordCount++;
        this.checkFlush();
    }
    logAlert(alert) {
        this.buffers.alerts.push({ timestamp: new Date().toISOString(), type: alert.type, title: alert.title, message: alert.message });
        this.recordCount++;
        this.flushBuffer('alerts');
    }
    checkFlush() {
        var total = 0;
        var keys = Object.keys(this.buffers);
        for (var i = 0; i < keys.length; i++) {
            total += this.buffers[keys[i]].length;
        }
        if (total >= this.maxBufferSize) this.flushAll();
    }
    flushAll() {
        var keys = Object.keys(this.buffers);
        for (var i = 0; i < keys.length; i++) {
            if (this.buffers[keys[i]].length > 0) this.flushBuffer(keys[i]);
        }
    }
    flushBuffer(name) {
        var buffer = this.buffers[name];
        if (buffer.length === 0) return;
        var today = new Date().toISOString().slice(0, 10);
        var filePath = path.join(this.basePath, name + '_' + today + '.json');
        var existing = [];
        if (fs.existsSync(filePath)) {
            try { existing = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) {}
        }
        fs.writeFileSync(filePath, JSON.stringify(existing.concat(buffer), null, 2));
        this.buffers[name] = [];
    }
    loadDay(name, date) {
        var filePath = path.join(this.basePath, name + '_' + date + '.json');
        if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return [];
    }
    loadRecentDays(name, days) {
        days = days || 7;
        var all = [];
        for (var i = 0; i < days; i++) {
            var d = new Date();
            d.setDate(d.getDate() - i);
            all = all.concat(this.loadDay(name, d.toISOString().slice(0, 10)));
        }
        return all;
    }
}
module.exports = DataLogger;
