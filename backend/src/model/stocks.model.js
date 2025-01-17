const { Stock, sequelize } = require('../../models/index');
const { mul } = require('../utils/arithmetic');
const usersModel = require('./users.model');

const HIGH = '100';
const LOW = '50';
const OPEN = '75';
const CLOSE = '75';
const LOW_HOUR = 12;
const HIGH_HOUR = 16;

const defaultAttributes = ['id', 'ownerId', 'companyId'];

async function getStocksByAttribute(key, value) {
  if (Object.keys(Stock.rawAttributes).find((k) => k === key)) {
    const result = await Stock.findAll({
      attributes: defaultAttributes,
      where: {
        [key]: [value],
      },
    });
    if (result.length === 0) throw new Error('Not Found.');
    return result;
  }
  throw new Error('Invalid key.');
}

async function getStocks() {
  const results = await Stock.findAll({ attributes: defaultAttributes });
  return results;
}

async function getStocksBy(attribute) {
  const group = (attribute === 'ownerId') ? ['ownerId', 'companyId'] : ['companyId', 'ownerId'];
  const attributes = [...group, [sequelize.fn('COUNT', attribute), 'owned']];
  const results = await Stock.findAll({
    group,
    attributes,
    order: [attribute],
  });
  return results;
}

async function getStocksByOwner() {
  const results = await getStocksBy('ownerId');
  return results;
}
async function getStocksByCompany() {
  const results = await getStocksBy('companyId');
  return results;
}

async function getStocksFromOwner(id) {
  const groupedStocks = await getStocksByOwner();
  return groupedStocks.filter(({ ownerId }) => ownerId === id);
}

async function getStocksFromCompany(id) {
  const groupedStocks = await getStocksByCompany();
  return groupedStocks.filter(({ companyId }) => companyId === id);
}

async function getTotalStocksFromOwner(id) {
  const ownedStocks = await getStocksFromOwner(id);
  return Number(ownedStocks.reduce((value, { owned }) => value + owned, 0));
}
async function getTotalStocksFromCompany(id) {
  const ownedStocks = await getStocksFromCompany(id);
  return Number(ownedStocks.reduce((value, { owned }) => value + owned, 0));
}

async function transferOwnership({
  sellerId, buyerId, cId, qty, getStockPrice,
}) {
  const owned = (await getStocksFromOwner(sellerId));
  const ownedSeller = owned.filter(({ companyId }) => companyId === cId);
  if (sellerId === buyerId) throw new Error('SellerId and buyerId can\'t be equal.');
  if (ownedSeller.length < 1 || ownedSeller[0].owned < qty) throw new Error('Not enough stock to sell.');
  let price = await getStockPrice({ key: 'id', value: cId });

  price = mul(price.stockPrice, qty);
  await usersModel.transferFunds(buyerId, sellerId, price);

  const stockList = await getStocksByAttribute('ownerId', sellerId);
  const stocksToSell = stockList.filter(({ companyId }) => companyId === cId);

  const promiseList = [];

  for (let i = 0; i < qty; i += 1) {
    promiseList.push(
      Stock.upsert({
        id: stocksToSell[i].id,
        ownerId: buyerId,
        companyId: stocksToSell[i].companyId,
      }),
    );
  }
  await Promise.all(promiseList);
  return { message: 'Stocks succesfully transferred.' };
}

module.exports = {
  getStocks,
  getStocksByAttribute,
  getStocksByOwner,
  getStocksByCompany,
  getStocksFromCompany,
  getStocksFromOwner,
  getTotalStocksFromOwner,
  getTotalStocksFromCompany,
  transferOwnership,
  HIGH,
  LOW,
  CLOSE,
  OPEN,
  LOW_HOUR,
  HIGH_HOUR,
};
