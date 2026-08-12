import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// Special case: if 'app' is not available (e.g. in some worker contexts if not passed correctly)
// but utilityProcess should have access to it or we can use environment variables.
const getLogPath = () => {
    try {
        const userData = app.getPath('userData');
        const logDir = path.join(userData, 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        return path.join(logDir, 'criterioia.log');
    } catch (e) {
        // Fallback to a predictable path if app.getPath fails
        return path.join(process.env.APPDATA || '', 'CriterioIA', 'logs', 'criterioia.log');
    }
};

const logFile = getLogPath();

export const logger = {
    info: (message: string, ...args: any[]) => write('INFO', message, args),
    error: (message: string, ...args: any[]) => write('ERROR', message, args),
    debug: (message: string, ...args: any[]) => write('DEBUG', message, args),
};

function write(level: string, message: string, args: any[]) {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.map(arg => {
        if (arg instanceof Error) {
            return `${arg.message}\n${arg.stack}`;
        }
        return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
    }).join(' ');

    const line = `[${timestamp}] [${level}] ${message} ${formattedArgs}\n`;

    try {
        fs.appendFileSync(logFile, line);
        // Also log to console for dev mode
        console.log(line.trim());
    } catch (e) {
        // Nowhere else to log if this fails
    }
}

logger.info('Logger initialized. Log file:', logFile);
