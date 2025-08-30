# 🔄 MIGRAÇÃO LOCALSTORAGE → SUPABASE

## 📋 **ESTRATÉGIA DE MIGRAÇÃO ZERO-DOWNTIME**

### 🎯 **OBJETIVOS DA MIGRAÇÃO**
1. **Zero Downtime**: Sistema continua funcionando durante toda migração
2. **Data Integrity**: Nenhum dado perdido durante transição
3. **Rollback Safety**: Capacidade de reverter rapidamente se necessário
4. **Performance**: Manter ou melhorar performance atual
5. **Real-time Sync**: Implementar sincronização em tempo real

---

## 🏗️ **ARQUITETURA DE MIGRAÇÃO**

### **Fase 1: Preparação e Infraestrutura**
```typescript
// src/migration/MigrationStrategy.ts
export enum MigrationPhase {
  PREPARATION = 'preparation',
  HYBRID_MODE = 'hybrid_mode',
  VALIDATION = 'validation',
  FULL_MIGRATION = 'full_migration',
  CLEANUP = 'cleanup'
}

export interface MigrationConfig {
  phase: MigrationPhase;
  enableSupabase: boolean;
  syncInterval: number;
  rollbackThreshold: number;
  validationRules: ValidationRule[];
}

export class MigrationManager {
  private config: MigrationConfig;
  private metricsCollector: MigrationMetrics;

  constructor(config: MigrationConfig) {
    this.config = config;
    this.metricsCollector = new MigrationMetrics();
  }

  async executeMigration(): Promise<MigrationResult> {
    try {
      switch (this.config.phase) {
        case MigrationPhase.PREPARATION:
          return await this.prepareInfrastructure();
        case MigrationPhase.HYBRID_MODE:
          return await this.enableHybridMode();
        case MigrationPhase.VALIDATION:
          return await this.validateDataIntegrity();
        case MigrationPhase.FULL_MIGRATION:
          return await this.completeMigration();
        case MigrationPhase.CLEANUP:
          return await this.cleanupLegacyData();
        default:
          throw new Error(`Unknown migration phase: ${this.config.phase}`);
      }
    } catch (error) {
      await this.handleMigrationError(error);
      throw error;
    }
  }
}
```

### **Database Schema Design**
```sql
-- 📊 Supabase Schema Setup

-- 1. Vagas Table
CREATE TABLE vagas (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('esperar', 'chamado', 'carregando', 'finalizado')),
  gaiola TEXT,
  check_status BOOLEAN DEFAULT FALSE,
  chamado_em TIMESTAMPTZ,
  chamado_por TEXT,
  carregando_em TIMESTAMPTZ,
  finalizado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Drivers Table  
CREATE TABLE drivers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gaiola TEXT NOT NULL,
  shift TEXT NOT NULL CHECK (shift IN ('morning', 'afternoon', 'night')),
  status TEXT NOT NULL CHECK (status IN ('esperar_fora_hub', 'entrar_hub', 'chegou', 'atrasado')),
  vaga_id TEXT REFERENCES vagas(id),
  chegada_em TIMESTAMPTZ,
  driver_check BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Migration Log Table
CREATE TABLE migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('vaga', 'driver', 'notification')),
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'sync')),
  old_data JSONB,
  new_data JSONB,
  source TEXT NOT NULL CHECK (source IN ('localStorage', 'supabase', 'migration')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'rolled_back')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Sync Status Table
CREATE TABLE sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  last_sync TIMESTAMPTZ,
  sync_direction TEXT CHECK (sync_direction IN ('localStorage_to_supabase', 'supabase_to_localStorage', 'bidirectional')),
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'error')),
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes para performance
CREATE INDEX idx_vagas_status ON vagas(status);
CREATE INDEX idx_vagas_updated_at ON vagas(updated_at);
CREATE INDEX idx_drivers_gaiola ON drivers(gaiola);
CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_migration_log_entity ON migration_log(entity_type, entity_id);
CREATE INDEX idx_sync_status_session ON sync_status(session_id);

-- RLS (Row Level Security)
ALTER TABLE vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- Policies básicas (ajustar conforme autenticação)
CREATE POLICY "Allow authenticated access" ON vagas
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated access" ON drivers
  FOR ALL USING (auth.role() = 'authenticated');

-- Real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE vagas;
ALTER PUBLICATION supabase_realtime ADD TABLE drivers;

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vagas_updated_at BEFORE UPDATE ON vagas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 🔄 **IMPLEMENTATION PHASES**

### **Phase 1: Infrastructure Setup (Semana 1)**

#### **Supabase Configuration**
```typescript
// src/config/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Type definitions
export type Database = {
  public: {
    Tables: {
      vagas: {
        Row: VagaRow;
        Insert: VagaInsert;
        Update: VagaUpdate;
      };
      drivers: {
        Row: DriverRow;
        Insert: DriverInsert;
        Update: DriverUpdate;
      };
    };
  };
};
```

#### **Data Source Abstraction**
```typescript
// src/adapters/DataSourceAdapter.ts
export interface DataSourceAdapter<T> {
  get(id: string): Promise<T | null>;
  getAll(): Promise<T[]>;
  save(id: string, data: T): Promise<void>;
  update(id: string, data: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
  subscribe(callback: (data: T[]) => void): UnsubscribeFunction;
  healthCheck(): Promise<boolean>;
}

export class LocalStorageAdapter<T> implements DataSourceAdapter<T> {
  constructor(private storageKey: string) {}

  async get(id: string): Promise<T | null> {
    try {
      const allData = await this.getAll();
      return allData.find((item: any) => item.id === id) || null;
    } catch (error) {
      console.error(`Error getting item ${id} from localStorage:`, error);
      return null;
    }
  }

  async getAll(): Promise<T[]> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : Object.values(parsed);
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return [];
    }
  }

  async save(id: string, data: T): Promise<void> {
    try {
      const allData = await this.getAll();
      const index = allData.findIndex((item: any) => item.id === id);
      
      const dataWithId = { ...data, id, updated_at: new Date().toISOString() };
      
      if (index >= 0) {
        allData[index] = dataWithId;
      } else {
        allData.push(dataWithId);
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(allData));
      this.notifySubscribers(allData);
    } catch (error) {
      throw new Error(`Failed to save to localStorage: ${error.message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const testKey = `${this.storageKey}_health_check`;
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
}

export class SupabaseAdapter<T> implements DataSourceAdapter<T> {
  constructor(
    private supabase: SupabaseClient,
    private tableName: string
  ) {}

  async get(id: string): Promise<T | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        throw error;
      }

      return data as T || null;
    } catch (error) {
      console.error(`Error getting ${id} from Supabase:`, error);
      throw error;
    }
  }

  async getAll(): Promise<T[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as T[]) || [];
    } catch (error) {
      console.error('Error loading from Supabase:', error);
      throw error;
    }
  }

  async save(id: string, data: T): Promise<void> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .upsert({ 
          ...data, 
          id, 
          updated_at: new Date().toISOString() 
        }, {
          onConflict: 'id'
        });

      if (error) throw error;
    } catch (error) {
      console.error(`Error saving ${id} to Supabase:`, error);
      throw error;
    }
  }

  subscribe(callback: (data: T[]) => void): UnsubscribeFunction {
    const subscription = this.supabase
      .channel(`${this.tableName}_changes`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: this.tableName
      }, async () => {
        try {
          const data = await this.getAll();
          callback(data);
        } catch (error) {
          console.error('Error in subscription callback:', error);
        }
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .select('count')
        .limit(1);
      
      return !error;
    } catch {
      return false;
    }
  }
}
```

### **Phase 2: Hybrid Mode Implementation (Semana 2-3)**

#### **Hybrid Data Manager**
```typescript
// src/migration/HybridDataManager.ts
export class HybridDataManager<T> {
  private localAdapter: LocalStorageAdapter<T>;
  private remoteAdapter: SupabaseAdapter<T>;
  private conflictResolver: ConflictResolver<T>;
  private syncQueue: SyncQueue;

  constructor(
    tableName: string,
    localStorageKey: string,
    conflictResolver: ConflictResolver<T>
  ) {
    this.localAdapter = new LocalStorageAdapter<T>(localStorageKey);
    this.remoteAdapter = new SupabaseAdapter<T>(supabase, tableName);
    this.conflictResolver = conflictResolver;
    this.syncQueue = new SyncQueue();
  }

  async get(id: string): Promise<T | null> {
    try {
      // Try remote first for latest data
      const remoteData = await this.remoteAdapter.get(id);
      if (remoteData) {
        // Cache locally
        await this.localAdapter.save(id, remoteData);
        return remoteData;
      }

      // Fallback to local
      return await this.localAdapter.get(id);
    } catch (error) {
      console.warn('Remote fetch failed, using local data:', error);
      return await this.localAdapter.get(id);
    }
  }

  async save(id: string, data: T): Promise<void> {
    // Save locally first for immediate UI update
    await this.localAdapter.save(id, data);

    // Queue remote save
    this.syncQueue.enqueue({
      operation: 'save',
      id,
      data,
      retries: 0,
      maxRetries: 3
    });

    // Attempt immediate remote save
    try {
      await this.remoteAdapter.save(id, data);
      this.syncQueue.markCompleted(id);
    } catch (error) {
      console.warn('Remote save failed, queued for retry:', error);
    }
  }

  async syncToRemote(): Promise<SyncResult> {
    try {
      const localData = await this.localAdapter.getAll();
      const remoteData = await this.remoteAdapter.getAll();

      const conflicts = this.detectConflicts(localData, remoteData);
      
      if (conflicts.length > 0) {
        const resolutions = await this.conflictResolver.resolve(conflicts);
        await this.applyResolutions(resolutions);
      }

      // Upload local changes
      const toUpload = this.getLocalChanges(localData, remoteData);
      const results = await Promise.allSettled(
        toUpload.map(item => this.remoteAdapter.save(item.id, item))
      );

      const failed = results.filter(r => r.status === 'rejected').length;

      return {
        success: failed === 0,
        totalItems: toUpload.length,
        uploaded: toUpload.length - failed,
        failed,
        conflicts: conflicts.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        totalItems: 0,
        uploaded: 0,
        failed: 0,
        conflicts: 0
      };
    }
  }

  async syncFromRemote(): Promise<SyncResult> {
    try {
      const remoteData = await this.remoteAdapter.getAll();
      
      const results = await Promise.allSettled(
        remoteData.map(item => this.localAdapter.save(item.id, item))
      );

      const failed = results.filter(r => r.status === 'rejected').length;

      return {
        success: failed === 0,
        totalItems: remoteData.length,
        downloaded: remoteData.length - failed,
        failed
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        totalItems: 0,
        downloaded: 0,
        failed: 0
      };
    }
  }

  private detectConflicts(local: T[], remote: T[]): DataConflict<T>[] {
    const conflicts: DataConflict<T>[] = [];
    const remoteMap = new Map(remote.map(item => [item.id, item]));

    for (const localItem of local) {
      const remoteItem = remoteMap.get(localItem.id);
      if (remoteItem && this.hasConflict(localItem, remoteItem)) {
        conflicts.push({
          id: localItem.id,
          local: localItem,
          remote: remoteItem,
          conflictType: this.getConflictType(localItem, remoteItem)
        });
      }
    }

    return conflicts;
  }
}
```

#### **Conflict Resolution System**
```typescript
// src/migration/ConflictResolver.ts
export enum ConflictResolutionStrategy {
  LOCAL_WINS = 'local_wins',
  REMOTE_WINS = 'remote_wins',
  MERGE = 'merge',
  MANUAL = 'manual'
}

export class ConflictResolver<T> {
  constructor(private strategy: ConflictResolutionStrategy) {}

  async resolve(conflicts: DataConflict<T>[]): Promise<ConflictResolution<T>[]> {
    const resolutions: ConflictResolution<T>[] = [];

    for (const conflict of conflicts) {
      let resolution: ConflictResolution<T>;

      switch (this.strategy) {
        case ConflictResolutionStrategy.LOCAL_WINS:
          resolution = {
            conflictId: conflict.id,
            resolvedData: conflict.local,
            strategy: this.strategy
          };
          break;

        case ConflictResolutionStrategy.REMOTE_WINS:
          resolution = {
            conflictId: conflict.id,
            resolvedData: conflict.remote,
            strategy: this.strategy
          };
          break;

        case ConflictResolutionStrategy.MERGE:
          resolution = {
            conflictId: conflict.id,
            resolvedData: this.mergeData(conflict.local, conflict.remote),
            strategy: this.strategy
          };
          break;

        case ConflictResolutionStrategy.MANUAL:
          resolution = await this.requestManualResolution(conflict);
          break;

        default:
          throw new Error(`Unknown strategy: ${this.strategy}`);
      }

      resolutions.push(resolution);
    }

    return resolutions;
  }

  private mergeData(local: T, remote: T): T {
    // Implementar lógica de merge específica para cada tipo
    if (this.isVagaData(local)) {
      return this.mergeVagaData(local as VagaData, remote as VagaData) as T;
    }
    
    if (this.isDriverData(local)) {
      return this.mergeDriverData(local as DriverData, remote as DriverData) as T;
    }

    // Fallback: usar mais recente baseado em updated_at
    const localTime = new Date(local.updated_at || 0).getTime();
    const remoteTime = new Date(remote.updated_at || 0).getTime();
    
    return localTime > remoteTime ? local : remote;
  }

  private mergeVagaData(local: VagaData, remote: VagaData): VagaData {
    // Regras específicas para merge de vagas
    return {
      ...remote,
      // Preservar status local se for mais recente
      ...(local.updated_at > remote.updated_at ? {
        status: local.status,
        gaiola: local.gaiola,
        chamadoEm: local.chamadoEm,
        finalizadoEm: local.finalizadoEm
      } : {}),
      // Sempre usar check mais recente
      check: local.updated_at > remote.updated_at ? local.check : remote.check
    };
  }
}
```

### **Phase 3: Feature Flags & Gradual Rollout (Semana 4)**

#### **Feature Flag System**
```typescript
// src/config/FeatureFlags.ts
export interface FeatureFlags {
  migration: {
    enableSupabaseForVagas: boolean;
    enableSupabaseForDrivers: boolean;
    enableRealTimeSync: boolean;
    hybridModeActive: boolean;
    autoSyncInterval: number;
  };
  rollout: {
    percentage: number;
    whitelistedUsers: string[];
    enabledEnvironments: string[];
  };
}

export class FeatureFlagManager {
  private flags: FeatureFlags;
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.flags = this.getDefaultFlags();
  }

  async loadFlags(): Promise<void> {
    try {
      // Carregar flags do Supabase ou serviço externo
      const { data } = await supabase
        .from('feature_flags')
        .select('*')
        .single();

      if (data) {
        this.flags = { ...this.flags, ...data.flags };
      }
    } catch (error) {
      console.warn('Failed to load feature flags, using defaults:', error);
    }

    // Aplicar override local para desenvolvimento
    this.applyLocalOverrides();
  }

  isEnabled(flag: keyof FeatureFlags['migration']): boolean {
    // Check local override first
    const localOverride = localStorage.getItem(`ff_${flag}`);
    if (localOverride !== null) {
      return localOverride === 'true';
    }

    // Check rollout percentage
    if (!this.isInRollout()) {
      return false;
    }

    return this.flags.migration[flag];
  }

  private isInRollout(): boolean {
    // Check if user is whitelisted
    const userId = this.getCurrentUserId();
    if (this.flags.rollout.whitelistedUsers.includes(userId)) {
      return true;
    }

    // Check environment
    const env = process.env.NODE_ENV;
    if (!this.flags.rollout.enabledEnvironments.includes(env)) {
      return false;
    }

    // Check percentage rollout
    const hash = this.hashSessionId(this.sessionId);
    const percentage = hash % 100;
    return percentage < this.flags.rollout.percentage;
  }

  private hashSessionId(sessionId: string): number {
    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
      const char = sessionId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
```

#### **Migration-Aware Hooks**
```typescript
// src/hooks/useMigrationAwareData.ts
export function useMigrationAwareVagaData() {
  const featureFlags = useFeatureFlags();
  const [dataManager, setDataManager] = useState<HybridDataManager<VagaData> | null>(null);

  useEffect(() => {
    const createDataManager = () => {
      if (featureFlags.isEnabled('hybridModeActive')) {
        return new HybridDataManager<VagaData>(
          'vagas',
          'vagas_data',
          new ConflictResolver(ConflictResolutionStrategy.MERGE)
        );
      } else {
        // Use localStorage-only adapter wrapped in same interface
        return new LocalStorageDataManager<VagaData>('vagas_data');
      }
    };

    setDataManager(createDataManager());
  }, [featureFlags]);

  const updateVagaStatus = useCallback(async (
    vagaId: string, 
    status: VagaStatus, 
    gaiola?: string
  ) => {
    if (!dataManager) return;

    const updateData = {
      status,
      gaiola: gaiola || '',
      chamadoEm: status === 'chamado' ? new Date().toISOString() : undefined,
      finalizadoEm: status === 'finalizado' ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString()
    };

    await dataManager.save(vagaId, updateData);

    // Emit event for backward compatibility
    window.dispatchEvent(new CustomEvent('vaga_data_update', {
      detail: { vagaId, ...updateData }
    }));
  }, [dataManager]);

  return {
    dataManager,
    updateVagaStatus,
    syncStatus: dataManager?.getSyncStatus() || { isActive: false }
  };
}
```

### **Phase 4: Data Migration Script (Semana 5)**

#### **Bulk Migration Tool**
```typescript
// src/migration/BulkMigrationTool.ts
export class BulkMigrationTool {
  private migrationLog: MigrationLogger;
  private batchSize = 50;

  constructor() {
    this.migrationLog = new MigrationLogger();
  }

  async migrateAllData(): Promise<MigrationReport> {
    const report: MigrationReport = {
      startTime: new Date(),
      endTime: null,
      totalItems: 0,
      migratedItems: 0,
      failedItems: 0,
      errors: [],
      summary: {}
    };

    try {
      // Migrate vagas
      const vagasResult = await this.migrateVagasData();
      report.summary.vagas = vagasResult;
      report.totalItems += vagasResult.total;
      report.migratedItems += vagasResult.migrated;
      report.failedItems += vagasResult.failed;

      // Migrate drivers
      const driversResult = await this.migrateDriversData();
      report.summary.drivers = driversResult;
      report.totalItems += driversResult.total;
      report.migratedItems += driversResult.migrated;
      report.failedItems += driversResult.failed;

      // Validate migration
      const validationResult = await this.validateMigration();
      report.validation = validationResult;

      report.endTime = new Date();
      return report;

    } catch (error) {
      report.endTime = new Date();
      report.errors.push(error.message);
      throw error;
    }
  }

  private async migrateVagasData(): Promise<EntityMigrationResult> {
    const localData = this.loadFromLocalStorage('vagas_data');
    const vagasArray = Array.isArray(localData) ? localData : Object.values(localData);
    
    const result: EntityMigrationResult = {
      entity: 'vagas',
      total: vagasArray.length,
      migrated: 0,
      failed: 0,
      errors: []
    };

    // Process in batches
    for (let i = 0; i < vagasArray.length; i += this.batchSize) {
      const batch = vagasArray.slice(i, i + this.batchSize);
      
      try {
        await this.migrateBatch('vagas', batch);
        result.migrated += batch.length;
        
        // Log progress
        await this.migrationLog.logProgress('vagas', result.migrated, result.total);
        
      } catch (error) {
        result.failed += batch.length;
        result.errors.push({
          batch: i / this.batchSize + 1,
          error: error.message,
          items: batch.map(item => item.id)
        });
        
        // Continue with next batch
        console.error(`Batch ${i / this.batchSize + 1} failed:`, error);
      }
    }

    return result;
  }

  private async migrateBatch(tableName: string, items: any[]): Promise<void> {
    const { error } = await supabase
      .from(tableName)
      .upsert(items, { onConflict: 'id' });

    if (error) {
      throw new Error(`Batch migration failed: ${error.message}`);
    }
  }

  private async validateMigration(): Promise<ValidationResult> {
    const validation: ValidationResult = {
      vagas: await this.validateEntityMigration('vagas', 'vagas_data'),
      drivers: await this.validateEntityMigration('drivers', 'drivers_data'),
      integrity: await this.validateDataIntegrity()
    };

    return validation;
  }

  private async validateEntityMigration(
    tableName: string, 
    localStorageKey: string
  ): Promise<EntityValidation> {
    const localData = this.loadFromLocalStorage(localStorageKey);
    const localArray = Array.isArray(localData) ? localData : Object.values(localData);
    
    const { data: remoteData, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }

    const localCount = localArray.length;
    const remoteCount = remoteData?.length || 0;
    const matches = this.compareDataSets(localArray, remoteData || []);

    return {
      localCount,
      remoteCount,
      matches,
      mismatches: localCount - matches,
      isValid: localCount === remoteCount && localCount === matches
    };
  }
}
```

#### **Migration Monitoring Dashboard**
```typescript
// src/components/MigrationDashboard.tsx
export const MigrationDashboard: React.FC = () => {
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>('idle');
  const [progress, setProgress] = useState<MigrationProgress>({
    phase: MigrationPhase.PREPARATION,
    percentage: 0,
    currentTask: '',
    errors: []
  });

  const migrationManager = useMemo(() => new MigrationManager({
    phase: MigrationPhase.HYBRID_MODE,
    enableSupabase: true,
    syncInterval: 30000,
    rollbackThreshold: 0.05,
    validationRules: []
  }), []);

  const handleStartMigration = async () => {
    setMigrationStatus('running');
    
    try {
      const result = await migrationManager.executeMigration();
      setMigrationStatus('completed');
      setProgress(prev => ({ ...prev, percentage: 100 }));
    } catch (error) {
      setMigrationStatus('failed');
      setProgress(prev => ({
        ...prev,
        errors: [...prev.errors, error.message]
      }));
    }
  };

  const handleRollback = async () => {
    setMigrationStatus('rolling_back');
    
    try {
      await migrationManager.rollback();
      setMigrationStatus('rolled_back');
    } catch (error) {
      setMigrationStatus('rollback_failed');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Migration Dashboard</h2>
        
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatusCard
            title="Current Phase"
            value={progress.phase}
            status={migrationStatus}
          />
          <StatusCard
            title="Progress"
            value={`${progress.percentage}%`}
            status={migrationStatus}
          />
          <StatusCard
            title="Errors"
            value={progress.errors.length}
            status={progress.errors.length > 0 ? 'warning' : 'success'}
          />
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{progress.currentTask}</span>
            <span>{progress.percentage}%</span>
          </div>
          <ProgressBar percentage={progress.percentage} />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-6">
          <Button
            onClick={handleStartMigration}
            disabled={migrationStatus === 'running'}
            className="bg-blue-500 hover:bg-blue-600"
          >
            {migrationStatus === 'running' ? 'Migrating...' : 'Start Migration'}
          </Button>
          
          <Button
            onClick={handleRollback}
            disabled={migrationStatus !== 'failed'}
            variant="destructive"
          >
            Rollback
          </Button>
        </div>

        {/* Error Log */}
        {progress.errors.length > 0 && (
          <ErrorLog errors={progress.errors} />
        )}
      </div>
    </div>
  );
};
```

---

## 📊 **MONITORING & ROLLBACK STRATEGY**

### **Health Monitoring**
```typescript
// src/monitoring/MigrationMonitor.ts
export class MigrationMonitor {
  private metrics: Map<string, MetricValue> = new Map();
  private alerts: Alert[] = [];

  async checkMigrationHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDataConsistency(),
      this.checkPerformanceMetrics(),
      this.checkErrorRates(),
      this.checkSyncLag()
    ]);

    const allPassed = checks.every(check => 
      check.status === 'fulfilled' && check.value.passed
    );

    return {
      status: allPassed ? 'healthy' : 'degraded',
      checks: checks.map(this.formatCheckResult),
      timestamp: new Date().toISOString(),
      nextCheck: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    };
  }

  async checkDataConsistency(): Promise<HealthCheck> {
    try {
      const localCount = await this.getLocalDataCount();
      const remoteCount = await this.getRemoteDataCount();
      const discrepancy = Math.abs(localCount - remoteCount) / Math.max(localCount, remoteCount);

      return {
        name: 'data_consistency',
        passed: discrepancy < 0.05, // 5% tolerance
        value: discrepancy,
        message: `Local: ${localCount}, Remote: ${remoteCount}, Discrepancy: ${(discrepancy * 100).toFixed(2)}%`
      };
    } catch (error) {
      return {
        name: 'data_consistency',
        passed: false,
        error: error.message
      };
    }
  }
}
```

### **Automated Rollback System**
```typescript
// src/migration/RollbackManager.ts
export class RollbackManager {
  private snapshots: Map<string, DataSnapshot> = new Map();

  async createSnapshot(label: string): Promise<void> {
    const snapshot: DataSnapshot = {
      id: crypto.randomUUID(),
      label,
      timestamp: new Date().toISOString(),
      data: {
        vagas: await this.exportLocalStorageData('vagas_data'),
        drivers: await this.exportLocalStorageData('drivers_data'),
        notifications: await this.exportLocalStorageData('notifications_data')
      },
      metadata: {
        version: packageJson.version,
        userAgent: navigator.userAgent,
        migrationPhase: await this.getCurrentMigrationPhase()
      }
    };

    this.snapshots.set(label, snapshot);
    localStorage.setItem(`migration_snapshot_${label}`, JSON.stringify(snapshot));
  }

  async rollback(snapshotLabel: string): Promise<RollbackResult> {
    try {
      const snapshot = this.snapshots.get(snapshotLabel) || 
        JSON.parse(localStorage.getItem(`migration_snapshot_${snapshotLabel}`) || '{}');

      if (!snapshot.data) {
        throw new Error(`Snapshot ${snapshotLabel} not found`);
      }

      // Restore localStorage data
      Object.entries(snapshot.data).forEach(([key, data]) => {
        localStorage.setItem(key, JSON.stringify(data));
      });

      // Clear Supabase data if necessary
      await this.clearSupabaseData();

      // Restart application with localStorage-only mode
      await this.resetToLocalStorageMode();

      return {
        success: true,
        snapshotId: snapshot.id,
        timestamp: new Date().toISOString(),
        restoredEntities: Object.keys(snapshot.data)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}
```

---

## 📅 **CRONOGRAMA DETALHADO**

### **Semana 1: Preparação**
- [ ] Setup Supabase project e database schema
- [ ] Implementar adapters e abstrações
- [ ] Criar feature flag system
- [ ] Setup monitoring básico

### **Semana 2-3: Hybrid Mode**
- [ ] Implementar HybridDataManager
- [ ] Sistema de conflict resolution
- [ ] Testes de sincronização
- [ ] Rollout gradual (10% → 50%)

### **Semana 4: Validação**
- [ ] Tools de migração bulk
- [ ] Dashboard de monitoring
- [ ] Testes de stress
- [ ] Preparação para 100% rollout

### **Semana 5: Migração Final**
- [ ] Migração completa dos dados
- [ ] Desabilitar localStorage writes
- [ ] Cleanup de código legacy
- [ ] Documentação final

### **Semana 6: Cleanup**
- [ ] Remover adapters de localStorage
- [ ] Otimizar performance
- [ ] Monitoring de produção
- [ ] Post-mortem e lessons learned

Esta estratégia garante uma migração segura e robusta com zero downtime e capacidade de rollback em qualquer momento!
