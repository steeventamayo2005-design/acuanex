class TimeManager {
    constructor(speedMultiplier = 360) {
        this.speed = speedMultiplier;
        this.simTime = 0;
        this.simDay = 1;
        this.simHour = 6;
    }
    advance(realDeltaSeconds) {
        const simDelta = realDeltaSeconds * this.speed;
        this.simTime += simDelta;
        this.simDay = Math.floor(this.simTime / 86400) + 1;
        this.simHour = Math.floor((this.simTime % 86400) / 3600);
        return simDelta / 86400;
    }
    getFormattedTime() {
        const h = String(this.simHour).padStart(2, '0');
        const m = String(Math.floor((this.simTime % 3600) / 60)).padStart(2, '0');
        const period = this.simHour >= 12 ? 'PM' : 'AM';
        const dh = this.simHour > 12 ? this.simHour - 12 : (this.simHour === 0 ? 12 : this.simHour);
        return 'Dia ' + this.simDay + ' - ' + dh + ':' + m + ' ' + period;
    }
    getHourFactor() {
        return Math.sin((this.simHour - 6) * Math.PI / 12);
    }
}
module.exports = TimeManager;
