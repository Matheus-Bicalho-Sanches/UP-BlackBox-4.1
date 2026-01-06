import { WebSocketServer } from 'ws';
import { connect, StringCodec } from 'nats';

const PORT = process.env.WS_PORT || 3002;
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const NATS_SUBJECT_PREFIX = process.env.NATS_SUBJECT_PREFIX || 'up5';

const wss = new WebSocketServer({ port: PORT });
const sc = StringCodec();

console.log(`WebSocket Gateway iniciado na porta ${PORT}`);
console.log(`Conectando ao NATS em ${NATS_URL}`);

// Mapa de clientes WebSocket e suas subscriptions
const clients = new Map();

// Conecta ao NATS
let nc;
(async () => {
  try {
    nc = await connect({ servers: NATS_URL });
    console.log('Conectado ao NATS');

    nc.closed().then(() => {
      console.log('Conexão NATS fechada');
    });
  } catch (err) {
    console.error('Erro ao conectar ao NATS:', err);
    process.exit(1);
  }
})();

// Throttle para agrupar updates (50-100ms)
const throttleMap = new Map();

function throttle(key, callback, delay = 100) {
  if (throttleMap.has(key)) {
    clearTimeout(throttleMap.get(key));
  }
  
  const timeout = setTimeout(() => {
    callback();
    throttleMap.delete(key);
  }, delay);
  
  throttleMap.set(key, timeout);
}

wss.on('connection', (ws, req) => {
  const clientId = `${Date.now()}-${Math.random()}`;
  const subscriptions = new Map(); // Map<subject, subscription>
  
  console.log(`Cliente conectado: ${clientId}`);
  clients.set(clientId, { ws, subscriptions });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'subscribe') {
        const { symbol, exchange = 'B', timeframe = '1m' } = data;
        
        if (!symbol) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'symbol é obrigatório' 
          }));
          return;
        }

        const subject = `${NATS_SUBJECT_PREFIX}.candles.${exchange}.${symbol}.${timeframe}`;
        const subKey = `${symbol}:${exchange}:${timeframe}`;

        // Remove subscription anterior se existir
        if (subscriptions.has(subKey)) {
          subscriptions.get(subKey).unsubscribe();
          subscriptions.delete(subKey);
        }

        // Cria nova subscription
        if (nc) {
          const sub = nc.subscribe(subject, {
            callback: (err, msg) => {
              if (err) {
                console.error(`Erro ao receber mensagem do NATS: ${err}`);
                return;
              }

              try {
                const candle = JSON.parse(sc.decode(msg.data));
                
                // Throttle por cliente+subject
                throttle(`${clientId}:${subKey}`, () => {
                  if (ws.readyState === 1) { // OPEN
                    ws.send(JSON.stringify({
                      type: 'candle',
                      symbol,
                      exchange,
                      timeframe,
                      data: candle
                    }));
                  }
                }, 100);
              } catch (parseErr) {
                console.error('Erro ao parsear candle:', parseErr);
              }
            }
          });

          subscriptions.set(subKey, sub);
          console.log(`Cliente ${clientId} subscribed em ${subject}`);
          
          ws.send(JSON.stringify({
            type: 'subscribed',
            symbol,
            exchange,
            timeframe,
            subject
          }));
        }
      } else if (data.type === 'unsubscribe') {
        const { symbol, exchange = 'B', timeframe = '1m' } = data;
        const subKey = `${symbol}:${exchange}:${timeframe}`;
        
        if (subscriptions.has(subKey)) {
          subscriptions.get(subKey).unsubscribe();
          subscriptions.delete(subKey);
          console.log(`Cliente ${clientId} unsubscribed de ${subKey}`);
          
          ws.send(JSON.stringify({
            type: 'unsubscribed',
            symbol,
            exchange,
            timeframe
          }));
        }
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (err) {
      console.error('Erro ao processar mensagem:', err);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: err.message 
      }));
    }
  });

  ws.on('close', () => {
    console.log(`Cliente desconectado: ${clientId}`);
    
    // Remove todas as subscriptions
    subscriptions.forEach(sub => sub.unsubscribe());
    subscriptions.clear();
    
    // Remove throttles
    for (const [key] of throttleMap.entries()) {
      if (key.startsWith(`${clientId}:`)) {
        clearTimeout(throttleMap.get(key));
        throttleMap.delete(key);
      }
    }
    
    clients.delete(clientId);
  });

  ws.on('error', (err) => {
    console.error(`Erro no WebSocket do cliente ${clientId}:`, err);
  });

  // Envia mensagem de boas-vindas
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    message: 'Conectado ao WebSocket Gateway'
  }));
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Encerrando servidor...');
  
  // Fecha todas as conexões WebSocket
  clients.forEach(({ ws }) => {
    if (ws.readyState === 1) {
      ws.close();
    }
  });
  
  // Fecha conexão NATS
  if (nc) {
    await nc.close();
  }
  
  // Fecha servidor WebSocket
  wss.close(() => {
    console.log('Servidor encerrado');
    process.exit(0);
  });
});

