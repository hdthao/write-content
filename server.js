import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 3000;
let child = null;
let isInitialized = false;
let isRestarting = false;
let mcpServerAvailable = true;
let spawnErrorMsg = '';
let msgId = 1;
const pendingRequests = new Map();

// Helper to spawn the gemini-webapi-mcp process
function startMcpServer() {
  console.log('[BACKEND] Đang khởi chạy gemini-webapi-mcp...');
  
  const env = { ...process.env };
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  if (userHome) {
    const uvBin = path.join(userHome, '.local', 'bin');
    const pathSeparator = process.platform === 'win32' ? ';' : ':';
    if (process.env.PATH) {
      env.PATH = `${uvBin}${pathSeparator}${process.env.PATH}`;
    } else {
      env.PATH = uvBin;
    }
  }

  // On Windows, running uv run with a single command string prevents argument escaping issues in shell: true.
  child = spawn('uv run --with "gemini-webapi-mcp @ git+https://github.com/AndyShaman/gemini-webapi-mcp.git" gemini-webapi-mcp', [], { 
    shell: true,
    env,
    stdio: ['pipe', 'pipe', 'pipe'] 
  });

  child.on('error', (err) => {
    console.error('[BACKEND] Lỗi khi chạy gemini-webapi-mcp:', err);
    mcpServerAvailable = false;
    spawnErrorMsg = err.message;
  });

  // Handle stdout to read JSON-RPC messages from MCP Server
  let stdoutBuffer = '';
  child.stdout.on('data', (data) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const msg = JSON.parse(trimmed);
          handleMcpMessage(msg);
        } catch (e) {
          console.error('[BACKEND] Không thể parse JSON từ MCP stdout:', trimmed, e);
        }
      } else {
        console.log('[MCP LOG]', trimmed);
      }
    }
  });

  // Handle stderr for logging
  child.stderr.on('data', (data) => {
    console.warn('[MCP STDERR]', data.toString().trim());
  });

  child.on('close', (code) => {
    console.log(`[BACKEND] gemini-webapi-mcp đã đóng với mã code: ${code}`);
    isInitialized = false;

    if (isRestarting) {
      console.log('[BACKEND] Đang tiến hành khởi động lại MCP server với cookie mới...');
      isRestarting = false;
      startMcpServer();
      return;
    }

    // Attempt to restart after 5 seconds if it closed unexpectedly
    if (mcpServerAvailable) {
      setTimeout(startMcpServer, 5000);
    }
  });

  // Send initialize request to start the protocol handshake
  sendInitialize();
}

function sendInitialize() {
  const initMsg = {
    jsonrpc: "2.0",
    id: msgId++,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "content-writer-backend",
        version: "1.0.0"
      }
    }
  };
  writeToMcp(initMsg);
}

function writeToMcp(msg) {
  if (!child || child.killed) return;
  child.stdin.write(JSON.stringify(msg) + '\n');
}

function handleMcpMessage(msg) {
  // 1. Handle initialize response
  if (msg.id === 1 && msg.result) {
    console.log('[BACKEND] Đã nhận phản hồi initialize từ gemini-webapi-mcp. Đang gửi thông báo initialized...');
    const initializedNotification = {
      jsonrpc: "2.0",
      method: "notifications/initialized"
    };
    writeToMcp(initializedNotification);
    isInitialized = true;
    mcpServerAvailable = true;
    console.log('[BACKEND] gemini-webapi-mcp đã sẵn sàng!');
    return;
  }

  // 2. Handle pending requests (tool call results)
  if (msg.id && pendingRequests.has(msg.id)) {
    const res = pendingRequests.get(msg.id);
    pendingRequests.delete(msg.id);

    if (msg.error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: msg.error.message || JSON.stringify(msg.error) }));
    } else {
      // Standard MCP tool response format: result.content[0].text
      let text = msg.result?.content?.[0]?.text || '';
      
      // Clean up markdown code blocks if the model wrapped the response
      text = text.trim();
      const codeBlockRegex = /^```(?:[a-zA-Z0-9_?&=]+)?\n([\s\S]*?)\n```$/;
      const match = text.match(codeBlockRegex);
      if (match) {
        text = match[1].trim();
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ output: text }));
    }
  }
}

// Helper to load .env file if it exists
function loadEnv() {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    console.log('[BACKEND] Đang đọc file cấu hình .env...');
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const index = trimmed.indexOf('=');
        if (index > 0) {
          const key = trimmed.slice(0, index).trim();
          const val = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
          process.env[key] = val;
        }
      }
    } catch (e) {
      console.error('[BACKEND] Lỗi đọc file .env:', e);
    }
  }
}

const COOKIES_CACHE_PATH = '/tmp/gemini_cookies.json';

function saveCookiesToFile(psid, psidts) {
  try {
    fs.writeFileSync(COOKIES_CACHE_PATH, JSON.stringify({ psid, psidts }), 'utf-8');
    console.log('[BACKEND] Đã lưu cookies vào file cache.');
  } catch (e) {
    console.warn('[BACKEND] Không thể lưu cookies vào file:', e.message);
  }
}

function loadCookiesFromFile() {
  try {
    if (fs.existsSync(COOKIES_CACHE_PATH)) {
      const data = JSON.parse(fs.readFileSync(COOKIES_CACHE_PATH, 'utf-8'));
      if (data.psid && data.psidts) {
        console.log('[BACKEND] Đọc cookies từ file cache để ưu tiên hơn biến môi trường...');
        process.env.GEMINI_PSID = data.psid;
        process.env.GEMINI_PSIDTS = data.psidts;
      }
    }
  } catch (e) {
    console.warn('[BACKEND] Không đọc được file cookie cache:', e.message);
  }
}

// Load env variables
loadEnv();
// Override with cached cookies from previous UI update (if any)
loadCookiesFromFile();

// Start the MCP process
startMcpServer();

// Create local Node HTTP server
const server = http.createServer((req, res) => {
  // CORS setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Content Writer AI Backend is running!\nMCP Server Available: ${mcpServerAvailable}\nInitialized: ${isInitialized}`);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/status') {
    returnStatusResponse(res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/status') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { cookies } = JSON.parse(body);
        if (cookies && cookies.psid && cookies.psidts) {
          const cleanPsid = cookies.psid.trim();
          const cleanPsidts = cookies.psidts.trim();

          if (cleanPsid !== process.env.GEMINI_PSID || cleanPsidts !== process.env.GEMINI_PSIDTS) {
            console.log('[BACKEND] Cập nhật cookie mới từ yêu cầu POST status...');
            process.env.GEMINI_PSID = cleanPsid;
            process.env.GEMINI_PSIDTS = cleanPsidts;
            saveCookiesToFile(cleanPsid, cleanPsidts);

            isInitialized = false;
            mcpServerAvailable = true;

            isRestarting = true;
            if (child) {
              child.kill();
            } else {
              isRestarting = false;
              startMcpServer();
            }

            // Wait for initialization
            let attempts = 0;
            const checkInterval = setInterval(() => {
              attempts++;
              if (isInitialized) {
                clearInterval(checkInterval);
                returnStatusResponse(res);
              } else if (attempts >= 30 || !mcpServerAvailable) {
                clearInterval(checkInterval);
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Không thể kết nối với Cookie mới.' }));
              }
            }, 500);
            return;
          }
        }

        returnStatusResponse(res);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'JSON không hợp lệ.' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { prompt, cookies } = JSON.parse(body);
        if (!prompt) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Prompt không được bỏ trống.' }));
          return;
        }

        // Check if frontend provided cookies and if they differ from current environment
        if (cookies && cookies.psid && cookies.psidts) {
          const cleanPsid = cookies.psid.trim();
          const cleanPsidts = cookies.psidts.trim();

          if (cleanPsid !== process.env.GEMINI_PSID || cleanPsidts !== process.env.GEMINI_PSIDTS) {
            console.log('[BACKEND] Phát hiện cookie mới gửi từ frontend. Đang khởi động lại MCP server...');
            process.env.GEMINI_PSID = cleanPsid;
            process.env.GEMINI_PSIDTS = cleanPsidts;
            saveCookiesToFile(cleanPsid, cleanPsidts);

            isInitialized = false;
            mcpServerAvailable = true;

            isRestarting = true;
            if (child) {
              child.kill();
            } else {
              isRestarting = false;
              startMcpServer();
            }

            // Wait for initialization (up to 15 seconds)
            let attempts = 0;
            const checkInterval = setInterval(() => {
              attempts++;
              if (isInitialized) {
                clearInterval(checkInterval);
                sendToolCall(prompt, res);
              } else if (attempts >= 30 || !mcpServerAvailable) {
                clearInterval(checkInterval);
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Không thể khởi tạo kết nối với Cookie mới. Vui lòng kiểm tra lại cookie.' }));
              }
            }, 500);
            return;
          }
        }

        if (!mcpServerAvailable) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: `Không chạy được gemini-webapi-mcp (${spawnErrorMsg}). Vui lòng đảm bảo bạn đã cài đặt uv và đã đăng nhập tài khoản Google trên Chrome để server có thể đọc cookies.` 
          }));
          return;
        }

        if (!isInitialized) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'gemini-webapi-mcp đang khởi tạo. Vui lòng thử lại sau vài giây.' }));
          return;
        }

        sendToolCall(prompt, res);

      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'JSON không hợp lệ hoặc lỗi kết nối.' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

function sendToolCall(prompt, res) {
  const requestId = msgId++;
  const toolCall = {
    jsonrpc: "2.0",
    id: requestId,
    method: "tools/call",
    params: {
      name: "gemini_chat",
      arguments: {
        prompt: prompt,
        model: "gemini-3.0-flash"
      }
    }
  };

  pendingRequests.set(requestId, res);
  writeToMcp(toolCall);
}

function returnStatusResponse(res) {
  const mask = (str) => {
    if (!str) return 'Chưa cấu hình';
    if (str.length <= 16) return '***';
    return str.slice(0, 10) + '...' + str.slice(-6);
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    initialized: isInitialized,
    mcpServerAvailable: mcpServerAvailable,
    cookies: {
      psid: mask(process.env.GEMINI_PSID),
      psidts: mask(process.env.GEMINI_PSIDTS)
    }
  }));
}

server.listen(PORT, () => {
  console.log(`[BACKEND] Server đang chạy tại http://localhost:${PORT}`);
});

// Clean up child process on exit
process.on('SIGINT', () => {
  if (child) child.kill();
  process.exit();
});
process.on('exit', () => {
  if (child) child.kill();
});
