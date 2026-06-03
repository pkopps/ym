"use client";

type FloatingChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderLabel: string;
  isCurrentUser: boolean;
};

type FloatingChatWindowProps = {
  isOpen: boolean;
  title: string;
  subtitle: string;
  draft: string;
  launcherLabel: string;
  inputPlaceholder: string;
  messages: FloatingChatMessage[];
  busy?: boolean;
  onDraftChange: (value: string) => void;
  onOpen: () => void;
  onClose: () => void;
  onSend: () => void;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function FloatingChatWindow({
  isOpen,
  title,
  subtitle,
  draft,
  launcherLabel,
  inputPlaceholder,
  messages,
  busy,
  onDraftChange,
  onOpen,
  onClose,
  onSend
}: FloatingChatWindowProps) {
  return (
    <div className="floating-chat">
      {isOpen ? (
        <section className="floating-chat__window" aria-label={title}>
          <header className="floating-chat__header">
            <div>
              <strong>{title}</strong>
              <p>{subtitle}</p>
            </div>
            <button className="floating-chat__close" onClick={onClose} type="button">
              Close
            </button>
          </header>

          <div className="floating-chat__messages">
            {messages.length === 0 ? (
              <div className="floating-chat__empty">
                <p>Start the conversation.</p>
              </div>
            ) : (
              messages.map((message) => (
                <article
                  className={`floating-chat__message ${
                    message.isCurrentUser ? "floating-chat__message--self" : ""
                  }`}
                  key={message.id}
                >
                  <strong>{message.senderLabel}</strong>
                  <p>{message.body}</p>
                  <small>{formatDateTime(message.createdAt)}</small>
                </article>
              ))
            )}
          </div>

          <div className="floating-chat__composer">
            <textarea
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSend();
                }
              }}
              placeholder={inputPlaceholder}
              rows={3}
              value={draft}
            />
            <div className="floating-chat__actions">
              <button className="button" disabled={busy} onClick={onSend} type="button">
                {busy ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <button className="floating-chat__launcher" onClick={onOpen} type="button">
          {launcherLabel}
        </button>
      )}
    </div>
  );
}
