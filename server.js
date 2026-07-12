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
let initializeId = null;
const pendingRequests = new Map();

// --- Restart backoff control (tránh vòng lặp restart vô hạn ăn RAM/CPU) ---
const MAX_RESTART_ATTEMPTS = 5;
const BASE_RESTART_DELAY_MS = 5000;
const MAX_RESTART_DELAY_MS = 60000;
let restartAttempts = 0;
let restartTimer = null;

// --- Hàng đợi request khi đang restart, tránh race condition khi nhiều request tới cùng lúc ---
const waitingForInit = [];

function removeDebugAndCodeLines(text) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim()
      .replace(/^\s*(story_template|story_content|story|content)\s*=\s*(?:[rubf]+)?("""|'''|`{3})/i, '')
      .replace(/("""|'''|`{3})\s*$/, '')
      .trim()
    )
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      return !(
        /^```/.test(trimmed) ||
        /^SCRIPT\s+TO\s+VERIFY\s+LENGTH\s+AND\s+FORMAT$/i.test(trimmed) ||
        /^SCRIPT\b.*\bVERIFY\b.*\bFORMAT\b/i.test(trimmed) ||
        /code_reference|code_event_index/i.test(trimmed) ||
        /^python\?/i.test(trimmed) ||
        /^#/.test(trimmed) ||
        /^(The user wants|Length|Formatting|Line\s*\d+|Dialogue starts|NO emojis)\s*:/i.test(trimmed) ||
        /^(story_template|story_content|story|content)\s*=\s*(?:[rubf]+)?("""|'''|`{3})\s*$/i.test(trimmed) ||
        /^(words|title_lines|story_content)\s*=/.test(trimmed) ||
        /^for\s+\w+\s+in\s+\w+\s*:\s*$/.test(trimmed) ||
        /^print\s*\(/.test(trimmed) ||
        /^Word count\b/i.test(trimmed) ||
        /^Title word count\b/i.test(trimmed) ||
        /^Line:\s*['"`]/i.test(trimmed) ||
        /^("""|'''|`{3})$/.test(trimmed)
      );
    });

  const firstContentIndex = lines.findIndex(Boolean);
  if (
    firstContentIndex !== -1 &&
    /^(PARTE|PART)\s*1$/i.test(lines[firstContentIndex]) &&
    lines.slice(firstContentIndex + 1).some(Boolean)
  ) {
    lines.splice(firstContentIndex, 1);
  }

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeGeneratedStoryOutput(text, itemType = 'srt') {
  const isTitleMode = itemType === 'titles';
  const removeEmoji = (value) =>
    value.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '');

  const unwrapCodeStringLine = (line) =>
    line
      .trim()
      .replace(/^\s*(?:const|let|var)?\s*(title|titulo|título|story_title|story_template|story_content|story|content|output)\s*=\s*(?:[rubf]+)?("""|'''|`{3}|["'`])/i, '')
      .replace(/("""|'''|`{3}|["'`])\s*[;,]?\s*$/, '')
      .trim();

  const cleanLine = (line) =>
    unwrapCodeStringLine(line)
      .replace(/^[#>*\s]+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/^(title|titulo|título|story title)\s*=\s*/i, '')
      .replace(/^(title|titulo|título|story title)\s*:\s*/i, '')
      .replace(/^["'`]+/, '')
      .replace(/["'`,]+$/, '')
      .trim();

  const isParteLine = (line) => /^(PARTE|PART|SECCION|SECCIÓN|SECTION|CAPITULO|CAPÍTULO|CHAPTER)\s*[-:]?\s*1\b/i.test(line.trim());

  const isJunkLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    return (
      /^```/.test(trimmed) ||
      /code_reference|code_event_index/i.test(trimmed) ||
      /^#/.test(trimmed) ||
      /^\/\//.test(trimmed) ||
      /^\/\*/.test(trimmed) ||
      /^\*\//.test(trimmed) ||
      /^python\??$/i.test(trimmed) ||
      /^SCRIPT\b/i.test(trimmed) ||
      /^(here is|here's|sure|claro|por supuesto|aquí tienes|aqui tienes|final story|historia final|cuento final|respuesta)\b/i.test(trimmed) ||
      /^[-*]\s*(line\s*\d+|length|formatting|dialogue starts|no emojis|cta)\s*:/i.test(trimmed) ||
      /^(analysis|reasoning|notes?|instructions?|formatting|length|word count|word count of title|title word count|line\s*\d+|dialogue starts|no emojis|cta)\s*:/i.test(trimmed) ||
      /^(the user wants|the task|based on|requirements?|format|hook sentence)\b/i.test(trimmed) ||
      /^perfect\b.*\bwords?\b/i.test(trimmed) ||
      /^(words|title_lines|paragraphs?|story_content|story_template|story|content|output)\s*=/.test(trimmed) ||
      /^(for|if|while|const|let|var|function|return|print|console\.log)\b/.test(trimmed) ||
      /^[{}\[\]();,]+$/.test(trimmed) ||
      /^(mam[aá]|est[aá]s|ustedes)\b.*\(.+\)$/i.test(trimmed) ||
      /^("""|'''|`{3})$/.test(trimmed)
    );
  };

  const wordCount = (line) => line.split(/\s+/).filter(Boolean).length;
  const isLikelyTitle = (line) => {
    const cleaned = removeEmoji(line).trim();
    const words = wordCount(cleaned);
    if (words < 5 || words > 20) return false;
    if (isParteLine(cleaned) || isJunkLine(cleaned)) return false;
    if (/[.!?¿¡]$/.test(cleaned)) return false;
    const letters = cleaned.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
    if (!letters) return false;
    const upperLetters = letters.replace(/[a-záéíóúüñ]/g, '').length;
    return upperLetters / letters.length > 0.65;
  };

  const isTitleContinuation = (line) => {
    const cleaned = removeEmoji(line).trim();
    if (!cleaned || isParteLine(cleaned) || isJunkLine(cleaned)) return false;
    if (/[.!?¿¡]$/.test(cleaned)) return false;
    const letters = cleaned.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
    if (!letters) return false;
    const upperLetters = letters.replace(/[a-záéíóúüñ]/g, '').length;
    return upperLetters / letters.length > 0.65;
  };

  const rawLines = text
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .map(cleanLine);

  const lines = rawLines.filter((line) => !isJunkLine(line));
  const titleIndex = lines.findIndex(isLikelyTitle);
  const fallbackTitleIndex = titleIndex === -1 ? lines.findIndex((line) => line.trim() && !isParteLine(line)) : titleIndex;

  if (fallbackTitleIndex === -1) {
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  let titleEndIndex = fallbackTitleIndex;
  while (titleEndIndex + 1 < lines.length && isTitleContinuation(lines[titleEndIndex + 1])) {
    titleEndIndex += 1;
  }

  const titleRaw = removeEmoji(lines.slice(fallbackTitleIndex, titleEndIndex + 1).join(' '))
    .replace(/^[\s#*_\-]+/, '')
    .replace(/[\s*_\-]+$/, '')
    .trim();

  const formatTitle = (value) => {
    const trimmed = value.replace(/\s+/g, ' ').trim();
    const letters = trimmed.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
    if (!letters) return trimmed;

    const upperLetters = letters.replace(/[a-zà-öø-ÿ]/g, '').length;
    if (upperLetters / letters.length <= 0.75) return trimmed;

    const lower = trimmed.toLocaleLowerCase('es');
    return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
  };

  const title = isTitleMode ? formatTitle(titleRaw) : titleRaw.toUpperCase();
  const normalizedTitleForCompare = removeEmoji(titleRaw).trim().toUpperCase();

  const pushFormattedLine = (line) => {
    const normalized = line
      .replace(/\u2014\.\s+/g, '\u2014\n')
      .replace(/([.!?])\s+(\u2014(?=\S))/g, '$1\n$2')
      .replace(/([^\n])\s+(\u2014(?=\S))/g, (match, before, dash, offset, value) => {
        const previous = value.slice(Math.max(0, offset - 80), offset);
        return /[.!?]\s*$/.test(previous) ? `${before}\n${dash}` : match;
      });

    normalized.split('\n').forEach((part) => {
      const cleanedPart = part.trim();
      if (!cleanedPart) return;
      bodyLines.push(cleanedPart);
    });
  };

  const bodyLines = [];
  let previousWasBlank = false;
  for (let i = titleEndIndex + 1; i < lines.length; i++) {
    let line = lines[i].trim();
    if (isJunkLine(line)) continue;
    if (isParteLine(line)) continue;
    if (removeEmoji(line).trim().toUpperCase() === normalizedTitleForCompare) continue;

    const isCta = /^Comenta\b/i.test(line);
    if (!isCta) line = removeEmoji(line).trim();
    if (!line) {
      if (bodyLines.length && !previousWasBlank) {
        bodyLines.push('');
        previousWasBlank = true;
      }
      continue;
    }

    if (isTitleMode) {
      pushFormattedLine(line);
    } else {
      bodyLines.push(line);
    }
    previousWasBlank = false;
  }

  return (isTitleMode ? [title, '', ...bodyLines] : [title, 'PARTE 1', '', ...bodyLines])
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeImagePromptOutput(text) {
  const cleaned = text
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^(PARTE|PART|SECCION|SECCIÓN|SECTION|CAPITULO|CAPÍTULO|CHAPTER)\s*[-:]?\s*1\b/i.test(line))
    .join(' ')
    .trim()
    .replace(/^```(?:[a-zA-Z0-9_?&=]+)?\n([\s\S]*?)\n```$/i, '$1')
    .replace(/^(image prompt|prompt|final prompt)\s*:\s*/i, '')
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    .trim();

  const letters = cleaned.replace(/[^A-Za-z]/g, '');
  if (!letters) return cleaned;

  const upperLetters = letters.replace(/[a-z]/g, '').length;
  if (upperLetters / letters.length <= 0.75) return cleaned;

  const lower = cleaned.toLocaleLowerCase('en');
  return lower.charAt(0).toLocaleUpperCase('en') + lower.slice(1);
}

// ---------------------------------------------------------------------
// Helper để spawn tiến trình gemini-webapi-mcp
//
// TỐI ƯU QUAN TRỌNG: mặc định KHÔNG dùng `uv run --with "pkg @ git+..."`
// nữa, vì cú pháp đó khiến uv resolve + tải + build lại package từ GitHub
// MỖI LẦN subprocess khởi động (kể cả các lần tự restart) -> rất tốn
// RAM/CPU/thời gian và là nguyên nhân khả dĩ gây lỗi "stream bị ngắt".
//
// Cách làm mới:
//  1) Cài đặt package MỘT LẦN lúc build (không phải lúc runtime), ví dụ
//     thêm vào Build Command của Render:
//       uv tool install "gemini-webapi-mcp @ git+https://github.com/AndyShaman/gemini-webapi-mcp.git"
//  2) Runtime chỉ cần gọi thẳng binary đã cài, gần như khởi động tức thì:
//       gemini-webapi-mcp
//
// Nếu bạn chưa cài trước lúc build, vẫn có thể override qua biến môi
// trường MCP_COMMAND để dùng lại cú pháp `uv run --with ...` cũ.
// ---------------------------------------------------------------------
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

  const mcpCommand = process.env.MCP_COMMAND || 'uvx --from git+https://github.com/AndyShaman/gemini-webapi-mcp.git gemini-webapi-mcp';
  child = spawn(mcpCommand, [], {
    shell: true,
    env,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  child.on('error', (err) => {
    console.error('[BACKEND] Lỗi khi chạy gemini-webapi-mcp:', err);
    mcpServerAvailable = false;
    spawnErrorMsg = err.message;
    failAllWaiting('Không thể khởi chạy gemini-webapi-mcp: ' + err.message);
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
      restartAttempts = 0; // đổi cookie là khởi động lại có chủ đích, reset bộ đếm backoff
      startMcpServer();
      return;
    }

    // Tự restart khi bị đóng ngoài ý muốn, nhưng có giới hạn số lần thử +
    // backoff tăng dần để tránh vòng lặp restart vô hạn ăn RAM/CPU
    // (đặc biệt quan trọng trên free tier RAM thấp).
    if (mcpServerAvailable) {
      scheduleRestart();
    }
  });

  // Send initialize request to start the protocol handshake
  sendInitialize();
}

function scheduleRestart() {
  if (restartTimer) return; // đã có 1 lần restart đang chờ, không xếp chồng

  restartAttempts += 1;
  if (restartAttempts > MAX_RESTART_ATTEMPTS) {
    console.error(`[BACKEND] Đã thử khởi động lại ${MAX_RESTART_ATTEMPTS} lần liên tiếp thất bại. Dừng tự động restart.`);
    mcpServerAvailable = false;
    spawnErrorMsg = `Vượt quá số lần tự khởi động lại tối đa (${MAX_RESTART_ATTEMPTS}).`;
    failAllWaiting(spawnErrorMsg);
    return;
  }

  const delay = Math.min(BASE_RESTART_DELAY_MS * 2 ** (restartAttempts - 1), MAX_RESTART_DELAY_MS);
  console.log(`[BACKEND] Sẽ thử khởi động lại lần ${restartAttempts}/${MAX_RESTART_ATTEMPTS} sau ${delay}ms...`);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    startMcpServer();
  }, delay);
}

function sendInitialize() {
  initializeId = msgId;
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

// Trả lỗi cho tất cả các request đang chờ MCP server sẵn sàng (dùng khi
// subprocess không thể phục hồi được nữa), tránh để client treo vô thời hạn.
function failAllWaiting(errorMessage) {
  while (waitingForInit.length) {
    const { res } = waitingForInit.shift();
    try {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: errorMessage }));
    } catch (e) {
      // response có thể đã đóng, bỏ qua
    }
  }
}

function handleMcpMessage(msg) {
  // 1. Handle initialize response
  if (msg.id === initializeId && msg.result) {
    console.log('[BACKEND] Đã nhận phản hồi initialize từ gemini-webapi-mcp. Đang gửi thông báo initialized...');
    const initializedNotification = {
      jsonrpc: "2.0",
      method: "notifications/initialized"
    };
    writeToMcp(initializedNotification);
    isInitialized = true;
    mcpServerAvailable = true;
    restartAttempts = 0; // khởi tạo thành công -> reset bộ đếm backoff
    console.log('[BACKEND] gemini-webapi-mcp đã sẵn sàng!');

    // Xử lý các request đã xếp hàng chờ trong lúc subprocess đang khởi động lại
    while (waitingForInit.length) {
      const { prompt, res, itemType } = waitingForInit.shift();
      sendToolCall(prompt, res, itemType);
    }
    return;
  }

  // 2. Handle pending requests (tool call results)
  if (msg.id && pendingRequests.has(msg.id)) {
    const pending = pendingRequests.get(msg.id);
    const res = pending.res;
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
      if (pending.itemType === 'imagePrompt') {
        text = normalizeImagePromptOutput(text);
      } else if (pending.itemType === 'translate') {
        text = text.trim();
      } else {
        text = normalizeGeneratedStoryOutput(text, pending.itemType);
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

  if (req.method === 'GET' && req.url === '/api/debug-code') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    try {
      const code = fs.readFileSync('server.js', 'utf8');
      res.end(code);
    } catch (e) {
      res.end('Lỗi đọc file: ' + e.message);
    }
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
              restartAttempts = 0;
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
        const { prompt, cookies, itemType = 'srt' } = JSON.parse(body);
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
              restartAttempts = 0;
              startMcpServer();
            }

            // Wait for initialization (up to 15 seconds)
            let attempts = 0;
            const checkInterval = setInterval(() => {
              attempts++;
              if (isInitialized) {
                clearInterval(checkInterval);
                sendToolCall(prompt, res, itemType);
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
            error: `Không chạy được gemini-webapi-mcp (${spawnErrorMsg}). Vui lòng đảm bảo bạn đã cài đặt uv (hoặc đã cài sẵn gemini-webapi-mcp lúc build) và đã đăng nhập tài khoản Google để server có thể đọc cookies.`
          }));
          return;
        }

        if (!isInitialized) {
          // Thay vì bắt client tự retry, xếp request vào hàng đợi và xử lý
          // ngay khi subprocess khởi tạo xong (hoặc timeout sau 15s).
          const entry = { prompt, res, itemType };
          waitingForInit.push(entry);

          const timeoutId = setTimeout(() => {
            const idx = waitingForInit.indexOf(entry);
            if (idx !== -1) {
              waitingForInit.splice(idx, 1);
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'gemini-webapi-mcp đang khởi tạo quá lâu. Vui lòng thử lại sau.' }));
            }
          }, 15000);

          // Đảm bảo timeout được huỷ nếu request đã được xử lý trước đó
          const originalEnd = res.end.bind(res);
          res.end = (...args) => {
            clearTimeout(timeoutId);
            return originalEnd(...args);
          };
          return;
        }

        sendToolCall(prompt, res, itemType);

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

function sendToolCall(prompt, res, itemType = 'srt') {
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

  pendingRequests.set(requestId, { res, itemType });
  writeToMcp(toolCall);
}

async function returnStatusResponse(res) {
  const mask = (str) => {
    if (!str) return 'Chưa cấu hình';
    if (str.length <= 16) return '***';
    return str.slice(0, 10) + '...' + str.slice(-6);
  };

  const hasCookies = Boolean(process.env.GEMINI_PSID && process.env.GEMINI_PSIDTS);
  const statusOk = isInitialized && mcpServerAvailable && hasCookies;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    initialized: statusOk,
    mcpServerAvailable: mcpServerAvailable,
    cookies: {
      psid: mask(process.env.GEMINI_PSID),
      psidts: mask(process.env.GEMINI_PSIDTS)
    },
    error: statusOk ? null : 'MCP server chưa sẵn sàng hoặc chưa có cookie.',
    pingOutput: null
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
