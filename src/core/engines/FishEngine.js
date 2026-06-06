/**
 * Motor de Gestión de Peces (Fish Engine)
 * Modela crecimiento, salud, comportamiento y alimentación de peces
 * Específicamente optimizado para tilapia en sistemas RAS
 */
import EventEmitter from 'events';
import { config } from '../../config/index.js';

class FishEngine extends EventEmitter {
  constructor(stateManager) {
    super();
    this.stateManager = stateManager;
    this.speciesParams = config.species.tilapia;
    
    // Estado interno
    this.lastUpdate = Date.now();
    this.running = false;
    this.simulationInterval = null;
    
    // Historial de crecimiento
    this.growthHistory = [];
    this.mortalityEvents = [];
    
    // Etapas de crecimiento
    this.growthStages = {
      fingerling: { minWeight: 0.001, maxWeight: 0.05 },
      juvenile: { minWeight: 0.05, maxWeight: 0.2 },
      grower: { minWeight: 0.2, maxWeight: 0.4 },
      finisher: { minWeight: 0.4, maxWeight: 1.5 }
    };
  }
  
  /**
   * Inicia la simulación del motor de peces
   */
  start() {
    if (this.running) return;
    
    this.running = true;
    // Actualización cada minuto (simulado)
    const intervalMs = 60000 / config.simulation.speed;
    
    this.simulationInterval = setInterval(() => this.tick(), intervalMs);
    this.emit('started');
    console.log('[FishEngine] Iniciado');
  }
  
  /**
   * Detiene la simulación
   */
  stop() {
    if (!this.running) return;
    
    clearInterval(this.simulationInterval);
    this.running = false;
    this.emit('stopped');
    console.log('[FishEngine] Detenido');
  }
  
  /**
   * Ciclo de simulación - actualiza estado de peces
   */
  tick() {
    const now = Date.now();
    const deltaHours = (now - this.lastUpdate) / (1000 * 3600);
    this.lastUpdate = now;
    
    // Obtener estados actuales
    const fishState = this.stateManager.getState('fish');
    const waterState = this.stateManager.getState('water');
    const equipmentState = this.stateManager.getState('equipment');
    
    // Calcular nuevos valores
    const updates = this.calculateFishUpdates(fishState, waterState, equipmentState, deltaHours);
    
    // Actualizar estado
    this.stateManager.updateBulk('fish', updates);
    
    // Registrar en histórico si hay cambio significativo
    if (updates.averageWeight && Math.abs(updates.averageWeight - fishState.averageWeight) > 0.001) {
      this.growthHistory.push({
        timestamp: now,
        weight: updates.averageWeight,
        biomass: updates.totalBiomass,
        population: updates.population || fishState.population
      });
      
      // Mantener histórico limitado
      if (this.growthHistory.length > 1000) {
        this.growthHistory.shift();
      }
      
      this.emit('growthUpdate', { weight: updates.averageWeight, biomass: updates.totalBiomass });
    }
    
    // Verificar mortalidad
    this.checkMortality(fishState, waterState);
    
    // Emitir evento
    this.emit('stateUpdated', updates);
  }
  
  /**
   * Calcula actualizaciones del estado de los peces
   */
  calculateFishUpdates(fish, water, equipment, deltaHours) {
    const updates = {};
    
    // --- CRECIMIENTO ---
    const growth = this.calculateGrowth(fish, water, deltaHours);
    updates.averageWeight = growth.newWeight;
    updates.totalBiomass = growth.newBiomass;
    
    // --- ETAPA DE CRECIMIENTO ---
    updates.growthStage = this.determineGrowthStage(updates.averageWeight || fish.averageWeight);
    
    // --- ÍNDICE DE SALUD ---
    updates.healthIndex = this.calculateHealthIndex(fish, water);
    
    // --- TASA DE ALIMENTACIÓN ---
    updates.feedingRate = this.calculateFeedingRate(fish, water, updates.growthStage);
    
    return updates;
  }
  
  /**
   * Modelo de crecimiento de peces
   * Basado en tasa de crecimiento específica (SGR) modificada por condiciones
   */
  calculateGrowth(fish, water, deltaHours) {
    const currentWeight = fish.averageWeight;
    const population = fish.population;
    
    // Tasa de crecimiento base (por día)
    const baseGrowthRate = this.speciesParams.growthRate;
    
    // Factores de estrés que reducen el crecimiento
    const tempFactor = this.getTemperatureGrowthFactor(water.temperature);
    const doFactor = this.getDissolvedOxygenGrowthFactor(water.dissolvedOxygen);
    const phFactor = this.getPHGrowthFactor(water.ph);
    const tanFactor = this.getTANGrowthFactor(water.tan);
    const no2Factor = this.getNO2GrowthFactor(water.no2);
    
    // Factor combinado (producto de todos los factores)
    const combinedFactor = tempFactor * doFactor * phFactor * tanFactor * no2Factor;
    
    // Crecimiento real ajustado
    const adjustedGrowthRate = baseGrowthRate * combinedFactor;
    
    // Crecimiento en el período (modelo exponencial simplificado)
    const dailyGrowthFraction = deltaHours / 24;
    const newWeight = currentWeight * Math.exp(adjustedGrowthRate * dailyGrowthFraction);
    
    // Nueva biomasa total
    const newBiomass = newWeight * population;
    
    return {
      newWeight: parseFloat(newWeight.toFixed(4)),
      newBiomass: parseFloat(newBiomass.toFixed(2))
    };
  }
  
  /**
   * Factor de crecimiento por temperatura (óptimo = 1.0)
   */
  getTemperatureGrowthFactor(temp) {
    const { min, max, optimal } = this.speciesParams.temp;
    
    if (temp < min || temp > max) {
      return 0; // Sin crecimiento fuera de rango
    }
    
    if (temp === optimal) {
      return 1.0;
    }
    
    // Curva triangular simplificada
    const deviation = Math.abs(temp - optimal);
    const maxDeviation = Math.max(optimal - min, max - optimal);
    const factor = 1 - (deviation / maxDeviation) * 0.7;
    
    return Math.max(0.1, factor);
  }
  
  /**
   * Factor de crecimiento por oxígeno disuelto
   */
  getDissolvedOxygenGrowthFactor(doLevel) {
    const { min, optimal } = this.speciesParams.do;
    
    if (doLevel <= min) {
      return 0.1; // Crecimiento mínimo
    }
    
    if (doLevel >= optimal) {
      return 1.0;
    }
    
    // Lineal entre min y optimal
    return 0.1 + (0.9 * (doLevel - min) / (optimal - min));
  }
  
  /**
   * Factor de crecimiento por pH
   */
  getPHGrowthFactor(ph) {
    const { min, max, optimal } = this.speciesParams.ph;
    
    if (ph < min || ph > max) {
      return 0.2;
    }
    
    const deviation = Math.abs(ph - optimal);
    const maxDeviation = Math.max(optimal - min, max - optimal);
    
    return 1 - (deviation / maxDeviation) * 0.5;
  }
  
  /**
   * Factor de crecimiento por amonio (TAN)
   */
  getTANGrowthFactor(tan) {
    const { max } = this.speciesParams.tan;
    
    if (tan >= max) {
      return 0.3; // Estrés severo
    }
    
    if (tan <= 0.2) {
      return 1.0;
    }
    
    // Declive gradual
    return 1 - (0.7 * (tan - 0.2) / (max - 0.2));
  }
  
  /**
   * Factor de crecimiento por nitrito (NO2)
   */
  getNO2GrowthFactor(no2) {
    const { max } = this.speciesParams.no2;
    
    if (no2 >= max) {
      return 0.2; // Estrés muy severo
    }
    
    if (no2 <= 0.05) {
      return 1.0;
    }
    
    return 1 - (0.8 * (no2 - 0.05) / (max - 0.05));
  }
  
  /**
   * Determina etapa de crecimiento según peso
   */
  determineGrowthStage(weight) {
    for (const [stage, range] of Object.entries(this.growthStages)) {
      if (weight >= range.minWeight && weight < range.maxWeight) {
        return stage;
      }
    }
    return 'finisher';
  }
  
  /**
   * Calcula índice de salud (0-100%)
   */
  calculateHealthIndex(fish, water) {
    let health = 100;
    
    // Penalizaciones por parámetros subóptimos
    const tempOptimal = this.speciesParams.temp.optimal;
    const tempDeviation = Math.abs(water.temperature - tempOptimal);
    health -= tempDeviation * 2;
    
    if (water.dissolvedOxygen < this.speciesParams.do.optimal) {
      health -= (this.speciesParams.do.optimal - water.dissolvedOxygen) * 5;
    }
    
    if (water.tan > this.speciesParams.tan.max * 0.5) {
      health -= 10;
    }
    
    if (water.no2 > this.speciesParams.no2.max * 0.5) {
      health -= 15;
    }
    
    // Penalización por densidad (población/biomasa)
    const density = fish.totalBiomass / 100; // kg/m³ (asumiendo 10 m³)
    if (density > 80) {
      health -= (density - 80) * 0.5;
    }
    
    return Math.max(0, Math.min(100, parseFloat(health.toFixed(1))));
  }
  
  /**
   * Calcula tasa de alimentación óptima (% de biomasa/día)
   */
  calculateFeedingRate(fish, water, growthStage) {
    let baseRate = 3.0; // % base
    
    // Ajustar por etapa de crecimiento
    switch (growthStage) {
      case 'fingerling':
        baseRate = 5.0;
        break;
      case 'juvenile':
        baseRate = 4.0;
        break;
      case 'grower':
        baseRate = 3.0;
        break;
      case 'finisher':
        baseRate = 2.0;
        break;
    }
    
    // Ajustar por temperatura
    const tempFactor = this.getTemperatureGrowthFactor(water.temperature);
    baseRate *= tempFactor;
    
    // Reducir si salud es baja
    if (fish.healthIndex < 70) {
      baseRate *= 0.7;
    }
    
    return parseFloat(baseRate.toFixed(1));
  }
  
  /**
   * Verifica y calcula mortalidad
   */
  checkMortality(fish, water) {
    const mortalityRate = this.calculateMortalityRate(fish, water);
    
    if (mortalityRate > 0) {
      const deaths = Math.floor(fish.population * mortalityRate);
      
      if (deaths > 0) {
        const newPopulation = fish.population - deaths;
        this.stateManager.update('fish', 'population', newPopulation);
        
        // Recalcular biomasa
        const newBiomass = newPopulation * fish.averageWeight;
        this.stateManager.update('fish', 'totalBiomass', parseFloat(newBiomass.toFixed(2)));
        
        // Registrar evento
        const event = {
          timestamp: Date.now(),
          deaths,
          cause: this.determineMortalityCause(water),
          populationAfter: newPopulation
        };
        
        this.mortalityEvents.push(event);
        if (this.mortalityEvents.length > 100) {
          this.mortalityEvents.shift();
        }
        
        this.emit('mortality', event);
        
        // Generar alarma si mortalidad significativa
        if (deaths > fish.population * 0.01) { // >1% de la población
          this.stateManager.addAlarm({
            type: 'critical',
            category: 'mortality',
            message: `Mortalidad detectada: ${deaths} peces`,
            value: deaths,
            threshold: '< 1% población'
          });
        }
      }
    }
  }
  
  /**
   * Calcula tasa de mortalidad basada en condiciones
   */
  calculateMortalityRate(fish, water) {
    let rate = 0.0001; // Tasa base diaria (0.01%)
    
    // Estrés por temperatura extrema
    if (water.temperature < this.speciesParams.temp.min || 
        water.temperature > this.speciesParams.temp.max) {
      rate += 0.01; // 1% adicional
    }
    
    // Hipoxia
    if (water.dissolvedOxygen < this.speciesParams.do.min) {
      rate += 0.05; // 5% adicional - crítico
    }
    
    // Toxicidad por amonio
    if (water.tan > this.speciesParams.tan.max) {
      rate += 0.02;
    }
    
    // Toxicidad por nitrito
    if (water.no2 > this.speciesParams.no2.max) {
      rate += 0.03;
    }
    
    // Salud baja
    if (fish.healthIndex < 50) {
      rate += 0.01;
    }
    
    return rate;
  }
  
  /**
   * Determina causa probable de mortalidad
   */
  determineMortalityCause(water) {
    if (water.dissolvedOxygen < this.speciesParams.do.min) {
      return 'hypoxia';
    }
    
    if (water.temperature > this.speciesParams.temp.max) {
      return 'heat_stress';
    }
    
    if (water.temperature < this.speciesParams.temp.min) {
      return 'cold_stress';
    }
    
    if (water.no2 > this.speciesParams.no2.max) {
      return 'nitrite_toxicity';
    }
    
    if (water.tan > this.speciesParams.tan.max) {
      return 'ammonia_toxicity';
    }
    
    return 'unknown';
  }
  
  /**
   * Alimenta a los peces (llamado desde el sistema de alimentadores)
   */
  feed(amountKg) {
    const fish = this.stateManager.getState('fish');
    
    // Actualizar última alimentación
    this.stateManager.update('fish', 'lastFeeding', Date.now());
    
    // Calcular eficiencia de alimentación basada en condiciones
    const water = this.stateManager.getState('water');
    const feedingEfficiency = this.calculateFeedingEfficiency(fish, water);
    
    // La comida no consumida afecta calidad del agua
    const uneatenFood = amountKg * (1 - feedingEfficiency);
    
    // Impacto en TAN (aproximadamente 3% del alimento se convierte en amonio)
    const tanIncrease = (uneatenFood * 0.03 * 1000000) / (10000 / 1000); // mg/L
    
    // Aplicar impacto al agua
    const currentTan = water.tan;
    this.stateManager.update('water', 'tan', parseFloat((currentTan + tanIncrease).toFixed(2)));
    
    // Actualizar costos económicos
    const feedCost = amountKg * 1.2; // $1.2/kg alimento
    const currentFeedCost = this.stateManager.getState('economics').feedCost;
    this.stateManager.update('economics', 'feedCost', currentFeedCost + feedCost);
    
    this.emit('feeding', { amount: amountKg, efficiency: feedingEfficiency, uneaten: uneatenFood });
    
    return { efficiency: feedingEfficiency, uneaten: uneatenFood };
  }
  
  /**
   * Calcula eficiencia de alimentación
   */
  calculateFeedingEfficiency(fish, water) {
    let efficiency = 0.85; // Base 85%
    
    // Reducir por estrés térmico
    const tempFactor = this.getTemperatureGrowthFactor(water.temperature);
    efficiency *= tempFactor;
    
    // Reducir por bajo oxígeno
    if (water.dissolvedOxygen < this.speciesParams.do.optimal) {
      efficiency *= 0.9;
    }
    
    // Reducir por mala calidad de agua
    if (water.tan > this.speciesParams.tan.max * 0.5) {
      efficiency *= 0.85;
    }
    
    return Math.max(0.5, Math.min(0.95, efficiency));
  }
  
  /**
   * Obtiene métricas de producción
   */
  getMetrics() {
    const fish = this.stateManager.getState('fish');
    const water = this.stateManager.getState('water');
    
    const daysElapsed = this.growthHistory.length > 0 
      ? (Date.now() - this.growthHistory[0].timestamp) / (1000 * 3600 * 24)
      : 0;
    
    const initialWeight = this.growthHistory.length > 0 
      ? this.growthHistory[0].weight 
      : fish.averageWeight;
    
    const sgr = daysElapsed > 0 
      ? ((Math.log(fish.averageWeight) - Math.log(initialWeight)) / daysElapsed) * 100
      : 0;
    
    const fcr = this.calculateFCR();
    
    return {
      specificGrowthRate: parseFloat(sgr.toFixed(3)), // %/día
      feedConversionRatio: parseFloat(fcr.toFixed(2)),
      survivalRate: parseFloat(((fish.population / 500) * 100).toFixed(1)), // Asumiendo 500 iniciales
      productionDensity: parseFloat((fish.totalBiomass / 10).toFixed(2)), // kg/m³
      healthStatus: fish.healthIndex >= 80 ? 'excellent' : fish.healthIndex >= 60 ? 'good' : 'poor'
    };
  }
  
  /**
   * Calcula FCR (Feed Conversion Ratio) acumulado
   */
  calculateFCR() {
    const fish = this.stateManager.getState('fish');
    const economics = this.stateManager.getState('economics');
    
    // Peso ganado desde inicio
    const initialBiomass = 500 * 0.01; // 500 peces x 10g inicial = 5kg
    const weightGain = fish.totalBiomass - initialBiomass;
    
    if (weightGain <= 0) return 999;
    
    // Alimento total consumido
    const totalFeed = economics.feedCost / 1.2; // kg de alimento
    
    return totalFeed / weightGain;
  }
  
  /**
   * Obtiene histórico de crecimiento
   */
  getGrowthHistory(limit = 100) {
    return this.growthHistory.slice(-limit);
  }
  
  /**
   * Obtiene eventos de mortalidad
   */
  getMortalityEvents(limit = 50) {
    return this.mortalityEvents.slice(-limit);
  }
}

export default FishEngine;
