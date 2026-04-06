import { HELIUS_WS, WATCHED_ACCOUNTS } from './constants'

type PriceUpdateCallback = () => void

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let subscriptionIds: number[] = []
let onPriceUpdate: PriceUpdateCallback | null = null
let pendingUpdate = false
let updateThrottleTimer: ReturnType<typeof setTimeout> | null = null

// Throttle callbacks to at most once per 2 seconds to avoid hammering RPC
function triggerUpdate() {
  if (pendingUpdate) return
  pendingUpdate = true
  if (updateThrottleTimer) clearTimeout(updateThrottleTimer)
  updateThrottleTimer = setTimeout(() => {
    pendingUpdate = false
    onPriceUpdate?.()
  }, 2000)
}

function subscribe(socket: WebSocket) {
  subscriptionIds = []
  WATCHED_ACCOUNTS.forEach((pubkey, i) => {
    const id = i + 100  // use as correlating id
    socket.send(JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'accountSubscribe',
      params: [pubkey, { encoding: 'base64', commitment: 'confirmed' }],
    }))
  })
}

export function connectWebSocket(callback: PriceUpdateCallback): () => void {
  onPriceUpdate = callback

  function connect() {
    if (ws) {
      ws.onclose = null
      ws.close()
    }

    ws = new WebSocket(HELIUS_WS)

    ws.onopen = () => {
      console.log('[WS] Connected to Helius')
      subscribe(ws!)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        // Subscription confirmation
        if (msg.id && msg.result !== undefined) {
          subscriptionIds.push(msg.result)
          return
        }
        // Account notification
        if (msg.method === 'accountNotification') {
          triggerUpdate()
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onerror = () => {
      console.warn('[WS] Error - will reconnect')
    }

    ws.onclose = () => {
      console.warn('[WS] Disconnected - reconnecting in 5s')
      reconnectTimer = setTimeout(connect, 5000)
    }
  }

  connect()

  // Cleanup function
  return () => {
    onPriceUpdate = null
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (updateThrottleTimer) clearTimeout(updateThrottleTimer)
    if (ws) {
      ws.onclose = null
      ws.close()
      ws = null
    }
  }
}
