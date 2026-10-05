import type { NotificationDeliveryRecord, NotificationOpsChannelHealth, NotificationOpsHealthResponse } from "@yardmatch/contracts";
export type NotificationHealthSnapshot = Omit<NotificationOpsHealthResponse, "generatedAt" | "alerts" | "deliveryPolicy">;
export function summarizeNotificationHealth(deliveries: NotificationDeliveryRecord[], now: number): NotificationHealthSnapshot {
  deliveries = [...deliveries].sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const last24Hours = now - 86400_000;
    const deliveriesLast24Hours = deliveries.filter((delivery) => Date.parse(delivery.createdAt) >= last24Hours);
    const failedDeliveries = deliveries.filter((delivery) => delivery.status === "failed");
    const queuedCount = deliveries.filter((delivery) => delivery.status === "queued").length;
    const pendingRetryDeliveries = failedDeliveries.filter((delivery) => Boolean(delivery.nextRetryAt));
    const overdueRetryDeliveries = pendingRetryDeliveries.filter(
      (delivery) => Date.parse(delivery.nextRetryAt as string) <= now
    );
    const exhaustedFailureCount = failedDeliveries.filter((delivery) => !delivery.nextRetryAt).length;
    const sentLast24Hours = deliveries.filter((delivery) => {
      const sentAt = delivery.sentAt ?? delivery.lastAttemptAt;
      return Boolean(sentAt) && Date.parse(sentAt as string) >= last24Hours && delivery.status === "sent";
    }).length;
    const failedLast24Hours = failedDeliveries.filter((delivery) => {
      const failedAt = delivery.lastAttemptAt ?? delivery.createdAt;
      return Date.parse(failedAt) >= last24Hours;
    }).length;
  return { totalDeliveries: deliveries.length, deliveriesLast24Hours: deliveriesLast24Hours.length,
    sentLast24Hours, failedLast24Hours, queuedCount, pendingRetryCount: pendingRetryDeliveries.length,
    overdueRetryCount: overdueRetryDeliveries.length, exhaustedFailureCount,
    channels: buildNotificationOpsChannelHealth(deliveries, now, last24Hours), recentFailures: failedDeliveries.slice(0, 8) };
}
function buildNotificationOpsChannelHealth(
    deliveries: NotificationDeliveryRecord[],
    now: number,
    last24Hours: number
  ): NotificationOpsChannelHealth[] {
    const groups = new Map<string, NotificationOpsChannelHealth>();

    for (const delivery of deliveries) {
      const key = `${delivery.channel}:${delivery.provider}`;
      const existing = groups.get(key) ?? {
        channel: delivery.channel,
        provider: delivery.provider,
        totalDeliveries: 0,
        deliveriesLast24Hours: 0,
        sentCount: 0,
        failedCount: 0,
        queuedCount: 0,
        pendingRetryCount: 0,
        overdueRetryCount: 0,
        lastAttemptAt: undefined
      };

      existing.totalDeliveries += 1;
      if (Date.parse(delivery.createdAt) >= last24Hours) {
        existing.deliveriesLast24Hours += 1;
      }
      if (delivery.status === "sent") {
        existing.sentCount += 1;
      }
      if (delivery.status === "failed") {
        existing.failedCount += 1;
      }
      if (delivery.status === "queued") {
        existing.queuedCount += 1;
      }
      if (delivery.nextRetryAt) {
        existing.pendingRetryCount += 1;
        if (Date.parse(delivery.nextRetryAt) <= now) {
          existing.overdueRetryCount += 1;
        }
      }

      const candidateAttemptAt = delivery.lastAttemptAt ?? delivery.sentAt ?? delivery.createdAt;
      if (!existing.lastAttemptAt || candidateAttemptAt > existing.lastAttemptAt) {
        existing.lastAttemptAt = candidateAttemptAt;
      }

      groups.set(key, existing);
    }

    return [...groups.values()].sort((left, right) => {
      if (right.failedCount !== left.failedCount) {
        return right.failedCount - left.failedCount;
      }
      return right.totalDeliveries - left.totalDeliveries;
    });
  }
