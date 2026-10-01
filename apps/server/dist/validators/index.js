"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeAccessSchema = exports.grantAccessSchema = exports.requestAccessSchema = exports.registerDoctorSchema = exports.registerPatientSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.changePasswordSchema = exports.loginUserSchema = exports.adminCreateUserSchema = exports.registerUserSchema = exports.ALL_ROLES = exports.PUBLIC_SIGNUP_ROLES = exports.passwordSchema = void 0;
const zod_1 = require("zod");
/**
 * Password policy: 8–72 characters (bcrypt only reads the first 72 bytes),
 * with at least one letter and one number.
 */
exports.passwordSchema = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(72, 'Password must be at most 72 characters long.')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.');
const emailSchema = zod_1.z.string().trim().email('Please enter a valid email address.').max(254);
const nameSchema = zod_1.z.string().trim().min(2, 'Name must be at least 2 characters.').max(100);
/** Roles anyone may sign up for from the public registration pages. */
exports.PUBLIC_SIGNUP_ROLES = ['patient', 'doctor'];
/** Roles only an administrator may create (organisations and other administrators). */
exports.ALL_ROLES = ['patient', 'doctor', 'hospital-admin', 'hospital', 'lab', 'insurance', 'admin', 'system-admin'];
exports.registerUserSchema = zod_1.z.object({
    email: emailSchema,
    password: exports.passwordSchema,
    role: zod_1.z.enum(exports.PUBLIC_SIGNUP_ROLES, {
        errorMap: () => ({
            message: 'Only patient and doctor accounts can be self-registered. Organisation accounts are created by an administrator.'
        })
    }),
    name: nameSchema,
    phone: zod_1.z.string().trim().max(20).optional(),
    walletAddress: zod_1.z.string().optional()
});
exports.adminCreateUserSchema = zod_1.z.object({
    email: emailSchema,
    password: exports.passwordSchema,
    role: zod_1.z.enum(exports.ALL_ROLES),
    name: nameSchema,
    phone: zod_1.z.string().trim().max(20).optional()
});
exports.loginUserSchema = zod_1.z.object({
    email: emailSchema,
    password: zod_1.z.string().min(1, 'Password is required.').max(200)
});
exports.changePasswordSchema = zod_1.z
    .object({
    currentPassword: zod_1.z.string().min(1, 'Please enter your current password.'),
    newPassword: exports.passwordSchema
})
    .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'The new password must be different from the current one.',
    path: ['newPassword']
});
exports.forgotPasswordSchema = zod_1.z.object({ email: emailSchema });
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(20, 'Invalid or expired reset link.').max(200),
    newPassword: exports.passwordSchema
});
exports.registerPatientSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Patient name is required.'),
    email: zod_1.z.string().email('Valid email is required.'),
    age: zod_1.z.string().optional(),
    phNo: zod_1.z.string().optional(),
    adharNo: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional()
});
exports.registerDoctorSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Doctor name is required.'),
    email: zod_1.z.string().email('Valid email is required.'),
    licenseId: zod_1.z.string().optional(),
    age: zod_1.z.string().optional(),
    phNo: zod_1.z.string().optional()
});
exports.requestAccessSchema = zod_1.z.object({
    patientId: zod_1.z.string().min(1, 'Patient ID is required.'),
    doctorId: zod_1.z.string().optional(),
    reportId: zod_1.z.string().optional(),
    reason: zod_1.z.string().optional()
});
exports.grantAccessSchema = zod_1.z.object({
    patientId: zod_1.z.string().min(1, 'Patient ID is required.'),
    doctorId: zod_1.z.string().optional(),
    doctorAddress: zod_1.z.string().optional()
});
exports.revokeAccessSchema = zod_1.z.object({
    patientId: zod_1.z.string().min(1, 'Patient ID is required.'),
    doctorId: zod_1.z.string().optional(),
    doctorAddress: zod_1.z.string().optional()
});
