// Optional local development database. Runs a real mongod with persistent storage.
// Production should use a separately managed MongoDB server or MongoDB Atlas.
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const fs = require('fs/promises');
(async () => {
  const dbPath = path.resolve(__dirname, '../.mongo-data');
  await fs.mkdir(dbPath, { recursive: true });
  const mongo = await MongoMemoryServer.create({ instance: { port: 27017, dbPath, storageEngine: 'wiredTiger', dbName: 'smartloan_ai' } });
  const uri = mongo.getUri('smartloan_ai');
  if (!uri.includes(':27017/')) { await mongo.stop(); throw new Error('Port 27017 is occupied. Use the existing MongoDB instance or change MONGO_URI.'); }
  console.log('Development MongoDB: mongodb://127.0.0.1:27017/smartloan_ai');
  console.log('Data is persisted in backend/.mongo-data. Keep this process running.');
  const stop = async () => { await mongo.stop({ doCleanup: false }); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})().catch(e => { console.error(e.message); process.exit(1); });
