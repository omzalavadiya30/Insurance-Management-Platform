const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const BCRYPT_ROUNDS = 12;

const createOpaqueToken = (bytes = 48) =>
  crypto.randomBytes(bytes).toString("base64url");

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const hashPassword = async (password) => ({
  passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
});

const verifyPassword = (password, passwordHash) =>
  bcrypt.compare(password, passwordHash);

module.exports = {
  createOpaqueToken,
  hashPassword,
  hashToken,
  verifyPassword,
};
