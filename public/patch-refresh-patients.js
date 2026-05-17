/**
 * 补丁：修改 refreshPatients() 函数
 * 使用 /api/patients/with-assessments 端点（动态计算评估信息）
 */

// ========== 调试：验证补丁文件已加载 ==========
console.log('[PATCH] patch-refresh-patients.js 已加载！');
// ===============================================

// ========== 关键修复：清除原始事件处理器 ==========
// 在 DOM 加载完成后，清除 app.js 绑定的 tbody.onclick 事件处理器
document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('patients-body');
  if (tbody) {
    tbody.onclick = null;
    console.log('[PATCH] DOMContentLoaded: 已清除原始 tbody.onclick 事件处理器');
  }
});

//  also try to clear it immediately in case DOM is already loaded
setTimeout(() => {
  const tbody = document.getElementById('patients-body');
  if (tbody) {
    tbody.onclick = null;
    console.log('[PATCH] setTimeout: 已清除原始 tbody.onclick 事件处理器');
  }
}, 0);
// =====================================================

// 保存原始函数
const originalRefreshPatients = refreshPatients;

// 防御性修复：重写 window.openPatientModal 防止被 undefined 调用
const originalOpenPatientModal = window.openPatientModal;
window.openPatientModal = function(p) {
  if (p === undefined) {
    console.warn('[PATCH] openPatientModal() 被调用但参数为 undefined，已阻止');
    return;
  }
  console.log('[PATCH] openPatientModal() 正常调用', p ? `患者ID: ${p.id}, 姓名: ${p.name}` : '新增患者');
  return originalOpenPatientModal.call(this, p);
};

// 重写 refreshPatients() 函数
async function refreshPatients() {
  await loadRubric();
  
  try {
    // 使用新API，直接获取患者列表及其最新评估信息（动态计算）
    const list = await api('/api/patients/with-assessments');
    patientsCache = list || [];
    console.log('[DEBUG] refreshPatients() 获取到', patientsCache.length, '条患者记录（含评估信息）');
    
    // 为每个患者设置拼音首字母
    patientsCache.forEach(p => {
      p.pinyinInitials = getPinyinInitials(p.name);
    });
    
    const tbody = document.getElementById('patients-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!patientsCache.length) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty-hint">暂无患者，请手动添加或导入 Excel</td></tr>';
      return;
    }
    
    const isAd = me && me.role === 'admin';
    const perm = (me && me.permissions) || {};
    const canManage = isAd || perm.managePatients;
    const canScore = isAd || perm.scorePatients !== false;
    const canDelete = isAd || perm.deletePatients;
    
    patientsCache.forEach(p => {
      const tr = document.createElement('tr');
      const actions = [];
      
      // 统一使用 id 字段（兼容 _id 和 patientNo）
      const patientId = p.id || p._id || p.patientNo || '';
      
      if (canManage) {
        actions.push(`<button type="button" class="btn secondary btn-edit" data-id="${patientId}">编辑</button>`);
      }
      if (canScore) {
        actions.push(`<button type="button" class="btn secondary btn-score" data-id="${patientId}">评分</button>`);
      }
      if (canDelete) {
        actions.push(`<button type="button" class="btn danger btn-del" data-id="${patientId}">删除</button>`);
      }
      
      const level = rubricCache.levelRules?.find(l => l.id === p.lastLevelId);
      let levelBadge = '—';
      if (level) {
        levelBadge = `<span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:0.85rem; color:white; background:${level.color || '#999'};">${escapeHtml(level.name)}</span>`;
      }
      
      tr.innerHTML = `
        <td>${escapeHtml(p.patientNo || '')}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.gender || '—')}</td>
        <td>${p.age != null ? p.age : '—'}</td>
        <td>${escapeHtml(p.phone || '—')}</td>
        <td>${levelBadge}</td>
        <td>${p.latestScore != null ? p.latestScore : '—'}</td>
        <td>${p.lastAssessmentAt ? formatDate(p.lastAssessmentAt) : '—'}</td>
        <td>${p.nextAssessmentDue ? formatDate(p.nextAssessmentDue, false) : '—'}</td>
        <td>${actions.join(' ')}</td>
      `;
      
      tbody.appendChild(tr);
    });
    
    // 关键：清除原始 app.js 绑定的 tbody.onclick 事件处理器
    // 因为原始代码使用事件委托，会干扰我们的按钮点击事件
    tbody.onclick = null;
    
    // 绑定患者行按钮事件
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.onclick = () => {
        const btnId = btn.getAttribute('data-id');
        const patient = patientsCache.find(p => 
          (p.id && p.id.toString() === btnId) ||
          (p._id && p._id.toString() === btnId) ||
          (p.patientNo && p.patientNo === btnId)
        );
        if (patient) {
          console.log('[PATCH] 编辑患者:', patient.name, 'ID:', patient.id || patient._id);
          openPatientModal(patient);
        } else {
          console.error('[PATCH] 未找到患者, data-id:', btnId);
        }
      };
    });
    
    tbody.querySelectorAll('.btn-score').forEach(btn => {
      btn.onclick = () => {
        const btnId = btn.getAttribute('data-id');
        const patient = patientsCache.find(p => 
          (p.id && p.id.toString() === btnId) ||
          (p._id && p._id.toString() === btnId) ||
          (p.patientNo && p.patientNo === btnId)
        );
        if (patient) {
          console.log('[PATCH] 评分患者:', patient.name);
          // 正确流程：切换到评分视图，设置患者信息
          show('score');
          const sInput = document.getElementById('score-patient-search');
          const pIdInput = document.getElementById('score-patient-id');
          const pInfoDiv = document.getElementById('score-patient-info');
          
          if (sInput) sInput.value = patient.name;
          if (pIdInput) pIdInput.value = patient.id || patient._id;
          if (pInfoDiv) {
            pInfoDiv.textContent = `已选择：${patient.name}，${patient.gender || '未知性别'}，${patient.phone || '无电话'}`;
          }
          
          initScoreView().then(() => loadScoreHistory());
        }
      };
    });
    
    tbody.querySelectorAll('.btn-del').forEach(btn => {
      btn.onclick = () => {
        const btnId = btn.getAttribute('data-id');
        const patient = patientsCache.find(p => 
          (p.id && p.id.toString() === btnId) ||
          (p._id && p._id.toString() === btnId) ||
          (p.patientNo && p.patientNo === btnId)
        );
        if (patient) {
          const id = patient.id || patient._id;
          console.log('[PATCH] 删除患者:', patient.name, 'ID:', id);
          if (!confirm('确定删除该患者及其全部评估记录？此操作不可恢复！')) return;
          
          api(`/api/patients/${id}`, { method: 'DELETE' })
            .then(() => {
              showMessage('删除成功', 'success');
              refreshPatients();
              refreshDashboard();
            })
            .catch(e => {
              showMessage('删除失败: ' + e.message, 'error');
            });
        }
      };
    });
    
    // 更新分页信息
    const totalPages = Math.ceil(patientsCache.length / CONFIG.PAGE_SIZE);
    const pageInfo = document.getElementById('patients-page-info');
    if (pageInfo) {
      pageInfo.textContent = `第 ${patientsPage} / ${totalPages} 页，共 ${patientsCache.length} 条`;
    }
    
    // 绑定分页按钮
    const prevBtn = document.getElementById('patients-prev');
    const nextBtn = document.getElementById('patients-next');
    if (prevBtn) prevBtn.disabled = patientsPage <= 1;
    if (nextBtn) nextBtn.disabled = patientsPage >= totalPages;
    
  } catch (e) {
    console.error('刷新患者列表失败:', e);
    showMessage('刷新患者列表失败: ' + e.message, 'error');
  }
}
