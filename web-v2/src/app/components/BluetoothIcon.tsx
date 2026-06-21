type BluetoothIconProps = {
  className?: string;
  size?: number;
};

export function BluetoothIcon({ className, size = 14 }: BluetoothIconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{ verticalAlign: '-2px' }}
    >
      <path
        d="M7 7L17 17L12 21V3L17 7L7 17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
