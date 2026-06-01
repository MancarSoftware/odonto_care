export const APP_NAME = "OdontoCare";

export const LOCAL_API_DEFAULT_URL = "http://127.0.0.1:3333";

export const UPLOADS_DEFAULT_DIR = "C:/OdontoSystem/uploads";

export const USER_ROLES = ["ADMIN", "DENTIST", "RECEPTION"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const TOOTH_STATUSES = [
  "HEALTHY",
  "CARIES",
  "RESTORATION",
  "EXTRACTION",
  "IMPLANT",
  "COMPLETED_TREATMENT",
] as const;
export type ToothStatus = (typeof TOOTH_STATUSES)[number];

export type ApiEnvelope<T> = {
  data: T;
  requestId?: string;
};
