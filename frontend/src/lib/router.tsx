import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

export function getHashRoute(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h === '' ? '/' : h;
}

export function navigate(to: string): void {
  window.location.hash = to;
}

export function useRoute(): string {
  const [route, setRoute] = useState<string>(getHashRoute);
  useEffect(() => {
    const onChange = () => setRoute(getHashRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: ReactNode;
}

export function Link({ to, children, onClick, ...rest }: LinkProps) {
  return (
    <a {...rest} href={`#${to}`} onClick={(e) => onClick?.(e)}>
      {children}
    </a>
  );
}
