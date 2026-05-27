import appLogo from '@/assets/images/wasmdee-logo.png';

export function LogoMark({ size = 'md', className = '' }) {
  const sizeClass = {
    sm: 'size-6',
    md: 'size-8',
    lg: 'size-10',
  }[size];

  return (
    <span className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden ${className}`}>
      <img src={appLogo} alt="Wasmdee app icon" className="h-full w-full object-contain" />
    </span>
  );
}
