export type IntelligenceAlertStatus = 'pending' | 'reviewed' | 'dismissed';

export type IntelligenceAlertResolution = 'reviewed' | 'dismissed';

export interface IntelligenceAlertRow {
  id: string;
  universityId: string;
  universityName: string;
  status: IntelligenceAlertStatus;
  sourceUrl: string;
  previousContentHash: string | null;
  newContentHash: string;
  detectedAt: string;
  resolvedAt: string | null;
}

export interface IntelligenceDashboardSummary {
  pendingCount: number;
  reviewedCount: number;
  /** source_url tanımlı izlenen kaynak sayısı */
  monitoredSourceCount: number;
  /** En az bir kez taranmış kaynak sayısı (last_checked_at dolu) */
  lastCheckedCount: number;
  alerts: IntelligenceAlertRow[];
}

export interface SourceCheckRunSummary {
  checked: number;
  alertsCreated: number;
  skipped: number;
  failures: string[];
}
