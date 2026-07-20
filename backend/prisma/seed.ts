import bcrypt from 'bcryptjs';
import { PrismaClient, Role, CustomerType, CustomerStatus, StockMovementType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  await prisma.challanItem.deleteMany();
  await prisma.salesChallan.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.followUpNote.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.challanCounter.deleteMany();

  const password = await bcrypt.hash('Password@123', 10);

  const [admin, sales, warehouse, accounts] = await Promise.all([
    prisma.user.create({
      data: { email: 'admin@erp.local', password, name: 'Admin User', role: Role.ADMIN },
    }),
    prisma.user.create({
      data: { email: 'sales@erp.local', password, name: 'Sales User', role: Role.SALES },
    }),
    prisma.user.create({
      data: { email: 'warehouse@erp.local', password, name: 'Warehouse User', role: Role.WAREHOUSE },
    }),
    prisma.user.create({
      data: { email: 'accounts@erp.local', password, name: 'Accounts User', role: Role.ACCOUNTS },
    }),
  ]);

  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: 'Ravi Sharma',
        mobile: '9876543210',
        email: 'ravi@acme.in',
        businessName: 'Acme Traders',
        gstNumber: '27AAAAA0000A1Z5',
        customerType: CustomerType.WHOLESALE,
        address: '12 Market Road, Pune',
        status: CustomerStatus.ACTIVE,
        followUpDate: new Date(Date.now() + 7 * 86400000),
        notes: 'Prefers weekly delivery',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Priya Nair',
        mobile: '9123456780',
        email: 'priya@retailhub.in',
        businessName: 'Retail Hub',
        customerType: CustomerType.RETAIL,
        address: '88 MG Road, Bangalore',
        status: CustomerStatus.LEAD,
        followUpDate: new Date(Date.now() + 2 * 86400000),
        notes: 'Interested in bulk snacks',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Imran Khan',
        mobile: '9988776655',
        email: 'imran@distco.in',
        businessName: 'DistCo India',
        gstNumber: '29BBBBB1111B1Z2',
        customerType: CustomerType.DISTRIBUTOR,
        address: 'Warehouse Complex, Hyderabad',
        status: CustomerStatus.ACTIVE,
        notes: 'Pan-India distributor',
      },
    }),
  ]);

  await prisma.followUpNote.create({
    data: {
      customerId: customers[1].id,
      note: 'Called — will decide next week',
      createdById: sales.id,
    },
  });

  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Basmati Rice 25kg',
        sku: 'RICE-25',
        category: 'Grains',
        unitPrice: 1800,
        currentStock: 120,
        minStockAlert: 20,
        location: 'Warehouse A - Rack 1',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Sunflower Oil 15L',
        sku: 'OIL-15',
        category: 'Oils',
        unitPrice: 2200,
        currentStock: 45,
        minStockAlert: 15,
        location: 'Warehouse A - Rack 4',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Toor Dal 50kg',
        sku: 'DAL-50',
        category: 'Pulses',
        unitPrice: 4500,
        currentStock: 8,
        minStockAlert: 10,
        location: 'Warehouse B - Rack 2',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Sugar 50kg',
        sku: 'SUG-50',
        category: 'Sweeteners',
        unitPrice: 2100,
        currentStock: 60,
        minStockAlert: 15,
        location: 'Warehouse B - Rack 5',
      },
    }),
  ]);

  for (const p of products) {
    await prisma.stockMovement.create({
      data: {
        productId: p.id,
        quantity: p.currentStock,
        type: StockMovementType.IN,
        reason: 'Opening stock',
        createdById: warehouse.id,
      },
    });
  }

  await prisma.challanCounter.create({ data: { id: 1, counter: 0 } });

  console.log('Seed complete.');
  console.log('Login credentials (password for all: Password@123):');
  console.log(`  Admin:     ${admin.email}`);
  console.log(`  Sales:     ${sales.email}`);
  console.log(`  Warehouse: ${warehouse.email}`);
  console.log(`  Accounts:  ${accounts.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
