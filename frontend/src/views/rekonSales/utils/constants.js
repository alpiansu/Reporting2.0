// Constants for ReKon Sales module
export const NOTE_CATEGORIES = {
  SYSTEM_GENERATED: { id: 1, name: 'system-generated', color: '#3B82F6' },
  HUMAN_INPUT: { id: 2, name: 'human-input', color: '#8B5CF6' },
  ISSUE_FOUND: { id: 3, name: 'issue-found', color: '#EF4444' },
  RESOLVED: { id: 4, name: 'resolved', color: '#10B981' },
  FOLLOW_UP: { id: 5, name: 'follow-up', color: '#F59E0B' }
};

export const SCREENING_LEVELS = {
  SINGLE_STORE: 'single_store',
  MASS_CABANG: 'mass_cabang',
  MASS_ALL: 'mass_all'
};

export const SEVERITY_CONFIG = {
  none: { color: '#6B7280', label: 'None' },
  low: { color: '#22C55E', label: 'Low' },
  medium: { color: '#F59E0B', label: 'Medium' },
  high: { color: '#EF4444', label: 'High' }
};

export const COLORS = {
  primaryBlue: '#3b82f6',
  successGreen: '#10b981',
  dangerRed: '#ef4444',
  warningOrange: '#f59e0b',
  neutralGray: '#6b7280',
  bgLight: '#f9fafb',
  bgWhite: '#ffffff'
};
