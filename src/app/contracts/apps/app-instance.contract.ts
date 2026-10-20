import { OsContext } from '../os/os-context.contract';

export type AppLifecycleState = 'unmounted' | 'initializing' | 'active' | 'paused' | 'destroyed';

export interface AppInstance {
  /**
   * Chamado quando o App é montado na janela e recebe o contexto seguro do OS
   */
  onAppInit?(context: OsContext): Promise<void> | void;

  /**
   * Chamado quando a janela do App é minimizada ou vai para segundo plano
   */
  onAppPause?(): Promise<void> | void;

  /**
   * Chamado quando a janela do App volta a ter foco ou é restaurada
   */
  onAppResume?(): Promise<void> | void;

  /**
   * Chamado quando a janela do App é fechada e desalocada
   */
  onAppDestroy?(): Promise<void> | void;
}

