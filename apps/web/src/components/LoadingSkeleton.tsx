type LoadingSkeletonProps = {
  cardClassName?: string;
  cardCount?: number;
  className?: string;
  label: string;
  lines?: number;
  showAvatar?: boolean;
  showAction?: boolean;
};

export function LoadingSkeleton({
  cardClassName = "card",
  cardCount = 1,
  className = "stack-lg",
  label,
  lines = 3,
  showAvatar = false,
  showAction = false
}: LoadingSkeletonProps) {
  return (
    <div aria-busy="true" aria-live="polite" className={className} role="status">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: cardCount }, (_, cardIndex) => (
        <article aria-hidden="true" className={`${cardClassName} loading-skeleton-card`} key={cardIndex}>
          <div className="loading-skeleton-card__header">
            {showAvatar ? <span className="loading-skeleton loading-skeleton--avatar" /> : null}
            <div className="loading-skeleton-card__heading">
              <span className="loading-skeleton loading-skeleton--eyebrow" />
              <span className="loading-skeleton loading-skeleton--title" />
            </div>
          </div>
          <div className="loading-skeleton-card__body">
            {Array.from({ length: lines }, (_, lineIndex) => (
              <span
                className={`loading-skeleton loading-skeleton--line loading-skeleton--line-${(lineIndex % 3) + 1}`}
                key={lineIndex}
              />
            ))}
          </div>
          {showAction ? <span className="loading-skeleton loading-skeleton--action" /> : null}
        </article>
      ))}
    </div>
  );
}
