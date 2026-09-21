import { randomUUID } from "node:crypto";
import type { BookingEvidenceEntry, CreateServiceComplaintRequest, ReplyServiceComplaintRequest, ServiceComplaintKind, SupportTicket } from "@yardmatch/contracts";
import { HttpError } from "../http";
import { validateEvidenceImageDataUrl } from "../media/imageValidation";
import type { MarketplaceRepository } from "../repositories/MarketplaceRepository";
import { PhotoStorageService } from "./PhotoStorageService";
import { ComplaintAssessmentService } from "./ComplaintAssessmentService";

const kinds: ServiceComplaintKind[] = ["missed-visit", "incomplete-work", "quality", "property-damage", "billing"];
function text(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new HttpError(400, `${field} must contain ${min}–${max} characters.`);
  return value.trim();
}

export class ServiceComplaintService {
  constructor(private readonly repository: MarketplaceRepository, private readonly photos: PhotoStorageService) {}

  async create(customerId: string, input: CreateServiceComplaintRequest): Promise<SupportTicket> {
    if (!input || !kinds.includes(input.kind)) throw new HttpError(400, "Choose a valid problem type.");
    const bookingId = text(input.bookingId, "Booking", 1, 150);
    const description = text(input.description, "Description", 10, 2000);
    const affectedArea = text(input.affectedArea, "Affected task or area", 2, 120);
    if (!["refund", "return-visit", "help-decide"].includes(input.preferredRemedy)) throw new HttpError(400, "Choose a preferred remedy.");
    if (input.aiConsent !== undefined && typeof input.aiConsent !== "boolean") throw new HttpError(400, "Invalid AI consent.");
    if (input.photos !== undefined && (!Array.isArray(input.photos) || input.photos.length > 2)) throw new HttpError(400, "Add up to two photos.");
    const images = (input.photos ?? []).map(photo => ({ data: text(photo, "Photo", 1, 1_900_000), validated: validateEvidenceImageDataUrl(text(photo, "Photo", 1, 1_900_000)) }));
    const noPhotoReason = input.noPhotoReason ? text(input.noPhotoReason, "Photo explanation", 5, 500) : undefined;
    if (["quality", "incomplete-work"].includes(input.kind) && !images.length && !noPhotoReason) throw new HttpError(400, "Add a photo or explain why you cannot provide one.");
    const booking = await this.repository.findBookingById(bookingId);
    if (!booking || booking.customerId !== customerId) throw new HttpError(403, "You can only report problems with your own bookings.");
    if (input.kind === "missed-visit" && Date.parse(booking.scheduledEndIso) > Date.now()) throw new HttpError(400, "The service window has not ended. Use Help for an arrival update.");
    const existing = (await this.repository.listSupportTickets()).find(ticket => ticket.bookingId === bookingId && ticket.complaint?.kind === input.kind && ticket.status !== "resolved");
    if (existing) return existing;
    const id = randomUUID();
    const now = new Date().toISOString();
    const evidence: BookingEvidenceEntry[] = [];
    try {
      for (const image of images) {
        const evidenceId = randomUUID();
        const stored = await this.photos.store(bookingId, evidenceId, image.data, image.validated);
        evidence.push({ id: evidenceId, complaintTicketId: id, phase: "after", evidenceType: "photo", capturedAt: now,
          capturedByRole: "customer", capturedByUserId: customerId, photoArea: "other", note: affectedArea,
          imageDataUrl: stored.deliveryUrl, imageStorageProvider: stored.storageProvider, imageObjectPathname: stored.objectPathname,
          imageContentType: image.validated.contentType, imageByteSize: image.validated.bytes.length,
          imageWidth: image.validated.width, imageHeight: image.validated.height, marketingUseStatus: "denied" });
      }
      const ticket = await this.repository.withLock(`payment:${bookingId}`, async repository => {
        const duplicate = (await repository.listSupportTickets()).find(ticket => ticket.bookingId === bookingId && ticket.complaint?.kind === input.kind && ticket.status !== "resolved");
        if (duplicate) return duplicate;
        const current = await repository.findBookingById(bookingId);
        if (!current || current.customerId !== customerId) throw new HttpError(403, "Booking is unavailable.");
        const urgent = input.kind === "property-damage";
        const result: SupportTicket = {
          id, bookingId, requesterId: customerId, subject: `Service problem: ${input.kind.replaceAll("-", " ")}`,
          description, issueType: input.kind === "billing" ? "billing" : "service-quality", status: "open", createdAt: now, updatedAt: now,
          complaint: { kind: input.kind, affectedArea, preferredRemedy: input.preferredRemedy, noPhotoReason, evidenceIds: evidence.map(item => item.id),
            aiConsent: input.aiConsent === true, humanReviewRequested: urgent, replies: [],
            nextUpdateDueAt: new Date(Date.now() + (urgent ? 2 : 8) * 3600000).toISOString(),
            customerMessage: urgent ? "Your report is in the human incident-review queue. Keep any photos and repair records. Add further details here if needed." : "Your report is saved for review. We will compare your report with the booked work and service evidence. You can add details or request human help here. No refund has been approved yet." }
        };
        await repository.updateBooking(bookingId, { serviceEvidence: [...current.serviceEvidence, ...evidence] });
        return repository.createSupportTicket(result);
      });
      if (ticket.id !== id) await Promise.all(evidence.map(item => this.photos.remove(item).catch(() => undefined)));
      return ticket;
    } catch (error) {
      await Promise.all(evidence.map(item => this.photos.remove(item).catch(() => undefined)));
      throw error;
    }
  }

  async reply(customerId: string, input: ReplyServiceComplaintRequest): Promise<SupportTicket> {
    const message = text(input?.message, "Message", 3, 2000);
    const ticket = (await this.repository.listSupportTickets()).find(item => item.id === input.ticketId);
    if (!ticket?.complaint || ticket.requesterId !== customerId) throw new HttpError(403, "You can only update your own service reports.");
    return this.repository.withLock(`payment:${ticket.bookingId}`, async repository => {
      const current = (await repository.listSupportTickets()).find(item => item.id === ticket.id)!;
      if (current.complaint!.replies.length >= 20) throw new HttpError(409, "Please contact support directly for further updates.");
      const now = new Date().toISOString();
      return (await repository.updateSupportTicket(current.id, {
        status: "open", updatedAt: now,
        complaint: { ...current.complaint!, humanReviewRequested: current.complaint!.humanReviewRequested || input.requestHumanReview === true,
          assessment: undefined, nextUpdateDueAt: new Date(Date.now() + (current.complaint!.kind === "property-damage" ? 2 : 8) * 3600000).toISOString(),
          customerMessage: "Your update is saved. A support reviewer can see the full report and your request for help.",
          replies: [...current.complaint!.replies, { message, createdAt: now, actorUserId: customerId }] }
      }))!;
    });
  }

  async assess(ticketId: string): Promise<SupportTicket> {
    const ticket = (await this.repository.listSupportTickets()).find(item => item.id === ticketId);
    if (!ticket?.complaint || !ticket.bookingId) throw new HttpError(404, "Service report not found.");
    const booking = await this.repository.findBookingById(ticket.bookingId);
    if (!booking) throw new HttpError(404, "Booking not found.");
    const assessment = await new ComplaintAssessmentService(this.photos).assess(booking, ticket.complaint, ticket.description);
    return this.repository.withLock(`payment:${booking.id}`, async repository => {
      const current = (await repository.listSupportTickets()).find(item => item.id === ticketId)!;
      if (current.updatedAt !== ticket.updatedAt) throw new HttpError(409, "The report changed. Refresh before assessing it again.");
      return (await repository.updateSupportTicket(ticket.id, { complaint: { ...current.complaint!, assessment } }))!;
    });
  }
}
