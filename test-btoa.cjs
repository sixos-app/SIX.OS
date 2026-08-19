function toBase64(value) {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary)
}
const crypto = require('crypto');
const salt = crypto.randomBytes(16);
const derivedBits = crypto.pbkdf2Sync('123456789012', salt, 100000, 32, 'sha256');
console.log(toBase64(derivedBits));
