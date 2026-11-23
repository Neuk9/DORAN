"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

type RouteTransitionLinkProps = Omit<LinkProps, "href"> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> & {
    href: string;
    children: ReactNode;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  };

/**
 * 페이지 이동 시 전역 전환 오버레이를 먼저 띄운 뒤 라우팅한다.
 * 전환 오버레이/페이드아웃은 LayoutShell에서 처리한다.
 */
export function RouteTransitionLink({
  href,
  children,
  onClick,
  ...rest
}: RouteTransitionLinkProps) {
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (rest.target === "_blank" || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    event.preventDefault();
    window.dispatchEvent(new Event("doran:route-transition"));
    window.setTimeout(() => router.push(href), 260);
  };

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
