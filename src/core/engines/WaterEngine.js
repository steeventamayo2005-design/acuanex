/**
 * Motor de Gestión del Agua (Water Engine)
 * Simula y monitorea parámetros fisicoquímicos del agua en tiempo real
 * Modela procesos biológicos, químicos y físicos en sistemas RAS
 */
import EventEmitter from 'events';
import { config } from '../../config/index.js';

class WaterEngine extends EventEmitter {
  constructor(stateManager) {
    super();
    this.stateManager = stateManager;
    this.speciesParams = config.species.tilapia;
    
    // Parámetros base del sistema
    this.systemVolume = 10000; // Litros (10 m³)
    this.flowRate = 120; // L/min
    this.exchangeRate = 0.05; // 5% diario
    
    // Constantes biológicas
    this.nitrificationRate = 0.85; // Eficiencia biofiltro
    this.denitrificationRate = 0.15;
    this.oxygenTransferEfficiency = 0.25;
    
    // Estado interno
    this.lastUpdate = Date.now();
    this.running = false;
    this.simulationInterval = null;
  }
  
  /**
   * Inicia la simulación del motor de agua
   */
  start() {
    if (this.running) return;
    
    this.running = true;
    const intervalMs = config.intervals.sensorUpdate / config.simulation.speed;
    
    this.simulationInterval = setInterval(() => this.tick(), intervalMs);
    this.emit('started');
    console.log('[WaterEngine] Iniciado');
  }
  
  /**
   * Detiene la simulación
   */
  stop() {
    if (!this.running) return;
    
    clearInterval(this.simulationInterval);
    this.running = false;
    this.emit('stopped');
    console.log('[WaterEngine] Detenido');
  }
  
  /**
   * Ciclo de simulación - actualiza todos los parámetros
   */
  tick() {
    const now = Date.now();
    const deltaSeconds = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;
    
    // Obtener estado actual
    const currentState = this.stateManager.getState('water');
    const fishState = this.stateManager.getState('fish');
    const equipmentState = this.stateManager.getState('equipment');
    
    // Calcular nuevos valores
    const newParams = this.calculateWaterParameters(currentState, fishState, equipmentState, deltaSeconds);
    
    // Actualizar estado
    this.stateManager.updateBulk('water', newParams);
    
    // Verificar alarmas
    this.checkAlarms(newParams);
    
    // Emitir evento de actualización
    this.emit('parametersUpdated', newParams);
  }
  
  /**
   * Calcula los nuevos parámetros del agua
   */
  calculateWaterParameters(current, fish, equipment, deltaSeconds) {
    const newParams = {};
    
    // --- TEMPERATURA ---
    newParams.temperature = this.calculateTemperature(current, equipment, deltaSeconds);
    
    // --- OXÍGENO DISUELTO ---
    newParams.dissolvedOxygen = this.calculateDissolvedOxygen(current, fish, equipment, deltaSeconds);
    
    // --- pH ---
    newParams.ph = this.calculatePH(current, fish, deltaSeconds);
    
    // --- NITRÓGENOS (TAN, NO2, NO3) ---
    const nitrogenCycle = this.calculateNitrogenCycle(current, fish, deltaSeconds);
    newParams.tan = nitrogenCycle.tan;
    newParams.no2 = nitrogenCycle.no2;
    newParams.no3 = nitrogenCycle.no3;
    
    // --- TURBIDEZ ---
    newParams.turbidity = this.calculateTurbidity(current, fish, deltaSeconds);
    
    // --- NIVEL DE AGUA ---
    newParams.waterLevel = this.calculateWaterLevel(current, deltaSeconds);
    
    return newParams;
  }
  
  /**
   * Modelo de temperatura del agua
   */
  calculateTemperature(current, equipment, deltaSeconds) {
    let temp = current.temperature;
    
    // Efecto de calentadores
    if (equipment.heaters.status === 'on') {
      const heatingRate = 0.1; // °C por minuto a plena potencia
      const targetDiff = equipment.heaters.targetTemp - temp;
      
      if (targetDiff > 0) {
        temp += Math.min(targetDiff, heatingRate * deltaSeconds / 60);
      }
    }
    
    // Pérdida térmica ambiental (simplificado)
    const ambientTemp = 24; // Temperatura ambiente asumida
    const coolingRate = 0.02; // °C por minuto
    temp -= (temp - ambientTemp) * coolingRate * deltaSeconds / 60;
    
    // Variación aleatoria pequeña (ruido de sensor)
    temp += (Math.random() - 0.5) * 0.05;
    
    return parseFloat(temp.toFixed(2));
  }
  
  /**
   * Modelo de oxígeno disuelto
   */
  calculateDissolvedOxygen(current, fish, equipment, deltaSeconds) {
    let doLevel = current.dissolvedOxygen;
    
    // Saturación máxima a temperatura actual (simplificado)
    const maxDO = 14.6 - 0.4 * current.temperature; // mg/L aproximado
    
    // Consumo de oxígeno por peces (mg O2/kg biomasa/hora)
    const biomass = fish.totalBiomass;
    const fishConsumptionRate = 200; // mg O2/kg/h
    const fishConsumption = (biomass * fishConsumptionRate * deltaSeconds) / 3600;
    
    // Transferencia de oxígeno desde aireadores
    let oxygenAddition = 0;
    equipment.aerators.forEach(aerator => {
      if (aerator.status === 'on') {
        const transferRate = 500 * (aerator.intensity / 100); // mg O2/min
        oxygenAddition += (transferRate * deltaSeconds) / 60;
      }
    });
    
    // Oxigenación por flujo de agua (si hay bomba)
    if (equipment.pumps.main.status === 'on') {
      const flowOxygenation = 100 * (equipment.pumps.main.speed / 100);
      oxygenAddition += (flowOxygenation * deltaSeconds) / 60;
    }
    
    // Balance neto
    const volumeFactor = this.systemVolume / 1000; // Normalizar por volumen
    const consumptionLoss = fishConsumption / volumeFactor;
    const additionGain = oxygenAddition / volumeFactor;
    
    // Intercambio con atmósfera (re-aireación natural)
    const naturalReaeration = (maxDO - doLevel) * 0.01 * deltaSeconds;
    
    doLevel = doLevel - consumptionLoss + additionGain + naturalReaeration;
    
    // Limitar entre 0 y saturación
    doLevel = Math.max(0, Math.min(maxDO, doLevel));
    
    // Ruido de sensor
    doLevel += (Math.random() - 0.5) * 0.1;
    
    return parseFloat(doLevel.toFixed(2));
  }
  
  /**
   * Modelo de pH
   */
  calculatePH(current, fish, deltaSeconds) {
    let ph = current.ph;
    
    // Acidificación por CO2 de respiración de peces
    const biomass = fish.totalBiomass;
    const co2Production = biomass * 0.5; // mg CO2/kg/h aproximado
    const phDrop = (co2Production * deltaSeconds) / (3600 * 50); // Factor empírico
    
    // Buffer del sistema (alcalinidad)
    const bufferCapacity = 100; // mg CaCO3/L
    const phStability = bufferCapacity / 100;
    
    ph -= phDrop * phStability;
    
    // Recuperación natural hacia pH neutro
    const neutralPH = 7.0;
    ph += (neutralPH - ph) * 0.001 * deltaSeconds;
    
    // Ruido
    ph += (Math.random() - 0.5) * 0.02;
    
    // Limitar rango físico
    ph = Math.max(5.0, Math.min(9.0, ph));
    
    return parseFloat(ph.toFixed(2));
  }
  
  /**
   * Ciclo del nitrógeno: TAN -> NO2 -> NO3
   */
  calculateNitrogenCycle(current, fish, deltaSeconds) {
    let tan = current.tan;
    let no2 = current.no2;
    let no3 = current.no3;
    
    // Producción de amonio (TAN) por peces
    const biomass = fish.totalBiomass;
    const feedingRate = fish.feedingRate / 100; // % a decimal
    const feedAmount = biomass * feedingRate; // kg alimento/día
    const proteinContent = 0.32; // 32% proteína
    const nitrogenInProtein = 0.16; // 16% N en proteína
    const tanExcretion = 0.70; // 70% del N se excreta como TAN
    
    // TAN producida por hora (mg/L/h)
    const tanProduction = (feedAmount * proteinContent * nitrogenInProtein * tanExcretion * 1000000) / 24;
    const tanIncrease = (tanProduction * deltaSeconds) / 3600 / (this.systemVolume / 1000);
    
    // Nitrificación: TAN -> NO2 (por bacterias Nitrosomonas)
    const tanToNo2Rate = tan * this.nitrificationRate * 0.1 * deltaSeconds / 3600;
    
    // Nitrificación: NO2 -> NO3 (por bacterias Nitrobacter)
    const no2ToNo3Rate = no2 * this.nitrificationRate * 0.15 * deltaSeconds / 3600;
    
    // Denitrificación: NO3 -> N2 (pérdida del sistema)
    const no3Removal = no3 * this.denitrificationRate * 0.05 * deltaSeconds / 3600;
    
    // Dilución por recambio de agua
    const dilutionRate = this.exchangeRate / 86400; // Por segundo
    const dilutionLoss = dilutionRate * deltaSeconds;
    
    // Actualizar valores
    tan = tan + tanIncrease - tanToNo2Rate - (tan * dilutionLoss);
    no2 = no2 + tanToNo2Rate - no2ToNo3Rate - (no2 * dilutionLoss);
    no3 = no3 + no2ToNo3Rate - no3Removal - (no3 * dilutionLoss);
    
    // Limitar valores mínimos a 0
    tan = Math.max(0, tan);
    no2 = Math.max(0, no2);
    no3 = Math.max(0, no3);
    
    return {
      tan: parseFloat(tan.toFixed(2)),
      no2: parseFloat(no2.toFixed(2)),
      no3: parseFloat(no3.toFixed(2))
    };
  }
  
  /**
   * Modelo de turbidez
   */
  calculateTurbidity(current, fish, deltaSeconds) {
    let turbidity = current.turbidity;
    
    // Aumento por actividad de peces
    const activityFactor = 1 + (fish.population / 1000);
    turbidity += 0.01 * activityFactor * deltaSeconds;
    
    // Reducción por filtración mecánica
    const filtrationRate = 0.05; // NTU/min
    turbidity -= filtrationRate * deltaSeconds / 60;
    
    // Limitar
    turbidity = Math.max(0, Math.min(100, turbidity));
    
    return parseFloat(turbidity.toFixed(1));
  }
  
  /**
   * Nivel de agua (evaporación, recambios)
   */
  calculateWaterLevel(current, deltaSeconds) {
    let level = current.waterLevel;
    
    // Evaporación (~1-2% diario)
    const evaporationRate = 0.015 / 86400; // Por segundo
    level -= evaporationRate * deltaSeconds * 100;
    
    // Auto-rellenado si está muy bajo
    if (level < 90) {
      level += 0.1 * deltaSeconds;
    }
    
    // Limitar
    level = Math.max(0, Math.min(100, level));
    
    return parseFloat(level.toFixed(1));
  }
  
  /**
   * Verifica umbrales y genera alarmas
   */
  checkAlarms(params) {
    const species = this.speciesParams;
    
    // Temperatura crítica
    if (params.temperature < species.temp.min || params.temperature > species.temp.max) {
      this.stateManager.addAlarm({
        type: 'critical',
        category: 'temperature',
        message: `Temperatura fuera de rango: ${params.temperature}°C`,
        value: params.temperature,
        threshold: `${species.temp.min}-${species.temp.max}`
      });
    }
    
    // Oxígeno crítico
    if (params.dissolvedOxygen < species.do.min) {
      this.stateManager.addAlarm({
        type: 'critical',
        category: 'dissolvedOxygen',
        message: `Oxígeno disuelto crítico: ${params.dissolvedOxygen} mg/L`,
        value: params.dissolvedOxygen,
        threshold: `> ${species.do.min}`
      });
    }
    
    // TAN tóxico
    if (params.tan > species.tan.max) {
      this.stateManager.addAlarm({
        type: 'warning',
        category: 'tan',
        message: `Nivel de amonio elevado: ${params.tan} mg/L`,
        value: params.tan,
        threshold: `< ${species.tan.max}`
      });
    }
    
    // NO2 tóxico
    if (params.no2 > species.no2.max) {
      this.stateManager.addAlarm({
        type: 'critical',
        category: 'nitrite',
        message: `Nitrito tóxico: ${params.no2} mg/L`,
        value: params.no2,
        threshold: `< ${species.no2.max}`
      });
    }
  }
  
  /**
   * Obtiene métricas de rendimiento del agua
   */
  getMetrics() {
    const water = this.stateManager.getState('water');
    
    return {
      qualityIndex: this.calculateQualityIndex(water),
      stabilityScore: this.calculateStabilityScore(),
      efficiencyRating: this.calculateEfficiencyRating()
    };
  }
  
  calculateQualityIndex(water) {
    // Índice de calidad del agua (0-100)
    let score = 100;
    
    const species = this.speciesParams;
    
    // Penalizaciones por desviación de óptimos
    const tempOptimal = species.temp.optimal;
    const tempDeviation = Math.abs(water.temperature - tempOptimal);
    score -= tempDeviation * 3;
    
    const doOptimal = species.do.optimal;
    if (water.dissolvedOxygen < doOptimal) {
      score -= (doOptimal - water.dissolvedOxygen) * 10;
    }
    
    const phOptimal = species.ph.optimal;
    const phDeviation = Math.abs(water.ph - phOptimal);
    score -= phDeviation * 5;
    
    if (water.tan > species.tan.max * 0.8) {
      score -= 15;
    }
    
    if (water.no2 > species.no2.max * 0.8) {
      score -= 20;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  calculateStabilityScore() {
    // Basado en varianza histórica (implementación simplificada)
    return 85 + Math.random() * 10;
  }
  
  calculateEfficiencyRating() {
    // Eficiencia del sistema de tratamiento
    const water = this.stateManager.getState('water');
    const conversionEfficiency = 1 - (water.tan / 10); // Simplificado
    return Math.max(0, Math.min(100, conversionEfficiency * 100));
  }
}

export default WaterEngine;
