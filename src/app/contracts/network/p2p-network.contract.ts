export type P2PPeerRole = 'pos' | 'kds' | 'terminal' | 'server';

export type P2PPeerStatus = 'discovered' | 'pairing_pending' | 'paired' | 'connected' | 'disconnected' | 'revoked';

export type P2PNetworkState = 'offline' | 'lan_only' | 'p2p_connected' | 'cloud_synced';

export interface P2PPeer {
  id: string;
  deviceName: string;
  ipAddress: string;
  port: number;
  role: P2PPeerRole;
  status: P2PPeerStatus;
  lastSeenAt: string;
  capabilities: string[];
  publicKey?: string;
  sessionToken?: string;
}

export interface P2PMessage<T = unknown> {
  id: string;
  senderPeerId: string;
  targetPeerId?: string;
  type: string;
  payload: T;
  timestamp: string;
  signature?: string;
}

export interface IP2PNetworkService {
  readonly networkState: P2PNetworkState;
  readonly knownPeers: P2PPeer[];
  
  discoverPeers(): Promise<P2PPeer[]>;
  pairPeer(peerId: string, pairingPin: string): Promise<boolean>;
  unpairPeer(peerId: string): Promise<void>;
  sendDirectMessage<T = unknown>(targetPeerId: string, type: string, payload: T): Promise<boolean>;
  broadcastMessage<T = unknown>(type: string, payload: T): Promise<void>;
  startSession(peerId: string): Promise<boolean>;
  closeSession(peerId: string): Promise<void>;
  getKnownPeers(): P2PPeer[];
}
