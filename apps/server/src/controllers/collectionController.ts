import { Response, Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { auditService } from '../services/auditService.js';
import { orgCollections, CollectionError, CollectionName } from '../services/orgCollections.js';
import { AuthenticatedRequest, UserRole } from '../types/index.js';

const ADMINS = ['admin', 'system-admin'];

/** Who may add and change items in each collection (their own organisation's items only). */
const WRITERS: Record<CollectionName, string[]> = {
  staff: ['hospital-admin', 'hospital'],
  admissions: ['hospital-admin', 'hospital'],
  samples: ['lab'],
  claims: ['insurance'],
  policyholders: ['insurance'],
  organisations: ADMINS
};

/** Patients can see their own admissions, samples and claims. */
const PATIENT_READABLE: CollectionName[] = ['admissions', 'samples', 'claims'];

const LABEL: Record<CollectionName, string> = {
  staff: 'staff member',
  admissions: 'admission',
  samples: 'sample',
  claims: 'claim',
  policyholders: 'policyholder',
  organisations: 'organisation'
};

const fail = (res: Response, err: unknown) => {
  if (err instanceof CollectionError) {
    res.status(err.status).json({ success: false, error: err.message });
    return;
  }
  console.error('[Collections]', err);
  res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
};

export function collectionRouter(name: CollectionName): Router {
  const router = Router();
  const writers = WRITERS[name];
  // admins keep one shared organisation register; everyone else sees only their own organisation's items
  const ownerOf = (req: AuthenticatedRequest) => (name === 'organisations' ? 'register' : String(req.user?.userId));

  router.get('/', authMiddleware(), (req: AuthenticatedRequest, res: Response) => {
    const role = req.user?.role || '';
    res.setHeader('Cache-Control', 'no-store');
    if (writers.includes(role)) {
      res.status(200).json({ success: true, data: orgCollections.list(name, ownerOf(req)) });
      return;
    }
    if (ADMINS.includes(role)) {
      res.status(200).json({ success: true, data: orgCollections.list(name) });
      return;
    }
    if (role === 'patient' && PATIENT_READABLE.includes(name)) {
      res.status(200).json({ success: true, data: orgCollections.forPatient(name, String(req.user?.userId)) });
      return;
    }
    res.status(403).json({ success: false, error: `Your account cannot see ${LABEL[name]} records.` });
  });

  router.post('/', authMiddleware(), async (req: AuthenticatedRequest, res: Response) => {
    if (!writers.includes(req.user?.role || '')) {
      res.status(403).json({ success: false, error: `Your account cannot add ${LABEL[name]} records.` });
      return;
    }
    try {
      const item = orgCollections.create(name, ownerOf(req), req.body);
      await auditService.logEvent({
        patientId: typeof item.patientId === 'string' && item.patientId ? item.patientId : String(req.user?.userId),
        actorId: String(req.user?.userId),
        actorRole: req.user?.role as UserRole,
        action: `${name.toUpperCase()}_CREATED`,
        details: { id: item.id }
      });
      res.status(201).json({ success: true, data: item });
    } catch (err) {
      fail(res, err);
    }
  });

  router.patch('/:id', authMiddleware(), async (req: AuthenticatedRequest, res: Response) => {
    const item = orgCollections.find(name, req.params.id);
    if (!item || (!writers.includes(req.user?.role || '')) || item.orgId !== ownerOf(req)) {
      res.status(item ? 403 : 404).json({ success: false, error: item ? `You cannot change this ${LABEL[name]}.` : 'Not found.' });
      return;
    }
    try {
      const before = item.status;
      const updated = orgCollections.update(name, item, req.body);
      await auditService.logEvent({
        patientId: typeof updated.patientId === 'string' && updated.patientId ? updated.patientId : String(req.user?.userId),
        actorId: String(req.user?.userId),
        actorRole: req.user?.role as UserRole,
        action: `${name.toUpperCase()}_UPDATED`,
        details: { id: updated.id, from: before, to: updated.status }
      });
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      fail(res, err);
    }
  });

  return router;
}
