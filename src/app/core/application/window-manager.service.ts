import { Injectable, signal, computed, inject } from '@angular/core';
import { AppRuntimeService } from '../app-runtime/app-runtime.service';
import { AppRegistryService } from '../app-runtime/app-registry.service';
import { OsDisplayEngineService } from './display-engine.service';

export interface WindowState {
  id: string;
  title: string;
  icon: string;
  componentId: string; // The ID of the app/component to render inside the window
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized?: boolean;
  zIndex: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  isSnapped?: 'left' | 'right' | null;
  preSnapX?: number;
  preSnapY?: number;
  preSnapWidth?: number;
  preSnapHeight?: number;
  isClosing?: boolean;
  isMinimizing?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WindowManagerService {
  private appRuntime = inject(AppRuntimeService);
  private appRegistry = inject(AppRegistryService);
  private displayEngine = inject(OsDisplayEngineService);
  private activeWindows = signal<WindowState[]>([]);
  private nextZIndex = 10;

  readonly windows = this.activeWindows.asReadonly();
  
  readonly topWindowId = computed(() => {
    const wins = this.windows();
    if (wins.length === 0) return null;
    return wins.reduce((prev, current) => (prev.zIndex > current.zIndex) ? prev : current).id;
  });

  openWindow(appId: string, title: string, icon: string) {
    const isInstalled = this.appRuntime.checkEntitlement(appId);
    if (!isInstalled) {
      console.warn(`[WindowManager] App '${appId}' is not installed for this tenant.`);
      return;
    }

    const compat = this.appRuntime.validateAppCompatibility(appId);
    if (!compat.compatible) {
      console.warn(`[WindowManager] Cannot open app '${appId}': ${compat.reason}`);
      return;
    }

    this.appRuntime.updateInstanceState(appId, 'active');
    void this.appRegistry.loadComponent(appId);

    this.activeWindows.update(windows => {
      const existing = windows.find(w => w.id === appId);
      
      if (existing) {
        // Bring to front and restore if minimized
        return windows.map(w => 
          w.id === appId 
            ? { ...w, isMinimized: false, isMinimizing: false, isClosing: false, zIndex: ++this.nextZIndex } 
            : w
        );
      }
      
      // Open new window
      const screenW = this.displayEngine.targetWidth();
      const screenH = Math.max(450, this.displayEngine.targetHeight() - 56);
      const defaultW = Math.min(1000, screenW - 64);
      const defaultH = Math.min(650, screenH - 64);
      const existingCount = windows.length;
      const cascadeOffset = (existingCount % 6) * 28;
      const defaultX = Math.max(16, Math.floor((screenW - defaultW) / 2) + cascadeOffset);
      const defaultY = Math.max(16, Math.floor((screenH - defaultH) / 2) + cascadeOffset);

      return [...windows, {
        id: appId,
        title,
        icon,
        componentId: appId,
        isOpen: true,
        isMinimized: false,
        isMinimizing: false,
        isMaximized: false,
        zIndex: ++this.nextZIndex,
        x: defaultX,
        y: defaultY,
        width: defaultW,
        height: defaultH
      }];
    });
  }

  closeWindow(appId: string) {
    this.activeWindows.update(windows => 
      windows.map(w => w.id === appId ? { ...w, isClosing: true } : w)
    );
  }

  removeWindow(appId: string) {
    this.appRuntime.updateInstanceState(appId, 'destroyed');
    this.activeWindows.update(windows => windows.filter(w => w.id !== appId));
  }

  minimizeWindow(appId: string) {
    this.appRuntime.updateInstanceState(appId, 'paused');
    this.activeWindows.update(windows => 
      windows.map(w => w.id === appId ? { ...w, isMinimized: true, isMinimizing: true } : w)
    );
  }

  finalizeMinimize(appId: string) {
    this.activeWindows.update(windows => 
      windows.map(w => w.id === appId ? { ...w, isMinimized: true, isMinimizing: false } : w)
    );
  }

  toggleMaximize(appId: string) {
    this.activeWindows.update(windows => 
      windows.map(w => {
        if (w.id === appId) {
          const isMax = !w.isMaximized;
          if (isMax) {
            return {
              ...w,
              isMaximized: isMax,
              zIndex: ++this.nextZIndex,
              preSnapX: w.x,
              preSnapY: w.y,
              preSnapWidth: w.width,
              preSnapHeight: w.height,
              isSnapped: null
            };
          } else {
            return {
              ...w,
              isMaximized: isMax,
              zIndex: ++this.nextZIndex,
              x: w.preSnapX !== undefined ? w.preSnapX : w.x,
              y: w.preSnapY !== undefined ? w.preSnapY : w.y,
              width: w.preSnapWidth !== undefined ? w.preSnapWidth : w.width,
              height: w.preSnapHeight !== undefined ? w.preSnapHeight : w.height
            };
          }
        }
        return w;
      })
    );
  }

  toggleWindow(appId: string) {
    const win = this.activeWindows().find(w => w.id === appId);
    if (!win) return;
    
    if (win.isMinimized) {
      this.focusWindow(appId);
    } else if (this.topWindowId() === appId) {
      this.minimizeWindow(appId);
    } else {
      this.focusWindow(appId);
    }
  }

  focusWindow(appId: string) {
    this.appRuntime.updateInstanceState(appId, 'active');
    this.activeWindows.update(windows => 
      windows.map(w => w.id === appId ? { ...w, isMinimized: false, isMinimizing: false, isClosing: false, zIndex: ++this.nextZIndex } : w)
    );
  }

  updateWindowPosition(appId: string, x: number, y: number) {
    this.activeWindows.update(windows => 
      windows.map(w => w.id === appId ? { ...w, x, y, isSnapped: null } : w)
    );
  }

  updateWindowSize(appId: string, width: number, height: number) {
    this.activeWindows.update(windows => 
      windows.map(w => w.id === appId ? { ...w, width, height } : w)
    );
  }

  snapWindow(appId: string, isSnapped: 'left' | 'right' | null) {
    this.activeWindows.update(windows => 
      windows.map(w => {
        if (w.id === appId) {
          if (isSnapped) {
            const saveCoords = !w.isSnapped && !w.isMaximized;
            return {
              ...w,
              isSnapped,
              isMaximized: false,
              preSnapX: saveCoords ? w.x : w.preSnapX,
              preSnapY: saveCoords ? w.y : w.preSnapY,
              preSnapWidth: saveCoords ? w.width : w.preSnapWidth,
              preSnapHeight: saveCoords ? w.height : w.preSnapHeight
            };
          } else {
            return { ...w, isSnapped };
          }
        }
        return w;
      })
    );
  }

  saveFloatingState(appId: string, x: number, y: number, width: number, height: number) {
    this.activeWindows.update(windows => 
      windows.map(w => w.id === appId ? { ...w, preSnapX: x, preSnapY: y, preSnapWidth: width, preSnapHeight: height } : w)
    );
  }

  unsnapAndRestore(appId: string) {
    this.activeWindows.update(windows => 
      windows.map(w => {
        if (w.id === appId) {
          return {
            ...w,
            isSnapped: null,
            isMaximized: false,
            x: w.preSnapX !== undefined ? w.preSnapX : w.x,
            y: w.preSnapY !== undefined ? w.preSnapY : w.y,
            width: w.preSnapWidth !== undefined ? w.preSnapWidth : w.width,
            height: w.preSnapHeight !== undefined ? w.preSnapHeight : w.height
          };
        }
        return w;
      })
    );
  }

  tileWindows() {
    const openWins = this.activeWindows().filter(w => !w.isMinimized);
    if (openWins.length === 0) return;

    const screenWidth = this.displayEngine.targetWidth();
    const screenHeight = Math.max(450, this.displayEngine.targetHeight() - 56); // 3.5rem taskbar is 56px

    const count = openWins.length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    this.activeWindows.update(windows => {
      let index = 0;
      return windows.map(w => {
        if (w.isMinimized) return w;
        
        const r = Math.floor(index / cols);
        const c = index % cols;
        
        const width = Math.floor(screenWidth / cols);
        const height = Math.floor(screenHeight / rows);
        const x = c * width;
        const y = r * height;
        
        index++;
        return {
          ...w,
          x: x + 4,
          y: y + 4,
          width: width - 8,
          height: height - 8,
          isMaximized: false,
          isSnapped: null
        };
      });
    });
  }

  cascadeWindows() {
    const openWins = this.activeWindows().filter(w => !w.isMinimized);
    if (openWins.length === 0) return;

    this.activeWindows.update(windows => {
      let index = 0;
      const startX = 60;
      const startY = 40;
      const offset = 35;
      const defaultW = Math.min(850, this.displayEngine.targetWidth() - 100);
      const defaultH = Math.min(550, this.displayEngine.targetHeight() - 100);

      return windows.map(w => {
        if (w.isMinimized) return w;

        const x = startX + index * offset;
        const y = startY + index * offset;
        index++;

        return {
          ...w,
          x,
          y,
          width: defaultW,
          height: defaultH,
          isMaximized: false,
          isSnapped: null,
          zIndex: ++this.nextZIndex
        };
      });
    });
  }
}

