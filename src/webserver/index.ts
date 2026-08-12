/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { app as electronApp, shell } from 'electron';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { networkInterfaces } from 'os';
import path from 'path';
import { SERVER_CONFIG } from './config/constants';
import { initWebAdapter } from './adapter';
import { setupBasicMiddleware, setupCors, setupErrorHandler } from './setup';
import { registerAuthRoutes } from './routes/authRoutes';
import { registerApiRoutes } from './routes/apiRoutes';
import { registerStaticRoutes } from './routes/staticRoutes';

/**
 * CriterioIA: En `electron-forge start -- --webui` (modo dev), app.whenReady() dispara
 * casi de inmediato, pero el bundle del renderer (.webpack/renderer/main_window/index.html)
 * puede tardar 1-2 minutos en compilarse via webpack-dev-server. registerStaticRoutes()
 * lanzaba una excepcion sincronica si ese archivo aun no existia, y como startWebServer()
 * no la atrapaba, la excepcion se propagaba hasta el catch de mas alto nivel en index.ts,
 * que hace app.quit() -- la app se cerraba sola segundos despues de arrancar, siempre en
 * modo dev, antes de que el renderer terminara de compilar. En produccion (app empaquetada)
 * el archivo ya existe dentro del asar, asi que esta espera resuelve de inmediato.
 */
async function waitForRendererBuild(timeoutMs = 180000, pollMs = 1000): Promise<void> {
  const indexHtml = path.join(electronApp.getAppPath(), '.webpack', 'renderer', 'main_window', 'index.html');
  const start = Date.now();
  while (!existsSync(indexHtml)) {
    if (Date.now() - start > timeoutMs) {
      console.warn(`[webserver] Timeout esperando el bundle del renderer en ${indexHtml}; continuando de todos modos.`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

// Express Request 类型扩展定义在 src/webserver/types/express.d.ts
// Express Request type extension is defined in src/webserver/types/express.d.ts

/**
 * 获取局域网 IP 地址
 * Get LAN IP address using os.networkInterfaces()
 */
function getLanIP(): string | null {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    const netInfo = nets[name];
    if (!netInfo) continue;

    for (const net of netInfo) {
      // 跳过内部地址（127.0.0.1）和 IPv6
      // Skip internal addresses (127.0.0.1) and IPv6
      const isIPv4 = net.family === 'IPv4';
      const isNotInternal = !net.internal;
      if (isIPv4 && isNotInternal) {
        return net.address;
      }
    }
  }
  return null;
}

/**
 * 获取公网 IP 地址（仅 Linux 无桌面环境）
 * Get public IP address (Linux headless only)
 */
function getPublicIP(): string | null {
  // 只在 Linux 无桌面环境下尝试获取公网 IP
  // Only try to get public IP on Linux headless environment
  const isLinuxHeadless = process.platform === 'linux' && !process.env.DISPLAY;
  if (!isLinuxHeadless) {
    return null;
  }

  try {
    // 使用 curl 获取公网 IP（有 2 秒超时）
    // Use curl to get public IP (with 2 second timeout)
    const publicIP = execSync('curl -s --max-time 2 ifconfig.me || curl -s --max-time 2 api.ipify.org', {
      encoding: 'utf8',
      timeout: 3000,
    }).trim();

    // 验证是否为有效的 IPv4 地址
    // Validate IPv4 address format
    if (publicIP && /^(\d{1,3}\.){3}\d{1,3}$/.test(publicIP)) {
      return publicIP;
    }
  } catch {
    // Ignore errors (firewall, network issues, etc.)
  }

  return null;
}

/**
 * 获取服务器 IP 地址（优先公网 IP，其次局域网 IP）
 * Get server IP address (prefer public IP, fallback to LAN IP)
 */
function getServerIP(): string | null {
  // 1. Linux 无桌面环境：尝试获取公网 IP
  // Linux headless: try to get public IP
  const publicIP = getPublicIP();
  if (publicIP) {
    return publicIP;
  }

  // 2. 所有平台：获取局域网 IP（包括 Windows/Mac/Linux）
  // All platforms: get LAN IP (Windows/Mac/Linux)
  return getLanIP();
}

/**
 * 启动 Web 服务器
 * Start web server with WebSocket support
 *
 * @param port 服务器端口 / Server port
 * @param allowRemote 是否允许远程访问 / Allow remote access
 */
export async function startWebServer(port: number, allowRemote = false): Promise<void> {
  // 设置服务器配置
  // Set server configuration
  SERVER_CONFIG.setServerConfig(port, allowRemote);

  // 创建 Express 应用和服务器
  // Create Express app and server
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // 配置中间件
  // Configure middleware
  setupBasicMiddleware(app);
  setupCors(app, port, allowRemote);

  // 注册路由
  // Register routes
  registerAuthRoutes(app);
  registerApiRoutes(app);
  await waitForRendererBuild();
  registerStaticRoutes(app);

  // 配置错误处理（必须最后）
  // Configure error handler (must be last)
  setupErrorHandler(app);

  // 启动服务器
  // Start server
  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      const localUrl = `http://localhost:${port}`;

      // 尝试获取服务器 IP（Linux 无桌面环境获取公网 IP，其他环境获取局域网 IP）
      // Try to get server IP (public IP for Linux headless, LAN IP for others)
      const serverIP = getServerIP();
      const displayUrl = serverIP ? `http://${serverIP}:${port}` : localUrl;

      // Only show network access when --remote flag is enabled
      if (allowRemote && serverIP && serverIP !== 'localhost') {
        console.log(`\n   🚀 Local access / 本地访问: ${localUrl}`);
        console.log(`   🚀 Network access / 网络访问: ${displayUrl}\n`);
      } else {
        console.log(`\n   🚀 WebUI started / WebUI 已启动: ${localUrl}\n`);
      }

      // 自动打开浏览器（仅在有桌面环境时）
      // Auto-open browser (only when desktop environment is available)
      // 当 allowRemote 为 true 时，优先打开局域网 IP
      // When allowRemote is true, prefer to open LAN IP
      if (process.env.DISPLAY || process.platform !== 'linux') {
        const urlToOpen = allowRemote && serverIP ? displayUrl : localUrl;
        void shell.openExternal(urlToOpen);
      }

      // 初始化 WebSocket 适配器
      // Initialize WebSocket adapter
      initWebAdapter(wss);

      resolve();
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use / 端口 ${port} 已被占用`);
      } else {
        console.error('❌ Server error / 服务器错误:', err);
      }
      reject(err);
    });
  });
}
