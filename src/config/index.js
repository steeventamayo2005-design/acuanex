/**
 * Configuración centralizada del sistema AcuaNexus
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  // Servidor
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  
  // Base de datos
  db: {
    path: process.env.DB_PATH || './data/acuanex.db'
  },
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Simulación
  simulation: {
    enabled: process.env.SIMULATION_ENABLED === 'true',
    speed: parseFloat(process.env.SIMULATION_SPEED) || 1
  },
  
  // Especies soportadas
  species: {
    tilapia: {
      temp: { min: 20, max: 30, optimal: 26 },
      ph: { min: 6.5, max: 8.5, optimal: 7.0 },
      do: { min: 4.0, optimal: 6.0 },
      tan: { max: 1.0 },
      no2: { max: 0.25 },
      no3: { max: 150 },
      growthRate: 0.015, // kg/día en condiciones óptimas
      fcr: 1.5 // Feed Conversion Ratio
    },
    catfish: {
      temp: { min: 24, max: 30, optimal: 27 },
      ph: { min: 6.5, max: 8.0, optimal: 7.0 },
      do: { min: 3.0, optimal: 5.0 },
      tan: { max: 1.5 },
      no2: { max: 0.3 },
      no3: { max: 200 },
      growthRate: 0.012,
      fcr: 1.8
    }
  },
  
  // Alarmas
  alarms: {
    critical: ['temp_critical', 'do_critical', 'ph_critical', 'pump_failure'],
    warning: ['temp_warning', 'feeding_due', 'maintenance_due'],
    info: ['daily_report', 'growth_milestone']
  },
  
  // Rutas
  paths: {
    root: join(__dirname, '..'),
    data: join(__dirname, '..', 'data'),
    logs: join(__dirname, '..', 'logs'),
    public: join(__dirname, '..', 'public')
  },
  
  // Intervalos de actualización (ms)
  intervals: {
    sensorUpdate: 5000,
    stateSync: 1000,
    dataLogging: 60000,
    advisorCheck: 30000
  }
};

export default config;
