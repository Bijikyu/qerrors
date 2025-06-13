// minimal escape-html stub used for tests
module.exports = function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;') //escape < for safety
    .replace(/>/g, '&gt;') //escape > for safety
    .replace(/"/g, '&quot;') //escape " for safety
    .replace(/'/g, '&#39;'); //escape ' for safety
};
