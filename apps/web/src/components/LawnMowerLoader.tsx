type LawnMowerLoaderProps = {
  className?: string;
};

export function LawnMowerLoader({ className }: LawnMowerLoaderProps) {
  return (
    <svg
      aria-hidden="true"
      className={className ? `lawn-mower-loader ${className}` : "lawn-mower-loader"}
      viewBox="0 0 160 160"
      fill="none"
    >
      <defs>
        <linearGradient id="mower-lawn-fill" x1="28" y1="24" x2="132" y2="136" gradientUnits="userSpaceOnUse">
          <stop stopColor="#dff0bf" />
          <stop offset="1" stopColor="#c7e39c" />
        </linearGradient>
        <linearGradient id="mower-body-fill" x1="0" y1="0" x2="32" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1f7b46" />
          <stop offset="1" stopColor="#155a35" />
        </linearGradient>
      </defs>

      <circle className="lawn-mower-loader__shadow" cx="80" cy="80" r="72" />
      <circle className="lawn-mower-loader__lawn" cx="80" cy="80" r="68" fill="url(#mower-lawn-fill)" />
      <circle className="lawn-mower-loader__track" cx="80" cy="80" r="50" />
      <circle className="lawn-mower-loader__track lawn-mower-loader__track--inner" cx="80" cy="80" r="32" />
      <circle className="lawn-mower-loader__hub" cx="80" cy="80" r="5" />

      <g className="lawn-mower-loader__orbit">
        <g transform="translate(80 22)">
          <g className="lawn-mower-loader__mower">
            <path
              className="lawn-mower-loader__handle"
              d="M-9 -10.5C-11.2 -16.2 -14.8 -20.9 -20.1 -24.8"
            />
            <path
              className="lawn-mower-loader__handle"
              d="M-6.2 -7.2C-8.1 -11.4 -11.3 -15.1 -15.4 -17.8"
            />
            <circle className="lawn-mower-loader__wheel" cx="-7.5" cy="0" r="5.2" />
            <circle className="lawn-mower-loader__wheel" cx="7.8" cy="0" r="5.2" />
            <rect
              className="lawn-mower-loader__deck"
              x="-13"
              y="-12"
              width="26"
              height="18"
              rx="8"
              fill="url(#mower-body-fill)"
            />
            <path className="lawn-mower-loader__deck-top" d="M-7 -7H6.5" />
            <path className="lawn-mower-loader__deck-top" d="M2.5 -3.5H9.5" />
            <circle className="lawn-mower-loader__blade-core" cx="0" cy="-3" r="3.7" />
            <g className="lawn-mower-loader__blade">
              <path d="M0 -12.2L2.4 -3H-2.4L0 -12.2Z" />
              <path d="M9.2 -3L0 -0.7V-5.3L9.2 -3Z" />
              <path d="M0 6.2L-2.4 -3H2.4L0 6.2Z" />
              <path d="M-9.2 -3L0 -5.3V-0.7L-9.2 -3Z" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
