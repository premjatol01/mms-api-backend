require('dotenv').config();
const mongoose = require('mongoose');
const { seedDatabase } = require('../utils/seedDatabase');

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected! Seeding dummy data...');
  
  const summary = await seedDatabase({ reset: true });
  console.log('====================================');
  console.log('SEED COMPLETED SUCCESSFULLY!');
  console.log('====================================');
  console.log(JSON.stringify(summary, null, 2));
  console.log('====================================');
  console.log('Super Admin Login:');
  console.log('  Email:    admin@tablly.com');
  console.log('  Password: Admin@1234');
  console.log('------------------------------------');
  console.log('Restaurant Admin Login:');
  console.log('  Email:    admin@urbancafe.com');
  console.log('  Password: Password@1234');
  console.log('  Subdomain: urbancafe');
  console.log('  Customer QR Menu: http://urbancafe.localhost:3000/menu/Table 01');
  console.log('====================================');
  
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
