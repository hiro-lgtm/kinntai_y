const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const repository = require('./SpreadsheetRepository');

class AuthService {
  // パスワードをハッシュ化
  async hashPassword(plainText) {
    return await bcrypt.hash(plainText, 10);
  }

  // パスワードを検証
  async verifyPassword(plainText, hash) {
    return await bcrypt.compare(plainText, hash);
  }

  // ログイン
  async login(employeeId, password) {
    const employee = await repository.getEmployeeById(employeeId);
    if (!employee) {
      throw new Error('INVALID_CREDENTIALS');
    }

    if (!employee.isActive) {
      throw new Error('ACCOUNT_DISABLED');
    }

    const isValid = await this.verifyPassword(password, employee.passwordHash);
    if (!isValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // JWTトークンを生成
    const token = jwt.sign(
      {
        employeeId: employee.id,
        role: employee.role,
        iat: Math.floor(Date.now() / 1000),
      },
      config.jwtSecret,
      { expiresIn: '30m' }
    );

    return {
      token,
      employee: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
      },
    };
  }

  // トークンを検証
  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwtSecret);
    } catch (error) {
      return null;
    }
  }
}

module.exports = new AuthService();

