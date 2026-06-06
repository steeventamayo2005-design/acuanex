class EventBus {
    constructor() {
        this.listeners = {};
        this.log = [];
    }
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
        return () => this.off(event, callback);
    }
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
    emit(event, data = {}) {
        this.log.push({ event, data, timestamp: new Date().toISOString() });
        if (this.log.length > 100) this.log.shift();
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(cb => { try { cb(data); } catch(e) { console.error(e); } });
    }
}
module.exports = new EventBus();
