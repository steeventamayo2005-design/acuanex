const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('frontend'));
app.use(express.json());

const EventBus = require('./backend/eventBus');
const StateManager = require('./backend/stateManager');
const TimeManager = require('./backend/timeManager');
const WaterEngine = require('./backend/simulation/waterEngine');
const FishEngine = require('./backend/biology/fishEngine');

const timeManager = new TimeManager(360);
const waterEngine = new WaterEngine(StateManager, timeManager);
const fishEngine = new FishEngine(StateManager);

let lastSimTime = Date.now();

// Escuchar alarmas
EventBus.on('alarm', function(alarm) {
    StateManager.state.alerts.unshift({
        type: alarm.type,
        title: alarm.title,
        message: alarm.message,
        timestamp: new Date().toISOString()
    });
    if (StateManager.state.alerts.length > 50) StateManager.state.alerts.pop();
});

// Generar recomendaciones
function generateRecommendations() {
    const recs = [];
    const w = StateManager.state.water;
    const f = StateManager.state.fish;
    const cfg = require('./config/species.json')[f.species];
    if (!cfg) return recs;
    
    if (w.oxygen < cfg.water.oxygen.min) recs.push({ priority: 'high', action: 'Activar aireador', reason: 'O2: ' + w.oxygen.toFixed(1) + ' mg/L' });
    if (w.ammonia > cfg.water.ammonia.max) recs.push({ priority: 'high', action: 'Reducir alimentacion', reason: 'NH3: ' + w.ammonia.toFixed(3) + ' ppm' });
    if (w.temperature > cfg.water.temperature.max) recs.push({ priority: 'medium', action: 'Aumentar recirculacion', reason: 'Temp: ' + w.temperature.toFixed(1) + 'C' });
    else if (w.temperature < cfg.water.temperature.min) recs.push({ priority: 'medium', action: 'Activar calentador', reason: 'Temp: ' + w.temperature.toFixed(1) + 'C' });
    if (f.stressLevel > 6) recs.push({ priority: 'high', action: 'Suspender alimentacion', reason: 'Estres: ' + f.stressLevel + '/10' });
    if (f.averageWeight >= f.harvestWeight * 0.9) recs.push({ priority: 'info', action: 'Planificar cosecha', reason: 'Peso: ' + f.averageWeight.toFixed(0) + 'g' });
    const feed = StateManager.state.feeding;
    if ((feed.feedInStock || 200) < f.dailyFeed * 7) recs.push({ priority: 'medium', action: 'Comprar alimento', reason: 'Stock: ' + (feed.feedInStock || 0).toFixed(0) + 'kg' });
    
    return recs;
}

// API
app.get('/api/state', function(req, res) {
    res.json(StateManager.state);
});

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'frontend', 'dashboard', 'index.html'));
});

// Simulación
function simulate() {
    var now = Date.now();
    var realDelta = Math.min(1, (now - lastSimTime) / 1000);
    lastSimTime = now;
    var simDays = timeManager.advance(realDelta);
    fishEngine.update(simDays);
    waterEngine.update(simDays);
    StateManager.state.recommendations = generateRecommendations();
}

// Broadcast a clientes
function broadcast() {
    StateManager.state.simTime = timeManager.getFormattedTime();
    io.emit('state:update', StateManager.state);
}

// WebSocket
io.on('connection', function(socket) {
    console.log('Cliente conectado');
    broadcast();
    socket.on('actuator:toggle', function(data) {
        StateManager.state.actuators[data.actuator] = data.status;
        broadcast();
    });
    socket.on('species:change', function(data) {
        StateManager.state.fish.species = data.species;
        broadcast();
    });
});

// Iniciar
var PORT = 3000;
server.listen(PORT, function() {
    console.log('');
    console.log('🧬 AcuaEvolution v1.0 Desktop');
    console.log('🌐 http://localhost:' + PORT);
    console.log('🐟 Simulacion iniciada');
    console.log('');
    setInterval(simulate, 2000);
    setInterval(broadcast, 2000);
});
