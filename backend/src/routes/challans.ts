import { Router } from 'express';
import { z } from 'zod';
import { ChallanStatus, Prisma, Role, StockMovementType } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError, sendError } from '../utils/errors';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive('Quantity must be positive'),
});

const challanSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  items: z.array(itemSchema).min(1, 'At least one product is required'),
  status: z.enum([ChallanStatus.DRAFT, ChallanStatus.CONFIRMED]).default(ChallanStatus.DRAFT),
});

async function nextChallanNumber(tx: Prisma.TransactionClient) {
  const counter = await tx.challanCounter.upsert({
    where: { id: 1 },
    create: { id: 1, counter: 1 },
    update: { counter: { increment: 1 } },
  });
  const year = new Date().getFullYear();
  return `CH-${year}-${String(counter.counter).padStart(5, '0')}`;
}

router.use(authenticate);

router.get('/', authorize(Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const search = String(req.query.search || '').trim();
    const status = req.query.status as ChallanStatus | undefined;

    const where: Prisma.SalesChallanWhereInput = {};
    if (status && Object.values(ChallanStatus).includes(status)) where.status = status;
    if (search) {
      where.OR = [
        { challanNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { businessName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, challans] = await Promise.all([
      prisma.salesChallan.count({ where }),
      prisma.salesChallan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: { select: { id: true, name: true, businessName: true, mobile: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          items: true,
        },
      }),
    ]);

    res.json({
      success: true,
      data: challans,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/:id', authorize(Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS), async (req, res) => {
  try {
    const challan = await prisma.salesChallan.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        createdBy: { select: { id: true, name: true, email: true } },
        items: true,
      },
    });
    if (!challan) throw new AppError(404, 'Challan not found');
    res.json({ success: true, data: challan });
  } catch (err) {
    sendError(res, err);
  }
});

async function applyStockOut(
  tx: Prisma.TransactionClient,
  items: { productId: string; quantity: number }[],
  userId: string,
  challanNumber: string
) {
  for (const item of items) {
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (!product) throw new AppError(404, `Product not found: ${item.productId}`);
    if (product.currentStock < item.quantity) {
      throw new AppError(
        400,
        `Insufficient stock for ${product.name} (${product.sku}). Available: ${product.currentStock}, requested: ${item.quantity}`
      );
    }
  }

  for (const item of items) {
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (!product) throw new AppError(404, `Product not found: ${item.productId}`);

    await tx.product.update({
      where: { id: product.id },
      data: { currentStock: product.currentStock - item.quantity },
    });

    await tx.stockMovement.create({
      data: {
        productId: product.id,
        quantity: item.quantity,
        type: StockMovementType.OUT,
        reason: `Sales challan ${challanNumber}`,
        createdById: userId,
      },
    });
  }
}

router.post(
  '/',
  authorize(Role.ADMIN, Role.SALES),
  validateBody(challanSchema),
  async (req: AuthRequest, res) => {
    try {
      const body = req.body as z.infer<typeof challanSchema>;

      const customer = await prisma.customer.findUnique({ where: { id: body.customerId } });
      if (!customer) throw new AppError(404, 'Customer not found');

      const productIds = body.items.map((i) => i.productId);
      const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
      if (products.length !== new Set(productIds).size) {
        throw new AppError(400, 'One or more products are invalid');
      }
      const productMap = new Map(products.map((p) => [p.id, p]));

      // Merge duplicate product lines
      const merged = new Map<string, number>();
      for (const item of body.items) {
        merged.set(item.productId, (merged.get(item.productId) || 0) + item.quantity);
      }
      const mergedItems = Array.from(merged.entries()).map(([productId, quantity]) => ({
        productId,
        quantity,
      }));

      const challan = await prisma.$transaction(async (tx) => {
        const challanNumber = await nextChallanNumber(tx);
        const totalQuantity = mergedItems.reduce((sum, i) => sum + i.quantity, 0);

        if (body.status === ChallanStatus.CONFIRMED) {
          await applyStockOut(tx, mergedItems, req.user!.id, challanNumber);
        }

        return tx.salesChallan.create({
          data: {
            challanNumber,
            customerId: body.customerId,
            totalQuantity,
            status: body.status,
            createdById: req.user!.id,
            items: {
              create: mergedItems.map((item) => {
                const p = productMap.get(item.productId)!;
                return {
                  productId: p.id,
                  productName: p.name,
                  sku: p.sku,
                  unitPrice: p.unitPrice,
                  quantity: item.quantity,
                };
              }),
            },
          },
          include: {
            customer: { select: { id: true, name: true, businessName: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            items: true,
          },
        });
      });

      res.status(201).json({ success: true, data: challan });
    } catch (err) {
      sendError(res, err);
    }
  }
);

router.patch(
  '/:id/confirm',
  authorize(Role.ADMIN, Role.SALES),
  async (req: AuthRequest, res) => {
    try {
      const challan = await prisma.$transaction(async (tx) => {
        const existing = await tx.salesChallan.findUnique({
          where: { id: req.params.id },
          include: { items: true },
        });
        if (!existing) throw new AppError(404, 'Challan not found');
        if (existing.status !== ChallanStatus.DRAFT) {
          throw new AppError(400, `Only draft challans can be confirmed. Current status: ${existing.status}`);
        }

        await applyStockOut(
          tx,
          existing.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          req.user!.id,
          existing.challanNumber
        );

        return tx.salesChallan.update({
          where: { id: existing.id },
          data: { status: ChallanStatus.CONFIRMED },
          include: {
            customer: { select: { id: true, name: true, businessName: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            items: true,
          },
        });
      });

      res.json({ success: true, data: challan });
    } catch (err) {
      sendError(res, err);
    }
  }
);

router.patch(
  '/:id/cancel',
  authorize(Role.ADMIN, Role.SALES),
  async (req: AuthRequest, res) => {
    try {
      const challan = await prisma.$transaction(async (tx) => {
        const existing = await tx.salesChallan.findUnique({
          where: { id: req.params.id },
          include: { items: true },
        });
        if (!existing) throw new AppError(404, 'Challan not found');
        if (existing.status === ChallanStatus.CANCELLED) {
          throw new AppError(400, 'Challan is already cancelled');
        }

        // Restock if previously confirmed
        if (existing.status === ChallanStatus.CONFIRMED) {
          for (const item of existing.items) {
            const product = await tx.product.findUnique({ where: { id: item.productId } });
            if (!product) continue;
            await tx.product.update({
              where: { id: product.id },
              data: { currentStock: product.currentStock + item.quantity },
            });
            await tx.stockMovement.create({
              data: {
                productId: product.id,
                quantity: item.quantity,
                type: StockMovementType.IN,
                reason: `Cancelled challan ${existing.challanNumber} — stock restored`,
                createdById: req.user!.id,
              },
            });
          }
        }

        return tx.salesChallan.update({
          where: { id: existing.id },
          data: { status: ChallanStatus.CANCELLED },
          include: {
            customer: { select: { id: true, name: true, businessName: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            items: true,
          },
        });
      });

      res.json({ success: true, data: challan });
    } catch (err) {
      sendError(res, err);
    }
  }
);

export default router;
