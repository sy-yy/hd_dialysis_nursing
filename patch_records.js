const fs = require('fs');
let c = fs.readFileSync('public/app.js', 'utf8');

const oldFn = `async function refreshRecords() {
  const searchValue = document.getElementById('records-search')?.value?.toLowerCase() || '';
  const levelFilter = document.getElementById('records-filter-level')?.value || '';

  try {
    const assessments = await api('/api/assessments');
    const patients = await api('/api/patients');
    const rubric = await loadRubric();

    const patientMap = {};
    patients.forEach(p => patientMap[p.id] = p);

    let filtered = assessments.map(a => {
      const patient = patientMap[a.patientId] || {};
      const level = rubric.levelRules.find(l => a.totalScore >= l.minScore && a.totalScore <= (l.maxScore || 999)) || {};
      return {
        ...a,
        patientName: patient.name || '未知',
        patientGender: patient.gender || '—',
        patientBirthDate: patient.birthDate || '',
        doctorName: a.doctorName || '未知',
        levelName: level.name || '未知',
        levelId: level.id || ''
      };
    });

    if (searchValue) {
      filtered = filtered.filter(r => {
        const patient = patientMap[r.patientId] || { name: '' };
        return matchPatient(searchValue, patient);
      });
    }
    if (levelFilter) {
      filtered = filtered.filter(r => r.levelId === levelFilter);
    }

    filtered.sort((a, b) => new Date(b.assessedAt) - new Date(a.assessedAt));

    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / recordsPageSize);
    const start = (recordsPage - 1) * recordsPageSize;
    const pageData = filtered.slice(start, start + recordsPageSize);

    const tbody = document.getElementById('records-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!pageData.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-hint">暂无评估记录</td></tr>';
    } else {
      pageData.forEach((r) => {
        const age = r.patientBirthDate ? calculateAge(r.patientBirthDate) : '—';
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${escapeHtml(r.patientName)}</td>
          <td>\${escapeHtml(r.patientGender)}</td>
          <td>\${age}</td>
          <td>\${formatDate(r.assessedAt)}</td>
          <td>\${r.totalScore}</td>
          <td>\${escapeHtml(r.levelName)}</td>
          <td>\${escapeHtml(r.doctorName)}</td>
          <td><button type="button" class="btn secondary" onclick="viewAssessment(\${r.id})">查看</button></td>
        \`;
        tbody.appendChild(tr);
      });
    }

    renderRecordsPagination(totalPages);

  } catch (e) {
    console.error('加载评估记录失败:', e);
  }
}`;

const newFn = `async function refreshRecords() {
  const searchValue = document.getElementById('records-search')?.value?.toLowerCase() || '';
  const levelFilter = document.getElementById('records-filter-level')?.value || '';

  // 判断是否有删除权限
  const canDelete = me && (me.role === 'admin' || (me.permissions && me.permissions.deleteRecords));

  // 控制复选框列和批量删除按钮的显示
  const checkCol = document.getElementById('records-check-col');
  const batchDeleteBtn = document.getElementById('btn-batch-delete-records');
  if (checkCol) checkCol.style.display = canDelete ? '' : 'none';
  if (batchDeleteBtn) batchDeleteBtn.style.display = 'none';

  try {
    const assessments = await api('/api/assessments');
    const patients = await api('/api/patients');
    const rubric = await loadRubric();

    const patientMap = {};
    patients.forEach(p => patientMap[p.id] = p);

    let filtered = assessments.map(a => {
      const patient = patientMap[a.patientId] || {};
      const level = rubric.levelRules.find(l => a.totalScore >= l.minScore && a.totalScore <= (l.maxScore || 999)) || {};
      return {
        ...a,
        patientName: patient.name || '未知',
        patientGender: patient.gender || '—',
        patientBirthDate: patient.birthDate || '',
        doctorName: a.doctorName || '未知',
        levelName: level.name || '未知',
        levelId: level.id || ''
      };
    });

    if (searchValue) {
      filtered = filtered.filter(r => {
        const patient = patientMap[r.patientId] || { name: '' };
        return matchPatient(searchValue, patient);
      });
    }
    if (levelFilter) {
      filtered = filtered.filter(r => r.levelId === levelFilter);
    }

    filtered.sort((a, b) => new Date(b.assessedAt) - new Date(a.assessedAt));

    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / recordsPageSize);
    const start = (recordsPage - 1) * recordsPageSize;
    const pageData = filtered.slice(start, start + recordsPageSize);

    const tbody = document.getElementById('records-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!pageData.length) {
      const colspan = canDelete ? 9 : 8;
      tbody.innerHTML = '<tr><td colspan="' + colspan + '" class="empty-hint">暂无评估记录</td></tr>';
    } else {
      pageData.forEach((r) => {
        const age = r.patientBirthDate ? calculateAge(r.patientBirthDate) : '—';
        const tr = document.createElement('tr');
        let checkCell = '';
        if (canDelete) {
          checkCell = '<td><input type="checkbox" class="record-check" data-id="' + r.id + '"></td>';
        }
        const deleteBtn = canDelete
          ? ' <button type="button" class="btn danger" style="padding:4px 10px;font-size:0.8rem;" onclick="deleteAssessmentRecord(' + r.id + ')">删除</button>'
          : '';
        tr.innerHTML = checkCell +
          '<td>' + escapeHtml(r.patientName) + '</td>' +
          '<td>' + escapeHtml(r.patientGender) + '</td>' +
          '<td>' + age + '</td>' +
          '<td>' + formatDate(r.assessedAt) + '</td>' +
          '<td>' + r.totalScore + '</td>' +
          '<td>' + escapeHtml(r.levelName) + '</td>' +
          '<td>' + escapeHtml(r.doctorName) + '</td>' +
          '<td><button type="button" class="btn secondary" onclick="viewAssessment(' + r.id + ')">查看</button>' + deleteBtn + '</td>';
        tbody.appendChild(tr);
      });

      if (canDelete) {
        updateBatchDeleteBtn();
        tbody.querySelectorAll('.record-check').forEach(cb => {
          cb.addEventListener('change', updateBatchDeleteBtn);
        });
      }
    }

    const checkAll = document.getElementById('records-check-all');
    if (checkAll) {
      checkAll.checked = false;
      checkAll.onchange = function() {
        document.querySelectorAll('.record-check').forEach(cb => cb.checked = this.checked);
        updateBatchDeleteBtn();
      };
    }

    renderRecordsPagination(totalPages);

  } catch (e) {
    console.error('加载评估记录失败:', e);
  }
}

function updateBatchDeleteBtn() {
  const checked = document.querySelectorAll('.record-check:checked').length;
  const btn = document.getElementById('btn-batch-delete-records');
  if (btn) {
    btn.style.display = checked > 0 ? '' : 'none';
    btn.textContent = '批量删除（已选 ' + checked + ' 条）';
  }
}

window.deleteAssessmentRecord = async function(id) {
  if (!confirm('确定删除该评估记录？此操作不可恢复。')) return;
  try {
    await api('/api/assessments/' + id, { method: 'DELETE' });
    await refreshRecords();
    refreshDashboard();
  } catch (e) {
    alert('删除失败：' + e.message);
  }
};`;

if (c.includes(oldFn)) {
  c = c.replace(oldFn, newFn);
  fs.writeFileSync('public/app.js', c, 'utf8');
  console.log('SUCCESS: refreshRecords replaced');
} else {
  console.error('ERROR: target function not found exactly');
  // Try to find partial match
  const idx = c.indexOf('async function refreshRecords()');
  console.log('Found at index:', idx);
}
