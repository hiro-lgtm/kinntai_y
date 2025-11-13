require('dotenv').config();
const bcrypt = require('bcryptjs');
const sheetsService = require('../services/GoogleSheetsService');
const config = require('../config');

async function seedUsers() {
  try {
    console.log('サンプルユーザーを作成しています...');

    // Employeesシートのデータを取得
    const data = await sheetsService.getSheetData('Employees');
    
    if (data.length < 1) {
      console.error('Employeesシートが見つかりません。先にシートを作成してください。');
      return;
    }

    const headers = data[0];
    const indexMap = sheetsService.buildIndexMap(headers);
    
    // 必要なカラムの確認（小文字でチェック）
    const requiredColumns = ['employee_id', 'name', 'role', 'password_hash', 'is_active'];
    const missingColumns = requiredColumns.filter(col => indexMap[col] === undefined);
    
    if (missingColumns.length > 0) {
      console.error('必要なカラムがありません:', missingColumns.join(', '));
      console.log('現在のヘッダー:', headers);
      console.log('IndexMapのキー:', Object.keys(indexMap));
      return;
    }

    // 既存のemployee_idを取得
    const existingIds = new Set();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const id = row[indexMap['employee_id']];
      if (id) {
        existingIds.add(id);
      }
    }

    // サンプルユーザーの定義
    const sampleUsers = [
      {
        employee_id: 'E001',
        name: 'テスト太郎',
        role: 'employee',
        department: '営業部',
        email: 'taro@example.com',
        password: 'test123',
        is_active: true,
      },
      {
        employee_id: 'E002',
        name: 'テスト花子',
        role: 'employee',
        department: '開発部',
        email: 'hanako@example.com',
        password: 'test123',
        is_active: true,
      },
      {
        employee_id: 'ADMIN01',
        name: '管理者一郎',
        role: 'admin',
        department: '管理部',
        email: 'admin@example.com',
        password: 'admin123',
        is_active: true,
      },
    ];

    // パスワードハッシュを生成してユーザーを追加
    const now = new Date().toISOString();
    let addedCount = 0;

    for (const user of sampleUsers) {
      // 既に存在する場合はスキップ
      if (existingIds.has(user.employee_id)) {
        console.log(`ユーザー ${user.employee_id} は既に存在します。スキップします。`);
        continue;
      }

      // パスワードハッシュを生成
      const passwordHash = await bcrypt.hash(user.password, 10);

      // 行データを構築（ヘッダーの順序に合わせる）
      const row = [];
      headers.forEach(header => {
        const key = String(header).trim().toLowerCase();
        switch (key) {
          case 'employee_id':
            row.push(user.employee_id);
            break;
          case 'name':
            row.push(user.name);
            break;
          case 'role':
            row.push(user.role);
            break;
          case 'department':
            row.push(user.department || '');
            break;
          case 'email':
            row.push(user.email || '');
            break;
          case 'password_hash':
            row.push(passwordHash);
            break;
          case 'is_active':
            row.push(user.is_active ? 'TRUE' : 'FALSE');
            break;
          case 'created_at':
            row.push(now);
            break;
          case 'updated_at':
            row.push(now);
            break;
          default:
            row.push('');
        }
      });

      // シートに追加
      await sheetsService.appendRow('Employees', row);
      console.log(`✓ ユーザーを作成しました: ${user.employee_id} (${user.name}) - パスワード: ${user.password}`);
      addedCount++;
    }

    console.log(`\n完了: ${addedCount} 人のユーザーを追加しました。`);
    console.log('\nログイン情報:');
    console.log('---');
    sampleUsers.forEach(user => {
      if (!existingIds.has(user.employee_id)) {
        console.log(`社員ID: ${user.employee_id}`);
        console.log(`パスワード: ${user.password}`);
        console.log(`役割: ${user.role}`);
        console.log('---');
      }
    });

  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  }
}

// 実行
seedUsers()
  .then(() => {
    console.log('\n処理が完了しました。');
    process.exit(0);
  })
  .catch(error => {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  });

