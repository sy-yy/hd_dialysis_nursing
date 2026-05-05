const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// 定义数据库文件路径
const USERS_DB = path.join(__dirname, '..', 'data', 'users.db');
const PATIENTS_DB = path.join(__dirname, '..', 'data', 'patients.db');
const ASSESSMENTS_DB = path.join(__dirname, '..', 'data', 'assessments.db');
const SETTINGS_PATH = path.join(__dirname, '..', 'data', 'settings.json');
const LOGS_DIR = path.join(__dirname, '..', 'logs');
const OLD_LOGS_DIR = path.join(__dirname, '..', 'data', 'logs');
const OLD_STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');

// 数据库连接
let usersDb, patientsDb, assessmentsDb;
let dbInitialized = false;
let dbInitPromise = new Promise((resolve) => {
  let initCount = 0;
  function checkInitComplete() {
    initCount++;
    if (initCount === 3) {
      dbInitialized = true;
      console.log('数据库初始化完成');
      initializeStore();
      ensureLogsDir();
      resolve();
    }
  }

  function initDatabases() {
    usersDb = new sqlite3.Database(USERS_DB, (err) => {
      if (err) {
        console.error('连接用户数据库失败:', err);
      } else {
        console.log('用户数据库连接成功');
        createUsersTable(() => checkInitComplete());
      }
    });

    patientsDb = new sqlite3.Database(PATIENTS_DB, (err) => {
      if (err) {
        console.error('连接患者数据库失败:', err);
      } else {
        console.log('患者数据库连接成功');
        createPatientsTable(() => checkInitComplete());
      }
    });

    assessmentsDb = new sqlite3.Database(ASSESSMENTS_DB, (err) => {
      if (err) {
        console.error('连接评估数据库失败:', err);
      } else {
        console.log('评估数据库连接成功');
        createAssessmentsTable(() => checkInitComplete());
      }
    });
  }

  initDatabases();
});

async function waitForDbInit() {
  await dbInitPromise;
}

function createUsersTable(callback) {
  usersDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      passwordHash TEXT,
      displayName TEXT,
      role TEXT,
      status TEXT,
      permissions TEXT,
      createdAt TEXT
    )
  `, callback);
}

function createPatientsTable(callback) {
  patientsDb.run(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      patientNo TEXT,
      name TEXT,
      gender TEXT,
      birthDate TEXT,
      phone TEXT,
      idCard TEXT,
      dialysisId TEXT,
      bedNo TEXT,
      firstDialysisDate TEXT,
      height TEXT,
      dryWeight TEXT,
      preWeight TEXT,
      dialysisFreq TEXT,
      notes TEXT,
      assessmentFrequencyDays INTEGER,
      createdAt TEXT,
      lastAssessment TEXT,
      nextAssessmentDue TEXT,
      latestLevel TEXT,
      latestScore INTEGER
    )
  `, () => {
    // 迁移：检查并添加缺失的字段（兼容旧数据库）
    migratePatientsTable(callback);
  });
}

/**
 * 迁移 patients 表：添加缺失的字段
 */
function migratePatientsTable(callback) {
  patientsDb.all(`PRAGMA table_info(patients)`, (err, columns) => {
    if (err) {
      console.error('检查 patients 表结构失败:', err);
      callback();
      return;
    }
    
    const columnNames = columns.map(c => c.name);
    const migrations = [];
    
    // 检查并添加缺失的字段
    if (!columnNames.includes('idCard')) {
      migrations.push('ALTER TABLE patients ADD COLUMN idCard TEXT');
    }
    if (!columnNames.includes('assessmentFrequencyDays')) {
      migrations.push('ALTER TABLE patients ADD COLUMN assessmentFrequencyDays INTEGER');
    }
    if (!columnNames.includes('dialysisId')) {
      migrations.push('ALTER TABLE patients ADD COLUMN dialysisId TEXT');
    }
    if (!columnNames.includes('bedNo')) {
      migrations.push('ALTER TABLE patients ADD COLUMN bedNo TEXT');
    }
    if (!columnNames.includes('firstDialysisDate')) {
      migrations.push('ALTER TABLE patients ADD COLUMN firstDialysisDate TEXT');
    }
    if (!columnNames.includes('height')) {
      migrations.push('ALTER TABLE patients ADD COLUMN height TEXT');
    }
    if (!columnNames.includes('dryWeight')) {
      migrations.push('ALTER TABLE patients ADD COLUMN dryWeight TEXT');
    }
    if (!columnNames.includes('preWeight')) {
      migrations.push('ALTER TABLE patients ADD COLUMN preWeight TEXT');
    }
    if (!columnNames.includes('dialysisFreq')) {
      migrations.push('ALTER TABLE patients ADD COLUMN dialysisFreq TEXT');
    }
    if (!columnNames.includes('notes')) {
      migrations.push('ALTER TABLE patients ADD COLUMN notes TEXT');
    }
    if (!columnNames.includes('createdAt')) {
      migrations.push('ALTER TABLE patients ADD COLUMN createdAt TEXT');
    }
    if (!columnNames.includes('lastAssessment')) {
      migrations.push('ALTER TABLE patients ADD COLUMN lastAssessment TEXT');
    }
    if (!columnNames.includes('nextAssessmentDue')) {
      migrations.push('ALTER TABLE patients ADD COLUMN nextAssessmentDue TEXT');
    }
    if (!columnNames.includes('latestLevel')) {
      migrations.push('ALTER TABLE patients ADD COLUMN latestLevel TEXT');
    }
    if (!columnNames.includes('latestScore')) {
      migrations.push('ALTER TABLE patients ADD COLUMN latestScore INTEGER');
    }
    
    if (migrations.length === 0) {
      console.log('patients 表结构检查完成，无需迁移');
      callback();
      return;
    }
    
    console.log(`开始迁移 patients 表，需要添加 ${migrations.length} 个字段...`);
    let completed = 0;
    migrations.forEach(sql => {
      patientsDb.run(sql, (err) => {
        if (err) {
          console.error('迁移 SQL 执行失败:', sql, err.message);
        } else {
          console.log('迁移成功:', sql);
        }
        completed++;
        if (completed === migrations.length) {
          console.log('patients 表迁移完成');
          callback();
        }
      });
    });
  });
}

function createAssessmentsTable(callback) {
  assessmentsDb.run(`
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      patientId TEXT,
      answers TEXT,
      totalScore INTEGER,
      levelId TEXT,
      levelName TEXT,
      levelColor TEXT,
      nextAssessmentDue TEXT,
      remark TEXT,
      createdAt TEXT,
      assessorId TEXT,
      assessorName TEXT
    )
  `, callback);
}

function initializeStore() {
  if (!fs.existsSync(SETTINGS_PATH) && fs.existsSync(OLD_STORE_PATH)) {
    try {
      const store = JSON.parse(fs.readFileSync(OLD_STORE_PATH, 'utf8'));
      if (store.settings) {
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(store.settings, null, 2));
        console.log('设置数据迁移成功');
      }
    } catch (e) {
      console.error('迁移设置数据失败:', e);
    }
  }
}

function ensureLogsDir() {
  // 创建新的日志目录
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  
  // 检查旧的日志目录是否存在，如果存在则将日志文件转移到新目录
  if (fs.existsSync(OLD_LOGS_DIR)) {
    try {
      const files = fs.readdirSync(OLD_LOGS_DIR).filter(f => f.endsWith('.log'));
      for (const file of files) {
        const oldPath = path.join(OLD_LOGS_DIR, file);
        const newPath = path.join(LOGS_DIR, file);
        if (!fs.existsSync(newPath)) {
          fs.copyFileSync(oldPath, newPath);
          console.log(`已将日志文件 ${file} 从旧目录转移到新目录`);
        }
      }
    } catch (e) {
      console.error('转移旧日志文件失败:', e);
    }
  }
}

function getTodayLogFile() {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(LOGS_DIR, `${today}.log`);
}

function query(db, sql, params = []) {
  return waitForDbInit().then(() => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  });
}

function run(db, sql, params = []) {
  return waitForDbInit().then(() => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  });
}

// 用户相关
function getUserByUsername(username) {
  return waitForDbInit().then(() => {
    return new Promise((resolve, reject) => {
      usersDb.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else {
          if (row && row.permissions) {
            try { row.permissions = JSON.parse(row.permissions); } catch (e) {}
          }
          resolve(row);
        }
      });
    });
  });
}

function getUserById(id) {
  return waitForDbInit().then(() => {
    return new Promise((resolve, reject) => {
      usersDb.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else {
          if (row && row.permissions) {
            try { row.permissions = JSON.parse(row.permissions); } catch (e) {}
          }
          resolve(row);
        }
      });
    });
  });
}

function listUsers() {
  return query(usersDb, 'SELECT * FROM users');
}

function saveUser(user) {
  const p = user.permissions;
  const permStr = typeof p === 'string' ? p : JSON.stringify(p || {});
  return run(usersDb,
    'INSERT OR REPLACE INTO users (id,username,passwordHash,displayName,role,status,permissions,createdAt) VALUES (?,?,?,?,?,?,?,?)',
    [user.id, user.username, user.passwordHash, user.displayName, user.role, user.status, permStr, user.createdAt]
  );
}

function createAdminUser(data) {
  return saveUser({
    id: uid('u'),
    username: data.username,
    passwordHash: data.passwordHash,
    displayName: data.displayName,
    role: 'admin',
    status: 'active',
    permissions: JSON.stringify(defaultDoctorPermissions()),
    createdAt: new Date().toISOString(),
  });
}

function createPendingDoctor(data) {
  return saveUser({
    id: uid('u'),
    username: data.username,
    passwordHash: data.passwordHash,
    displayName: data.displayName,
    role: 'doctor',
    status: 'pending',
    permissions: JSON.stringify(defaultDoctorPermissions()),
    createdAt: new Date().toISOString(),
  });
}

function updateUserPassword(id, passwordHash) {
  return run(usersDb, 'UPDATE users SET passwordHash = ? WHERE id = ?', [passwordHash, id]);
}

function updateUserById(id, patch) {
  return new Promise(async (resolve, reject) => {
    const fields = [];
    const values = [];
    
    if (patch.permissions != null) {
      fields.push('permissions = ?');
      values.push(typeof patch.permissions === 'string' ? patch.permissions : JSON.stringify(patch.permissions));
    }
    if (patch.displayName != null) {
      fields.push('displayName = ?');
      values.push(patch.displayName);
    }
    if (patch.status != null) {
      fields.push('status = ?');
      values.push(patch.status);
    }
    
    if (fields.length === 0) {
      try {
        const user = await getUserById(id);
        resolve({ ok: true, user });
      } catch (err) {
        reject(err);
      }
      return;
    }
    
    values.push(id);
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    
    try {
      await run(usersDb, sql, values);
      const updatedUser = await getUserById(id);
      resolve({ ok: true, user: updatedUser });
    } catch (err) {
      reject(err);
    }
  });
}

// 患者相关
function listPatients() {
  return new Promise((resolve, reject) => {
    waitForDbInit().then(() => {
      query(patientsDb, 'SELECT * FROM patients').then(rows => resolve(rows)).catch(reject);
    });
  });
}

function getPatient(id) {
  return query(patientsDb, 'SELECT * FROM patients WHERE id = ?', [id]).then(rows => rows[0] || null);
}

function savePatient(patient) {
  console.log(`[DEBUG] savePatient() 被调用 (patientId=${patient.id}, name=${patient.name})`);
  console.log(`[DEBUG] savePatient() 数据: patientNo=${patient.patientNo}, latestScore=${patient.latestScore}, lastLevelId=${patient.lastLevelId}, nextAssessmentDue=${patient.nextAssessmentDue}`);
  
  // 防护：如果patient.id为空，生成一个新的id
  if (!patient.id) {
    console.warn('[WARN] savePatient() 检测到 patient.id 为空，将自动生成新ID');
    patient.id = uid('p');
  }
  
  return run(patientsDb,
    'INSERT OR REPLACE INTO patients (id, patientNo, name, gender, birthDate, phone, idCard, dialysisId, bedNo, firstDialysisDate, height, dryWeight, preWeight, dialysisFreq, notes, assessmentFrequencyDays, createdAt, lastAssessment, nextAssessmentDue, latestLevel, latestScore) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [patient.id, patient.patientNo || '', patient.name, patient.gender, patient.birthDate, patient.phone, patient.idCard, patient.dialysisId, patient.bedNo, patient.firstDialysisDate, patient.height, patient.dryWeight, patient.preWeight, patient.dialysisFreq, patient.notes, patient.assessmentFrequencyDays, patient.createdAt, patient.lastAssessmentAt || patient.lastAssessment, patient.nextAssessmentDue, patient.lastLevelId || patient.latestLevel, patient.latestScore]
  ).then(() => {
    console.log(`[DEBUG] savePatient() 成功保存患者数据 (patientId=${patient.id})`);
  }).catch(e => {
    console.error(`[DEBUG] savePatient() 保存患者数据失败 (patientId=${patient.id}):`, e);
    throw e;
  });
}

function deletePatient(id) {
  return run(patientsDb, 'DELETE FROM patients WHERE id = ?', [id]);
}

function deleteUser(id) {
  return run(usersDb, 'DELETE FROM users WHERE id = ? AND role != ?', [id, 'admin']);
}

// 评估相关
function listAssessmentsForPatient(patientId) {
  return query(assessmentsDb, 'SELECT * FROM assessments WHERE patientId = ? ORDER BY createdAt DESC', [patientId]);
}

function listAllAssessments() {
  return query(assessmentsDb, 'SELECT * FROM assessments ORDER BY createdAt DESC');
}

function addAssessment(assessment) {
  return run(assessmentsDb,
    'INSERT INTO assessments (id, patientId, answers, totalScore, levelId, levelName, levelColor, nextAssessmentDue, remark, createdAt, assessorId, assessorName) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [assessment.id, assessment.patientId, JSON.stringify(assessment.answers), assessment.totalScore, assessment.levelId, assessment.levelName, assessment.levelColor, assessment.nextAssessmentDue, assessment.remark, assessment.assessedAt, assessment.doctorId, assessment.doctorName]
  );
}

function deleteAssessment(id) {
  return run(assessmentsDb, 'DELETE FROM assessments WHERE id = ?', [id]);
}

function deleteAssessmentsBatch(ids) {
  if (!ids || ids.length === 0) return Promise.resolve();
  const placeholders = ids.map(() => '?').join(',');
  return run(assessmentsDb, `DELETE FROM assessments WHERE id IN (${placeholders})`, ids);
}

function defaultDoctorPermissions() {
  return {
    viewDashboard: true,
    viewPatients: true,
    scorePatients: true,
    viewAssessments: true,
    managePatients: false,
    importPatients: false,
    manageUsers: false,
    systemSettings: false,
    deleteRecords: false,
  };
}

// 设置相关 - 使用JSON文件
function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('读取设置失败:', e);
  }
  return { patientFields: [] };
}

function writeSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    return true;
  } catch (e) {
    console.error('写入设置失败:', e);
    return false;
  }
}

function getPatientFields() {
  const settings = readSettings();
  return settings.patientFields || [];
}

function savePatientFields(fields) {
  const settings = readSettings();
  settings.patientFields = fields;
  return writeSettings(settings);
}

// 日志相关 - 使用文件存储
function addLog(logEntry) {
  try {
    ensureLogsDir();
    const timestamp = new Date().toISOString();
    const logEntryWithTimestamp = {
      timestamp,
      level: logEntry.level || 'info',
      method: logEntry.method || '',
      path: logEntry.path || '',
      ip: logEntry.ip || '',
      userId: logEntry.userId || '',
      username: logEntry.username || '',
      action: logEntry.action || '',
      targetType: logEntry.targetType || '',
      targetId: logEntry.targetId || '',
      details: logEntry.details || '',
      userAgent: logEntry.userAgent || ''
    };
    const logLine = JSON.stringify(logEntryWithTimestamp) + '\n';

    // 确保使用utf8编码写入日志文件
    fs.appendFileSync(getTodayLogFile(), logLine, 'utf8');
    console.log('日志记录成功:', logEntryWithTimestamp);
  } catch (e) {
    console.error('写入日志失败:', e);
  }
}

function getLogs(options = {}) {
  return new Promise((resolve) => {
    try {
      ensureLogsDir();
      const logs = [];
      const files = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.log'));

      for (const file of files.sort()) {
        if (options.startDate || options.endDate) {
          const fileDate = file.replace('.log', '');
          if (options.startDate && fileDate < options.startDate.slice(0, 10)) continue;
          if (options.endDate && fileDate > options.endDate.slice(0, 10)) continue;
        }

        const content = fs.readFileSync(path.join(LOGS_DIR, file), 'utf8');
        const lines = content.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);

            if (options.level && entry.level !== options.level) continue;
            if (options.method && entry.method !== options.method) continue;
            if (options.path && !entry.path.includes(options.path)) continue;
            if (options.userId && entry.userId !== options.userId) continue;
            if (options.username && !entry.username.includes(options.username)) continue;
            if (options.action && !entry.action.includes(options.action)) continue;
            if (options.targetType && entry.targetType !== options.targetType) continue;

            logs.push(entry);
          } catch (e) {}
        }
      }

      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (options.limit) {
        return resolve(logs.slice(0, options.limit));
      }
      resolve(logs);
    } catch (e) {
      console.error('读取日志失败:', e);
      resolve([]);
    }
  });
}

function uid(prefix) {
  return prefix + crypto.randomBytes(4).toString('hex') + Date.now().toString(36);
}

/**
 * 生成患者ID，格式：p_ + 16位随机字符串（0-9, a-z）
 */
function generatePatientId() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = 'p_';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 获取下一个可用的患者编号（patientNo）
 * 格式：p + 6位数字，从 p000001 开始递增
 * 自动查找数据库中最大的编号并加1
 */
function getNextPatientNo() {
  return new Promise((resolve, reject) => {
    waitForDbInit().then(() => {
      patientsDb.all('SELECT patientNo FROM patients WHERE patientNo IS NOT NULL AND patientNo != ""', (err, rows) => {
        if (err) {
          console.error('[ERROR] 查询患者编号失败:', err);
          // 失败时返回默认编号
          return resolve('p000001');
        }
        
        // 提取所有有效的患者编号（格式：p + 数字）
        const validNos = [];
        const regex = /^p(\d{6})$/i;
        
        rows.forEach(row => {
          const match = row.patientNo.match(regex);
          if (match) {
            validNos.push(parseInt(match[1], 10));
          }
        });
        
        if (validNos.length === 0) {
          // 数据库中没有有效编号，从 p000001 开始
          return resolve('p000001');
        }
        
        // 找到最大编号并加1
        const maxNo = Math.max(...validNos);
        const nextNo = maxNo + 1;
        
        // 确保不超过 999999
        if (nextNo > 999999) {
          console.error('[ERROR] 患者编号已超过最大值 999999');
          return reject(new Error('患者编号已超过最大值'));
        }
        
        const nextPatientNo = 'p' + String(nextNo).padStart(6, '0');
        console.log(`[DEBUG] 生成新患者编号: ${nextPatientNo} (当前最大编号: p${String(maxNo).padStart(6, '0')})`);
        resolve(nextPatientNo);
      });
    }).catch(reject);
  });
}

/**
 * 计算年龄（根据出生日期）
 * @param {string} birthDate - 出生日期（YYYY-MM-DD格式）
 * @returns {number|null} 年龄，如果日期无效则返回null
 */
function calculateAge(birthDate) {
  if (!birthDate) return null;
  
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  // 如果今年还没过生日，年龄减1
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * 计算透析龄（年）（根据首次透析日期）
 * @param {string} firstDialysisDate - 首次透析日期（YYYY-MM-DD格式）
 * @returns {number|null} 透析年限（小数），如果日期无效则返回null
 */
function calculateDialysisAge(firstDialysisDate) {
  if (!firstDialysisDate) return null;
  
  const start = new Date(firstDialysisDate);
  if (isNaN(start.getTime())) return null;
  
  const today = new Date();
  const diffMs = today - start;
  const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  
  // 保留2位小数
  return Math.round(years * 100) / 100;
}

/**
 * 根据年龄自动选择对应的评分选项ID
 * @param {number} age - 年龄
 * @returns {string|null} 选项ID，如果无法确定则返回null
 */
function getAgeItemId(age) {
  if (age === null || age === undefined || isNaN(age)) return null;
  
  if (age < 18) {
    // <18岁（儿童）
    return 'age_4';
  } else if (age >= 18 && age < 45) {
    // 18~<45岁（青年）
    return 'age_0';
  } else if (age >= 45 && age < 60) {
    // 45~<60岁（中年）
    return 'age_1';
  } else {
    // ≥60岁（老年）
    return 'age_4';
  }
}

/**
 * 根据透析龄自动选择对应的评分选项ID
 * @param {number} dialysisYears - 透析年限
 * @returns {string|null} 选项ID，如果无法确定则返回null
 */
function getDialysisAgeItemId(dialysisYears) {
  if (dialysisYears === null || dialysisYears === undefined || isNaN(dialysisYears)) return null;
  
  if (dialysisYears < 1) {
    return 'da_0';
  } else if (dialysisYears >= 1 && dialysisYears < 3) {
    return 'da_1';
  } else if (dialysisYears >= 3 && dialysisYears < 5) {
    return 'da_2';
  } else if (dialysisYears >= 5 && dialysisYears <= 10) {
    return 'da_3';
  } else {
    // >10年
    return 'da_4';
  }
}

/**
 * 获取患者评估默认值（增强版，包含所有必要信息用于前端验证）
 * @param {string} patientId - 患者ID
 * @returns {Object} 包含年龄、透析龄、患者姓名、自动选择的选项及范围描述
 */
async function getPatientAssessmentDefaults(patientId) {
  const patient = await getPatient(patientId);
  if (!patient) {
    throw new Error('患者不存在');
  }
  
  const age = calculateAge(patient.birthDate);
  const dialysisYears = calculateDialysisAge(patient.firstDialysisDate);
  
  const result = {
    patientId: patient.id,
    name: patient.name,
    birthDate: patient.birthDate,
    firstDialysisDate: patient.firstDialysisDate,
    age: age,
    dialysisYears: dialysisYears,
    // 增加：年龄范围描述（用于提示）
    ageRangeDescription: getAgeRangeDescription(age),
    // 增加：透析龄范围描述（用于提示）
    dialysisAgeRangeDescription: getDialysisAgeRangeDescription(dialysisYears),
    autoSelectedAnswers: {}
  };
  
  // 自动选择年龄选项
  const ageItemId = getAgeItemId(age);
  if (ageItemId) {
    result.autoSelectedAnswers['age'] = {
      itemId: ageItemId,
      label: getAgeItemLabel(ageItemId)
    };
  }
  
  // 自动选择透析龄选项
  const dialysisAgeItemId = getDialysisAgeItemId(dialysisYears);
  if (dialysisAgeItemId) {
    result.autoSelectedAnswers['dialysis_age'] = {
      itemId: dialysisAgeItemId,
      label: getDialysisAgeItemLabel(dialysisAgeItemId)
    };
  }
  
  // 自动选择首次血液透析选项（透析龄 < 3个月为首次）
  const firstDialysisItemId = getFirstDialysisItemId(dialysisYears);
  if (firstDialysisItemId) {
    result.autoSelectedAnswers['first_dialysis'] = {
      itemId: firstDialysisItemId,
      label: getFirstDialysisItemLabel(firstDialysisItemId)
    };
    // 添加描述信息用于前端提示
    result.firstDialysisDescription = getFirstDialysisDescription(dialysisYears < 0.25);
  }
  
  console.log(`[DEBUG] 患者评估默认值计算: 姓名=${patient.name}, 年龄=${age}, 透析龄=${dialysisYears}年`);
  console.log(`[DEBUG] 自动选择的选项: age=${ageItemId}, dialysis_age=${dialysisAgeItemId}`);
  
  return result;
}

/**
 * 获取年龄范围描述
 * @param {number} age - 年龄
 * @returns {string} 年龄范围描述
 */
function getAgeRangeDescription(age) {
  if (age === null || age === undefined) {
    return '未知';
  }
  if (age < 18) {
    return `${age}岁（儿童/未成年）`;
  }
  if (age < 45) {
    return `${age}岁（青年，18~<45岁）`;
  }
  if (age < 60) {
    return `${age}岁（中年，45~<60岁）`;
  }
  return `${age}岁（老年，≥60岁）`;
}

/**
 * 获取透析龄范围描述
 * @param {number} years - 透析年限
 * @returns {string} 透析龄范围描述
 */
function getDialysisAgeRangeDescription(years) {
  if (years === null || years === undefined) {
    return '未知';
  }
  if (years < 1) {
    return `${years.toFixed(1)}年（<1年）`;
  }
  if (years < 3) {
    return `${years.toFixed(1)}年（1~<3年）`;
  }
  if (years < 5) {
    return `${years.toFixed(1)}年（3~<5年）`;
  }
  if (years <= 10) {
    return `${years.toFixed(1)}年（5~10年）`;
  }
  return `${years.toFixed(1)}年（>10年）`;
}

/**
 * 获取年龄选项的标签
 */
function getAgeItemLabel(itemId) {
  const labels = {
    'age_0': '18~<45岁（青年）',
    'age_1': '45~<60岁（中年）',
    'age_4': '≥60岁（老年）或<18岁（儿童）'
  };
  return labels[itemId] || '';
}

/**
 * 获取透析龄选项的标签
 */
function getDialysisAgeItemLabel(itemId) {
  const labels = {
    'da_0': '<1年',
    'da_1': '1~<3年',
    'da_2': '3~<5年',
    'da_3': '5~10年',
    'da_4': '>10年'
  };
  return labels[itemId] || '';
}

/**
 * 获取首次血液透析选项的ID
 * 判断标准：透析龄 < 3个月（0.25年）为首次
 */
function getFirstDialysisItemId(dialysisYears) {
  if (dialysisYears === null || dialysisYears === undefined) {
    return null; // 无法判断
  }
  // 透析龄 < 3个月为首次血液透析
  return dialysisYears < 0.25 ? 'fd_4' : 'fd_0';
}

/**
 * 获取首次血液透析选项的标签
 */
function getFirstDialysisItemLabel(itemId) {
  const labels = {
    'fd_0': '否',
    'fd_4': '是'
  };
  return labels[itemId] || '';
}

/**
 * 获取首次血液透析描述
 */
function getFirstDialysisDescription(isFirstDialysis) {
  return isFirstDialysis ? '是（透析龄 < 3个月）' : '否（透析龄 ≥ 3个月）';
}

module.exports = {
  waitForDbInit,
  getUserByUsername,
  getUserById,
  listUsers,
  saveUser,
  createAdminUser,
  createPendingDoctor,
  updateUserPassword,
  updateUserById,
  deleteUser,
  listPatients,
  getPatient,
  savePatient,
  deletePatient,
  listAssessmentsForPatient,
  listAllAssessments,
  addAssessment,
  deleteAssessment,
  deleteAssessmentsBatch,
  defaultDoctorPermissions,
  getPatientFields,
  savePatientFields,
  addLog,
  getLogs,
  uid,
  generatePatientId,
  getNextPatientNo,
  calculateAge,
  calculateDialysisAge,
  getAgeItemId,
  getDialysisAgeItemId,
  getPatientAssessmentDefaults,
};
