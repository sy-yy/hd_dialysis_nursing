const fs = require('fs');
const path = require('path');

// 日志目录
const LOG_DIR = path.join(__dirname, '..', 'logs');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 获取今天的日期字符串，用于命名日志文件
function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取今天的日志文件路径
function getLogFilePath() {
  const date = getTodayDate();
  return path.join(LOG_DIR, `${date}.log`);
}

// 日志级别
const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  DEBUG: 'DEBUG'
};

// 写入日志
function writeLog(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data
  };
  
  const logString = JSON.stringify(logEntry) + '\n';
  
  try {
    fs.appendFileSync(getLogFilePath(), logString, 'utf8');
  } catch (error) {
    console.error('写入日志失败:', error);
  }
}

// 导出日志方法
module.exports = {
  info: (message, data) => writeLog(LOG_LEVELS.INFO, message, data),
  warn: (message, data) => writeLog(LOG_LEVELS.WARN, message, data),
  error: (message, data) => writeLog(LOG_LEVELS.ERROR, message, data),
  debug: (message, data) => writeLog(LOG_LEVELS.DEBUG, message, data)
};