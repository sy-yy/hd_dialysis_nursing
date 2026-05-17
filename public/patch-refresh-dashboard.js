/**
 * 补丁：修改 refreshDashboard() 函数
 * 动态计算统计数据（不依赖存储字段）
 */

// 保存原始函数
const originalRefreshDashboard = refreshDashboard;

// 重写 refreshDashboard() 函数
async function refreshDashboard() {
  try {
    // 获取患者列表（含最新评估信息，动态计算）
    const patients = await api('/api/patients/with-assessments');
    
    // 获取评估记录
    const assessments = await api('/api/assessments');
    
    // 计算统计数据
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // 按级别统计
    const byLevel = { low: 0, medium: 0, high: 0 };
    
    patients.forEach(p => {
      // 统计级别
      if (p.lastLevelId) {
        const level = rubricCache.levelRules?.find(l => l.id === p.lastLevelId);
        if (level) {
          const levelName = level.name.toLowerCase();
          if (levelName.includes('低') || levelName.includes('low')) {
            byLevel.low++;
          } else if (levelName.includes('高') || levelName.includes('high')) {
            byLevel.high++;
          } else {
            byLevel.medium++;
          }
        }
      }
    });
    
    // 更新统计卡片
    const dashPatients = document.getElementById('dash-patients');
    const dashAssessments = document.getElementById('dash-assessments');
    const dashDoctors = document.getElementById('dash-doctors');
    
    if (dashPatients) dashPatients.textContent = patients.length;
    if (dashAssessments) dashAssessments.textContent = assessments.length;
    if (dashDoctors) {
      // 只有管理员才调用 /api/admin/users
      if (me && me.role === 'admin') {
        try {
          const users = await api('/api/admin/users');
          dashDoctors.textContent = users.length;
        } catch (e) {
          console.error('获取用户列表失败:', e);
          dashDoctors.textContent = '—';
        }
      } else {
        // 非管理员只显示自己
        dashDoctors.textContent = '1';
      }
    }
    
    // 更新分级徽章
    const dashLow = document.getElementById('dash-low');
    const dashMed = document.getElementById('dash-med');
    const dashHigh = document.getElementById('dash-high');
    
    if (dashLow) dashLow.textContent = byLevel.low ?? 0;
    if (dashMed) dashMed.textContent = byLevel.medium ?? 0;
    if (dashHigh) dashHigh.textContent = byLevel.high ?? 0;
    
    // 计算逾期和即将到期列表
    const overdueList = [];
    const dueSoonList = [];
    
    patients.forEach(p => {
      if (p.nextAssessmentDue) {
        const dueDate = new Date(p.nextAssessmentDue);
        if (dueDate < now) {
          const latestAssessment = assessments
            .filter(a => a.patientId === p.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
          overdueList.push({
            patient: p,
            dueAt: p.nextAssessmentDue,
            assessment: latestAssessment
          });
        } else if (dueDate <= sevenDaysLater) {
          const latestAssessment = assessments
            .filter(a => a.patientId === p.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
          dueSoonList.push({
            patient: p,
            dueAt: p.nextAssessmentDue,
            assessment: latestAssessment
          });
        }
      }
    });
    
    // 更新逾期表格
    const ov = document.getElementById('dash-overdue-body');
    if (ov) {
      ov.innerHTML = '';
      
      if (!overdueList || !overdueList.length) {
        ov.innerHTML = '<tr><td colspan="4" class="empty-hint">暂无逾期未评</td></tr>';
      } else {
        overdueList.forEach(row => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${escapeHtml(row.patient?.name || '—')}</td>
            <td>${escapeHtml(row.patient?.phone || '—')}</td>
            <td class="tag-overdue">${formatDate(row.dueAt)}</td>
            <td><button type="button" class="btn secondary go-score" data-pid="${row.patient?.id || ''}">去评估</button></td>
          `;
          ov.appendChild(tr);
        });
      }
    }
    
    // 更新待评表格
    const ds = document.getElementById('dash-soon-body');
    if (ds) {
      ds.innerHTML = '';
      
      if (!dueSoonList || !dueSoonList.length) {
        ds.innerHTML = '<tr><td colspan="4" class="empty-hint">7日内暂无待评</td></tr>';
      } else {
        dueSoonList.forEach(row => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${escapeHtml(row.patient?.name || '—')}</td>
            <td>${escapeHtml(row.patient?.phone || '—')}</td>
            <td class="tag-soon">${formatDate(row.dueAt)}</td>
            <td><button type="button" class="btn secondary go-score" data-pid="${row.patient?.id || ''}">去评估</button></td>
          `;
          ds.appendChild(tr);
        });
      }
    }
    
    // 绑定"去评估"按钮事件
    const goScore = (e) => {
      const b = e.target.closest('.go-score');
      if (!b) return;
      
      const pid = b.getAttribute('data-pid');
      if (!pid) return;
      
      show('score');
      // 设置选中的患者
      const sInput = document.getElementById('score-patient-search');
      const pIdInput = document.getElementById('score-patient-id');
      const pInfoDiv = document.getElementById('score-patient-info');
      
      // 查找患者信息
      const patient = patients.find(p => p.id === pid);
      if (patient && sInput && pIdInput && pInfoDiv) {
        sInput.value = patient.name;
        pIdInput.value = patient.id;
        pInfoDiv.textContent = `已选择：${patient.name}，${patient.gender || '未知性别'}，${patient.phone || '无电话'}`;
      }
      
      initScoreView();
      loadScoreHistory();
    };
    
    const overdueBody = document.getElementById('dash-overdue-body');
    const soonBody = document.getElementById('dash-soon-body');
    if (overdueBody) overdueBody.onclick = goScore;
    if (soonBody) soonBody.onclick = goScore;
    
  } catch (e) {
    console.error('刷新仪表盘失败:', e);
    showMessage('刷新仪表盘失败: ' + e.message, 'error');
  }
}
