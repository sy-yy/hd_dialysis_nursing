const path = require('path');
const fs = require('fs');

const RUBRIC_PATH = path.join(__dirname, '..', 'data', 'rubric.json');

let rubricCache = null;

function loadRubric() {
  if (rubricCache) return Promise.resolve(rubricCache);

  return new Promise((resolve, reject) => {
    fs.readFile(RUBRIC_PATH, 'utf8', (err, data) => {
      if (err) {
        console.error('读取评分规则失败:', err);
        reject(err);
        return;
      }
      try {
        rubricCache = JSON.parse(data);
        resolve(rubricCache);
      } catch (e) {
        console.error('解析评分规则失败:', e);
        reject(e);
      }
    });
  });
}

function saveRubric(rubric) {
  return new Promise((resolve, reject) => {
    fs.writeFile(RUBRIC_PATH, JSON.stringify(rubric, null, 2), 'utf8', (err) => {
      if (err) {
        console.error('保存评分规则失败:', err);
        reject(err);
        return;
      }
      rubricCache = rubric;
      resolve();
    });
  });
}

function buildItemMap(rubric) {
  const map = {};
  for (const dim of rubric.dimensions) {
    for (const it of dim.items) {
      map[it.id] = { dimensionId: dim.id, score: it.score, label: it.label };
    }
  }
  return map;
}

function scoreFromAnswers(rubric, answers) {
  const itemMap = buildItemMap(rubric);
  const scores = {};
  let total = 0;
  for (const dim of rubric.dimensions) {
    try {
      const itemId = answers[dim.id];
      if (!itemId) {
        scores[dim.id] = 0;
        continue;
      }
      const meta = itemMap[itemId];
      const s = meta ? meta.score : 0;
      scores[dim.id] = s;
      total += s;
    } catch (e) {
      console.error(`处理维度 ${dim.id} 时出错:`, e);
      scores[dim.id] = 0;
    }
  }
  return { totalScore: total, scores };
}

function resolveLevel(rubric, totalScore) {
  // 按 minScore 排序，确保按顺序匹配
  const sortedRules = [...rubric.levelRules].sort((a, b) => (a.minScore || 0) - (b.minScore || 0));
  
  for (const rule of sortedRules) {
    const min = rule.minScore != null ? rule.minScore : 0;
    const max = rule.maxScore != null ? rule.maxScore : Infinity;
    if (totalScore >= min && totalScore <= max) {
      return rule;
    }
  }
  
  // 如果没找到匹配，返回最后一个规则（最高级别）
  return sortedRules[sortedRules.length - 1];
}

function frequencyDaysForLevel(rubric, levelRule, patient) {
  if (patient.assessmentFrequencyDays != null && patient.assessmentFrequencyDays > 0) {
    return patient.assessmentFrequencyDays;
  }
  return levelRule.defaultFrequencyDays || 30;
}

function nextDueIso(assessedAtIso, days) {
  const d = new Date(assessedAtIso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

module.exports = {
  loadRubric,
  saveRubric,
  scoreFromAnswers,
  resolveLevel,
  frequencyDaysForLevel,
  nextDueIso,
};
