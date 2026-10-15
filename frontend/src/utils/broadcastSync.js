/**
 * Cross-tab communication channel using BroadcastChannel API.
 * Allows multiple tabs of the same application to stay synchronized
 * without opening duplicate persistent SSE connections.
 */
const CHANNEL_NAME = "reporting_tab_sync";

let channel = null;

export function getSyncChannel() {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return null;
  }
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

export function broadcastMessage(type, payload = {}) {
  const ch = getSyncChannel();
  if (ch) {
    try {
      ch.postMessage({ type, payload, timestamp: Date.now() });
    } catch (e) {
      console.warn("BroadcastChannel postMessage failed:", e);
    }
  }
}
