import { Injectable, signal, computed, effect } from '@angular/core';

export type LinuxThemeId = 'biglinux' | 'plasma-breeze' | 'manjaro-emerald' | 'ubuntu-cosmic' | 'arch-nord' | 'desk-skeuo';
export type DockLayoutMode = 'floating' | 'panel';
export type WindowControlStyle = 'linux' | 'traffic' | 'classic';

export interface LinuxThemePreset {
  id: LinuxThemeId;
  name: string;
  distro: string;
  description: string;
  accentColor: string;
  accentHover: string;
  accentGlow: string;
  bgSurface: string;
  bgSurfaceLight: string;
  textPrimary: string;
  textSecondary: string;
  windowBorder: string;
  dockGlass: string;
  badgeBg: string;
  icon: string;
}

export interface LinuxWallpaper {
  id: string;
  name: string;
  distro: string;
  css: string;
  previewColor: string;
}

export const LINUX_THEME_PRESETS: Record<LinuxThemeId, LinuxThemePreset> = {
  'biglinux': {
    id: 'biglinux',
    name: 'BigLinux Modern',
    distro: 'BigLinux (Manjaro/Arch Base)',
    description: 'Interface translúcida em vidro ciano inspirada no BigLinux KDE Plasma.',
    accentColor: '#06b6d4',
    accentHover: '#0891b2',
    accentGlow: 'rgba(6, 182, 212, 0.4)',
    bgSurface: '#0b0f17',
    bgSurfaceLight: '#141b27',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    windowBorder: 'rgba(6, 182, 212, 0.3)',
    dockGlass: 'rgba(11, 15, 23, 0.78)',
    badgeBg: '#0891b2',
    icon: 'desktop_windows'
  },
  'plasma-breeze': {
    id: 'plasma-breeze',
    name: 'KDE Plasma Breeze',
    distro: 'KDE Plasma 6',
    description: 'Visual oficial Breeze com azul cobalto vibrante e acabamentos em vidro.',
    accentColor: '#3b82f6',
    accentHover: '#2563eb',
    accentGlow: 'rgba(59, 130, 246, 0.4)',
    bgSurface: '#0f172a',
    bgSurfaceLight: '#1e293b',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    windowBorder: 'rgba(59, 130, 246, 0.35)',
    dockGlass: 'rgba(15, 23, 42, 0.82)',
    badgeBg: '#2563eb',
    icon: 'dashboard'
  },
  'manjaro-emerald': {
    id: 'manjaro-emerald',
    name: 'Manjaro Emerald',
    distro: 'Manjaro Linux',
    description: 'Estilo verde esmeralda com alta produtividade e visual escuro requintado.',
    accentColor: '#10b981',
    accentHover: '#059669',
    accentGlow: 'rgba(16, 185, 129, 0.35)',
    bgSurface: '#091512',
    bgSurfaceLight: '#13231e',
    textPrimary: '#f0fdf4',
    textSecondary: '#a7f3d0',
    windowBorder: 'rgba(16, 185, 129, 0.3)',
    dockGlass: 'rgba(9, 21, 18, 0.82)',
    badgeBg: '#059669',
    icon: 'spa'
  },
  'ubuntu-cosmic': {
    id: 'ubuntu-cosmic',
    name: 'Ubuntu Cosmic',
    distro: 'Ubuntu Linux',
    description: 'Acentos em laranja cósmico quente com superfícies aubergine profundas.',
    accentColor: '#f97316',
    accentHover: '#ea580c',
    accentGlow: 'rgba(249, 115, 22, 0.4)',
    bgSurface: '#18111d',
    bgSurfaceLight: '#261b2e',
    textPrimary: '#fff7ed',
    textSecondary: '#fed7aa',
    windowBorder: 'rgba(249, 115, 22, 0.35)',
    dockGlass: 'rgba(24, 17, 29, 0.82)',
    badgeBg: '#ea580c',
    icon: 'bolt'
  },
  'arch-nord': {
    id: 'arch-nord',
    name: 'Arch Linux Nord',
    distro: 'Arch Linux',
    description: 'Paleta ártica minimalista Nord com ciano glacial e cinza azulado.',
    accentColor: '#88c0d0',
    accentHover: '#81a1c1',
    accentGlow: 'rgba(136, 192, 208, 0.35)',
    bgSurface: '#242933',
    bgSurfaceLight: '#2e3440',
    textPrimary: '#eceff4',
    textSecondary: '#d8dee9',
    windowBorder: 'rgba(136, 192, 208, 0.3)',
    dockGlass: 'rgba(36, 41, 51, 0.85)',
    badgeBg: '#5e81ac',
    icon: 'terminal'
  },
  'desk-skeuo': {
    id: 'desk-skeuo',
    name: 'DEsk Balcão Físico',
    distro: 'DEsk (fyzugx/DEsk Inspired)',
    description: 'Mesa tátil de madeira nobre e latão, com gaveta de apps, papéis e luminária de mesa.',
    accentColor: '#f59e0b',
    accentHover: '#d97706',
    accentGlow: 'rgba(245, 158, 11, 0.5)',
    bgSurface: '#1c1917',
    bgSurfaceLight: '#292524',
    textPrimary: '#fef3c7',
    textSecondary: '#d6d3d1',
    windowBorder: 'rgba(245, 158, 11, 0.45)',
    dockGlass: 'rgba(28, 25, 23, 0.92)',
    badgeBg: '#b45309',
    icon: 'desk'
  }
};

export const LINUX_WALLPAPERS: LinuxWallpaper[] = [
  {
    id: 'desk-wood-counter',
    name: 'DEsk Balcão de Madeira Nobre',
    distro: 'DEsk',
    css: 'bg-[#181411] bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.22),transparent_70%),linear-gradient(to_bottom,#1f1a14,#14100c)]',
    previewColor: '#92400e'
  },
  {
    id: 'desk-leather-mat',
    name: 'DEsk Couro & Latão Comercial',
    distro: 'DEsk',
    css: 'bg-[#12100e] bg-[radial-gradient(ellipse_at_top,rgba(217,119,6,0.2),transparent_60%),radial-gradient(circle_at_bottom,rgba(180,83,9,0.1),transparent)]',
    previewColor: '#78350f'
  },
  {
    id: 'desk-dark-oak',
    name: 'DEsk Carvalho Escuro Executivo',
    distro: 'DEsk',
    css: 'bg-[#15110d] bg-[radial-gradient(ellipse_at_center,rgba(180,83,9,0.18),transparent_65%),linear-gradient(to_bottom,#1c1510,#0d0a08)]',
    previewColor: '#451a03'
  },
  {
    id: 'biglinux-cyan',
    name: 'BigLinux Nebula Ciano',
    distro: 'BigLinux',
    css: 'bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.25),rgba(15,23,42,1))]',
    previewColor: '#06b6d4'
  },
  {
    id: 'plasma-aurora',
    name: 'KDE Plasma Aurora',
    distro: 'KDE Plasma',
    css: 'bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.25),rgba(11,15,25,1))]',
    previewColor: '#3b82f6'
  },
  {
    id: 'manjaro-forest',
    name: 'Manjaro Breath Dark',
    distro: 'Manjaro',
    css: 'bg-[#08120f] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.2),rgba(8,18,15,1))]',
    previewColor: '#10b981'
  },
  {
    id: 'ubuntu-dusk',
    name: 'Ubuntu Cosmic Sunset',
    distro: 'Ubuntu',
    css: 'bg-[#140e19] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(249,115,22,0.22),rgba(20,14,25,1))]',
    previewColor: '#f97316'
  },
  {
    id: 'arch-arctic',
    name: 'Arch Linux Nord Frost',
    distro: 'Arch Linux',
    css: 'bg-[#1e222a] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(136,192,208,0.2),rgba(30,34,42,1))]',
    previewColor: '#88c0d0'
  }
];

@Injectable({
  providedIn: 'root'
})
export class LinuxThemeService {
  private readonly THEME_KEY = '3eatcru_os_linux_theme';
  private readonly DOCK_KEY = '3eatcru_os_dock_mode';
  private readonly WALLPAPER_KEY = '3eatcru_os_linux_wallpaper';
  private readonly CONTROLS_KEY = '3eatcru_os_window_controls';
  private readonly DESK_LAMP_KEY = '3eatcru_os_desk_lamp';

  // Signals
  readonly activeThemeId = signal<LinuxThemeId>(this.loadStoredTheme());
  readonly dockMode = signal<DockLayoutMode>(this.loadStoredDockMode());
  readonly activeWallpaperId = signal<string>(this.loadStoredWallpaper());
  readonly windowControlsStyle = signal<WindowControlStyle>(this.loadStoredWindowControls());
  readonly deskLampEnabled = signal<boolean>(this.loadStoredDeskLamp());

  // Computeds
  readonly currentTheme = computed<LinuxThemePreset>(() => {
    return LINUX_THEME_PRESETS[this.activeThemeId()] || LINUX_THEME_PRESETS['biglinux'];
  });

  readonly effectiveWallpaper = computed<string>(() => {
    const wp = LINUX_WALLPAPERS.find(w => w.id === this.activeWallpaperId());
    return wp ? wp.css : LINUX_WALLPAPERS[0].css;
  });

  readonly isFloatingDock = computed<boolean>(() => {
    return this.dockMode() === 'floating';
  });

  readonly isDeskTheme = computed<boolean>(() => {
    return this.activeThemeId() === 'desk-skeuo';
  });

  constructor() {
    // Apply CSS variables dynamically whenever active theme changes
    effect(() => {
      const theme = this.currentTheme();
      if (typeof document !== 'undefined' && document.documentElement) {
        const root = document.documentElement;
        root.style.setProperty('--accent-color', theme.accentColor);
        root.style.setProperty('--accent-hover', theme.accentHover);
        root.style.setProperty('--accent-glow', theme.accentGlow);
        root.style.setProperty('--bg-surface', theme.bgSurface);
        root.style.setProperty('--bg-surface-light', theme.bgSurfaceLight);
        root.style.setProperty('--text-primary', theme.textPrimary);
        root.style.setProperty('--text-secondary', theme.textSecondary);
        root.style.setProperty('--window-border', theme.windowBorder);
        root.style.setProperty('--dock-glass', theme.dockGlass);
      }
    });
  }

  setTheme(themeId: LinuxThemeId): void {
    if (LINUX_THEME_PRESETS[themeId]) {
      this.activeThemeId.set(themeId);
      this.safeSetStorage(this.THEME_KEY, themeId);
      
      // Auto-switch to matching wallpaper if user hasn't heavily customized
      const matchWp = LINUX_WALLPAPERS.find(w => w.distro.toLowerCase().includes(themeId.split('-')[0]));
      if (matchWp) {
        this.setWallpaper(matchWp.id);
      }
    }
  }

  setDockMode(mode: DockLayoutMode): void {
    this.dockMode.set(mode);
    this.safeSetStorage(this.DOCK_KEY, mode);
  }

  setWallpaper(wallpaperId: string): void {
    this.activeWallpaperId.set(wallpaperId);
    this.safeSetStorage(this.WALLPAPER_KEY, wallpaperId);
  }

  setWindowControls(style: WindowControlStyle): void {
    this.windowControlsStyle.set(style);
    this.safeSetStorage(this.CONTROLS_KEY, style);
  }

  toggleDeskLamp(): void {
    this.deskLampEnabled.update(v => !v);
    this.safeSetStorage(this.DESK_LAMP_KEY, String(this.deskLampEnabled()));
  }

  private loadStoredDeskLamp(): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = localStorage.getItem(this.DESK_LAMP_KEY);
        if (val !== null) return val === 'true';
      }
    } catch {
      // fallback
    }
    return true;
  }

  private loadStoredTheme(): LinuxThemeId {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = localStorage.getItem(this.THEME_KEY) as LinuxThemeId;
        if (val && LINUX_THEME_PRESETS[val]) {
          return val;
        }
      }
    } catch {
      // fallback
    }
    return 'desk-skeuo';
  }

  private loadStoredDockMode(): DockLayoutMode {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = localStorage.getItem(this.DOCK_KEY) as DockLayoutMode;
        if (val === 'floating' || val === 'panel') {
          return val;
        }
      }
    } catch {
      // fallback
    }
    return 'floating';
  }

  private loadStoredWallpaper(): string {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = localStorage.getItem(this.WALLPAPER_KEY);
        if (val) return val;
      }
    } catch {
      // fallback
    }
    return 'desk-wood-counter';
  }

  private loadStoredWindowControls(): WindowControlStyle {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = localStorage.getItem(this.CONTROLS_KEY) as WindowControlStyle;
        if (val === 'linux' || val === 'traffic' || val === 'classic') {
          return val;
        }
      }
    } catch {
      // fallback
    }
    return 'linux';
  }

  private safeSetStorage(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value);
      }
    } catch {
      // ignore
    }
  }
}
