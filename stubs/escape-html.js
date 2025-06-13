// simple HTML escaping used by tests to mimic escape-html module
module.exports = function escapeHtml(str) {
  return String(str) //ensure string input
    .replace(/&/g, '&amp;') //escape ampersand
    .replace(/</g, '&lt;') //escape less than
    .replace(/>/g, '&gt;') //escape greater than
    .replace(/"/g, '&quot;') //escape double quote
    .replace(/'/g, '&#39;'); //escape single quote
};
