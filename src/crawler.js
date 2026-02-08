const axios = require('axios');
const Utils = require('./utils');

/**
 * 股市資料爬蟲組件 (Node.js 版)
 */
const Crawler = {
    /**
     * 抓取日成交資料
     * @param {string} symbol 股票代號
     * @param {string} date 日期 (YYYYMMDD)
     */
    fetchDailyPrice: async (symbol, date) => {
        try {
            const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${date}&stockNo=${symbol}`;

            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (response.status !== 200) {
                throw new Error(`API 請求失敗: ${response.status}`);
            }

            const json = response.data;

            if (json.stat !== 'OK' || !json.data) {
                return { success: false, message: '查無資料或該日期非交易日' };
            }

            // 取得最後一筆符合該日期的資料
            const dailyData = json.data.find(row => {
                const parts = row[0].split('/');
                const formattedDate = `${parseInt(parts[0]) + 1911}${parts[1]}${parts[2]}`;
                return formattedDate === date;
            });

            if (!dailyData) {
                return { success: false, message: '在當月資料中找不到指定日期的數據' };
            }

            return {
                success: true,
                data: {
                    symbol: symbol,
                    date: date,
                    volume: Utils.parseNum(dailyData[1]),
                    turnover: Utils.parseNum(dailyData[2]),
                    open: Utils.parseNum(dailyData[3]),
                    high: Utils.parseNum(dailyData[4]),
                    low: Utils.parseNum(dailyData[5]),
                    close: Utils.parseNum(dailyData[6]),
                    change: dailyData[7],
                    transactions: Utils.parseNum(dailyData[8])
                }
            };

        } catch (e) {
            return { success: false, error: e.message || e.toString() };
        }
    },

    /**
     * 抓取全市場三大法人買賣超 (T86)
     * @param {string} date YYYYMMDD
     */
    fetchInstitutionalData: async (date) => {
        try {
            const url = `https://www.twse.com.tw/fund/T86?response=json&date=${date}&selectType=ALLBUT0999`;
            const response = await axios.get(url, { timeout: 15000 });
            const json = response.data;
            if (json.stat !== 'OK' || !json.data) return {};

            const map = {};
            json.data.forEach(row => {
                const symbol = row[0].trim();
                map[symbol] = {
                    foreign_net: Utils.parseNum(row[4]), // 外資買賣超
                    trust_net: Utils.parseNum(row[10]),  // 投信買賣超
                    dealer_net: Utils.parseNum(row[11])  // 自營商買賣超 (合計)
                };
            });
            return map;
        } catch (e) {
            console.error(`Institutional fetch error: ${e.message}`);
            return {};
        }
    },

    /**
     * 抓取全市場融資融券 (MI_MARGN)
     * @param {string} date YYYYMMDD
     */
    fetchMarginData: async (date) => {
        try {
            const url = `https://www.twse.com.tw/exchangeReport/MI_MARGN?response=json&date=${date}&selectType=ALL`;
            const response = await axios.get(url, { timeout: 15000 });
            const json = response.data;
            let data = null;

            // 如果有 tables 陣列 (TWSE 新格式)，遍歷尋找目標表格
            if (json.tables && Array.isArray(json.tables)) {
                const targetTable = json.tables.find(t => t.title && t.title.includes('融資融券彙總'));
                if (targetTable) {
                    data = targetTable.data;
                    console.log(`Found target table in json.tables: ${targetTable.title}`);
                }
            }

            // 備援方案：舊格式 (data, data7, data8)
            if (!data) data = json.data || json.data7 || json.data8;
            if (json.stat !== 'OK' || !data) return {};

            const map = {};
            data.forEach(row => {
                const symbol = row[0].trim();
                map[symbol] = {
                    margin_balance: Utils.parseNum(row[6]), // 融資今日餘額
                    short_balance: Utils.parseNum(row[12])  // 融券今日餘額
                };
            });
            return map;
        } catch (e) {
            console.error(`Margin fetch error: ${e.message}`);
            return {};
        }
    }
};

module.exports = Crawler;
