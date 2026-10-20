import { Component, input, effect, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { animate } from 'motion';
import { WindowState } from '../../../core/application/window-manager.service';
import { WindowManagerService } from '../../../core/application/window-manager.service';

@Component({
  selector: 'app-os-window',
  standalone: true,
  imports: [CommonModule],
  template: `<ng-content></ng-content>`,
  host: {
    '[class]': 'win().isMaximized ? "rounded-none" : "rounded-2xl"',
  }
})
export class OsWindowComponent {
  win = input.required<WindowState>();
  el = inject(ElementRef);
  wm = inject(WindowManagerService);
  private wasClosing = false;
  private wasMinimizing = false;
  private hasEntered = false;

  constructor() {
    effect(() => {
      const windowState = this.win();
      
      if (windowState.isClosing && !this.wasClosing) {
        this.wasClosing = true;
        animate(this.el.nativeElement, {
          opacity: [1, 0],
          scale: [1, 0.92],
          y: [0, 14]
        }, {
          duration: 0.25,
          ease: "easeIn"
        }).finished.then(() => {
          this.wm.removeWindow(windowState.id);
        });
      } else if (windowState.isMinimizing && !this.wasMinimizing) {
        this.wasMinimizing = true;
        animate(this.el.nativeElement, {
          opacity: [1, 0],
          scale: [1, 0.72],
          y: [0, 80]
        }, {
          duration: 0.22,
          ease: "easeInOut"
        }).finished.then(() => {
          this.wm.finalizeMinimize(windowState.id);
          this.wasMinimizing = false;
          this.hasEntered = false;
        });
      } else if (!windowState.isClosing && !windowState.isMinimizing && !this.hasEntered) {
        this.hasEntered = true;
        this.wasClosing = false;
        this.wasMinimizing = false;
        animate(this.el.nativeElement, {
          opacity: [0, 1],
          scale: [0.94, 1],
          y: [16, 0]
        }, {
          duration: 0.32,
          ease: "easeOut"
        });
      }
    });
  }
}
