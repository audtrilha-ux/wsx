import { Injectable, signal, computed, effect } from '@angular/core';

export type ResolutionPresetId = 
  | 'auto' 
  | '1280x720' 
  | '1366x768' 
  | '1600x900' 
  | '1920x1080' 
  | '2560x1440' 
  | '3840x2160' 
  | 'custom';

export type ScaleFactor = 80 | 90 | 100 | 110 | 125 | 150;

export type ViewportFitMode = 'contain-scaled' | 'center-letterbox' | 'scrollable';

export interface ResolutionOption {
  id: ResolutionPresetId;
  label: string;
  category: 'Auto' | 'Compact' | 'Standard' | 'HD' | 'Full HD' | 'QHD' | '4K' | 'Custom';
  width?: number;
  height?: number;
}

export interface WorkspaceContext {
  workspaceWidth: number;
  workspaceHeight: number;
  scale: number;
  fitMode: ViewportFitMode;
  presetId: ResolutionPresetId;
  safeArea: { top: number; bottom: number; left: number; right: number };
}

export const RESOLUTION_PRESETS: ResolutionOption[] = [
  { id: 'auto', label: 'Automática (Adaptativa)', category: 'Auto' },
  { id: '1280x720', label: 'Compacto (1280 × 720)', category: 'Compact', width: 1280, height: 720 },
  { id: '1366x768', label: 'Padrão (1366 × 768)', category: 'Standard', width: 1366, height: 768 },
  { id: '1600x900', label: 'HD (1600 × 900)', category: 'HD', width: 1600, height: 900 },
  { id: '1920x1080', label: 'Full HD (1920 × 1080)', category: 'Full HD', width: 1920, height: 1080 },
  { id: '2560x1440', label: 'QHD (2560 × 1440)', category: 'QHD', width: 2560, height: 1440 },
  { id: '3840x2160', label: '4K (3840 × 2160)', category: '4K', width: 3840, height: 2160 },
  { id: 'custom', label: 'Personalizada', category: 'Custom' }
];

export const SCALE_FACTORS: ScaleFactor[] = [80, 90, 100, 110, 125, 150];

const STORAGE_KEY = '3eatcru_os_display_config_v1';

@Injectable({
  providedIn: 'root'
})
export class OsDisplayEngineService {
  readonly selectedPresetId = signal<ResolutionPresetId>('auto');
  readonly scaleFactor = signal<ScaleFactor>(100);
  readonly customWidth = signal<number>(1920);
  readonly customHeight = signal<number>(1080);
  readonly fitMode = signal<ViewportFitMode>('contain-scaled');

  // Real browser window size tracking for auto mode calculations
  readonly windowWidth = signal<number>(typeof window !== 'undefined' ? window.innerWidth : 1920);
  readonly windowHeight = signal<number>(typeof window !== 'undefined' ? window.innerHeight : 1080);

  constructor() {
    this.loadFromStorage();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        this.windowWidth.set(window.innerWidth);
        this.windowHeight.set(window.innerHeight);
      });
    }

    // Auto-save changes to storage
    effect(() => {
      const config = {
        presetId: this.selectedPresetId(),
        scaleFactor: this.scaleFactor(),
        customWidth: this.customWidth(),
        customHeight: this.customHeight(),
        fitMode: this.fitMode()
      };
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        } catch (err) {
          console.warn('Could not save display resolution to storage:', err);
        }
      }
    });
  }

  readonly currentPreset = computed(() => {
    const id = this.selectedPresetId();
    return RESOLUTION_PRESETS.find(p => p.id === id) || RESOLUTION_PRESETS[0];
  });

  readonly effectiveScale = computed(() => this.scaleFactor() / 100);

  readonly targetWidth = computed(() => {
    const preset = this.currentPreset();
    if (preset.id === 'auto') {
      return this.windowWidth();
    }
    if (preset.id === 'custom') {
      return this.customWidth();
    }
    return preset.width || 1920;
  });

  readonly targetHeight = computed(() => {
    const preset = this.currentPreset();
    if (preset.id === 'auto') {
      return this.windowHeight();
    }
    if (preset.id === 'custom') {
      return this.customHeight();
    }
    return preset.height || 1080;
  });

  readonly workspaceContext = computed<WorkspaceContext>(() => ({
    workspaceWidth: this.targetWidth(),
    workspaceHeight: this.targetHeight(),
    scale: this.effectiveScale(),
    fitMode: this.fitMode(),
    presetId: this.selectedPresetId(),
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 }
  }));

  readonly displayBadgeLabel = computed(() => {
    const preset = this.currentPreset();
    const scale = this.scaleFactor();
    if (preset.id === 'auto') {
      return `AUTO (${this.targetWidth()}×${this.targetHeight()}) @ ${scale}%`;
    }
    if (preset.id === 'custom') {
      return `CUSTOM (${this.targetWidth()}×${this.targetHeight()}) @ ${scale}%`;
    }
    return `${preset.category} (${this.targetWidth()}×${this.targetHeight()}) @ ${scale}%`;
  });

  setPreset(presetId: ResolutionPresetId) {
    this.selectedPresetId.set(presetId);
  }

  setScale(scale: ScaleFactor) {
    this.scaleFactor.set(scale);
  }

  setFitMode(mode: ViewportFitMode) {
    this.fitMode.set(mode);
  }

  setCustomResolution(width: number, height: number) {
    this.customWidth.set(Math.max(800, width));
    this.customHeight.set(Math.max(600, height));
    this.selectedPresetId.set('custom');
  }

  private loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.presetId) this.selectedPresetId.set(parsed.presetId);
        if (parsed.scaleFactor) this.scaleFactor.set(parsed.scaleFactor);
        if (parsed.customWidth) this.customWidth.set(parsed.customWidth);
        if (parsed.customHeight) this.customHeight.set(parsed.customHeight);
        if (parsed.fitMode) this.fitMode.set(parsed.fitMode);
      }
    } catch (err) {
      console.warn('Failed to load display resolution from storage:', err);
    }
  }
}
