"use client";

import { AppNotification } from "@yardmatch/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { createAuthenticatedWebApiClient, StoredWebSession } from "../lib/api";

function formatRelativeDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function NotificationMenu({ session }: { session?: StoredWebSession }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const visibleNotifications = useMemo(() => notifications.slice(0, 6), [notifications]);

  async function loadNotifications() {
    if (!session) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const api = createAuthenticatedWebApiClient();
      const response = await api.getNotifications();
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load notifications.");
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, [session?.token, session?.userId]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function markAllRead() {
    if (!session || unreadCount === 0) {
      return;
    }

    try {
      setIsWorking(true);
      const api = createAuthenticatedWebApiClient();
      const response = await api.markNotificationsRead({});
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to mark notifications as read.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleNotificationClick(notification: AppNotification) {
    if (!notification.isRead) {
      try {
        setIsWorking(true);
        const api = createAuthenticatedWebApiClient();
        const response = await api.markNotificationsRead({
          notificationIds: [notification.id]
        });
        setNotifications(response.notifications);
        setUnreadCount(response.unreadCount);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to update this notification.");
      } finally {
        setIsWorking(false);
      }
    }

    if (notification.actionHref) {
      window.location.href = notification.actionHref;
    }
  }

  if (!session) {
    return null;
  }

  return (
    <div className="notification-menu" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        className="app-header__notification"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) {
            void loadNotifications();
          }
        }}
        type="button"
      >
        <span className="app-header__notification-icon" aria-hidden="true">
          &#128276;
        </span>
        {unreadCount > 0 ? <span className="app-header__notification-count">{unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="notification-menu__panel">
          <div className="notification-menu__header">
            <strong>Updates</strong>
            {unreadCount > 0 ? (
              <button
                className="notification-menu__mark-read"
                disabled={isWorking}
                onClick={() => void markAllRead()}
                type="button"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {errorMessage ? <p className="notification-menu__state">{errorMessage}</p> : null}

          {!errorMessage && visibleNotifications.length === 0 ? (
            <p className="notification-menu__state">No updates yet.</p>
          ) : null}

          <div className="notification-menu__list">
            {visibleNotifications.map((notification) => (
              <button
                className={`notification-menu__item ${notification.isRead ? "" : "notification-menu__item--unread"}`}
                key={notification.id}
                onClick={() => void handleNotificationClick(notification)}
                type="button"
              >
                <div className="notification-menu__item-copy">
                  <strong>{notification.title}</strong>
                  <span>{notification.body}</span>
                </div>
                <small>{formatRelativeDate(notification.createdAt)}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
