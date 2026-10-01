import { z } from 'zod';

/**
 * Password policy: 8–72 characters (bcrypt only reads the first 72 bytes),
 * with at least one letter and one number.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(72, 'Password must be at most 72 characters long.')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

const emailSchema = z.string().trim().email('Please enter a valid email address.').max(254);
const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters.').max(100);

/** Roles anyone may sign up for from the public registration pages. */
export const PUBLIC_SIGNUP_ROLES = ['patient', 'doctor'] as const;

/** Roles only an administrator may create (organisations and other administrators). */
export const ALL_ROLES = ['patient', 'doctor', 'hospital-admin', 'hospital', 'lab', 'insurance', 'admin', 'system-admin'] as const;

export const registerUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(PUBLIC_SIGNUP_ROLES, {
    errorMap: () => ({
      message: 'Only patient and doctor accounts can be self-registered. Organisation accounts are created by an administrator.'
    })
  }),
  name: nameSchema,
  phone: z.string().trim().max(20).optional(),
  walletAddress: z.string().optional()
});

export const adminCreateUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(ALL_ROLES),
  name: nameSchema,
  phone: z.string().trim().max(20).optional()
});

export const loginUserSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.').max(200)
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Please enter your current password.'),
    newPassword: passwordSchema
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'The new password must be different from the current one.',
    path: ['newPassword']
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'Invalid or expired reset link.').max(200),
  newPassword: passwordSchema
});

export const registerPatientSchema = z.object({
  name: z.string().min(2, 'Patient name is required.'),
  email: z.string().email('Valid email is required.'),
  age: z.string().optional(),
  phNo: z.string().optional(),
  adharNo: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional()
});

export const registerDoctorSchema = z.object({
  name: z.string().min(2, 'Doctor name is required.'),
  email: z.string().email('Valid email is required.'),
  licenseId: z.string().optional(),
  age: z.string().optional(),
  phNo: z.string().optional()
});

export const requestAccessSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required.'),
  doctorId: z.string().optional(),
  reportId: z.string().optional(),
  reason: z.string().optional()
});

export const grantAccessSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required.'),
  doctorId: z.string().optional(),
  doctorAddress: z.string().optional()
});

export const revokeAccessSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required.'),
  doctorId: z.string().optional(),
  doctorAddress: z.string().optional()
});
