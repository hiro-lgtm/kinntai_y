/**
 * 共通ユーティリティ。
 */
const UtilitiesService = (() => {
  function hashPassword(plainText) {
    if (!plainText) {
      throw new Error('Password required');
    }
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      plainText
    );
    return Utilities.base64Encode(digest);
  }

  function compareHash(plainText, hashed) {
    if (!plainText || !hashed) {
      return false;
    }
    return hashPassword(plainText) === hashed;
  }

  return {
    hashPassword,
    compareHash
  };
})();

