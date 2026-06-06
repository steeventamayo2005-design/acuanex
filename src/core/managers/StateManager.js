/**
 * Gestor de Estado Global del Sistema
 * Centraliza y sincroniza el estado de todos los subsistemas
 */
import EventEmitter from 'events';

class StateManager extends EventEmitter {
  constructor() {
    super();
    this.state = {
      // Estado del sistema
      system: {
        status: 'initializing', // initializing, running, paused, error
        startTime: null,
        lastUpdate: null
      },
      
      // Parámetros del agua (tiempo real)
      water: {
        temperature: 26.0,
        ph: 7.0,
        dissolvedOxygen: 6.0,
        tan: 0.5,
        no2: 0.1,
        no3: 40.0,
        turbidity: 15.0,
        conductivity: 2.5,
        waterLevel: 95.0,
        flowRate: 120.0
      },
      
      // Estado de los peces
      fish: {
        species: 'tilapia',
        population: 500,
        averageWeight: 0.15, // kg
        totalBiomass: 75.0, // kg
        healthIndex: 95.0, // %
        feedingRate: 2.5, // % biomasa/día
        lastFeeding: null,
        growthStage: 'juvenile' // fingerling, juvenile, grower, finisher
      },
      
      // Equipos y actuadores
      equipment: {
        pumps: {
          main: { status: 'off', speed: 0, runtime: 0 },
          backup: { status: 'standby', speed: 0, runtime: 0 },
          dosing: { status: 'off', activeChannel: null }
        },
        aerators: [
          { id: 1, status: 'off', intensity: 0 },
          { id: 2, status: 'off', intensity: 0 }
        ],
        heaters: { status: 'off', targetTemp: 26.0, currentTemp: 26.0 },
        feeders: { status: 'idle', nextFeeding: null, portion: 0 },
        lights: { status: 'off', intensity: 0, photoperiod: 'day' }
      },
      
      // Economía y costos
      economics: {
        totalCost: 0.0,
        operationalCost: 0.0,
        feedCost: 0.0,
        energyCost: 0.0,
        laborCost: 0.0,
        projectedRevenue: 0.0,
        profit: 0.0,
        roi: 0.0
      },
      
      // Alertas activas
      alarms: [],
      
      // Recomendaciones del asesor
      recommendations: [],
      
      // Modo de operación
      mode: 'simulation', // simulation, semi-auto, full-auto
      lastSync: Date.now()
    };
    
    this.history = [];
    this.maxHistoryLength = 1000;
  }
  
  /**
   * Actualiza una parte específica del estado
   */
  update(category, key, value, emit = true) {
    const timestamp = Date.now();
    
    if (this.state[category] === undefined) {
      console.warn(`Categoría desconocida: ${category}`);
      return false;
    }
    
    if (typeof this.state[category] !== 'object') {
      console.warn(`Categoría no es un objeto: ${category}`);
      return false;
    }
    
    // Actualizar valor
    const oldValue = this.state[category][key];
    this.state[category][key] = value;
    this.state.lastUpdate = timestamp;
    
    // Registrar en histórico
    this.addToHistory({ category, key, value, oldValue, timestamp });
    
    // Emitir evento de cambio
    if (emit) {
      this.emit('stateChanged', { category, key, value, oldValue, timestamp });
      this.emit(`${category}.${key}`, { value, oldValue, timestamp });
    }
    
    return true;
  }
  
  /**
   * Actualiza múltiples valores en una categoría
   */
  updateBulk(category, updates, emit = true) {
    const timestamp = Date.now();
    
    if (!this.state[category]) {
      return false;
    }
    
    Object.keys(updates).forEach(key => {
      const oldValue = this.state[category][key];
      this.state[category][key] = updates[key];
      this.addToHistory({ category, key, value: updates[key], oldValue, timestamp });
    });
    
    this.state.lastUpdate = timestamp;
    
    if (emit) {
      this.emit('stateChanged', { category, updates, timestamp });
      this.emit(`${category}.bulk`, { updates, timestamp });
    }
    
    return true;
  }
  
  /**
   * Obtiene el estado completo o parcial
   */
  getState(category = null) {
    if (category) {
      return { ...this.state[category] };
    }
    return { ...this.state };
  }
  
  /**
   * Agrega una alarma al sistema
   */
  addAlarm(alarm) {
    const alarmWithMeta = {
      ...alarm,
      id: `alarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      acknowledged: false
    };
    
    this.state.alarms.push(alarmWithMeta);
    this.emit('alarmAdded', alarmWithMeta);
    this.emit('alarmsChanged', this.state.alarms);
    
    return alarmWithMeta.id;
  }
  
  /**
   * Reconoce/elimina una alarma
   */
  acknowledgeAlarm(alarmId) {
    const index = this.state.alarms.findIndex(a => a.id === alarmId);
    if (index !== -1) {
      this.state.alarms[index].acknowledged = true;
      this.emit('alarmAcknowledged', alarmId);
      return true;
    }
    return false;
  }
  
  /**
   * Elimina una alarma
   */
  removeAlarm(alarmId) {
    const index = this.state.alarms.findIndex(a => a.id === alarmId);
    if (index !== -1) {
      this.state.alarms.splice(index, 1);
      this.emit('alarmRemoved', alarmId);
      return true;
    }
    return false;
  }
  
  /**
   * Agrega una recomendación
   */
  addRecommendation(recommendation) {
    const recWithMeta = {
      ...recommendation,
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      implemented: false
    };
    
    this.state.recommendations.push(recWithMeta);
    this.emit('recommendationAdded', recWithMeta);
    
    return recWithMeta.id;
  }
  
  /**
   * Marca una recomendación como implementada
   */
  implementRecommendation(recId) {
    const index = this.state.recommendations.findIndex(r => r.id === recId);
    if (index !== -1) {
      this.state.recommendations[index].implemented = true;
      this.emit('recommendationImplemented', recId);
      return true;
    }
    return false;
  }
  
  /**
   * Agrega al histórico
   */
  addToHistory(entry) {
    this.history.push(entry);
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
    }
  }
  
  /**
   * Obtiene el histórico
   */
  getHistory(limit = 100, category = null) {
    let filtered = this.history;
    if (category) {
      filtered = this.history.filter(h => h.category === category);
    }
    return filtered.slice(-limit);
  }
  
  /**
   * Cambia el modo de operación
   */
  setMode(mode) {
    if (['simulation', 'semi-auto', 'full-auto'].includes(mode)) {
      this.state.mode = mode;
      this.emit('modeChanged', mode);
      return true;
    }
    return false;
  }
  
  /**
   * Inicia el sistema
   */
  start() {
    this.state.system.status = 'running';
    this.state.system.startTime = Date.now();
    this.emit('systemStarted', { timestamp: this.state.system.startTime });
  }
  
  /**
   * Pausa el sistema
   */
  pause() {
    this.state.system.status = 'paused';
    this.emit('systemPaused', { timestamp: Date.now() });
  }
  
  /**
   * Detiene el sistema
   */
  stop() {
    this.state.system.status = 'stopped';
    this.emit('systemStopped', { timestamp: Date.now() });
  }
  
  /**
   * Establece estado de error
   */
  setError(error) {
    this.state.system.status = 'error';
    this.state.system.error = error;
    this.emit('systemError', error);
  }
}

// Singleton
let stateManagerInstance = null;

export function getStateManager() {
  if (!stateManagerInstance) {
    stateManagerInstance = new StateManager();
  }
  return stateManagerInstance;
}

export default StateManager;
