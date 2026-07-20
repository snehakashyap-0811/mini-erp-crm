import { Router } from 'express';
import { z } from 'zod';
import { Prisma, Role, StockMovementType } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError, sendError } from '../utils/errors';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  category: z.string().min(1, 'Category is required'),
  unitPrice: z.number().positive('Unit price must be positive'),
  currentStock: z.number().int().min(0).optional(),
  minStockAlert: z.number().int().min(0),
  location: z.string().min(1, 'Location is required'),
});

const stockMoveSchema = z.object({
  quantity: z.number().int().positive('Quantity must be positive'),
  type: z.nativeEnum(StockMovementType),
  reason: z.string().min(1, 'Reason is required'),
});

router.use(authenticate);

router.get('/', authorize(Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const lowStock = String(req.query.lowStock || '') === 'true';

    const where: Prisma.ProductWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = { equals: category, mode: 'insensitive' };

    let products;
    let total;

    if (lowStock) {
      const all = await prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
      });
      const filtered = all.filter((p) => p.currentStock <= p.minStockAlert);
      total = filtered.length;
      products = filtered.slice((page - 1) * limit, page * limit);
    } else {
      [total, products] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);
    }

    res.json({
      success: true,
      data: products,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/:id', authorize(Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS), async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        stockMoves: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { createdBy: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!product) throw new AppError(404, 'Product not found');
    res.json({ success: true, data: product });
  } catch (err) {
    sendError(res, err);
  }
});

router.post(
  '/',
  authorize(Role.ADMIN, Role.WAREHOUSE),
  validateBody(productSchema),
  async (req: AuthRequest, res) => {
    try {
      const body = req.body as z.infer<typeof productSchema>;
      const existing = await prisma.product.findUnique({ where: { sku: body.sku } });
      if (existing) throw new AppError(409, 'SKU already exists');

      const initialStock = body.currentStock ?? 0;
      const product = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            name: body.name,
            sku: body.sku,
            category: body.category,
            unitPrice: body.unitPrice,
            currentStock: initialStock,
            minStockAlert: body.minStockAlert,
            location: body.location,
          },
        });
        if (initialStock > 0) {
          await tx.stockMovement.create({
            data: {
              productId: created.id,
              quantity: initialStock,
              type: StockMovementType.IN,
              reason: 'Initial stock on product create',
              createdById: req.user!.id,
            },
          });
        }
        return created;
      });

      res.status(201).json({ success: true, data: product });
    } catch (err) {
      sendError(res, err);
    }
  }
);

router.put(
  '/:id',
  authorize(Role.ADMIN, Role.WAREHOUSE),
  validateBody(productSchema.omit({ currentStock: true })),
  async (req, res) => {
    try {
      const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new AppError(404, 'Product not found');

      const body = req.body as Omit<z.infer<typeof productSchema>, 'currentStock'>;
      if (body.sku !== existing.sku) {
        const skuTaken = await prisma.product.findUnique({ where: { sku: body.sku } });
        if (skuTaken) throw new AppError(409, 'SKU already exists');
      }

      const product = await prisma.product.update({
        where: { id: req.params.id },
        data: {
          name: body.name,
          sku: body.sku,
          category: body.category,
          unitPrice: body.unitPrice,
          minStockAlert: body.minStockAlert,
          location: body.location,
        },
      });
      res.json({ success: true, data: product });
    } catch (err) {
      sendError(res, err);
    }
  }
);

router.post(
  '/:id/stock-movements',
  authorize(Role.ADMIN, Role.WAREHOUSE),
  validateBody(stockMoveSchema),
  async (req: AuthRequest, res) => {
    try {
      const { quantity, type, reason } = req.body as z.infer<typeof stockMoveSchema>;

      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { id: req.params.id } });
        if (!product) throw new AppError(404, 'Product not found');

        if (type === StockMovementType.OUT && product.currentStock < quantity) {
          throw new AppError(
            400,
            `Insufficient stock. Available: ${product.currentStock}, requested: ${quantity}`
          );
        }

        const newStock =
          type === StockMovementType.IN
            ? product.currentStock + quantity
            : product.currentStock - quantity;

        const updated = await tx.product.update({
          where: { id: product.id },
          data: { currentStock: newStock },
        });

        const movement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            quantity,
            type,
            reason,
            createdById: req.user!.id,
          },
          include: { createdBy: { select: { id: true, name: true, email: true } } },
        });

        return { product: updated, movement };
      });

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      sendError(res, err);
    }
  }
);

router.get(
  '/:id/stock-movements',
  authorize(Role.ADMIN, Role.SALES, Role.WAREHOUSE, Role.ACCOUNTS),
  async (req, res) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
      const where = { productId: req.params.id };

      const [total, movements] = await Promise.all([
        prisma.stockMovement.count({ where }),
        prisma.stockMovement.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { createdBy: { select: { id: true, name: true, email: true } } },
        }),
      ]);

      res.json({
        success: true,
        data: movements,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      sendError(res, err);
    }
  }
);

export default router;
