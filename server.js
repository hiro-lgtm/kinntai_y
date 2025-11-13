const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const app = express();

// ミドルウェア
app.use(cors());
app.use(express.json());

// APIルート（静的ファイルより先に定義）
app.use('/api/auth', require('./routes/auth'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/admin', require('./routes/admin'));

// 静的ファイル（APIルートの後に定義）
app.use(express.static(path.join(__dirname, 'public')));

// フロントエンドのルーティング（SPA用）
// API ルート以外の GET リクエストを index.html に送る
app.get('*', (req, res, next) => {
  // API ルートは除外
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('エラー:', err);
  res.status(500).json({
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: 'サーバーエラーが発生しました',
  });
});

// サーバー起動
const PORT = config.port;
const HOST = process.env.HOST || '0.0.0.0'; // すべてのネットワークインターフェースでリッスン

// IPアドレスを取得する関数
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'YOUR_IP';
}

app.listen(PORT, HOST, () => {
  const localIP = getLocalIP();
  console.log(`サーバーがポート ${PORT} で起動しました`);
  console.log(`ローカルアクセス: http://localhost:${PORT}`);
  console.log(`ネットワークアクセス: http://${localIP}:${PORT}`);
  console.log(`\n📱 スマホからアクセスするには:`);
  console.log(`1. PCとスマホを同じWi-Fiネットワークに接続`);
  console.log(`2. スマホのブラウザで http://${localIP}:${PORT} にアクセス`);
});

