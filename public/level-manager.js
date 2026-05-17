/**
 * 级别管理模块 - 可视化评分级别设置
 * 包含：可视化预览、内联编辑表单、颜色选择器等
 */

// ==================== 常见高对比度颜色列表 ====================
const PRESET_COLORS = [
  { name: '红色', value: '#e74c3c' },
  { name: '橙色', value: '#e67e22' },
  { name: '黄色', value: '#f1c40f' },
  { name: '绿色', value: '#2ecc71' },
  { name: '青色', value: '#1abc9c' },
  { name: '蓝色', value: '#3498db' },
  { name: '紫色', value: '#9b59b6' },
  { name: '粉色', value: '#e91e63' },
  { name: '棕色', value: '#795548' },
  { name: '灰色', value: '#95a5a6' }
];

// ==================== 渲染评分级别可视化预览 ====================
function renderLevelVisualPreview(levels) {
  const bar = document.getElementById('level-range-bar');
  const labels = document.getElementById('level-range-labels');
  
  if (!bar || !labels) return;
  
  bar.innerHTML = '';
  labels.innerHTML = '';
  
  if (!levels || levels.length === 0) {
    bar.innerHTML = '<div style="flex:1; display:flex; align-items:center; justify-content:center; background:#e0e0e0; color:#666; font-size:0.9rem; border-radius:8px;">暂无级别数据</div>';
    return;
  }
  
  // 找出最大分数
  const maxScore = Math.max(...levels.map(l => l.maxScore || 0));
  
  // 按 minScore 排序
  const sortedLevels = [...levels].sort((a, b) => (a.minScore || 0) - (b.minScore || 0));
  
  // 构建完整的范围区间（包括未覆盖的间隙）
  const ranges = [];
  let currentPos = 0;
  
  sortedLevels.forEach(level => {
    const min = level.minScore || 0;
    const max = level.maxScore || 0;
    
    // 如果当前级别的最小值大于当前位置，说明有间隙
    if (min > currentPos) {
      // 添加未覆盖的间隙区间（灰色）
      ranges.push({
        min: currentPos,
        max: min - 1,
        level: null,
        color: '#e0e0e0',
        name: '未划分'
      });
    }
    
    // 添加当前级别区间
    ranges.push({
      min: min,
      max: max,
      level: level,
      color: level.color || '#999',
      name: level.name
    });
    
    currentPos = max + 1;
  });
  
  // 如果最后一个级别的最大值小于最大分数，添加末尾间隙
  if (currentPos <= maxScore) {
    ranges.push({
      min: currentPos,
      max: maxScore,
      level: null,
      color: '#e0e0e0',
      name: '未划分'
    });
  }
  
  // 渲染所有区间
  ranges.forEach(range => {
    const rangeSize = maxScore > 0 ? ((range.max - range.min + 1) / (maxScore + 1)) * 100 : 100 / ranges.length;
    
    // 创建颜色段
    const segment = document.createElement('div');
    segment.className = 'level-range-segment';
    const isUncovered = range.level === null;
    
    // 根据区间大小调整样式
    const isSmallSegment = (range.max - range.min + 1) < 5;
    const fontSizes = isSmallSegment ? '0.65rem' : '0.75rem';
    const padding = isSmallSegment ? '2px' : '4px';
    
    segment.style.cssText = `flex: ${rangeSize}; background: ${range.color}; padding: ${padding}; font-size: ${fontSizes}; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; position:relative; ${isUncovered ? 'color:#999; border: 2px dashed #999;' : 'color:white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);'}`;
    segment.setAttribute('data-range', `${range.min}-${range.max}分`);
    segment.title = isUncovered ? `未划分区域: ${range.min}-${range.max}分` : `${range.name}: ${range.min}-${range.max}分`;
    
    // 在颜色段内部显示标签信息
    if (isUncovered) {
      segment.innerHTML = `<div style="font-weight:bold; opacity:0.7;">?</div><div style="font-size:0.6rem; opacity:0.6;">${range.min}-${range.max}</div>`;
    } else {
      // 显示级别名称和分数范围
      const nameHtml = `<div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;">${range.name}</div>`;
      const rangeHtml = `<div style="font-size:0.65rem; opacity:0.9;">${range.min}-${range.max}分</div>`;
      segment.innerHTML = nameHtml + rangeHtml;
    }
    
    bar.appendChild(segment);
  });
  
  // 如果有未覆盖的区间，在下方添加提示信息
  const hasUncovered = ranges.some(r => r.level === null);
  if (hasUncovered) {
    const warning = document.createElement('div');
    warning.style.cssText = 'margin-top:8px; padding:8px; background:#fff3cd; border-left:4px solid #ffc107; border-radius:4px; font-size:0.85rem; color:#856404; width:100%;';
    warning.innerHTML = '⚠️ <strong>注意：</strong>存在未划分的分数区间（灰色区域），建议调整级别范围以确保所有分数都有对应级别。';
    labels.appendChild(warning);
  }
  
  // 清空标签区域，因为标签已经在颜色段内部显示了
  // 如果需要保留标签区域用于其他用途，可以在这里添加
  
}

// ==================== 渲染评分级别列表 ====================
function renderLevelsList(levels) {
  const levelsList = document.getElementById('settings-levels-list');
  if (!levelsList) return;
  
  levelsList.innerHTML = '';
  
  if (!levels || levels.length === 0) {
    levelsList.innerHTML = '<div class="empty-hint">暂无评分级别，请点击"添加级别"按钮创建。</div>';
    return;
  }
  
  levels.forEach(level => {
    const item = document.createElement('div');
    item.className = 'level-item';
    item.style.cssText = 'display:flex; align-items:center; gap:12px; padding:12px; border:1px solid #e8eaf6; border-radius:8px; margin-bottom:12px; background:#f8f9fa;';
    item.setAttribute('data-level-id', level.id);
    
    // 颜色指示器
    const colorIndicator = document.createElement('div');
    colorIndicator.className = 'level-color-indicator';
    colorIndicator.style.cssText = `width:24px; height:24px; border-radius:50%; background:${level.color || '#999'}; border:2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.2); flex-shrink:0;`;
    
    // 级别信息
    const info = document.createElement('div');
    info.className = 'level-info';
    info.innerHTML = `
      <h4 style="margin:0 0 4px 0; font-size:1rem;">${escapeHtml(level.name)}</h4>
      <p style="margin:4px 0; font-size:0.85rem; color:#666;">分数范围: ${level.minScore} - ${level.maxScore} 分 | 评估周期: ${level.defaultFrequencyDays} 天</p>
      ${level.description ? `<p style="margin:4px 0; font-size:0.8rem; color:#888;">${escapeHtml(level.description)}</p>` : ''}
    `;
    
    // 操作按钮
    const actions = document.createElement('div');
    actions.className = 'level-actions';
    actions.innerHTML = `
      <button type="button" class="btn secondary btn-edit-level" data-id="${level.id}" style="padding:6px 12px; font-size:0.85rem;">编辑</button>
      <button type="button" class="btn danger btn-delete-level" data-id="${level.id}" style="padding:6px 12px; font-size:0.85rem;">删除</button>
    `;
    
    item.appendChild(colorIndicator);
    item.appendChild(info);
    item.appendChild(actions);
    levelsList.appendChild(item);
  });
  
  // 绑定编辑按钮事件
  levelsList.querySelectorAll('.btn-edit-level').forEach(btn => {
    btn.onclick = () => {
      const levelId = btn.getAttribute('data-id');
      toggleLevelEditForm(levelId);
    };
  });
  
  // 绑定删除按钮事件
  levelsList.querySelectorAll('.btn-delete-level').forEach(btn => {
    btn.onclick = () => {
      const levelId = btn.getAttribute('data-id');
      deleteLevel(levelId);
    };
  });
}

// ==================== 切换级别编辑表单 ====================
function toggleLevelEditForm(levelId) {
  const level = rubricCache.levelRules?.find(l => l.id === levelId);
  if (!level) return;
  
  // Find the level item in the DOM
  const levelItem = document.querySelector(`.level-item[data-level-id="${levelId}"]`);
  if (!levelItem) return;
  
  // Check if edit form already exists
  let editForm = levelItem.querySelector('.level-form');
  
  if (editForm) {
    // Toggle: remove if exists
    editForm.remove();
    levelItem.classList.remove('editing');
    return;
  }
  
  // Remove any other open edit forms
  document.querySelectorAll('.level-form').forEach(f => f.remove());
  document.querySelectorAll('.level-item.editing').forEach(el => el.classList.remove('editing'));
  
  // Create edit form
  editForm = document.createElement('div');
  editForm.className = 'level-form';
  
  // Build color picker HTML
  let colorPickerHtml = '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">';
  PRESET_COLORS.forEach(color => {
    const isSelected = color.value === level.color ? 'selected' : '';
    colorPickerHtml += `
      <div class="color-option ${isSelected}" 
           style="width:32px; height:32px; border-radius:50%; background:${color.value}; cursor:pointer; border:3px solid ${isSelected ? '#333' : 'transparent'};"
           data-color="${color.value}"
           title="${color.name}"></div>
    `;
  });
  colorPickerHtml += '</div>';
  
  editForm.innerHTML = `
    <div class="form-group">
      <label>级别名称</label>
      <input type="text" class="edit-level-name" value="${escapeHtml(level.name)}" placeholder="请输入级别名称" />
    </div>
    
    <div class="form-group">
      <label>级别颜色</label>
      <p style="font-size:0.85rem; color:#666; margin-bottom:8px;">点击选择颜色：</p>
      ${colorPickerHtml}
      <input type="hidden" class="edit-level-color" value="${level.color || '#3498db'}" />
    </div>
    
    <div class="form-row">
      <div class="form-group">
        <label>最低分数</label>
        <input type="number" class="edit-level-min" value="${level.minScore || 0}" min="0" max="100" />
      </div>
      <div class="form-group">
        <label>最高分数</label>
        <input type="number" class="edit-level-max" value="${level.maxScore || 100}" min="0" max="100" />
      </div>
    </div>
    
    <div class="form-group">
      <label>评估周期（天）</label>
      <input type="number" class="edit-level-freq" value="${level.defaultFrequencyDays || 30}" min="1" max="365" />
    </div>
    
    <div class="form-group">
      <label>级别描述</label>
      <textarea class="edit-level-desc" rows="2" placeholder="可选：输入级别描述">${escapeHtml(level.description || '')}</textarea>
    </div>
    
    <div class="form-actions">
      <button type="button" class="btn" id="save-level-${levelId}">保存</button>
      <button type="button" class="btn secondary" id="cancel-level-${levelId}">取消</button>
    </div>
  `;
  
  levelItem.appendChild(editForm);
  levelItem.classList.add('editing');
  
  // Bind color picker
  editForm.querySelectorAll('.color-option').forEach(option => {
    option.onclick = () => {
      editForm.querySelectorAll('.color-option').forEach(o => o.style.borderColor = 'transparent');
      option.style.borderColor = '#333';
      editForm.querySelector('.edit-level-color').value = option.getAttribute('data-color');
    };
  });
  
  // Bind save button
  editForm.querySelector(`#save-level-${levelId}`).onclick = async () => {
    await saveLevelEdit(levelId);
  };
  
  // Bind cancel button
  editForm.querySelector(`#cancel-level-${levelId}`).onclick = () => {
    editForm.remove();
    levelItem.classList.remove('editing');
  };
}

// ==================== 检查分数范围是否重叠 ====================
function checkRangeOverlap(minScore, maxScore, excludeId = null) {
  if (!rubricCache.levelRules || rubricCache.levelRules.length === 0) {
    return { hasOverlap: false, overlappingLevels: [] };
  }
  
  const overlappingLevels = [];
  
  for (const level of rubricCache.levelRules) {
    // 排除自身（编辑时）
    if (excludeId && level.id === excludeId) continue;
    
    const levelMin = level.minScore || 0;
    const levelMax = level.maxScore || 0;
    
    // 检查重叠：两个区间存在交集
    // 区间A: [minScore, maxScore], 区间B: [levelMin, levelMax]
    // 重叠条件: minScore <= levelMax && maxScore >= levelMin
    if (minScore <= levelMax && maxScore >= levelMin) {
      overlappingLevels.push({
        id: level.id,
        name: level.name,
        minScore: levelMin,
        maxScore: levelMax
      });
    }
  }
  
  return {
    hasOverlap: overlappingLevels.length > 0,
    overlappingLevels: overlappingLevels
  };
}

// ==================== 保存级别编辑 ====================
async function saveLevelEdit(levelId) {
  const levelItem = document.querySelector(`.level-item[data-level-id="${levelId}"]`);
  if (!levelItem) return;
  
  const editForm = levelItem.querySelector('.level-form');
  if (!editForm) return;
  
  const name = editForm.querySelector('.edit-level-name')?.value?.trim();
  const color = editForm.querySelector('.edit-level-color')?.value;
  const min = parseInt(editForm.querySelector('.edit-level-min')?.value);
  const max = parseInt(editForm.querySelector('.edit-level-max')?.value);
  const freq = parseInt(editForm.querySelector('.edit-level-freq')?.value);
  const desc = editForm.querySelector('.edit-level-desc')?.value?.trim();
  
  if (!name) {
    showMessage('请输入级别名称', 'warning');
    return;
  }
  
  if (isNaN(min) || isNaN(max) || isNaN(freq)) {
    showMessage('请输入有效的数字（分数范围和评估周期）', 'warning');
    return;
  }
  
  if (min > max) {
    showMessage('最低分数不能大于最高分数', 'warning');
    return;
  }
  
  // 检查分数范围是否重叠
  const overlapCheck = checkRangeOverlap(min, max, levelId);
  if (overlapCheck.hasOverlap) {
    const overlapInfo = overlapCheck.overlappingLevels.map(l => `"${l.name}" (${l.minScore}-${l.maxScore}分)`).join('、');
    showMessage(`分数范围与以下级别重叠：${overlapInfo}，请调整分数范围避免重叠。`, 'warning');
    return;
  }
  
  try {
    await api(`/api/rubric/levels/${levelId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name,
        color,
        minScore: min,
        maxScore: max,
        defaultFrequencyDays: freq,
        description: desc
      })
    });
    
    showMessage('保存成功！正在重新计算所有患者数据...', 'success');
    
    // 关键修复：保存成功后，自动刷新患者管理和仪表盘
    await refreshSettings();
    
    // 延迟刷新患者列表和仪表盘，确保后端计算完成
    setTimeout(async () => {
      if (typeof refreshPatients === 'function') {
        await refreshPatients();
        console.log('[DEBUG] 评分级别保存后已刷新患者列表');
      }
      if (typeof refreshDashboard === 'function') {
        await refreshDashboard();
        console.log('[DEBUG] 评分级别保存后已刷新仪表盘');
      }
    }, 500);
  } catch (e) {
    showMessage('保存失败：' + e.message, 'error');
  }
}

// ==================== 删除级别 ====================
async function deleteLevel(levelId) {
  if (!confirm('确定要删除这个评分级别吗？删除后会影响所有使用该级别的患者评估数据。')) {
    return;
  }
  
  try {
    await api(`/api/rubric/levels/${levelId}`, {
      method: 'DELETE'
    });
    
    showMessage('删除成功！正在重新计算所有患者数据...', 'success');
    
    // 关键修复：删除成功后，自动刷新患者管理和仪表盘
    await refreshSettings();
    
    // 延迟刷新患者列表和仪表盘，确保后端计算完成
    setTimeout(async () => {
      if (typeof refreshPatients === 'function') {
        await refreshPatients();
        console.log('[DEBUG] 评分级别删除后已刷新患者列表');
      }
      if (typeof refreshDashboard === 'function') {
        await refreshDashboard();
        console.log('[DEBUG] 评分级别删除后已刷新仪表盘');
      }
    }, 500);
  } catch (e) {
    showMessage('删除失败：' + e.message, 'error');
  }
}

// ==================== 显示添加级别表单 ====================
function showAddLevelForm() {
  // Remove any existing add form
  const existingForm = document.getElementById('add-level-form');
  if (existingForm) {
    existingForm.remove();
    return;
  }
  
  // Remove any edit forms
  document.querySelectorAll('.level-form').forEach(f => f.remove());
  document.querySelectorAll('.level-item.editing').forEach(el => el.classList.remove('editing'));
  
  const levelsList = document.getElementById('settings-levels-list');
  if (!levelsList) return;
  
  // Create add form
  const addForm = document.createElement('div');
  addForm.id = 'add-level-form';
  addForm.className = 'level-form';
  
  // Auto-assign color
  const existingColors = rubricCache.levelRules?.map(l => l.color) || [];
  const availableColor = PRESET_COLORS.find(c => !existingColors.includes(c.value)) || PRESET_COLORS[0];
  
  // Build color picker HTML
  let colorPickerHtml = '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">';
  PRESET_COLORS.forEach(color => {
    const isSelected = color.value === availableColor.value ? 'selected' : '';
    colorPickerHtml += `
      <div class="color-option ${isSelected}" 
           style="width:32px; height:32px; border-radius:50%; background:${color.value}; cursor:pointer; border:3px solid ${isSelected ? '#333' : 'transparent'};"
           data-color="${color.value}"
           title="${color.name}"></div>
    `;
  });
  colorPickerHtml += '</div>';
  
  addForm.innerHTML = `
    <h4 style="margin-top:0; margin-bottom:12px;">添加新级别</h4>
    
    <div class="form-group">
      <label>级别名称</label>
      <input type="text" class="add-level-name" placeholder="请输入级别名称" />
    </div>
    
    <div class="form-group">
      <label>级别颜色</label>
      <p style="font-size:0.85rem; color:#666; margin-bottom:8px;">点击选择颜色：</p>
      ${colorPickerHtml}
      <input type="hidden" class="add-level-color" value="${availableColor.value}" />
    </div>
    
    <div class="form-row">
      <div class="form-group">
        <label>最低分数</label>
        <input type="number" class="add-level-min" value="0" min="0" max="100" />
      </div>
      <div class="form-group">
        <label>最高分数</label>
        <input type="number" class="add-level-max" value="100" min="0" max="100" />
      </div>
    </div>
    
    <div class="form-group">
      <label>评估周期（天）</label>
      <input type="number" class="add-level-freq" value="30" min="1" max="365" />
    </div>
    
    <div class="form-group">
      <label>级别描述</label>
      <textarea class="add-level-desc" rows="2" placeholder="可选：输入级别描述"></textarea>
    </div>
    
    <div class="form-actions">
      <button type="button" class="btn" id="save-new-level">保存</button>
      <button type="button" class="btn secondary" id="cancel-add-level">取消</button>
    </div>
  `;
  
  levelsList.appendChild(addForm);
  
  // Bind color picker
  addForm.querySelectorAll('.color-option').forEach(option => {
    option.onclick = () => {
      addForm.querySelectorAll('.color-option').forEach(o => o.style.borderColor = 'transparent');
      option.style.borderColor = '#333';
      addForm.querySelector('.add-level-color').value = option.getAttribute('data-color');
    };
  });
  
  // Bind cancel button
  addForm.querySelector('#cancel-add-level').onclick = () => {
    addForm.remove();
  };
  
  // Bind save button
  addForm.querySelector('#save-new-level').onclick = async () => {
    await saveNewLevel();
  };
}

// ==================== 保存新级别 ====================
async function saveNewLevel() {
  const addForm = document.getElementById('add-level-form');
  if (!addForm) return;
  
  const name = addForm.querySelector('.add-level-name')?.value?.trim();
  const color = addForm.querySelector('.add-level-color')?.value;
  const min = parseInt(addForm.querySelector('.add-level-min')?.value);
  const max = parseInt(addForm.querySelector('.add-level-max')?.value);
  const freq = parseInt(addForm.querySelector('.add-level-freq')?.value);
  const desc = addForm.querySelector('.add-level-desc')?.value?.trim();
  
  if (!name) {
    showMessage('请输入级别名称', 'warning');
    return;
  }
  
  if (isNaN(min) || isNaN(max) || isNaN(freq)) {
    showMessage('请输入有效的数字（分数范围和评估周期）', 'warning');
    return;
  }
  
  if (min > max) {
    showMessage('最低分数不能大于最高分数', 'warning');
    return;
  }
  
  // 检查分数范围是否重叠（添加新级别时不需要排除任何级别）
  const overlapCheck = checkRangeOverlap(min, max);
  if (overlapCheck.hasOverlap) {
    const overlapInfo = overlapCheck.overlappingLevels.map(l => `"${l.name}" (${l.minScore}-${l.maxScore}分)`).join('、');
    showMessage(`分数范围与以下级别重叠：${overlapInfo}，请调整分数范围避免重叠。`, 'warning');
    return;
  }
  
  try {
    await api('/api/rubric/levels', {
      method: 'POST',
      body: JSON.stringify({
        name,
        color,
        minScore: min,
        maxScore: max,
        defaultFrequencyDays: freq,
        description: desc
      })
    });
    
    showMessage('添加成功！正在重新计算所有患者数据...', 'success');
    
    // 关键修复：添加成功后，自动刷新患者管理和仪表盘
    await refreshSettings();
    
    // 延迟刷新患者列表和仪表盘，确保后端计算完成
    setTimeout(async () => {
      if (typeof refreshPatients === 'function') {
        await refreshPatients();
        console.log('[DEBUG] 评分级别添加后已刷新患者列表');
      }
      if (typeof refreshDashboard === 'function') {
        await refreshDashboard();
        console.log('[DEBUG] 评分级别添加后已刷新仪表盘');
      }
    }, 500);
  } catch (e) {
    showMessage('添加失败：' + e.message, 'error');
  }
}

// ==================== 初始化：绑定事件 ====================
document.addEventListener('DOMContentLoaded', () => {
  // 绑定添加级别按钮
  const addLevelBtn = document.getElementById('btn-add-level');
  if (addLevelBtn && typeof showAddLevelForm === 'function') {
    addLevelBtn.onclick = showAddLevelForm;
  }
});
