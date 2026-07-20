import { Router } from 'express';
import { Role } from '@prisma/client';
import prisma from '../utils/prisma';
import { sendError } from '../utils/errors';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize(Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS));

router.get('/', async (_req, res) => {
  try {
    const [customers, products, lowStock, draftChallans, confirmedChallans, recentChallans] =
      await Promise.all([
        prisma.customer.count(),
        prisma.product.count(),
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint as count FROM "Product" WHERE "currentStock" <= "minStockAlert"
        `,
        prisma.salesChallan.count({ where: { status: 'DRAFT' } }),
        prisma.salesChallan.count({ where: { status: 'CONFIRMED' } }),
        prisma.salesChallan.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { name: true, businessName: true } },
          },
        }),
      ]);

    res.json({
      success: true,
      data: {
        totals: {
          customers,
          products,
          lowStock: Number(lowStock[0]?.count || 0),
          draftChallans,
          confirmedChallans,
        },
        recentChallans,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
