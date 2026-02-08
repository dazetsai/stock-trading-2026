/**
 * 通用工具組件 (Node.js 版)
 */
const Utils = {
  /**
   * 格式化日期為 YYYYMMDD
   * @param {Date} date 
   */
  formatDate: (date) => {
    const y = date.getFullYear();
    const m = ('0' + (date.getMonth() + 1)).slice(-2);
    const d = ('0' + date.getDate()).slice(-2);
    return `${y}${m}${d}`;
  },

  /**
   * 清理數據中的逗號並轉換為數字
   * @param {string} str 
   */
  parseNum: (str) => {
    if (!str || str === '--') return 0;
    if (typeof str === 'number') return str;
    return parseFloat(str.replace(/,/g, ''));
  },

  /**
   * 判斷代碼是否為上市 (TWSE)
   */
  isTWSE: (symbol) => {
    return symbol.length === 4; 
  }
};

module.exports = Utils;
