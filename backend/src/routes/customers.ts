import { Router } from 'express';
import { z } from 'zod';
import { CustomerStatus, CustomerType, Prisma, Role } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError, sendError } from '../utils/errors';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  mobile: z.string().min(5, 'Mobile number is required'),
  email: z.string().email('Valid email is required'),
  businessName: z.string().min(1, 'Business name is required'),
  gstNumber: z.string().optional().nullable(),
  customerType: z.nativeEnum(CustomerType),
  address: z.string().min(1, 'Address is required'),
  status: z.nativeEnum(CustomerStatus).optional(),
  followUpDate: z.string().datetime().optional().nullable().or(z.string().optional().nullable()),
  notes: z.string().optional().nullable(),
});

const followUpSchema = z.object({
  note: z.string().min(1, 'Follow-up note is required'),
  followUpDate: z.string().optional().nullable(),
});

router.use(authenticate);

router.get('/', authorize(Role.ADMIN, Role.SALES, Role.ACCOUNTS), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const search = String(req.query.search || '').trim();
    const status = req.query.status as CustomerStatus | undefined;
    const customerType = req.query.customerType as CustomerType | undefined;

    const where: Prisma.CustomerWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { businessName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status && Object.values(CustomerStatus).includes(status)) where.status = status;
    if (customerType && Object.values(CustomerType).includes(customerType)) {
      where.customerType = customerType;
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({
      success: true,
      data: customers,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/:id', authorize(Role.ADMIN, Role.SALES, Role.ACCOUNTS), async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        followUps: {
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: { id: true, name: true, email: true } } },
        },
        challans: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            challanNumber: true,
            status: true,
            totalQuantity: true,
            createdAt: true,
          },
        },
      },
    });
    if (!customer) throw new AppError(404, 'Customer not found');
    res.json({ success: true, data: customer });
  } catch (err) {
    sendError(res, err);
  }
});

router.post(
  '/',
  authorize(Role.ADMIN, Role.SALES),
  validateBody(customerSchema),
  async (req, res) => {
    try {
      const body = req.body as z.infer<typeof customerSchema>;
      const customer = await prisma.customer.create({
        data: {
          ...body,
          gstNumber: body.gstNumber || null,
          notes: body.notes || null,
          followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
          status: body.status || CustomerStatus.LEAD,
        },
      });
      res.status(201).json({ success: true, data: customer });
    } catch (err) {
      sendError(res, err);
    }
  }
);

router.put(
  '/:id',
  authorize(Role.ADMIN, Role.SALES),
  validateBody(customerSchema),
  async (req, res) => {
    try {
      const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new AppError(404, 'Customer not found');

      const body = req.body as z.infer<typeof customerSchema>;
      const customer = await prisma.customer.update({
        where: { id: req.params.id },
        data: {
          ...body,
          gstNumber: body.gstNumber || null,
          notes: body.notes || null,
          followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
        },
      });
      res.json({ success: true, data: customer });
    } catch (err) {
      sendError(res, err);
    }
  }
);

router.post(
  '/:id/follow-ups',
  authorize(Role.ADMIN, Role.SALES),
  validateBody(followUpSchema),
  async (req: AuthRequest, res) => {
    try {
      const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
      if (!customer) throw new AppError(404, 'Customer not found');

      const { note, followUpDate } = req.body as z.infer<typeof followUpSchema>;

      const [followUp] = await prisma.$transaction([
        prisma.followUpNote.create({
          data: {
            customerId: customer.id,
            note,
            createdById: req.user!.id,
          },
          include: { createdBy: { select: { id: true, name: true, email: true } } },
        }),
        prisma.customer.update({
          where: { id: customer.id },
          data: {
            notes: note,
            ...(followUpDate ? { followUpDate: new Date(followUpDate) } : {}),
          },
        }),
      ]);

      res.status(201).json({ success: true, data: followUp });
    } catch (err) {
      sendError(res, err);
    }
  }
);

export default router;
