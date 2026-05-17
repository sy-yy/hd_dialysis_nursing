/**
 * 补丁：修改 refreshSettings() 函数
 * 使用 level-manager.js 中的可视化渲染函数
 */

// 保存原始函数
const originalRefreshSettings = refreshSettings;

// 重写 refreshSettings() 函数
async function refreshSettings() {
  if (!me || (me.role !== 'admin' && (!me.permissions || me.permissions.systemSettings === false))) {
    show('dashboard');
    return;
  }
  
  // 渲染患者字段设置
  const fieldsList = document.getElementById('settings-fields-list');
  if (fieldsList) {
    fieldsList.innerHTML = '';
    
    const defaultFields = [
      { id: 'name', name: '姓名', required: true },
      { id: 'gender', name: '性别' },
      { id: 'birthDate', name: '出生日期' },
      { id: 'phone', name: '联系电话' },
      { id: 'idCard', name: '身份证', required: true },
      { id: 'firstDialysisDate', name: '首次透析日期' },
      { id: 'height', name: '身高' },
      { id: 'dryWeight', name: '干体重' },
      { id: 'preWeight', name: '透前体重' },
      { id: 'dialysisFreq', name: '透析频次' },
      { id: 'notes', name: '备注' }
    ];
    
    let savedFields = [];
    try {
      savedFields = await api('/api/settings/patient-fields');
    } catch (e) {
      console.error('加载患者字段设置失败:', e);
    }
    
    const fieldMap = new Map();
    defaultFields.forEach(f => fieldMap.set(f.id, { ...f, enabled: true }));
    savedFields.forEach(f => { 
      if (fieldMap.has(f.id)) {
        fieldMap.get(f.id).required = f.required;
      } else {
        fieldMap.set(f.id, { ...f, enabled: true });
      }
    });
    
    fieldMap.forEach((f, id) => {
      const item = document.createElement('div');
      item.className = 'field-item';
      item.style.cssText = 'padding: 8px 12px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 8px;';
      
      item.innerHTML = `
        <input type="checkbox" ${f.enabled ? 'checked' : ''} data-field="${id}" style="margin-right: 8px;">
        <span style="flex: 1;">${escapeHtml(f.name)}</span>
        <label style="font-size: 0.85rem; color: #666;">
          <input type="checkbox" class="field-required" data-field="${id}" ${f.required ? 'checked' : ''}> 必填
        </label>
        ${id.startsWith('custom_') ? '<button type="button" class="btn danger btn-remove-field" style="padding: 4px 8px; font-size: 0.85rem;">删除</button>' : ''}
      `;
      
      fieldsList.appendChild(item);
    });
    
    // 保存字段设置按钮
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn';
    saveBtn.textContent = '保存字段设置';
    saveBtn.style.marginTop = '12px';
    saveBtn.onclick = async () => {
      const fields = Array.from(fieldsList.querySelectorAll('.field-item')).map(item => {
        const cb = item.querySelector('input[type="checkbox"]:not(.field-required)');
        const fieldId = cb?.getAttribute('data-field');
        const fieldName = item.querySelector('span')?.textContent?.trim() || '';
        const required = item.querySelector('.field-required')?.checked || false;
        const enabled = cb?.checked || false;
        
        return { id: fieldId, name: fieldName, required, enabled };
      });
      
      try {
        await api('/api/settings/patient-fields', { 
          method: 'POST', 
          body: JSON.stringify(fields) 
        });
        showMessage('保存成功', 'success');
      } catch (e) {
        showMessage('保存失败: ' + e.message, 'error');
      }
    };
    
    fieldsList.appendChild(saveBtn);
  }
  
  // 渲染评分级别设置（使用可视化函数）
  const levelsList = document.getElementById('settings-levels-list');
  if (levelsList) {
    levelsList.innerHTML = '';
    
    try {
      await loadRubric(true);
      
      // 渲染可视化预览
      if (rubricCache && rubricCache.levelRules) {
        renderLevelVisualPreview(rubricCache.levelRules);
      }
      
      // 渲染级别列表（带编辑功能）
      if (typeof renderLevelsList === 'function') {
        renderLevelsList(rubricCache.levelRules || []);
      }
    } catch (e) {
      console.error('加载评分级别失败:', e);
    }
  }
}
