/**
 * 补丁：修改 refreshPatientsByLevel() 函数
 * 使用 /api/patients/with-assessments 端点（动态计算评估信息）
 * 修复：从仪表盘点击分级标签后，患者列表显示级别不正确的问题
 */

// ========== 调试：验证补丁文件已加载 ==========
console.log('[PATCH] patch-refresh-patients-by-level.js 已加载！');
// ===============================================

// 保存原始函数
const originalRefreshPatientsByLevel = refreshPatientsByLevel;

// 重写 refreshPatientsByLevel() 函数
async function refreshPatientsByLevel(levelId) {
  console.log(`[PATCH] refreshPatientsByLevel('${levelId}') 被调用`);
  
  await loadRubric();
  
  try {
    // 使用新API，直接获取患者列表及其最新评估信息（动态计算）
    const list = await api('/api/patients/with-assessments');
    patientsCache = list || [];
    console.log('[DEBUG] refreshPatientsByLevel() 获取到', patientsCache.length, '条患者记录（含评估信息）');
    
    // 为每个患者设置拼音首字母
    patientsCache.forEach(p => {
      p.pinyinInitials = getPinyinInitials(p.name);
    });
    
    // 过滤出指定级别的患者
    const filtered = patientsCache.filter(p => p.lastLevelId === levelId);
    console.log(`[DEBUG] 级别 '${levelId}' 筛选出`, filtered.length, '名患者');
    
    const tbody = document.getElementById('patients-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!filtered.length) {
      const levelText = levelId === 'low' ? '绿色（低危）' : levelId === 'medium' ? '黄色（中危）' : '红色（高危）';
      tbody.innerHTML = `<tr><td colspan="10" class="empty-hint">暂无${levelText}患者</td></tr>`;
      return;
    }
    
    const isAd = me && me.role === 'admin';
    const perm = (me && me.permissions) || {};
    const canManage = isAd || perm.managePatients;
    const canScore = isAd || perm.scorePatients !== false;
    const canDelete = isAd || perm.deletePatients;
    
    filtered.forEach(p => {
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
      
      // 使用动态计算的级别显示
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
    
    // 绑定患者行按钮事件（与 patch-refresh-patients.js 相同的逻辑）
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
          show('score');
          const sInput = document.getElementById('score-patient-search');
          const pIdInput = document.getElementById('score-patient-id');
          const pInfoDiv = document.getElementById('score-patient-info');
          
          if (sInput) sInput.value = patient.name;
          if (pIdInput) pIdInput.value = patient.id || patient._id;
          if (pInfoDiv) {
            pInfoDiv.textContent = `已选择：${patient.name}，${patient.gender || '未知性别'}${patient.phone || '无电话'}`;
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
    
    console.log(`[PATCH] refreshPatientsByLevel('${levelId}') 完成，显示了 ${filtered.length} 名患者`);
    
  } catch (e) {
    console.error('按级别刷新患者列表失败:', e);
    showMessage('刷新患者列表失败: ' + e.message, 'error');
  }
}

console.log('[PATCH] refreshPatientsByLevel() 函数已重写');
