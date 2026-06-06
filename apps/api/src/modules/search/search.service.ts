import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(query: string) {
    const search = query.trim();

    const [appointments, media, patients, payments, treatments] =
      await Promise.all([
        this.prisma.appointment.findMany({
          orderBy: { startsAt: "desc" },
          select: {
            id: true,
            patient: {
              select: {
                firstName: true,
                id: true,
                lastName: true,
              },
            },
            startsAt: true,
            status: true,
            title: true,
          },
          take: 6,
          where: {
            deletedAt: null,
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
              {
                patient: {
                  is: {
                    OR: [
                      { firstName: { contains: search, mode: "insensitive" } },
                      { lastName: { contains: search, mode: "insensitive" } },
                      { code: { contains: search, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          },
        }),
        this.prisma.mediaAsset.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            label: true,
            patient: {
              select: {
                firstName: true,
                id: true,
                lastName: true,
              },
            },
            type: true,
          },
          take: 6,
          where: {
            deletedAt: null,
            OR: [
              { label: { contains: search, mode: "insensitive" } },
              { mimeType: { contains: search, mode: "insensitive" } },
              {
                patient: {
                  is: {
                    OR: [
                      { firstName: { contains: search, mode: "insensitive" } },
                      { lastName: { contains: search, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          },
        }),
        this.prisma.patient.findMany({
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: {
            code: true,
            documentId: true,
            firstName: true,
            id: true,
            lastName: true,
            phone: true,
          },
          take: 8,
          where: {
            deletedAt: null,
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { documentId: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          },
        }),
        this.prisma.payment.findMany({
          orderBy: { paidAt: "desc" },
          select: {
            amount: true,
            id: true,
            method: true,
            patient: {
              select: {
                firstName: true,
                id: true,
                lastName: true,
              },
            },
            reference: true,
            status: true,
          },
          take: 6,
          where: {
            deletedAt: null,
            OR: [
              { reference: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
              {
                patient: {
                  is: {
                    OR: [
                      { firstName: { contains: search, mode: "insensitive" } },
                      { lastName: { contains: search, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          },
        }),
        this.prisma.treatment.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            patient: {
              select: {
                firstName: true,
                id: true,
                lastName: true,
              },
            },
            status: true,
            toothNumber: true,
          },
          take: 6,
          where: {
            deletedAt: null,
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              {
                patient: {
                  is: {
                    OR: [
                      { firstName: { contains: search, mode: "insensitive" } },
                      { lastName: { contains: search, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          },
        }),
      ]);

    return [
      ...patients.map((patient) => ({
        id: patient.id,
        kind: "patient",
        patientId: patient.id,
        section: "patients",
        subtitle: [patient.code, patient.documentId, patient.phone]
          .filter(Boolean)
          .join(" · "),
        title: patientName(patient),
      })),
      ...appointments.map((appointment) => ({
        id: appointment.id,
        kind: "appointment",
        patientId: appointment.patient.id,
        section: "appointments",
        subtitle: `${patientName(appointment.patient)} · ${appointment.status}`,
        title: appointment.title,
      })),
      ...treatments.map((treatment) => ({
        id: treatment.id,
        kind: "treatment",
        patientId: treatment.patient.id,
        section: "treatments",
        subtitle: `${patientName(treatment.patient)} · ${treatment.status}${
          treatment.toothNumber ? ` · Pieza ${treatment.toothNumber}` : ""
        }`,
        title: treatment.name,
      })),
      ...payments.map((payment) => ({
        id: payment.id,
        kind: "payment",
        patientId: payment.patient.id,
        section: "billing",
        subtitle: `${patientName(payment.patient)} · ${payment.method} · ${payment.status}`,
        title: `${Number(payment.amount).toFixed(2)} USD${
          payment.reference ? ` · ${payment.reference}` : ""
        }`,
      })),
      ...media.map((asset) => ({
        id: asset.id,
        kind: "media",
        patientId: asset.patient.id,
        section: "media",
        subtitle: `${patientName(asset.patient)} · ${asset.type}`,
        title: asset.label ?? "Archivo clinico",
      })),
    ];
  }
}

function patientName(patient: { firstName: string; lastName: string }) {
  return `${patient.firstName} ${patient.lastName}`.trim();
}
