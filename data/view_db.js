const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 连接到assessments.db数据库
const dbPath = path.join(__dirname, 'assessments.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('连接数据库失败:', err);
    return;
  }
  console.log('成功连接到assessments.db数据库');
  
  // 查看表结构
  db.all('PRAGMA table_info(assessments);', (err, rows) => {
    if (err) {
      console.error('查询表结构失败:', err);
      return;
    }
    console.log('\n表结构:');
    console.table(rows);
    
    // 查看数据
    db.all('SELECT * FROM assessments LIMIT 10;', (err, rows) => {
      if (err) {
        console.error('查询数据失败:', err);
        return;
      }
      console.log('\n数据内容:');
      console.table(rows);
      
      // 关闭数据库连接
      db.close();
    });
  });
});